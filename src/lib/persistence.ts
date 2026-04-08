import type { IngestBookRequest, IngestBookResult, IngestJob, Lesson } from "@/lib/domain";
import { queueBookIngest } from "@/lib/ingest";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

function mapLessonStatusToDbStatus(
  status: Lesson["status"],
): "queued" | "extracting" | "structuring" | "completed" | "failed" {
  switch (status) {
    case "approved":
      return "completed";
    case "explanation":
    case "quiz":
    case "summary":
      return "structuring";
    case "ingest":
      return "queued";
  }
}

function mapDbStatusToJobStatus(
  status: "queued" | "extracting" | "structuring" | "completed" | "failed",
): IngestJob["status"] {
  return status;
}

function buildChunkRows(
  lessonIdsByOrder: Map<number, string>,
  chunkCandidates: IngestBookResult["chunkCandidates"],
) {
  if (lessonIdsByOrder.size === 0) {
    return [];
  }

  return chunkCandidates
    .map((chunk) => {
      const lessonId = lessonIdsByOrder.get(chunk.lessonOrder);

      if (!lessonId) {
        return null;
      }

      return {
        lesson_id: lessonId,
        page_from: chunk.pageFrom,
        page_to: chunk.pageTo,
        raw_text: chunk.rawText,
        cleaned_text: chunk.cleanedText,
        embedding: null,
      };
    })
    .filter((value) => value !== null);
}

async function getOrCreateCanonicalBook(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  result: IngestBookResult,
) {
  const { data: existingBooks, error: existingBooksError } = await supabase
    .from("books")
    .select("id,title,subject,grade,source_type,source_uri,created_at,updated_at")
    .eq("title", result.book.title)
    .order("created_at", { ascending: false });

  if (existingBooksError) {
    throw new Error(`Failed to load existing books: ${existingBooksError.message}`);
  }

  const canonicalBook = existingBooks?.[0] ?? null;

  if (!canonicalBook) {
    const { data: insertedBook, error: bookError } = await supabase
      .from("books")
      .insert({
        title: result.book.title,
        subject: result.book.subject,
        grade: result.book.grade,
        source_type: result.book.sourceType,
        source_uri: result.book.sourceUri,
      })
      .select()
      .single();

    if (bookError || !insertedBook) {
      throw new Error(`Failed to insert book: ${bookError?.message}`);
    }

    return insertedBook;
  }

  const duplicateBookIds = (existingBooks ?? []).slice(1).map((book) => book.id);

  if (duplicateBookIds.length > 0) {
    const { data: duplicateProgressRows, error: duplicateProgressError } = await supabase
      .from("book_progress")
      .select("child_name,status,completed_at,quiz_score,quiz_total,quiz_completed_at,created_at,updated_at")
      .in("book_id", duplicateBookIds)
      .order("updated_at", { ascending: false });

    if (duplicateProgressError) {
      throw new Error(`Failed to load duplicate progress rows: ${duplicateProgressError.message}`);
    }

    const latestProgressByChild = new Map<string, (typeof duplicateProgressRows)[number]>();
    for (const row of duplicateProgressRows ?? []) {
      if (!latestProgressByChild.has(row.child_name)) {
        latestProgressByChild.set(row.child_name, row);
      }
    }

    if (latestProgressByChild.size > 0) {
      const { error: progressUpsertError } = await supabase.from("book_progress").upsert(
        Array.from(latestProgressByChild.values()).map((row) => ({
          child_name: row.child_name,
          book_id: canonicalBook.id,
          status: row.status,
          completed_at: row.completed_at,
          quiz_score: row.quiz_score,
          quiz_total: row.quiz_total,
          quiz_completed_at: row.quiz_completed_at,
          created_at: row.created_at,
          updated_at: row.updated_at,
        })),
        { onConflict: "child_name,book_id" },
      );

      if (progressUpsertError) {
        throw new Error(`Failed to merge duplicate progress rows: ${progressUpsertError.message}`);
      }
    }

    const { error: duplicateDeleteError } = await supabase
      .from("books")
      .delete()
      .in("id", duplicateBookIds);

    if (duplicateDeleteError) {
      throw new Error(`Failed to delete duplicate books: ${duplicateDeleteError.message}`);
    }
  }

  const { data: updatedBook, error: updateBookError } = await supabase
    .from("books")
    .update({
      subject: result.book.subject,
      grade: result.book.grade,
      source_type: result.book.sourceType,
      source_uri: result.book.sourceUri,
      updated_at: new Date().toISOString(),
    })
    .eq("id", canonicalBook.id)
    .select()
    .single();

  if (updateBookError || !updatedBook) {
    throw new Error(`Failed to update canonical book: ${updateBookError?.message}`);
  }

  const { error: existingLessonsDeleteError } = await supabase
    .from("lessons")
    .delete()
    .eq("book_id", canonicalBook.id);

  if (existingLessonsDeleteError) {
    throw new Error(`Failed to clear existing lessons: ${existingLessonsDeleteError.message}`);
  }

  return updatedBook;
}

export async function queueBookIngestWithPersistence(
  request: IngestBookRequest,
): Promise<IngestBookResult & { persistenceMode: "mock" | "supabase" }> {
  const result = await queueBookIngest(request);

  if (!isSupabaseConfigured()) {
    return {
      ...result,
      persistenceMode: "mock",
    };
  }

  const supabase = createSupabaseServerClient();
  const insertedBook = await getOrCreateCanonicalBook(supabase, result);

  const { data: insertedJob, error: jobError } = await supabase
    .from("ingest_jobs")
    .insert({
      book_id: insertedBook.id,
      status: result.job.status,
      requested_at: result.job.requestedAt,
      started_at: result.job.startedAt,
      finished_at: result.job.finishedAt,
      error_message: result.job.errorMessage,
    })
    .select()
    .single();

  if (jobError) {
    throw new Error(`Failed to insert ingest job: ${jobError.message}`);
  }

  const lessonRows = result.lessons.map((lesson, index) => ({
    book_id: insertedBook.id,
    title: lesson.title,
    chapter: lesson.chapter,
    lesson_order: index + 1,
    goal: lesson.goal,
    status: mapLessonStatusToDbStatus(lesson.status),
  }));

  const { data: insertedLessons, error: lessonsError } = await supabase
    .from("lessons")
    .insert(lessonRows)
    .select();

  if (lessonsError) {
    throw new Error(`Failed to insert lessons: ${lessonsError.message}`);
  }

  const lessonIdsByOrder = new Map(
    insertedLessons.map((lesson) => [lesson.lesson_order, lesson.id]),
  );

  const chunkRows = buildChunkRows(lessonIdsByOrder, result.chunkCandidates);

  if (chunkRows.length > 0) {
    const { error: chunksError } = await supabase
      .from("lesson_chunks")
      .insert(chunkRows);

    if (chunksError) {
      throw new Error(`Failed to insert lesson chunks: ${chunksError.message}`);
    }
  }

  return {
    book: {
      id: insertedBook.id,
      title: insertedBook.title,
      subject: insertedBook.subject,
      grade: insertedBook.grade,
      sourceType: insertedBook.source_type,
      sourceUri: insertedBook.source_uri,
    },
    job: {
      id: insertedJob.id,
      bookId: insertedJob.book_id,
      status: mapDbStatusToJobStatus(insertedJob.status),
      requestedAt: insertedJob.requested_at,
      startedAt: insertedJob.started_at,
      finishedAt: insertedJob.finished_at,
      errorMessage: insertedJob.error_message,
    },
    lessons: insertedLessons.map((lesson) => ({
      id: lesson.id,
      bookId: lesson.book_id,
      title: lesson.title,
      chapter: lesson.chapter,
      goal: lesson.goal,
      status: "ingest",
    })),
    chunkCandidates: result.chunkCandidates,
    persistenceMode: "supabase",
  };
}
