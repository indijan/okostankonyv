import { cookies } from "next/headers";

import { StudyWorkspace } from "@/components/study-workspace";
import { hasParentAdminPassword } from "@/lib/env";
import { getExamRegistryOverview } from "@/lib/exam-sources";
import {
  listBookProgress,
  listPersistedChildren,
  listSubjectKnowledgeBases,
  listSubjectKnowledgeSegments,
  listPersistedSummaryJobs,
  listPersistedSummaryReviews,
  listPersistedTopicBooks,
  listPersistedTopicIngestDetails,
  listPersistedTopicQuizItems,
  listPersistedTopicSummaries,
} from "@/lib/repositories";

function buildBookTitle(subject: string, topicTitle: string, sourceGroupLabel: string) {
  return `${subject} - ${topicTitle} - ${sourceGroupLabel}`;
}

function buildChildScopedBookTitle(
  childName: string,
  subject: string,
  topicTitle: string,
  sourceGroupLabel: string,
) {
  return `${childName} - ${subject} - ${topicTitle} - ${sourceGroupLabel}`;
}

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<{ child?: string }>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const cookieStore = await cookies();
  const parentUnlocked = !hasParentAdminPassword() || cookieStore.get("okostankonyv_parent_session")?.value === "1";
  const children = await listPersistedChildren();
  const fallbackChild = {
    id: "local-adam",
    name: "Ádám",
    grade: 5,
    active: true,
  };

  const selectedChild =
    children.find((child) => child.id === resolvedSearchParams.child || child.name === resolvedSearchParams.child) ??
    children[0] ??
    fallbackChild;

  const [examOverview, persistedBooks, persistedSummaries, persistedSummaryReviews, persistedSummaryJobs, persistedQuizItems, progressRows, ingestDetails, subjectKnowledgeBases] =
    await Promise.all([
      getExamRegistryOverview({ childId: selectedChild.id, grade: selectedChild.grade ?? 5 }),
      listPersistedTopicBooks(),
      listPersistedTopicSummaries(),
      listPersistedSummaryReviews(),
      listPersistedSummaryJobs(),
      listPersistedTopicQuizItems(),
      listBookProgress(selectedChild.name),
      listPersistedTopicIngestDetails(),
      listSubjectKnowledgeBases(selectedChild.id),
    ]);

  const knowledgeSegmentsByBaseId = new Map(
    (
      await Promise.all(
        subjectKnowledgeBases.map(async (base) => [
          base.id,
          await listSubjectKnowledgeSegments(base.id),
        ] as const),
      )
    ).map(([baseId, segments]) => [baseId, segments]),
  );

  const subjects = examOverview.registry.subjects.map((subject) => ({
    id: subject.id,
    subject: subject.subject,
    knowledgeBase: (() => {
      const base =
        (subject.id
          ? subjectKnowledgeBases.find((item) => item.subjectId === subject.id)
          : null) ?? null;

      if (!base) {
        return null;
      }

      return {
        ...base,
        segments: knowledgeSegmentsByBaseId.get(base.id) ?? [],
      };
    })(),
    topics: subject.topics.map((topic) => ({
      id: topic.id,
      title: topic.title,
      subblocks: topic.source_groups.map((group) => {
        const childScopedBookTitle = buildChildScopedBookTitle(
          selectedChild.name,
          subject.subject,
          topic.title,
          group.label,
        );
        const bookTitlesToMatch =
          selectedChild.id === "local-adam"
            ? [buildBookTitle(subject.subject, topic.title, group.label)]
            : [childScopedBookTitle];
        const candidateBooks = persistedBooks.filter(
          (item) => bookTitlesToMatch.includes(item.title),
        );
        const rankedCandidates = candidateBooks
          .map((item) => {
            const progress = progressRows.find((row) => row.book_id === item.id) ?? null;
            const rank =
              progress?.status === "needs_review"
                ? 3
                : progress?.status === "in_progress"
                  ? 2
                  : progress?.status === "completed"
                    ? 1
                    : 0;

            return { item, progress, rank };
          })
          .sort((a, b) => b.rank - a.rank);
        const selectedBook = rankedCandidates[0] ?? null;
        const book = selectedBook?.item ?? null;
        const progress = book
          ? selectedBook?.progress ?? progressRows.find((row) => row.book_id === book.id) ?? null
          : null;

        const summaries = persistedSummaries
          .filter((summary) => {
            const lesson =
              summary.lesson && !Array.isArray(summary.lesson)
                ? summary.lesson
                : Array.isArray(summary.lesson)
                ? summary.lesson[0]
                : null;

            return book ? lesson?.book?.id === book.id : false;
          })
          .map((summary) => ({
            lessonTitle:
              (summary.lesson && !Array.isArray(summary.lesson)
                ? summary.lesson.title
                : Array.isArray(summary.lesson)
                  ? summary.lesson[0]?.title
                  : "Ismeretlen lecke") ?? "Ismeretlen lecke",
            type: summary.type,
            sourceMode:
              (summary.source_mode === "knowledge_base" ? "knowledge_base" : "legacy") as
                | "legacy"
                | "knowledge_base",
            approved: summary.approved === true,
            content: summary.content,
            createdAt: summary.created_at,
          }));

        const quizItems = persistedQuizItems
          .filter((quizItem) => {
            const lesson =
              quizItem.lesson && !Array.isArray(quizItem.lesson)
                ? quizItem.lesson
                : Array.isArray(quizItem.lesson)
                ? quizItem.lesson[0]
                : null;

            return book ? lesson?.book?.id === book.id : false;
          })
          .map((quizItem) => ({
            lessonTitle:
              (quizItem.lesson && !Array.isArray(quizItem.lesson)
                ? quizItem.lesson.title
                : Array.isArray(quizItem.lesson)
                  ? quizItem.lesson[0]?.title
                  : "Ismeretlen lecke") ?? "Ismeretlen lecke",
            question: quizItem.question,
            options:
              Array.isArray(quizItem.options_json) &&
              quizItem.options_json.every((item) => typeof item === "string")
                ? (quizItem.options_json as string[])
                : [],
            correctAnswer: quizItem.correct_answer,
            explanation: quizItem.explanation,
            createdAt: quizItem.created_at,
          }));

        const summaryReviews = persistedSummaryReviews
          .filter((review) => {
            const lesson =
              review.lesson && !Array.isArray(review.lesson)
                ? review.lesson
                : Array.isArray(review.lesson)
                  ? review.lesson[0]
                  : null;

            return book ? lesson?.book?.id === book.id : false;
          })
          .map((review) => ({
            lessonId:
              (review.lesson && !Array.isArray(review.lesson)
                ? review.lesson.id
                : Array.isArray(review.lesson)
                  ? review.lesson[0]?.id
                  : null) ?? "",
            lessonTitle:
              (review.lesson && !Array.isArray(review.lesson)
                ? review.lesson.title
                : Array.isArray(review.lesson)
                  ? review.lesson[0]?.title
                  : "Ismeretlen lecke") ?? "Ismeretlen lecke",
            summaryType: review.summary_type,
            sourceMode:
              (review.source_mode === "knowledge_base" ? "knowledge_base" : "legacy") as
                | "legacy"
                | "knowledge_base",
            qualityScore: review.quality_score,
            factualityScore: review.factuality_score,
            issues: Array.isArray(review.issues) ? review.issues : [],
            improvementNotes: Array.isArray(review.improvement_notes) ? review.improvement_notes : [],
            correctedContent: review.corrected_content,
            createdAt: review.created_at,
          }));

        const summaryJob =
          persistedSummaryJobs.find(
            (job) =>
              (job.child_name ?? null) === selectedChild.name &&
              (job.subject ?? null) === subject.subject &&
              (job.topic_title ?? null) === topic.title &&
              (job.source_group_label ?? null) === group.label,
          ) ?? null;

        const ingestItems = ingestDetails.filter((item) => (book ? item.bookId === book.id : false));

        return {
          label: group.label,
          status: group.status,
          urlCount: group.urls.length,
          links: (group.links ?? group.urls.map((url) => ({ url }))).map((link) => ({
            id: "id" in link && typeof link.id === "string" ? link.id : undefined,
            url: link.url,
            contentHint:
              "contentHint" in link && typeof link.contentHint === "string"
                ? link.contentHint
                : null,
            includePattern:
              "includePattern" in link && typeof link.includePattern === "string"
                ? link.includePattern
                : null,
            excludePattern:
              "excludePattern" in link && typeof link.excludePattern === "string"
                ? link.excludePattern
                : null,
          })),
          book: book
            ? {
                id: book.id,
                title: book.title,
                sourceType: book.source_type,
                sourceUri: book.source_uri,
                createdAt: book.updated_at ?? book.created_at,
              }
            : null,
          progress: progress
            ? {
                status: progress.status,
                completedAt: progress.completed_at,
                quizScore: progress.quiz_score,
                quizTotal: progress.quiz_total,
                quizCompletedAt: progress.quiz_completed_at,
              }
            : null,
          summaries,
          summaryReviews,
          summaryJob: summaryJob
            ? {
                id: summaryJob.id,
                status: summaryJob.status,
                requestedAt: summaryJob.requested_at,
                startedAt: summaryJob.started_at,
                finishedAt: summaryJob.finished_at,
                resultCount: summaryJob.result_count,
                errorMessage: summaryJob.error_message,
              }
            : null,
          quizItems,
          ingestItems,
        };
      }),
    })),
  }));

  return (
    <main className="grain flex-1 px-6 py-8 md:px-10 md:py-10">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <StudyWorkspace
          learnerId={selectedChild.id}
          learnerName={selectedChild.name}
          learners={children}
          gradeLabel={`${selectedChild.grade ?? examOverview.registry.grade}. osztály`}
          subjects={subjects}
          parentUnlocked={parentUnlocked}
        />
      </div>
    </main>
  );
}
