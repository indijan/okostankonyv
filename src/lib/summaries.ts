import { AppError } from "@/lib/errors";
import {
  generateLessonKeyPointsDraft,
  generateLessonSummaryDraft,
  type SummarySourceMode,
  reviewLessonSummaryDraft,
} from "@/lib/ai";
import { createOpenAiServerClient, isOpenAiConfigured } from "@/lib/openai/server";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

type GenerateLessonSummariesOptions = {
  lessonId?: string;
  childName?: string;
  subject?: string;
  topicTitle?: string;
  sourceGroupLabel?: string;
  vectorStoreId?: string;
  limit?: number;
};

type LessonRow = {
  id: string;
  title: string;
  chapter: string;
  book: {
    subject: string;
    title: string;
  } | null;
};

type LessonSummaryInsert = Database["public"]["Tables"]["lesson_summaries"]["Insert"];
type BookRow = Database["public"]["Tables"]["books"]["Row"];
type LessonInsert = Database["public"]["Tables"]["lessons"]["Insert"];

type VectorStoreSearchResult = {
  filename: string;
  score: number;
  content: Array<{ type: "text"; text: string }>;
};

function isSkippableLessonTitle(value: string) {
  return [
    /^(kapcsol[oó]d[oó]\s+szekci[oó]|feladatok,\s*k[eé]rd[eé]sek|k[eé]rd[eé]sek,\s*feladatok|munkaf[uü]zeti\s+feladatok|tov[aá]bbi\s+okosfeladatok)$/i,
    /^form[aá]zott\s+sz[oö]veg(?:\s+szekci[oó])?$/i,
    /^kifut[oó]\s+c[ií]msor(?:\s+szekci[oó])?$/i,
    /^defin[ií]ci[oó]\s+szekci[oó](?:\s+v[eé]ge)?$/i,
    /^vers\s+szekci[oó](?:\s+v[eé]ge)?$/i,
    /szekci[oó]\s+v[eé]ge$/i,
  ].some((pattern) => pattern.test(value.trim()));
}

function buildKnowledgeSearchQuery(input: {
  lessonTitle: string;
  lessonChapter: string;
  subject: string;
  topicTitle?: string;
  sourceGroupLabel?: string;
  childName?: string;
}) {
  return [
    input.childName,
    input.subject,
    input.topicTitle,
    input.sourceGroupLabel,
    input.lessonTitle,
    input.lessonChapter,
  ]
    .filter((value): value is string => Boolean(value && value.trim()))
    .join(" ");
}

function buildSubblockBookTitle(input: {
  childName?: string;
  subject: string;
  topicTitle: string;
  sourceGroupLabel: string;
}) {
  const base = `${input.subject} - ${input.topicTitle} - ${input.sourceGroupLabel}`;
  return input.childName ? `${input.childName} - ${base}` : base;
}

async function ensureSubblockLesson(input: {
  supabase: ReturnType<typeof createSupabaseServerClient>;
  childName?: string;
  subject: string;
  topicTitle: string;
  sourceGroupLabel: string;
  vectorStoreId: string;
}): Promise<LessonRow> {
  const bookTitle = buildSubblockBookTitle({
    childName: input.childName,
    subject: input.subject,
    topicTitle: input.topicTitle,
    sourceGroupLabel: input.sourceGroupLabel,
  });

  const { data: existingBooks, error: booksError } = await input.supabase
    .from("books")
    .select("id,title,subject")
    .eq("title", bookTitle)
    .order("created_at", { ascending: false })
    .limit(1);

  if (booksError) {
    throw new Error(`Failed to load summary book: ${booksError.message}`);
  }

  let book: Pick<BookRow, "id" | "title" | "subject"> | null = existingBooks?.[0] ?? null;

  if (!book) {
    const { data: insertedBook, error: insertBookError } = await input.supabase
      .from("books")
      .insert({
        title: bookTitle,
        subject: input.subject,
        grade: "5",
        source_type: "uploaded_pdf",
        source_uri: `knowledge-base:${input.vectorStoreId}`,
      })
      .select("id,title,subject")
      .single();

    if (insertBookError || !insertedBook) {
      throw new Error(`Failed to create summary book: ${insertBookError?.message}`);
    }

    book = insertedBook;
  }

  const { data: existingLessons, error: lessonsError } = await input.supabase
    .from("lessons")
    .select("id,title,chapter,book:books(subject,title)")
    .eq("book_id", book.id)
    .eq("title", input.sourceGroupLabel)
    .order("created_at", { ascending: false })
    .limit(1);

  if (lessonsError) {
    throw new Error(`Failed to load summary lesson: ${lessonsError.message}`);
  }

  const existingLesson = (existingLessons?.[0] as LessonRow | undefined) ?? null;

  if (existingLesson) {
    return existingLesson;
  }

  const { data: orderRows, error: orderError } = await input.supabase
    .from("lessons")
    .select("lesson_order")
    .eq("book_id", book.id)
    .order("lesson_order", { ascending: false })
    .limit(1);

  if (orderError) {
    throw new Error(`Failed to load lesson order: ${orderError.message}`);
  }

  const nextLessonOrder = Math.max(1, (orderRows?.[0]?.lesson_order ?? 0) + 1);

  const lessonRow: LessonInsert = {
    book_id: book.id,
    title: input.sourceGroupLabel,
    chapter: input.topicTitle,
    lesson_order: nextLessonOrder,
    goal: "Tantárgyi PDF tudásbázisból generált összefoglaló.",
    status: "structuring",
  };

  const { data: insertedLesson, error: insertLessonError } = await input.supabase
    .from("lessons")
    .insert(lessonRow)
    .select("id,title,chapter,book:books(subject,title)")
    .single();

  if (insertLessonError || !insertedLesson) {
    throw new Error(`Failed to create summary lesson: ${insertLessonError?.message}`);
  }

  return insertedLesson as LessonRow;
}

async function searchKnowledgeBaseSourceText(input: {
  vectorStoreId: string;
  query: string;
  maxResults: number;
  charLimit?: number;
}) {
  if (!isOpenAiConfigured()) {
    return "";
  }

  const client = createOpenAiServerClient();
  const response = (await client.vectorStores.search(input.vectorStoreId, {
    query: input.query,
    max_num_results: input.maxResults,
    ranking_options: {
      ranker: "default-2024-11-15",
      score_threshold: 0,
    },
    rewrite_query: true,
  })) as { data?: VectorStoreSearchResult[] };

  const normalize = (value: string) => value.replace(/\s+/g, " ").trim();

  const normalized = (response.data ?? [])
    .flatMap((item) =>
      item.content
        .map((entry) => entry.text)
        .filter((text) => typeof text === "string" && text.trim().length > 0)
        .map((text) => normalize(text)),
    )
    .filter(Boolean);

  return [...new Set(normalized)].join("\n\n").slice(0, input.charLimit ?? 12000);
}

async function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), ms);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

function sanitizeGeneratedParagraphs(text: string) {
  return text
    .split(/\n{2,}|\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .filter(
      (line) =>
        !/^(a sz[oö]veg szerint|ebben a r[eé]szben|ez a r[eé]sz|a lecke bemutatja|a tananyag bemutatja)\b/i.test(
          line,
        ),
    )
    .filter(
      (line) =>
        !/^(besz[eé]lj[eé]tek meg|v[aá]laszolj|oldd meg|figyeld meg|nevezd meg|rajzold le|gy[uű]jtsd|keresd meg|p[aá]ros[ií]tsd|eg[eé]sz[ií]tsd ki|dolgozzatok)\b/i.test(
          line,
        ),
    )
    .filter((line) => !/^forr[aá]s/i.test(line));
}

function sanitizeSummary(text: string) {
  const lines = sanitizeGeneratedParagraphs(text);
  return [...new Set(lines)].join("\n\n").trim();
}

function sanitizeKeyPoints(points: string[]) {
  return [...new Set(
    points
      .map((point) => point.replace(/^[-*•]\s*/, "").replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .filter(
        (point) =>
          !/^(a sz[oö]veg szerint|ebben a r[eé]szben|ez a r[eé]sz|a lecke bemutatja|a tananyag bemutatja)\b/i.test(
            point,
          ),
      )
      .filter(
        (point) =>
          !/^(besz[eé]lj[eé]tek meg|v[aá]laszolj|oldd meg|figyeld meg|nevezd meg|rajzold le|gy[uű]jtsd|keresd meg|p[aá]ros[ií]tsd|eg[eé]sz[ií]tsd ki|dolgozzatok)\b/i.test(
            point,
          ),
      ),
  )].slice(0, 7);
}

async function generateStableSummaryDraft(input: {
  lessonTitle: string;
  sourceText: string;
  keyPoints: string[];
}) {
  return withTimeout(
    generateLessonSummaryDraft(input),
    55000,
    "A summary generalása túl sokáig tartott ennél a leckénél.",
  );
}

export async function generateLessonSummaries(options: GenerateLessonSummariesOptions = {}) {
  if (!isSupabaseConfigured()) {
    throw new AppError(
      "SUPABASE_NOT_CONFIGURED",
      "A summary generalashoz Supabase kapcsolat kell.",
    );
  }

  const supabase = createSupabaseServerClient();
  let lessonQuery = supabase
    .from("lessons")
    .select("id,title,chapter,book:books(subject,title)")
    .order("created_at", { ascending: false });

  if (options.lessonId) {
    lessonQuery = lessonQuery.eq("id", options.lessonId);
  }

  if (options.subject) {
    lessonQuery = lessonQuery.eq("book.subject", options.subject);
  }

  if (options.limit && options.limit > 0) {
    lessonQuery = lessonQuery.limit(options.limit);
  }

  const { data: lessons, error: lessonsError } = await lessonQuery;

  if (lessonsError) {
    throw new Error(`Failed to load lessons: ${lessonsError.message}`);
  }

  if (!options.vectorStoreId) {
    throw new AppError("MISSING_VECTOR_STORE", "A summaryhoz tantárgyi vector store kell.");
  }

  const filteredLessons = ((lessons ?? []) as LessonRow[]).filter((lesson) => {
    if (!lesson.book) {
      return false;
    }

    if (isSkippableLessonTitle(lesson.title)) {
      return false;
    }

    if (options.sourceGroupLabel && options.topicTitle) {
      const titles = [
        `${lesson.book.subject} - ${options.topicTitle} - ${options.sourceGroupLabel}`,
        options.childName
          ? `${options.childName} - ${lesson.book.subject} - ${options.topicTitle} - ${options.sourceGroupLabel}`
          : null,
      ].filter(Boolean);
      return titles.includes(lesson.book.title);
    }

    if (options.topicTitle) {
      return lesson.book.title === `${lesson.book.subject} - ${options.topicTitle}`;
    }

    return true;
  });

  const boundedLessons =
    options.sourceGroupLabel && options.topicTitle
      ? filteredLessons.slice(0, 2)
      : filteredLessons;

  if (
    boundedLessons.length === 0 &&
    options.subject &&
    options.topicTitle &&
    options.sourceGroupLabel
  ) {
    const syntheticLesson = await ensureSubblockLesson({
      supabase,
      childName: options.childName,
      subject: options.subject,
      topicTitle: options.topicTitle,
      sourceGroupLabel: options.sourceGroupLabel,
      vectorStoreId: options.vectorStoreId,
    });

    boundedLessons.push(syntheticLesson);
  }

  if (boundedLessons.length === 0) {
    throw new AppError(
      "NO_FACTCHECK_TARGET",
      "Nem találtam fact-check cél leckét ehhez az alblokkhoz.",
    );
  }

  if (
    boundedLessons.length === 0 &&
    options.subject &&
    options.topicTitle &&
    options.sourceGroupLabel
  ) {
    const syntheticLesson = await ensureSubblockLesson({
      supabase,
      childName: options.childName,
      subject: options.subject,
      topicTitle: options.topicTitle,
      sourceGroupLabel: options.sourceGroupLabel,
      vectorStoreId: options.vectorStoreId,
    });

    boundedLessons.push(syntheticLesson);
  }

  if (boundedLessons.length === 0) {
    throw new AppError(
      "NO_SUMMARY_TARGET",
      "Nem találtam summary-cél leckét ehhez az alblokkhoz.",
    );
  }

  const results: Array<{
    lessonId: string;
    lessonTitle: string;
    subject: string | null;
    sourceMode: SummarySourceMode;
    summaryMode: "openai" | "disabled";
    explanationMode: "openai" | "disabled";
    keyPointsMode: "openai" | "disabled";
    summaryLength: number;
    explanationLength: number;
    summaryContent: string;
    explanationContent: string;
    keyPointsContent: string[];
  }> = [];
  let lastError: Error | null = null;

  for (const lesson of boundedLessons) {
    try {
      const sourceText = await searchKnowledgeBaseSourceText({
        vectorStoreId: options.vectorStoreId,
        query: buildKnowledgeSearchQuery({
          lessonTitle: lesson.title,
          lessonChapter: lesson.chapter,
          subject: lesson.book?.subject ?? "",
          topicTitle: options.topicTitle,
          sourceGroupLabel: options.sourceGroupLabel,
          childName: options.childName,
        }),
        maxResults: options.sourceGroupLabel && options.topicTitle ? 6 : 8,
      });

      if (!sourceText) {
        throw new Error(`Nem találtam releváns anyagot a vector store-ban ehhez: ${lesson.title}.`);
      }

      const keyPointsDraft = await withTimeout(
        generateLessonKeyPointsDraft({
          lessonTitle: lesson.title,
          sourceText,
        }),
        35000,
        "A vázlatos kivonat generalása túl sokáig tartott ennél a leckénél.",
      );

      const cleanedKeyPoints = sanitizeKeyPoints(keyPointsDraft.keyPoints);

      if (cleanedKeyPoints.length === 0) {
        throw new Error("A vázlatos kivonat ures lett ennél a leckénél.");
      }

      const summaryDraft = await generateStableSummaryDraft({
        lessonTitle: lesson.title,
        sourceText,
        keyPoints: cleanedKeyPoints,
      });

      const cleanedDraftSummary = sanitizeSummary(summaryDraft.summary);

      if (!cleanedDraftSummary) {
        throw new Error("Az összefoglaló ures lett ennél a leckénél.");
      }

      const { error: deleteError } = await supabase
        .from("lesson_summaries")
        .delete()
        .eq("lesson_id", lesson.id)
        .in("type", ["short_summary", "child_friendly_explanation", "key_points"]);

      if (deleteError) {
        throw new Error(`Failed to clear old summaries: ${deleteError.message}`);
      }

      const summaryRows: LessonSummaryInsert[] = [
        {
          lesson_id: lesson.id,
          type: "short_summary",
          content: cleanedDraftSummary,
          source_mode: "knowledge_base",
          grounding_score: summaryDraft.mode === "openai" ? 70 : 0,
          factuality_score: summaryDraft.mode === "openai" ? 70 : 0,
          approved: false,
        },
        {
          lesson_id: lesson.id,
          type: "key_points",
          content: cleanedKeyPoints.join("\n"),
          source_mode: "knowledge_base",
          grounding_score: keyPointsDraft.mode === "openai" ? 70 : 0,
          factuality_score: keyPointsDraft.mode === "openai" ? 70 : 0,
          approved: false,
        },
      ];

      const { error: insertError } = await supabase.from("lesson_summaries").insert(summaryRows);

      if (insertError) {
        throw new Error(`Failed to insert lesson summaries: ${insertError.message}`);
      }

      await supabase
        .from("lessons")
        .update({ status: "structuring" })
        .eq("id", lesson.id);

      results.push({
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        subject: lesson.book?.subject ?? null,
        sourceMode: "knowledge_base",
        summaryMode: summaryDraft.mode,
        explanationMode: "disabled",
        keyPointsMode: keyPointsDraft.mode,
        summaryLength: cleanedDraftSummary.length,
        explanationLength: 0,
        summaryContent: cleanedDraftSummary,
        explanationContent: "",
        keyPointsContent: cleanedKeyPoints,
      });
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Ismeretlen summary hiba.");
    }
  }

  if (results.length === 0 && lastError) {
    throw lastError;
  }

  if (results.length === 0) {
    throw new AppError(
      "NO_FACTCHECK_TARGET",
      "Nincs ellenőrizhető összefoglaló ehhez az alblokkhoz.",
    );
  }

  return results;
}

export async function reviewLessonSummaries(options: GenerateLessonSummariesOptions = {}) {
  if (!isSupabaseConfigured()) {
    throw new AppError("SUPABASE_NOT_CONFIGURED", "A fact checkhez Supabase kapcsolat kell.");
  }

  const supabase = createSupabaseServerClient();
  let lessonQuery = supabase
    .from("lessons")
    .select("id,title,chapter,book:books(subject,title)")
    .order("created_at", { ascending: false });

  if (options.lessonId) {
    lessonQuery = lessonQuery.eq("id", options.lessonId);
  }

  if (options.subject) {
    lessonQuery = lessonQuery.eq("book.subject", options.subject);
  }

  if (options.limit && options.limit > 0) {
    lessonQuery = lessonQuery.limit(options.limit);
  }

  const { data: lessons, error: lessonsError } = await lessonQuery;

  if (lessonsError) {
    throw new Error(`Failed to load lessons: ${lessonsError.message}`);
  }

  if (!options.vectorStoreId) {
    throw new AppError("MISSING_VECTOR_STORE", "A fact checkhez tantárgyi vector store kell.");
  }

  const filteredLessons = ((lessons ?? []) as LessonRow[]).filter((lesson) => {
    if (!lesson.book) {
      return false;
    }

    if (isSkippableLessonTitle(lesson.title)) {
      return false;
    }

    if (options.sourceGroupLabel && options.topicTitle) {
      const titles = [
        `${lesson.book.subject} - ${options.topicTitle} - ${options.sourceGroupLabel}`,
        options.childName
          ? `${options.childName} - ${lesson.book.subject} - ${options.topicTitle} - ${options.sourceGroupLabel}`
          : null,
      ].filter(Boolean);
      return titles.includes(lesson.book.title);
    }

    if (options.topicTitle) {
      return lesson.book.title === `${lesson.book.subject} - ${options.topicTitle}`;
    }

    return true;
  });

  const boundedLessons =
    options.sourceGroupLabel && options.topicTitle
      ? filteredLessons.slice(0, 2)
      : filteredLessons;

  const results: Array<{
    lessonId: string;
    lessonTitle: string;
    summaryType: "short_summary" | "key_points";
    sourceMode: SummarySourceMode;
    qualityScore: number;
    factualityScore: number;
    issues: string[];
    improvementNotes: string[];
    correctedContent: string;
    createdAt: string;
  }> = [];

  for (const lesson of boundedLessons) {
    const sourceText = await searchKnowledgeBaseSourceText({
      vectorStoreId: options.vectorStoreId,
      query: buildKnowledgeSearchQuery({
        lessonTitle: lesson.title,
        lessonChapter: lesson.chapter,
        subject: lesson.book?.subject ?? "",
        topicTitle: options.topicTitle,
        sourceGroupLabel: options.sourceGroupLabel,
        childName: options.childName,
      }),
      maxResults: options.sourceGroupLabel && options.topicTitle ? 4 : 6,
      charLimit: 7000,
    });

    if (!sourceText) {
      throw new Error(`Nem találtam releváns anyagot a vector store-ban ehhez: ${lesson.title}.`);
    }

    const { data: summaries, error: summariesError } = await supabase
      .from("lesson_summaries")
      .select("type,content")
      .eq("lesson_id", lesson.id)
      .in("type", ["short_summary", "key_points"]);

    if (summariesError) {
      throw new Error(`Failed to load lesson summaries: ${summariesError.message}`);
    }

    const reviewTargets = (summaries ?? []).filter(
      (summary): summary is { type: "short_summary" | "key_points"; content: string } =>
        (summary.type === "short_summary" || summary.type === "key_points") &&
        Boolean(summary.content?.trim()),
    );

    if (reviewTargets.length === 0) {
      continue;
    }

    const { error: deleteError } = await supabase
      .from("lesson_summary_reviews")
      .delete()
      .eq("lesson_id", lesson.id)
      .in(
        "summary_type",
        reviewTargets.map((item) => item.type),
      );

    if (deleteError) {
      throw new Error(`Failed to clear old summary reviews: ${deleteError.message}`);
    }

    for (const target of reviewTargets) {
      const reviewDraft = await withTimeout(
        reviewLessonSummaryDraft({
          lessonTitle: lesson.title,
          sourceText,
          summaryType: target.type,
          draftContent: target.content,
          sourceTextLimit: 4200,
          draftContentLimit: 1800,
        }),
        120000,
        "A fact check túl sokáig tartott ennél a leckénél.",
      );

      const correctedContent =
        target.type === "key_points"
          ? sanitizeKeyPoints(
              reviewDraft.review.correctedContent
                .split(/\n+/)
                .map((item) => item.replace(/^[-*•]\s*/, "").trim()),
            ).join("\n")
          : sanitizeSummary(reviewDraft.review.correctedContent);

      const createdAt = new Date().toISOString();

      const { error: insertError } = await supabase.from("lesson_summary_reviews").insert({
        lesson_id: lesson.id,
        summary_type: target.type,
        source_mode: "knowledge_base",
        quality_score: reviewDraft.review.qualityScore,
        factuality_score: reviewDraft.review.factualityScore,
        issues: reviewDraft.review.issues,
        improvement_notes: reviewDraft.review.improvementNotes,
        corrected_content: correctedContent || target.content,
      });

      if (insertError) {
        throw new Error(`Failed to insert summary review: ${insertError.message}`);
      }

      results.push({
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        summaryType: target.type,
        sourceMode: "knowledge_base",
        qualityScore: reviewDraft.review.qualityScore,
        factualityScore: reviewDraft.review.factualityScore,
        issues: reviewDraft.review.issues,
        improvementNotes: reviewDraft.review.improvementNotes,
        correctedContent: correctedContent || target.content,
        createdAt,
      });
    }
  }

  return results;
}
