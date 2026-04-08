import { AppError } from "@/lib/errors";
import { generateLessonQuizDraft } from "@/lib/ai";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

type GenerateLessonQuizOptions = {
  lessonId?: string;
  childName?: string;
  subject?: string;
  topicTitle?: string;
  sourceGroupLabel?: string;
  limit?: number;
};

type LessonChunkRow = {
  cleaned_text: string;
  page_from: number;
};

type LessonRow = {
  id: string;
  title: string;
  book: {
    subject: string;
    title: string;
  } | null;
};

type LessonSummaryRow = {
  type: "short_summary" | "child_friendly_explanation" | "key_points";
  content: string;
};

function buildSourceText(chunks: LessonChunkRow[]) {
  return chunks
    .sort((a, b) => a.page_from - b.page_from)
    .map((chunk) => chunk.cleaned_text.trim())
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 15000);
}

function buildQuizSourceText(summaries: LessonSummaryRow[], chunks: LessonChunkRow[]) {
  const keyPoints = summaries
    .filter((summary) => summary.type === "key_points")
    .flatMap((summary) =>
      summary.content
        .split(/\n+/)
        .map((item) => item.replace(/^[-*•]\s*/, "").trim())
        .filter(Boolean),
    );

  const summaryText = summaries
    .filter((summary) => summary.type === "short_summary")
    .map((summary) => summary.content.trim())
    .filter(Boolean);

  const combined = [...keyPoints, ...summaryText].join("\n\n").trim();
  if (combined) {
    return combined.slice(0, 12000);
  }

  return buildSourceText(chunks).slice(0, 12000);
}

export async function generateLessonQuiz(options: GenerateLessonQuizOptions = {}) {
  if (!isSupabaseConfigured()) {
    throw new AppError("SUPABASE_NOT_CONFIGURED", "A kvízgeneráláshoz Supabase kapcsolat kell.");
  }

  const supabase = createSupabaseServerClient();
  let lessonQuery = supabase
    .from("lessons")
    .select("id,title,book:books(subject,title)")
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

  const filteredLessons = ((lessons ?? []) as LessonRow[]).filter((lesson) => {
    if (!lesson.book) {
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

  const results: Array<{
    lessonId: string;
    lessonTitle: string;
    subject: string | null;
    mode: "openai" | "disabled";
    items: Array<{
      question: string;
      options: string[];
      correctAnswer: string;
      explanation: string;
      sourceQuote: string;
      sourcePage: number;
    }>;
  }> = [];

  for (const lesson of filteredLessons) {
    const { data: chunks, error: chunksError } = await supabase
      .from("lesson_chunks")
      .select("cleaned_text,page_from")
      .eq("lesson_id", lesson.id)
      .order("page_from", { ascending: true });

    if (chunksError) {
      throw new Error(`Failed to load lesson chunks: ${chunksError.message}`);
    }

    const { data: summaries, error: summariesError } = await supabase
      .from("lesson_summaries")
      .select("type,content")
      .eq("lesson_id", lesson.id)
      .in("type", ["short_summary", "key_points"]);

    if (summariesError) {
      throw new Error(`Failed to load lesson summaries: ${summariesError.message}`);
    }

    const sourceText = buildQuizSourceText(
      (summaries ?? []) as LessonSummaryRow[],
      (chunks ?? []) as LessonChunkRow[],
    );
    if (!sourceText) {
      continue;
    }

    const quizDraft = await generateLessonQuizDraft({
      lessonTitle: lesson.title,
      sourceText,
    });

    const items = quizDraft.items.slice(0, 4);
    if (items.length === 0) {
      continue;
    }

    const { error: deleteError } = await supabase.from("quiz_items").delete().eq("lesson_id", lesson.id);
    if (deleteError) {
      throw new Error(`Failed to clear old quiz items: ${deleteError.message}`);
    }

    const { error: insertError } = await supabase.from("quiz_items").insert(
      items.map((item) => ({
        lesson_id: lesson.id,
        question: item.question.trim(),
        options_json: item.options,
        correct_answer: item.correctAnswer.trim(),
        explanation: item.explanation.trim(),
        source_quote: item.sourceQuote.trim(),
        source_page: item.sourcePage,
        grounding_score: quizDraft.mode === "openai" ? 70 : 0,
        factuality_score: quizDraft.mode === "openai" ? 70 : 0,
        approved: false,
      })),
    );

    if (insertError) {
      throw new Error(`Failed to insert quiz items: ${insertError.message}`);
    }

    await supabase.from("lessons").update({ status: "completed" }).eq("id", lesson.id);

    results.push({
      lessonId: lesson.id,
      lessonTitle: lesson.title,
      subject: lesson.book?.subject ?? null,
      mode: quizDraft.mode,
      items,
    });
  }

  return results;
}
