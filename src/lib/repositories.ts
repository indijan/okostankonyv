import type { IngestBookRequest, IngestBookResult, IngestJob } from "@/lib/domain";
import { applyImprovementToKeyPointsDraft, applyImprovementToSummaryDraft } from "@/lib/ai";
import { listReadyIngestItems } from "@/lib/exam-sources";
import { queueBookIngestWithPersistence } from "@/lib/persistence";
import { generateLessonSummaries, reviewLessonSummaries } from "@/lib/summaries";
import { generateLessonQuiz } from "@/lib/quiz";
import { pilotDataset } from "@/lib/mock-data";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

const ingestJobs: IngestJob[] = [];

export async function listPilotChildren() {
  return pilotDataset.children;
}

export async function listPilotLessons() {
  return pilotDataset.lessons;
}

export async function listPilotQualityPrinciples() {
  return pilotDataset.qualityPrinciples;
}

export async function getPilotBook() {
  return pilotDataset.book;
}

export async function listPilotProgress() {
  return pilotDataset.progress;
}

export async function queuePilotBookIngest(): Promise<
  IngestBookResult & { persistenceMode: "mock" | "supabase" }
> {
  const result = await queueBookIngestWithPersistence({
    title: pilotDataset.book.title,
    subject: pilotDataset.book.subject,
    grade: pilotDataset.book.grade,
    sourceType: pilotDataset.book.sourceType,
    sourceUri: pilotDataset.book.sourceUri,
  });

  ingestJobs.unshift(result.job);

  return result;
}

export async function listIngestJobs() {
  return ingestJobs;
}

export async function queueCustomBookIngest(
  request: IngestBookRequest,
): Promise<IngestBookResult & { persistenceMode: "mock" | "supabase" }> {
  const result = await queueBookIngestWithPersistence(request);

  ingestJobs.unshift(result.job);

  return result;
}

export async function seedReadyExamIngests(options?: {
  limit?: number;
  childId?: string;
  childName?: string;
  subject?: string;
  topicTitle?: string;
  sourceGroupLabel?: string;
}) {
  const items = await listReadyIngestItems({
    childId: options?.childId,
    subject: options?.subject,
    topicTitle: options?.topicTitle,
    sourceGroupLabel: options?.sourceGroupLabel,
  });
  const implicitSingleSubblockSelection =
    !options?.limit && options?.subject && options?.topicTitle && options?.sourceGroupLabel;
  const selectedItems =
    options?.limit && options.limit > 0
      ? items.slice(0, options.limit)
      : implicitSingleSubblockSelection
        ? items.slice(0, 1)
        : items;

  const results: Array<
    (IngestBookResult & { persistenceMode: "mock" | "supabase" }) & {
        sourceLabel: string;
        sourceGroupLabel: string;
        topicTitle: string;
        subject: string;
    }
  > = [];

  for (const item of selectedItems) {
    const result = await queueBookIngestWithPersistence({
      title: options?.childName
        ? `${options.childName} - ${item.subject} - ${item.topicTitle} - ${item.sourceGroupLabel}`
        : `${item.subject} - ${item.topicTitle} - ${item.sourceGroupLabel}`,
      subject: item.subject,
      grade: item.gradeLabel,
      sourceType: item.sourceType,
      sourceUri: item.sourceUri,
      topicTitle: item.topicTitle,
      sourceGroupLabel: item.sourceGroupLabel,
      contentHint: item.contentHint,
      includePattern: item.includePattern,
      excludePattern: item.excludePattern,
    });

    ingestJobs.unshift(result.job);
    results.push({
      ...result,
      sourceLabel: item.sourceLabel,
      sourceGroupLabel: item.sourceGroupLabel,
      topicTitle: item.topicTitle,
      subject: item.subject,
    });
  }

  return results;
}

export async function generateSummariesForLessons(options?: {
  lessonId?: string;
  childName?: string;
  subject?: string;
  topicTitle?: string;
  sourceGroupLabel?: string;
  vectorStoreId?: string;
  limit?: number;
}) {
  return generateLessonSummaries({
    lessonId: options?.lessonId,
    childName: options?.childName,
    subject: options?.subject,
    topicTitle: options?.topicTitle,
    sourceGroupLabel: options?.sourceGroupLabel,
    vectorStoreId: options?.vectorStoreId,
    limit: options?.limit,
  });
}

export async function runSummaryFactCheck(options?: {
  lessonId?: string;
  childName?: string;
  subject?: string;
  topicTitle?: string;
  sourceGroupLabel?: string;
  vectorStoreId?: string;
  limit?: number;
}) {
  return reviewLessonSummaries({
    lessonId: options?.lessonId,
    childName: options?.childName,
    subject: options?.subject,
    topicTitle: options?.topicTitle,
    sourceGroupLabel: options?.sourceGroupLabel,
    vectorStoreId: options?.vectorStoreId,
    limit: options?.limit,
  });
}

export async function createSummaryJob(options?: {
  lessonId?: string;
  childName?: string;
  subject?: string;
  topicTitle?: string;
  sourceGroupLabel?: string;
  vectorStoreId?: string;
}) {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured.");
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("summary_jobs")
    .insert({
      lesson_id: options?.lessonId ?? null,
      child_name: options?.childName ?? null,
      subject: options?.subject ?? null,
      topic_title: options?.topicTitle ?? null,
      source_group_label: options?.sourceGroupLabel ?? null,
      vector_store_id: options?.vectorStoreId ?? null,
      status: "queued",
    })
    .select("id,status,requested_at,started_at,finished_at,result_count,error_message,vector_store_id")
    .single();

  if (error || !data) {
    throw new Error(`Failed to create summary job: ${error?.message}`);
  }

  return data;
}

export async function getSummaryJob(jobId: string) {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured.");
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("summary_jobs")
    .select("id,status,requested_at,started_at,finished_at,result_count,error_message,vector_store_id")
    .eq("id", jobId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load summary job: ${error.message}`);
  }

  return data;
}

export async function processSummaryJob(jobId: string) {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured.");
  }

  const supabase = createSupabaseServerClient();
  const { data: job, error: jobError } = await supabase
    .from("summary_jobs")
    .select("id,lesson_id,child_name,subject,topic_title,source_group_label,vector_store_id,status")
    .eq("id", jobId)
    .maybeSingle();

  if (jobError || !job) {
    throw new Error(`Failed to load summary job: ${jobError?.message}`);
  }

  if (job.status === "completed") {
    return getSummaryJob(jobId);
  }

  await supabase
    .from("summary_jobs")
    .update({
      status: "structuring",
      started_at: new Date().toISOString(),
      error_message: null,
    })
    .eq("id", jobId);

  try {
    const results = await generateSummariesForLessons({
      lessonId: job.lesson_id ?? undefined,
      childName: job.child_name ?? undefined,
      subject: job.subject ?? undefined,
      topicTitle: job.topic_title ?? undefined,
      sourceGroupLabel: job.source_group_label ?? undefined,
      vectorStoreId: job.vector_store_id ?? undefined,
      limit: job.lesson_id ? 1 : 2,
    });

    await supabase
      .from("summary_jobs")
      .update({
        status: "completed",
        finished_at: new Date().toISOString(),
        result_count: results.length,
        error_message: null,
      })
      .eq("id", jobId);

    return {
      ...(await getSummaryJob(jobId)),
      items: results,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ismeretlen hiba.";
    await supabase
      .from("summary_jobs")
      .update({
        status: "failed",
        finished_at: new Date().toISOString(),
        error_message: message,
      })
      .eq("id", jobId);
    throw error;
  }
}

export async function generateQuizForLessons(options?: {
  lessonId?: string;
  childName?: string;
  subject?: string;
  topicTitle?: string;
  sourceGroupLabel?: string;
  limit?: number;
}) {
  return generateLessonQuiz({
    lessonId: options?.lessonId,
    childName: options?.childName,
    subject: options?.subject,
    topicTitle: options?.topicTitle,
    sourceGroupLabel: options?.sourceGroupLabel,
    limit: options?.limit,
  });
}

export async function listRecentPersistedBooks(limit = 6) {
  if (!isSupabaseConfigured()) {
    return [];
  }

  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("books")
      .select("id,title,subject,source_type,created_at")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to load recent books: ${error.message}`);
    }

    return (data ?? []).map((book) => ({
      id: book.id,
      title: book.title,
      subject: book.subject,
      sourceType: book.source_type,
      createdAt: book.created_at,
    }));
  } catch {
    return [];
  }
}

export async function listRecentPersistedSummaries(limit = 6) {
  if (!isSupabaseConfigured()) {
    return [];
  }

  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("lesson_summaries")
      .select("id,type,content,created_at,lesson:lessons(id,title,book:books(title,subject))")
      .order("created_at", { ascending: false })
      .limit(limit * 8);

    if (error) {
      throw new Error(`Failed to load recent summaries: ${error.message}`);
    }

    const grouped = new Map<
      string,
      {
        lessonId: string;
        lessonTitle: string;
        bookTitle: string;
        subject: string;
        createdAt: string;
        items: Array<{
          id: string;
          summaryType: string;
          content: string;
          preview: string;
        }>;
      }
    >();

    for (const summary of data ?? []) {
      const lesson =
        summary.lesson && !Array.isArray(summary.lesson)
          ? summary.lesson
          : Array.isArray(summary.lesson)
            ? summary.lesson[0]
            : null;

      const lessonTitle = lesson?.title ?? "Ismeretlen lecke";
      if (
        /^(kapcsol[oó]d[oó]\s+szekci[oó]|feladatok,\s*k[eé]rd[eé]sek|k[eé]rd[eé]sek,\s*feladatok)$/i.test(
          lessonTitle,
        )
      ) {
        continue;
      }

      const lessonId = lesson?.id ?? `lesson-${summary.id}`;
      const existing = grouped.get(lessonId);

      if (!existing) {
        grouped.set(lessonId, {
          lessonId,
          lessonTitle,
          bookTitle: lesson?.book?.title ?? "Ismeretlen forrás",
          subject: lesson?.book?.subject ?? "Ismeretlen tantárgy",
          createdAt: summary.created_at,
          items: [
            {
              id: summary.id,
              summaryType: summary.type,
              content: summary.content,
              preview: summary.content.slice(0, 220),
            },
          ],
        });
        continue;
      }

      existing.items.push({
        id: summary.id,
        summaryType: summary.type,
        content: summary.content,
        preview: summary.content.slice(0, 220),
      });
      if (summary.created_at > existing.createdAt) {
        existing.createdAt = summary.created_at;
      }
    }

    return Array.from(grouped.values())
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  } catch {
    return [];
  }
}

export async function listSubjectsWithPersistedBooks() {
  if (!isSupabaseConfigured()) {
    return [];
  }

  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("books")
      .select("subject")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      throw new Error(`Failed to load persisted subjects: ${error.message}`);
    }

    return [...new Set((data ?? []).map((book) => book.subject))];
  } catch {
    return [];
  }
}

export async function listPersistedTopicBooks() {
  if (!isSupabaseConfigured()) {
    return [];
  }

  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("books")
      .select("id,title,subject,source_type,source_uri,created_at,updated_at")
      .order("created_at", { ascending: false })
      .limit(300);

    if (error) {
      throw new Error(`Failed to load persisted topic books: ${error.message}`);
    }

    return data ?? [];
  } catch {
    return [];
  }
}

export async function listPersistedTopicSummaries() {
  if (!isSupabaseConfigured()) {
    return [];
  }

  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("lesson_summaries")
      .select("id,type,content,source_mode,created_at,lesson:lessons(id,title,book:books(id,title,subject))")
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      throw new Error(`Failed to load persisted topic summaries: ${error.message}`);
    }

    return data ?? [];
  } catch {
    return [];
  }
}

export async function listPersistedSummaryReviews() {
  if (!isSupabaseConfigured()) {
    return [];
  }

  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("lesson_summary_reviews")
      .select(
        "id,summary_type,source_mode,quality_score,factuality_score,issues,improvement_notes,corrected_content,created_at,lesson:lessons(id,title,book:books(id,title,subject))",
      )
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      throw new Error(`Failed to load summary reviews: ${error.message}`);
    }

    return data ?? [];
  } catch {
    return [];
  }
}

export async function listPersistedSummaryJobs() {
  if (!isSupabaseConfigured()) {
    return [];
  }

  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("summary_jobs")
      .select(
        "id,child_name,subject,topic_title,source_group_label,lesson_id,status,requested_at,started_at,finished_at,result_count,error_message",
      )
      .order("requested_at", { ascending: false })
      .limit(500);

    if (error) {
      throw new Error(`Failed to load summary jobs: ${error.message}`);
    }

    return data ?? [];
  } catch {
    return [];
  }
}

export async function applySummaryImprovement(options: {
  lessonId: string;
  note: string;
}) {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured.");
  }

  const supabase = createSupabaseServerClient();
  const note = options.note.trim();

  if (!note) {
    throw new Error("Hiányzik a beszúrandó javítás.");
  }

  const { data: lesson, error: lessonError } = await supabase
    .from("lessons")
    .select("id,title")
    .eq("id", options.lessonId)
    .maybeSingle();

  if (lessonError || !lesson) {
    throw new Error(`Failed to load lesson: ${lessonError?.message}`);
  }

  const { data: chunks, error: chunksError } = await supabase
    .from("lesson_chunks")
    .select("cleaned_text,page_from")
    .eq("lesson_id", options.lessonId)
    .order("page_from", { ascending: true });

  if (chunksError) {
    throw new Error(`Failed to load lesson chunks: ${chunksError.message}`);
  }

  const sourceText = (chunks ?? [])
    .map((chunk) => chunk.cleaned_text?.trim() ?? "")
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 9000);

  if (!sourceText) {
    throw new Error("Nincs elérhető forrásszöveg a javítás alkalmazásához.");
  }

  const { data: summaries, error: loadError } = await supabase
    .from("lesson_summaries")
    .select("id,type,content")
    .eq("lesson_id", options.lessonId)
    .in("type", ["short_summary", "key_points"]);

  if (loadError) {
    throw new Error(`Failed to load lesson summaries: ${loadError.message}`);
  }

  const summary = summaries?.find((item) => item.type === "short_summary") ?? null;
  const keyPoints = summaries?.find((item) => item.type === "key_points") ?? null;

  if (!summary && !keyPoints) {
    throw new Error("Nem találtam javítható summaryt ehhez a leckéhez.");
  }

  if (summary) {
    const summaryDraft = await applyImprovementToSummaryDraft({
      lessonTitle: lesson.title,
      sourceText,
      currentSummary: summary.content.trim(),
      improvementNote: note,
    });

    const updatedSummary = summaryDraft.content.trim();

    const { error: summaryUpdateError } = await supabase
      .from("lesson_summaries")
      .update({ content: updatedSummary })
      .eq("id", summary.id);

    if (summaryUpdateError) {
      throw new Error(`Failed to update summary: ${summaryUpdateError.message}`);
    }
  }

  if (keyPoints) {
    const points = keyPoints.content
      .split(/\n+/)
      .map((item) => item.replace(/^[-*•]\s*/, "").trim())
      .filter(Boolean);

    const keyPointsDraft = await applyImprovementToKeyPointsDraft({
      lessonTitle: lesson.title,
      sourceText,
      currentKeyPoints: points,
      improvementNote: note,
    });

    const updatedPoints = [...new Set(
      keyPointsDraft.keyPoints
        .map((item) => item.replace(/^[-*•]\s*/, "").trim())
        .filter(Boolean),
    )];

    const { error: keyPointsUpdateError } = await supabase
      .from("lesson_summaries")
      .update({ content: updatedPoints.join("\n") })
      .eq("id", keyPoints.id);

    if (keyPointsUpdateError) {
      throw new Error(`Failed to update key points: ${keyPointsUpdateError.message}`);
    }
  }

  return { ok: true };
}

export async function applySummaryReviewCorrection(options: {
  lessonId: string;
  summaryType: "short_summary" | "key_points";
  correctedContent: string;
}) {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured.");
  }

  const supabase = createSupabaseServerClient();
  const content = options.correctedContent.trim();

  if (!content) {
    throw new Error("Hiányzik a beszúrandó javított tartalom.");
  }

  const formatSummaryLikeExisting = (incoming: string, existing: string) => {
    const boldTerms = [...existing.matchAll(/\*\*([^*]+)\*\*/g)]
      .map((match) => match[1]?.trim())
      .filter((term): term is string => Boolean(term));

    let next = incoming.replace(/\r\n/g, "\n").trim();

    for (const term of boldTerms) {
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const bolded = new RegExp(`\\*\\*\\s*${escaped}\\s*\\*\\*`, "i");
      const plain = new RegExp(`\\b${escaped}\\b`, "i");
      if (!bolded.test(next) && plain.test(next)) {
        next = next.replace(plain, `**${term}**`);
      }
    }

    if (!/\n\s*\n/.test(next)) {
      const sentences = next
        .split(/(?<=[.!?])\s+/)
        .map((item) => item.trim())
        .filter(Boolean);

      if (sentences.length > 3) {
        const chunks: string[] = [];
        for (let i = 0; i < sentences.length; i += 2) {
          chunks.push(sentences.slice(i, i + 2).join(" ").trim());
        }
        next = chunks.join("\n\n");
      }
    }

    return next.trim();
  };

  const normalizedContent =
    options.summaryType === "key_points"
      ? content
          .split(/\n+/)
          .map((item) => item.replace(/^[-*•]\s*/, "").trim())
          .filter(Boolean)
          .join("\n")
      : content;

  const { data: summaryRows, error: summaryLoadError } = await supabase
    .from("lesson_summaries")
    .select("id,type,content")
    .eq("lesson_id", options.lessonId)
    .order("created_at", { ascending: false })
    .in("type", ["short_summary", "key_points"]);

  if (summaryLoadError) {
    throw new Error(`Failed to load target summary rows: ${summaryLoadError.message}`);
  }

  if (!summaryRows || summaryRows.length === 0) {
    throw new Error("Nem találtam cél summary rekordot ehhez a beszúráshoz.");
  }

  const shortSummaryRow =
    summaryRows.find((row) => row.type === "short_summary") ?? null;
  const keyPointsRow = summaryRows.find((row) => row.type === "key_points") ?? null;

  const updates: Array<{ id: string; content: string }> = [];

  if (shortSummaryRow && options.summaryType === "short_summary") {
    const nextSummary = formatSummaryLikeExisting(
      normalizedContent,
      shortSummaryRow.content ?? "",
    );
    updates.push({ id: shortSummaryRow.id, content: nextSummary });
  }

  if (keyPointsRow && options.summaryType === "key_points") {
    updates.push({ id: keyPointsRow.id, content: normalizedContent });
  }

  for (const update of updates) {
    const { error: updateError } = await supabase
      .from("lesson_summaries")
      .update({ content: update.content })
      .eq("id", update.id);

    if (updateError) {
      throw new Error(`Failed to apply corrected summary content: ${updateError.message}`);
    }
  }
  return { ok: true, updatedRows: updates.length };
}

function buildSubblockBookTitles(input: {
  childName?: string;
  subject: string;
  topicTitle: string;
  sourceGroupLabel: string;
}) {
  const base = `${input.subject} - ${input.topicTitle} - ${input.sourceGroupLabel}`;
  return [input.childName ? `${input.childName} - ${base}` : null, base].filter(
    (value): value is string => Boolean(value),
  );
}

async function resolveSubblockLessonIds(input: {
  childName?: string;
  subject: string;
  topicTitle: string;
  sourceGroupLabel: string;
}) {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured.");
  }

  const supabase = createSupabaseServerClient();
  const titles = buildSubblockBookTitles(input);

  const { data: books, error: booksError } = await supabase
    .from("books")
    .select("id,title")
    .in("title", titles)
    .order("created_at", { ascending: false });

  if (booksError) {
    throw new Error(`Failed to load books for subblock: ${booksError.message}`);
  }

  const bookIds = (books ?? []).map((book) => book.id);
  if (bookIds.length === 0) {
    return [];
  }

  const { data: lessons, error: lessonsError } = await supabase
    .from("lessons")
    .select("id")
    .in("book_id", bookIds)
    .order("created_at", { ascending: false });

  if (lessonsError) {
    throw new Error(`Failed to load lessons for subblock: ${lessonsError.message}`);
  }

  return (lessons ?? []).map((lesson) => lesson.id);
}

async function resolveSubblockTargets(input: {
  childName?: string;
  subject: string;
  topicTitle: string;
  sourceGroupLabel: string;
}) {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured.");
  }

  const supabase = createSupabaseServerClient();
  const titles = buildSubblockBookTitles(input);

  const { data: books, error: booksError } = await supabase
    .from("books")
    .select("id,title")
    .in("title", titles)
    .order("created_at", { ascending: false });

  if (booksError) {
    throw new Error(`Failed to load books for subblock: ${booksError.message}`);
  }

  const bookIds = (books ?? []).map((book) => book.id);
  if (bookIds.length === 0) {
    return { bookIds: [] as string[], lessonIds: [] as string[] };
  }

  const { data: lessons, error: lessonsError } = await supabase
    .from("lessons")
    .select("id")
    .in("book_id", bookIds)
    .order("created_at", { ascending: false });

  if (lessonsError) {
    throw new Error(`Failed to load lessons for subblock: ${lessonsError.message}`);
  }

  return {
    bookIds,
    lessonIds: (lessons ?? []).map((lesson) => lesson.id),
  };
}

export async function clearSubblockSummaries(input: {
  childName?: string;
  subject: string;
  topicTitle: string;
  sourceGroupLabel: string;
}) {
  const lessonIds = await resolveSubblockLessonIds(input);

  if (lessonIds.length === 0) {
    return { ok: true, deletedSummaries: 0 };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("lesson_summaries")
    .delete()
    .in("lesson_id", lessonIds)
    .in("type", ["short_summary", "key_points", "child_friendly_explanation"]);

  if (error) {
    throw new Error(`Failed to clear summaries: ${error.message}`);
  }

  return { ok: true, deletedSummaries: lessonIds.length };
}

export async function clearSubblockSummaryReviews(input: {
  childName?: string;
  subject: string;
  topicTitle: string;
  sourceGroupLabel: string;
}) {
  const lessonIds = await resolveSubblockLessonIds(input);

  if (lessonIds.length === 0) {
    return { ok: true, deletedReviews: 0 };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("lesson_summary_reviews")
    .delete()
    .in("lesson_id", lessonIds)
    .in("summary_type", ["short_summary", "key_points"]);

  if (error) {
    throw new Error(`Failed to clear summary reviews: ${error.message}`);
  }

  return { ok: true, deletedReviews: lessonIds.length };
}

export async function updateSubblockSummaryContent(input: {
  childName?: string;
  subject: string;
  topicTitle: string;
  sourceGroupLabel: string;
  summaryType: "short_summary" | "key_points";
  content: string;
}) {
  const lessonIds = await resolveSubblockLessonIds(input);

  if (lessonIds.length === 0) {
    throw new Error("Nem találtam szerkeszthető summary rekordot ehhez az alblokkhoz.");
  }

  const supabase = createSupabaseServerClient();
  const normalizedContent = input.content.trim();

  if (!normalizedContent) {
    throw new Error("A tartalom nem lehet üres.");
  }

  const { error: deleteError } = await supabase
    .from("lesson_summaries")
    .delete()
    .in("lesson_id", lessonIds)
    .eq("type", input.summaryType);

  if (deleteError) {
    throw new Error(`Failed to clear old summary rows: ${deleteError.message}`);
  }

  const rows = lessonIds.map((lessonId) => ({
    lesson_id: lessonId,
    type: input.summaryType,
    content: normalizedContent,
    source_mode: "knowledge_base" as const,
    grounding_score: 80,
    factuality_score: 80,
    approved: false,
  }));

  const { error: insertError } = await supabase.from("lesson_summaries").insert(rows);

  if (insertError) {
    throw new Error(`Failed to save edited summary: ${insertError.message}`);
  }

  return { ok: true, updatedLessons: lessonIds.length };
}

export async function clearSubblockIngestData(input: {
  childName?: string;
  subject: string;
  topicTitle: string;
  sourceGroupLabel: string;
}) {
  const { bookIds, lessonIds } = await resolveSubblockTargets(input);
  if (bookIds.length === 0) {
    return { ok: true, deletedBooks: 0, deletedLessons: 0 };
  }

  const supabase = createSupabaseServerClient();

  if (lessonIds.length > 0) {
    const { error: quizError } = await supabase.from("quiz_items").delete().in("lesson_id", lessonIds);
    if (quizError) {
      throw new Error(`Failed to clear quiz items: ${quizError.message}`);
    }

    const { error: summaryReviewError } = await supabase
      .from("lesson_summary_reviews")
      .delete()
      .in("lesson_id", lessonIds);
    if (summaryReviewError) {
      throw new Error(`Failed to clear summary reviews: ${summaryReviewError.message}`);
    }

    const { error: summaryError } = await supabase.from("lesson_summaries").delete().in("lesson_id", lessonIds);
    if (summaryError) {
      throw new Error(`Failed to clear summaries: ${summaryError.message}`);
    }

    const { error: chunkError } = await supabase.from("lesson_chunks").delete().in("lesson_id", lessonIds);
    if (chunkError) {
      throw new Error(`Failed to clear chunks: ${chunkError.message}`);
    }

    const { error: lessonError } = await supabase.from("lessons").delete().in("id", lessonIds);
    if (lessonError) {
      throw new Error(`Failed to clear lessons: ${lessonError.message}`);
    }
  }

  const progressQuery = supabase.from("book_progress").delete().in("book_id", bookIds);
  const { error: progressError } = input.childName
    ? await progressQuery.eq("child_name", input.childName)
    : await progressQuery;

  if (progressError) {
    throw new Error(`Failed to clear progress: ${progressError.message}`);
  }

  const { error: ingestJobError } = await supabase.from("ingest_jobs").delete().in("book_id", bookIds);
  if (ingestJobError) {
    throw new Error(`Failed to clear ingest jobs: ${ingestJobError.message}`);
  }

  const { error: bookError } = await supabase.from("books").delete().in("id", bookIds);
  if (bookError) {
    throw new Error(`Failed to clear books: ${bookError.message}`);
  }

  return { ok: true, deletedBooks: bookIds.length, deletedLessons: lessonIds.length };
}

export async function listPersistedTopicQuizItems() {
  if (!isSupabaseConfigured()) {
    return [];
  }

  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("quiz_items")
      .select(
        "id,question,options_json,correct_answer,explanation,source_quote,source_page,created_at,lesson:lessons(id,title,book:books(id,title,subject))",
      )
      .order("created_at", { ascending: false })
      .limit(800);

    if (error) {
      throw new Error(`Failed to load persisted topic quiz items: ${error.message}`);
    }

    return data ?? [];
  } catch {
    return [];
  }
}

export async function listBookProgress(childName: string) {
  if (!isSupabaseConfigured()) {
    return [];
  }

  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("book_progress")
      .select("book_id,status,completed_at,quiz_score,quiz_total,quiz_completed_at")
      .eq("child_name", childName);

    if (error) {
      throw new Error(`Failed to load book progress: ${error.message}`);
    }

    return data ?? [];
  } catch {
    return [];
  }
}

export async function listPersistedChildren() {
  if (!isSupabaseConfigured()) {
    return [
      {
        id: "local-adam",
        name: "Ádám",
        grade: 5,
        active: true,
      },
    ];
  }

  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("children")
      .select("id,name,grade,active")
      .order("created_at", { ascending: true });

    if (error) {
      throw new Error(`Failed to load children: ${error.message}`);
    }

    const children = (data ?? [])
      .filter((child) => child.active)
      .map((child) => ({
        id: child.id,
        name: child.name,
        grade: child.grade ?? 5,
        active: child.active,
      }));

    return children.length > 0
      ? children
      : [
          {
            id: "local-adam",
            name: "Ádám",
            grade: 5,
            active: true,
          },
        ];
  } catch {
    return [
      {
        id: "local-adam",
        name: "Ádám",
        grade: 5,
        active: true,
      },
    ];
  }
}

export async function listSubjectKnowledgeBases(childId: string) {
  if (!isSupabaseConfigured()) {
    return [];
  }

  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("subject_knowledge_bases")
      .select(
        "id,child_id,subject_id,status,provider,vector_store_id,last_built_at,error_message,created_at,updated_at,files:subject_knowledge_files(id,file_name,storage_path,mime_type,file_size_bytes,processing_status,page_count,created_at)",
      )
      .eq("child_id", childId)
      .order("created_at", { ascending: true });

    if (error) {
      throw new Error(`Failed to load subject knowledge bases: ${error.message}`);
    }

    return (data ?? []).map((item) => ({
      id: item.id,
      childId: item.child_id,
      subjectId: item.subject_id,
      status: item.status,
      provider: item.provider,
      vectorStoreId: item.vector_store_id,
      lastBuiltAt: item.last_built_at,
      errorMessage: item.error_message,
      fileCount: Array.isArray(item.files) ? item.files.length : 0,
      files: Array.isArray(item.files)
        ? item.files.map((file) => ({
            id: file.id,
            fileName: file.file_name,
            storagePath: file.storage_path,
            mimeType: file.mime_type,
            fileSizeBytes: file.file_size_bytes,
            processingStatus: file.processing_status,
            pageCount: file.page_count,
            createdAt: file.created_at,
          }))
        : [],
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    }));
  } catch {
    return [];
  }
}

export async function ensureSubjectKnowledgeBase(input: { childId: string; subjectId: string }) {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured.");
  }

  const supabase = createSupabaseServerClient();
  const { data: existing, error: existingError } = await supabase
    .from("subject_knowledge_bases")
    .select("id,child_id,subject_id,status,provider,vector_store_id,last_built_at,error_message,created_at,updated_at")
    .eq("child_id", input.childId)
    .eq("subject_id", input.subjectId)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Failed to load subject knowledge base: ${existingError.message}`);
  }

  if (existing) {
    const { count: fileCount } = await supabase
      .from("subject_knowledge_files")
      .select("*", { count: "exact", head: true })
      .eq("knowledge_base_id", existing.id);

    return {
      id: existing.id,
      childId: existing.child_id,
      subjectId: existing.subject_id,
      status: existing.status,
      provider: existing.provider,
      vectorStoreId: existing.vector_store_id,
      lastBuiltAt: existing.last_built_at,
      errorMessage: existing.error_message,
      fileCount: fileCount ?? 0,
      files: [],
      createdAt: existing.created_at,
      updatedAt: existing.updated_at,
      alreadyExists: true,
    };
  }

  const { data, error } = await supabase
    .from("subject_knowledge_bases")
    .insert({
      child_id: input.childId,
      subject_id: input.subjectId,
      status: "empty",
      provider: "openai_vector_store",
    })
    .select("id,child_id,subject_id,status,provider,vector_store_id,last_built_at,error_message,created_at,updated_at")
    .single();

  if (error || !data) {
    throw new Error(`Failed to create subject knowledge base: ${error?.message}`);
  }

  return {
    id: data.id,
    childId: data.child_id,
    subjectId: data.subject_id,
    status: data.status,
    provider: data.provider,
    vectorStoreId: data.vector_store_id,
    lastBuiltAt: data.last_built_at,
    errorMessage: data.error_message,
    fileCount: 0,
    files: [],
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    alreadyExists: false,
  };
}

export async function createSubjectKnowledgeFile(input: {
  knowledgeBaseId: string;
  storagePath: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number | null;
}) {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured.");
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("subject_knowledge_files")
    .insert({
      knowledge_base_id: input.knowledgeBaseId,
      storage_path: input.storagePath,
      file_name: input.fileName,
      mime_type: input.mimeType,
      file_size_bytes: input.fileSizeBytes,
      processing_status: "uploaded",
    })
    .select("id,file_name,storage_path,mime_type,file_size_bytes,processing_status,page_count,created_at")
    .single();

  if (error || !data) {
    throw new Error(`Failed to create subject knowledge file: ${error?.message}`);
  }

  return {
    id: data.id,
    fileName: data.file_name,
    storagePath: data.storage_path,
    mimeType: data.mime_type,
    fileSizeBytes: data.file_size_bytes,
    processingStatus: data.processing_status,
    pageCount: data.page_count,
    createdAt: data.created_at,
  };
}

export async function listSubjectKnowledgeSegments(knowledgeBaseId: string) {
  if (!isSupabaseConfigured()) {
    return [];
  }

  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("subject_knowledge_segments")
      .select("id,file_id,page_number,segment_type,raw_text,cleaned_text,created_at")
      .eq("knowledge_base_id", knowledgeBaseId)
      .order("page_number", { ascending: true })
      .limit(200);

    if (error) {
      throw new Error(`Failed to load subject knowledge segments: ${error.message}`);
    }

    return (data ?? []).map((item) => ({
      id: item.id,
      fileId: item.file_id,
      pageNumber: item.page_number,
      segmentType: item.segment_type,
      rawText: item.raw_text,
      cleanedText: item.cleaned_text,
      createdAt: item.created_at,
    }));
  } catch {
    return [];
  }
}

export async function createChildProfile(input: {
  name: string;
  grade: number;
}) {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured.");
  }

  const supabase = createSupabaseServerClient();
  const currentYear = new Date().getFullYear();
  const estimatedBirthYear = currentYear - (input.grade + 6);
  const { data, error } = await supabase
    .from("children")
    .insert({
      name: input.name.trim(),
      grade: input.grade,
      birth_year: Math.max(2000, estimatedBirthYear),
      active: true,
    })
    .select("id,name,grade,active")
    .single();

  if (error || !data) {
    throw new Error(`Failed to create child: ${error?.message}`);
  }

  return data;
}

export async function createCurriculumSubject(input: { grade: number; name: string; childId: string }) {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured.");
  }

  const supabase = createSupabaseServerClient();
  const { count } = await supabase
    .from("curriculum_subjects")
    .select("*", { count: "exact", head: true })
    .eq("grade", input.grade)
    .eq("child_id", input.childId);

  const { data, error } = await supabase
    .from("curriculum_subjects")
    .insert({
      child_id: input.childId,
      grade: input.grade,
      name: input.name.trim(),
      sort_order: count ?? 0,
    })
    .select("id,grade,name,sort_order")
    .single();

  if (error || !data) {
    throw new Error(`Failed to create subject: ${error?.message}`);
  }

  return data;
}

export async function createCurriculumTopic(input: { subjectId: string; title: string }) {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured.");
  }

  const supabase = createSupabaseServerClient();
  const { count } = await supabase
    .from("curriculum_topics")
    .select("*", { count: "exact", head: true })
    .eq("subject_id", input.subjectId);

  const { data, error } = await supabase
    .from("curriculum_topics")
    .insert({
      subject_id: input.subjectId,
      title: input.title.trim(),
      sort_order: count ?? 0,
    })
    .select("id,subject_id,title,sort_order")
    .single();

  if (error || !data) {
    throw new Error(`Failed to create topic: ${error?.message}`);
  }

  return data;
}

export async function createCurriculumSubblock(input: { topicId: string; title: string }) {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured.");
  }

  const supabase = createSupabaseServerClient();
  const { count } = await supabase
    .from("curriculum_subblocks")
    .select("*", { count: "exact", head: true })
    .eq("topic_id", input.topicId);

  const { data, error } = await supabase
    .from("curriculum_subblocks")
    .insert({
      topic_id: input.topicId,
      title: input.title.trim(),
      sort_order: count ?? 0,
    })
    .select("id,topic_id,title,sort_order")
    .single();

  if (error || !data) {
    throw new Error(`Failed to create subblock: ${error?.message}`);
  }

  return data;
}

export async function updateCurriculumSubject(input: { id: string; name: string }) {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured.");
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("curriculum_subjects")
    .update({
      name: input.name.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id)
    .select("id,name")
    .single();

  if (error || !data) {
    throw new Error(`Failed to update subject: ${error?.message}`);
  }

  return data;
}

export async function updateCurriculumTopic(input: { id: string; title: string }) {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured.");
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("curriculum_topics")
    .update({
      title: input.title.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id)
    .select("id,title")
    .single();

  if (error || !data) {
    throw new Error(`Failed to update topic: ${error?.message}`);
  }

  return data;
}

export async function updateCurriculumSubblock(input: { topicId: string; title: string; nextTitle: string }) {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured.");
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("curriculum_subblocks")
    .update({
      title: input.nextTitle.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq("topic_id", input.topicId)
    .eq("title", input.title)
    .select("id,title")
    .single();

  if (error || !data) {
    throw new Error(`Failed to update subblock: ${error?.message}`);
  }

  return data;
}

export async function deleteCurriculumSubject(input: { id: string }) {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured.");
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("curriculum_subjects").delete().eq("id", input.id);

  if (error) {
    throw new Error(`Failed to delete subject: ${error.message}`);
  }

  return { deleted: true };
}

export async function deleteCurriculumTopic(input: { id: string }) {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured.");
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("curriculum_topics").delete().eq("id", input.id);

  if (error) {
    throw new Error(`Failed to delete topic: ${error.message}`);
  }

  return { deleted: true };
}

export async function deleteCurriculumSubblock(input: { topicId: string; title: string }) {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured.");
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("curriculum_subblocks")
    .delete()
    .eq("topic_id", input.topicId)
    .eq("title", input.title);

  if (error) {
    throw new Error(`Failed to delete subblock: ${error.message}`);
  }

  return { deleted: true };
}

export async function listPersistedTopicIngestDetails() {
  if (!isSupabaseConfigured()) {
    return [];
  }

  try {
    const supabase = createSupabaseServerClient();
    const { data: lessons, error: lessonsError } = await supabase
      .from("lessons")
      .select("id,title,chapter,book:books(id,title,subject,source_uri,source_type),created_at")
      .order("created_at", { ascending: false })
      .limit(500);

    if (lessonsError) {
      throw new Error(`Failed to load lessons: ${lessonsError.message}`);
    }

    const lessonIds = (lessons ?? []).map((lesson) => lesson.id);
    if (lessonIds.length === 0) {
      return [];
    }

    const { data: chunks, error: chunksError } = await supabase
      .from("lesson_chunks")
      .select("lesson_id,page_from,page_to,cleaned_text")
      .in("lesson_id", lessonIds)
      .order("page_from", { ascending: true });

    if (chunksError) {
      throw new Error(`Failed to load chunks: ${chunksError.message}`);
    }

    const chunksByLesson = new Map<string, typeof chunks>();
    for (const chunk of chunks ?? []) {
      const list = chunksByLesson.get(chunk.lesson_id) ?? [];
      list.push(chunk);
      chunksByLesson.set(chunk.lesson_id, list);
    }

    return (lessons ?? []).map((lesson) => ({
      id: lesson.id,
      bookId: lesson.book?.id ?? null,
      title: lesson.title,
      chapter: lesson.chapter,
      bookTitle: lesson.book?.title ?? "Ismeretlen forrás",
      subject: lesson.book?.subject ?? "Ismeretlen tantárgy",
      sourceUri: lesson.book?.source_uri ?? null,
      sourceType: lesson.book?.source_type ?? null,
      createdAt: lesson.created_at,
      chunks: (chunksByLesson.get(lesson.id) ?? []).slice(0, 2).map((chunk) => ({
        pageFrom: chunk.page_from,
        pageTo: chunk.page_to,
        preview: chunk.cleaned_text.slice(0, 280),
      })),
    }));
  } catch {
    return [];
  }
}

export async function requestBookReview(input: {
  childName: string;
  bookId: string;
}) {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured.");
  }

  const supabase = createSupabaseServerClient();
  const now = new Date().toISOString();
  const { error } = await supabase.from("book_progress").upsert(
    {
      child_name: input.childName,
      book_id: input.bookId,
      status: "needs_review",
      completed_at: null,
      updated_at: now,
    },
    {
      onConflict: "child_name,book_id",
    },
  );

  if (error) {
    throw new Error(`Failed to mark topic complete: ${error.message}`);
  }

  return {
    bookId: input.bookId,
    childName: input.childName,
    status: "needs_review" as const,
    completedAt: null,
  };
}

export async function approveBookCompletion(input: {
  childName: string;
  bookId: string;
}) {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured.");
  }

  const supabase = createSupabaseServerClient();
  const now = new Date().toISOString();
  const { error } = await supabase.from("book_progress").upsert(
    {
      child_name: input.childName,
      book_id: input.bookId,
      status: "completed",
      completed_at: now,
      updated_at: now,
    },
    {
      onConflict: "child_name,book_id",
    },
  );

  if (error) {
    throw new Error(`Failed to approve topic completion: ${error.message}`);
  }

  return {
    bookId: input.bookId,
    childName: input.childName,
    status: "completed" as const,
    completedAt: now,
  };
}

export async function resetBookCompletion(input: {
  childName: string;
  bookId: string;
}) {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured.");
  }

  const supabase = createSupabaseServerClient();
  const now = new Date().toISOString();
  const { error } = await supabase.from("book_progress").upsert(
    {
      child_name: input.childName,
      book_id: input.bookId,
      status: "in_progress",
      completed_at: null,
      updated_at: now,
    },
    {
      onConflict: "child_name,book_id",
    },
  );

  if (error) {
    throw new Error(`Failed to reset topic completion: ${error.message}`);
  }

  return {
    bookId: input.bookId,
    childName: input.childName,
    status: "in_progress" as const,
    completedAt: null,
  };
}

export async function saveBookQuizResult(input: {
  childName: string;
  bookId: string;
  score: number;
  total: number;
}) {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured.");
  }

  const supabase = createSupabaseServerClient();
  const now = new Date().toISOString();
  const { error } = await supabase.from("book_progress").upsert(
    {
      child_name: input.childName,
      book_id: input.bookId,
      status: "in_progress",
      quiz_score: input.score,
      quiz_total: input.total,
      quiz_completed_at: now,
      updated_at: now,
    },
    {
      onConflict: "child_name,book_id",
    },
  );

  if (error) {
    throw new Error(`Failed to save quiz result: ${error.message}`);
  }

  return {
    bookId: input.bookId,
    childName: input.childName,
    status: "saved" as const,
    score: input.score,
    total: input.total,
    completedAt: now,
  };
}
