export type ChildProfile = {
  id: string;
  name: string;
  birthYear: number;
  gradeLabel: string;
  focus: string;
  active: boolean;
  parentNotes: string | null;
};

export type BookSourceType = "nkp_pdf" | "nkp_lesson_page" | "uploaded_pdf";

export type Book = {
  id: string;
  title: string;
  subject: string;
  grade: string;
  sourceType: BookSourceType;
  sourceUri: string;
};

export type IngestJobStatus =
  | "queued"
  | "extracting"
  | "structuring"
  | "completed"
  | "failed";

export type IngestJob = {
  id: string;
  bookId: string;
  status: IngestJobStatus;
  requestedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  errorMessage: string | null;
};

export type IngestChunkCandidate = {
  lessonOrder: number;
  pageFrom: number;
  pageTo: number;
  rawText: string;
  cleanedText: string;
};

export type ExtractedPage = {
  pageNumber: number;
  text: string;
};

export type PageHeadingCandidate = {
  pageNumber: number;
  heading: string | null;
  preview: string;
};

export type Lesson = {
  id: string;
  bookId: string;
  title: string;
  chapter: string;
  goal: string;
  status: "ingest" | "summary" | "quiz" | "explanation" | "approved";
};

export type LessonSummaryType =
  | "short_summary"
  | "child_friendly_explanation"
  | "key_points";

export type LessonSummary = {
  id: string;
  lessonId: string;
  type: LessonSummaryType;
  content: string;
  groundingScore: number;
  factualityScore: number;
  approved: boolean;
};

export type QuizItem = {
  id: string;
  lessonId: string;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  sourceQuote: string;
  sourcePage: number;
  groundingScore: number;
  factualityScore: number;
  approved: boolean;
};

export type LessonProgressStatus =
  | "not_started"
  | "in_progress"
  | "completed"
  | "needs_review";

export type LessonProgress = {
  id: string;
  childId: string;
  lessonId: string;
  status: LessonProgressStatus;
  score: number | null;
  lastCompletedAt: string | null;
};

export type PilotDataset = {
  subjectLabel: string;
  book: Book;
  children: ChildProfile[];
  lessons: Lesson[];
  summaries: LessonSummary[];
  quizItems: QuizItem[];
  progress: LessonProgress[];
  qualityPrinciples: string[];
};

export type IngestBookRequest = {
  title: string;
  subject: string;
  grade: string;
  sourceType: BookSourceType;
  sourceUri: string;
  topicTitle?: string;
  sourceGroupLabel?: string;
  contentHint?: string | null;
  includePattern?: string | null;
  excludePattern?: string | null;
};

export type IngestBookResult = {
  book: Book;
  job: IngestJob;
  lessons: Lesson[];
  chunkCandidates: IngestChunkCandidate[];
};
