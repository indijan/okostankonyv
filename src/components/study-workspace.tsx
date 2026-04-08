"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { formatRequestError, readJsonResponse } from "@/lib/http";

type SubblockSummary = {
  lessonTitle: string;
  type: "short_summary" | "child_friendly_explanation" | "key_points";
  sourceMode: "legacy" | "knowledge_base";
  approved: boolean;
  content: string;
  createdAt: string;
};

type SubblockSummaryReview = {
  lessonId: string;
  lessonTitle: string;
  summaryType: "short_summary" | "key_points";
  sourceMode: "legacy" | "knowledge_base";
  qualityScore: number;
  factualityScore: number;
  issues: string[];
  improvementNotes: string[];
  correctedContent: string;
  createdAt: string;
};

type Subblock = {
  label: string;
  status: "ready" | "missing";
  urlCount: number;
  links: Array<{
    id?: string;
    url: string;
    contentHint?: string | null;
    includePattern?: string | null;
    excludePattern?: string | null;
  }>;
  book: {
    id: string;
    title: string;
    sourceType: string;
    sourceUri: string;
    createdAt: string;
  } | null;
  progress: {
    status: "not_started" | "in_progress" | "completed" | "needs_review";
    completedAt: string | null;
    quizScore?: number | null;
    quizTotal?: number | null;
    quizCompletedAt?: string | null;
  } | null;
  summaries: SubblockSummary[];
  summaryReviews: SubblockSummaryReview[];
  summaryJob: {
    id: string;
    status: "queued" | "extracting" | "structuring" | "completed" | "failed";
    requestedAt: string;
    startedAt: string | null;
    finishedAt: string | null;
    resultCount: number;
    errorMessage: string | null;
  } | null;
  quizItems: Array<{
    lessonTitle: string;
    question: string;
    options: string[];
    correctAnswer: string;
    explanation: string;
    createdAt: string;
  }>;
  ingestItems: Array<{
    title: string;
    chapter: string;
    sourceUri: string | null;
    sourceType: string | null;
    createdAt: string;
    chunks: Array<{
      pageFrom: number;
      pageTo: number;
      preview: string;
    }>;
  }>;
};

type TopicCard = {
  id?: string;
  title: string;
  subblocks: Subblock[];
};

type SubjectWorkspace = {
  id?: string;
  subject: string;
  knowledgeBase: {
    id: string;
    status: "empty" | "processing" | "ready" | "failed";
    provider: "openai_vector_store";
    vectorStoreId: string | null;
    fileCount: number;
    lastBuiltAt: string | null;
    errorMessage: string | null;
    files: Array<{
      id: string;
      fileName: string;
      storagePath: string;
      mimeType: string;
      fileSizeBytes: number | null;
      processingStatus: "uploaded" | "processing" | "ready" | "failed";
      pageCount: number | null;
      createdAt: string;
    }>;
    segments: Array<{
      id: string;
      fileId: string;
      pageNumber: number;
      segmentType: "content" | "exercise" | "noise" | "source_note";
      rawText: string;
      cleanedText: string;
      createdAt: string;
    }>;
  } | null;
  topics: TopicCard[];
};

type StudyWorkspaceProps = {
  gradeLabel: string;
  learnerId: string;
  learnerName: string;
  learners: Array<{
    id: string;
    name: string;
    grade: number;
  }>;
  parentUnlocked: boolean;
  subjects: SubjectWorkspace[];
};

type SeedResponse = {
  count: number;
};

type SummaryResponse = {
  count: number;
  jobId?: string;
  status?: string;
  items?: Array<{
    lessonId: string;
    lessonTitle: string;
    subject: string | null;
    sourceMode: "legacy" | "knowledge_base";
    summaryMode: "openai" | "disabled";
    explanationMode: "openai" | "disabled";
    summaryLength: number;
    explanationLength: number;
    summaryContent: string;
    explanationContent: string;
    keyPointsContent: string[];
  }>;
};

type FactCheckResponse = {
  count: number;
  items?: Array<{
    lessonId: string;
    lessonTitle: string;
    summaryType: "short_summary" | "key_points";
    sourceMode: "legacy" | "knowledge_base";
    qualityScore: number;
    factualityScore: number;
    issues: string[];
    improvementNotes: string[];
    correctedContent: string;
    createdAt: string;
  }>;
  error?: string;
};

type QuizResponse = {
  count: number;
  items?: Array<{
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
  }>;
};

type ManageSummaryResponse = {
  ok?: boolean;
  error?: string;
};

type SummaryEditorState = {
  subject: string;
  topicTitle: string;
  sourceGroupLabel: string;
  type: "summary" | "key_points";
  content: string;
};

type ProgressResponse = {
  status: string;
  score?: number;
  total?: number;
};

type SubmittedQuizResult = {
  score: number;
  total: number;
  answers: Array<{
    selected: string;
    correct: string;
  }>;
};

type AdminSessionResponse = {
  unlocked: boolean;
};

type OverrideResponse = {
  alreadyExists?: boolean;
  sourceType?: string;
  removed?: boolean;
  updated?: boolean;
};

type CreateChildResponse = {
  child: {
    id: string;
    name: string;
    grade: number | null;
    active: boolean;
  };
};

type CreateCurriculumResponse = {
  subject?: {
    id: string;
    grade: number;
    name: string;
    sort_order: number;
  };
  topic?: {
    id: string;
    subject_id: string;
    title: string;
    sort_order: number;
  };
  subblock?: {
    id: string;
    topic_id: string;
    title: string;
    sort_order: number;
  };
};

type DeleteResponse = {
  deleted?: boolean;
};

type SubjectKnowledgeBaseResponse = {
  knowledgeBase?: {
    id: string;
    childId: string;
    subjectId: string;
    status: "empty" | "processing" | "ready" | "failed";
    provider: "openai_vector_store";
    vectorStoreId: string | null;
    fileCount: number;
    lastBuiltAt: string | null;
    errorMessage: string | null;
    files?: Array<{
      id: string;
      fileName: string;
      storagePath: string;
      mimeType: string;
      fileSizeBytes: number | null;
      processingStatus: "uploaded" | "processing" | "ready" | "failed";
      pageCount: number | null;
      createdAt: string;
    }>;
    alreadyExists?: boolean;
  };
  error?: string;
};

type SubjectKnowledgeFileUploadResponse = {
  file?: {
    id: string;
    fileName: string;
    storagePath: string;
    mimeType: string;
    fileSizeBytes: number | null;
    processingStatus: "uploaded" | "processing" | "ready" | "failed";
    pageCount: number | null;
    createdAt: string;
  };
  knowledgeBase?: {
    id: string;
    fileCount: number;
  };
  error?: string;
};

function formatTimestamp(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    return new Intl.DateTimeFormat("hu-HU", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function summaryTypeLabel(value: "short_summary" | "key_points") {
  return value === "short_summary" ? "Összefoglaló" : "Vázlatos kivonat";
}

function summarySourceModeLabel(value: "legacy" | "knowledge_base") {
  return value === "knowledge_base" ? "PDF-RAG" : "Legacy";
}

function knowledgeBaseStatusLabel(value: "empty" | "processing" | "ready" | "failed") {
  switch (value) {
    case "processing":
      return "Feldolgozás alatt";
    case "ready":
      return "Kész";
    case "failed":
      return "Hibás";
    default:
      return "Még nincs felépítve";
  }
}

function isMetaLessonTitle(value: string) {
  return /^(kapcsol[oó]d[oó]\s+szekci[oó]|feladatok,\s*k[eé]rd[eé]sek|k[eé]rd[eé]sek,\s*feladatok|munkaf[uü]zeti\s+feladatok|tov[aá]bbi\s+okosfeladatok)$/i.test(
    value.trim(),
  );
}

function inferClientSourceType(url: string) {
  if (/\.pdf(\?|#|$)/i.test(url)) {
    return "nkp_pdf";
  }

  if (/^https?:\/\/www\.nkp\.hu\/tankonyv\/.+\/(lecke|fejezet)_/i.test(url)) {
    return "nkp_lesson_page";
  }

  return null;
}

function countIngestableLinks(
  links: Array<{
    url: string;
    sourceType?: string | null;
  }>,
) {
  return links.filter((link) => (link.sourceType ?? inferClientSourceType(link.url)) !== null).length;
}

function percentage(part: number, whole: number) {
  if (whole <= 0) {
    return 0;
  }

  return Math.round((part / whole) * 100);
}

export function StudyWorkspace({
  gradeLabel,
  learnerId,
  learnerName,
  learners,
  parentUnlocked,
  subjects,
}: StudyWorkspaceProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [subjectState, setSubjectState] = useState(subjects);
  const [learnerState, setLearnerState] = useState(learners);
  const [mode, setMode] = useState<"parent" | "child">("parent");
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isParentUnlocked, setIsParentUnlocked] = useState(parentUnlocked);
  const [parentPassword, setParentPassword] = useState("");
  const [overrideInputs, setOverrideInputs] = useState<Record<string, string>>({});
  const [knowledgeBaseUploads, setKnowledgeBaseUploads] = useState<Record<string, File | null>>({});
  const [knowledgeBaseUploadNames, setKnowledgeBaseUploadNames] = useState<Record<string, string | null>>({});
  const [quizSelections, setQuizSelections] = useState<Record<string, string>>({});
  const [quizResults, setQuizResults] = useState<Record<string, SubmittedQuizResult>>({});
  const [newChildName, setNewChildName] = useState("");
  const [newChildGrade, setNewChildGrade] = useState("5");
  const [newSubjectName, setNewSubjectName] = useState("");
  const [newTopicTitles, setNewTopicTitles] = useState<Record<string, string>>({});
  const [newSubblockTitles, setNewSubblockTitles] = useState<Record<string, string>>({});
  const [summaryEditor, setSummaryEditor] = useState<SummaryEditorState | null>(null);
  const summaryPollersRef = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  useEffect(() => {
    setSubjectState(subjects);
    setLearnerState(learners);
    setIsParentUnlocked(parentUnlocked);
    setActiveKey(null);
    setMessage(null);
    setError(null);
    setQuizSelections({});
    setQuizResults({});
  }, [subjects, learners, parentUnlocked, learnerId]);

  useEffect(() => {
    return () => {
      Object.values(summaryPollersRef.current).forEach((timer) => clearInterval(timer));
      summaryPollersRef.current = {};
    };
  }, []);

  function selectLearner(nextLearnerId: string) {
    const nextParams = new URLSearchParams(searchParams?.toString() ?? "");
    nextParams.set("child", nextLearnerId);
    router.replace(`${pathname}?${nextParams.toString()}`);
    router.refresh();
  }

  function renderInlineBold(text: string) {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, index) =>
      part.startsWith("**") && part.endsWith("**") ? (
        <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>
      ) : (
        <span key={`${part}-${index}`}>{part}</span>
      ),
    );
  }

  function updateSubblockSummaryJob(
    subject: string,
    topicTitle: string,
    sourceGroupLabel: string,
    summaryJob: Subblock["summaryJob"],
  ) {
    setSubjectState((current) =>
      current.map((subjectItem) =>
        subjectItem.subject !== subject
          ? subjectItem
          : {
              ...subjectItem,
              topics: subjectItem.topics.map((topicItem) =>
                topicItem.title !== topicTitle
                  ? topicItem
                  : {
                      ...topicItem,
                      subblocks: topicItem.subblocks.map((subblockItem) =>
                        subblockItem.label !== sourceGroupLabel
                          ? subblockItem
                          : {
                              ...subblockItem,
                              summaryJob,
                            },
                      ),
                    },
              ),
            },
      ),
    );
  }

  async function initializeSubjectKnowledgeBase(subjectId: string, subjectName: string) {
    const key = `knowledge-base-init:${subjectId}`;
    setActiveKey(key);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/admin/knowledge-base", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          childId: learnerId,
          subjectId,
        }),
      });

      const payload = await readJsonResponse<SubjectKnowledgeBaseResponse>(response);
      if (!response.ok || !payload.knowledgeBase) {
        throw new Error(
          formatRequestError(null, "A tantárgyi tudásbázis inicializálása nem sikerult", {
            status: response.status,
            bodyError: payload.error,
          }),
        );
      }

      const knowledgeBase = payload.knowledgeBase;

      setSubjectState((current) =>
        current.map((subjectItem) =>
          subjectItem.id !== subjectId
            ? subjectItem
            : {
                ...subjectItem,
                knowledgeBase: {
                  id: knowledgeBase.id,
                  status: knowledgeBase.status,
                  provider: knowledgeBase.provider,
                  vectorStoreId: knowledgeBase.vectorStoreId,
                  fileCount: knowledgeBase.fileCount,
                  lastBuiltAt: knowledgeBase.lastBuiltAt,
                  errorMessage: knowledgeBase.errorMessage,
                  files: knowledgeBase.files ?? [],
                  segments: [],
                },
              },
        ),
      );

      setMessage(
        knowledgeBase.alreadyExists
          ? `${subjectName}: a tantárgyi tudásbázis már létezett.`
          : `${subjectName}: a tantárgyi tudásbázis alapja elkészült.`,
      );
      router.refresh();
    } catch (knowledgeBaseError) {
      setError(formatRequestError(knowledgeBaseError, "A tantárgyi tudásbázis inicializálása nem sikerult"));
    } finally {
      setActiveKey(null);
    }
  }

  async function uploadKnowledgeBasePdf(subjectId: string, subjectName: string) {
    const selectedFile = knowledgeBaseUploads[subjectId];
    if (!selectedFile) {
      setError("Valassz ki egy PDF filet a feltolteshez.");
      return;
    }

    const key = `knowledge-base-upload:${subjectId}`;
    setActiveKey(key);
    setMessage(null);
    setError(null);

    try {
      const formData = new FormData();
      formData.set("childId", learnerId);
      formData.set("subjectId", subjectId);
      formData.set("file", selectedFile);

      const response = await fetch("/api/admin/knowledge-base/files", {
        method: "POST",
        body: formData,
      });

      const payload = await readJsonResponse<SubjectKnowledgeFileUploadResponse>(response);
      if (!response.ok || !payload.file) {
        throw new Error(
          formatRequestError(null, "A PDF feltoltese nem sikerult", {
            status: response.status,
            bodyError: payload.error,
          }),
        );
      }

      setSubjectState((current) =>
        current.map((subjectItem) =>
          subjectItem.id !== subjectId
            ? subjectItem
            : {
                ...subjectItem,
                knowledgeBase: subjectItem.knowledgeBase
                  ? {
                      ...subjectItem.knowledgeBase,
                      fileCount: payload.knowledgeBase?.fileCount ?? subjectItem.knowledgeBase.fileCount + 1,
                      files: [payload.file!, ...subjectItem.knowledgeBase.files],
                    }
                  : subjectItem.knowledgeBase,
              },
        ),
      );
      setKnowledgeBaseUploads((current) => ({
        ...current,
        [subjectId]: null,
      }));
      setMessage(`${subjectName}: PDF feltöltve a tudásbázishoz.`);
      router.refresh();
    } catch (uploadError) {
      setError(formatRequestError(uploadError, "A PDF feltoltese nem sikerult"));
    } finally {
      setActiveKey(null);
    }
  }

  async function processKnowledgeBase(subjectId: string, subjectName: string, knowledgeBaseId: string) {
    const key = `knowledge-base-process:${subjectId}`;
    setActiveKey(key);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/admin/knowledge-base/process", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ knowledgeBaseId }),
      });

      const payload = await readJsonResponse<{ ok?: boolean; error?: string }>(response);
      if (!response.ok) {
        throw new Error(
          formatRequestError(null, "A PDF feldolgozása nem sikerült", {
            status: response.status,
            bodyError: payload.error,
          }),
        );
      }

      setMessage(`${subjectName}: a PDF-ek tisztítása és feldolgozása elkészült.`);
      router.refresh();
    } catch (processError) {
      setError(formatRequestError(processError, "A PDF feldolgozása nem sikerült"));
    } finally {
      setActiveKey(null);
    }
  }

  async function buildKnowledgeBaseVectorStore(subjectId: string, subjectName: string, knowledgeBaseId: string) {
    const key = `knowledge-base-build:${subjectId}`;
    setActiveKey(key);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/admin/knowledge-base/build", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ knowledgeBaseId }),
      });

      const payload = await readJsonResponse<{ ok?: boolean; vectorStoreId?: string; error?: string }>(response);
      if (!response.ok) {
        throw new Error(
          formatRequestError(null, "A vector store build nem sikerült", {
            status: response.status,
            bodyError: payload.error,
          }),
        );
      }

      setMessage(`${subjectName}: a tantárgyi vector store elkészült.`);
      router.refresh();
    } catch (buildError) {
      setError(formatRequestError(buildError, "A vector store build nem sikerült"));
    } finally {
      setActiveKey(null);
    }
  }

  async function runSubblockSeed(subject: string, topicTitle: string, sourceGroupLabel: string) {
    const key = `seed:${subject}:${topicTitle}:${sourceGroupLabel}`;
    setActiveKey(key);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/ingest/seed", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          childId: learnerId,
          childName: learnerName,
          subject,
          topicTitle,
          sourceGroupLabel,
          limit: 1,
        }),
      });

      const payload = await readJsonResponse<SeedResponse>(response);

      if (!response.ok) {
        throw new Error(
          formatRequestError(null, "Az ingest nem sikerult", {
            status: response.status,
            bodyError: payload.error,
          }),
        );
      }

      setMessage(`${sourceGroupLabel}: ingest elkészült.`);
      router.refresh();
    } catch (seedError) {
      setError(formatRequestError(seedError, "Az ingest nem sikerult"));
    } finally {
      setActiveKey(null);
    }
  }

  async function runSubblockSummary(
    subject: string,
    topicTitle: string,
    sourceGroupLabel: string,
    vectorStoreId: string | null,
  ) {
    const key = `summary:${subject}:${topicTitle}:${sourceGroupLabel}`;
    setActiveKey(key);
    setMessage(null);
    setError(null);

    if (!vectorStoreId) {
      setActiveKey(null);
      setError("Ehhez a tantárgyhoz még nincs használható vector store. Előbb építsd fel a tudásbázist.");
      return;
    }

    try {
      const response = await fetch("/api/summaries/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          childName: learnerName,
          subject,
          topicTitle,
          sourceGroupLabel,
          vectorStoreId,
        }),
      });

      const payload = await readJsonResponse<SummaryResponse>(response);

      if (!response.ok) {
        throw new Error(
          formatRequestError(null, "Az összefoglaló generálása nem sikerult", {
            status: response.status,
            bodyError: payload.error,
          }),
        );
      }

      if (!payload.jobId) {
        throw new Error("A summary job nem indult el rendesen.");
      }

      const requestedAt = new Date().toISOString();
      updateSubblockSummaryJob(subject, topicTitle, sourceGroupLabel, {
        id: payload.jobId!,
        status: "queued",
        requestedAt,
        startedAt: null,
        finishedAt: null,
        resultCount: 0,
        errorMessage: null,
      });
      setMessage(`${sourceGroupLabel}: összefoglaló generálása elindult a háttérben.`);

      const pollerKey = `${subject}:${topicTitle}:${sourceGroupLabel}`;
      if (summaryPollersRef.current[pollerKey]) {
        clearInterval(summaryPollersRef.current[pollerKey]!);
      }

      summaryPollersRef.current[pollerKey] = setInterval(async () => {
        try {
          const jobResponse = await fetch(`/api/summaries/generate?jobId=${payload.jobId}`, {
            method: "GET",
            cache: "no-store",
          });
          const jobPayload = await readJsonResponse<{
            status?: string;
            requested_at?: string | null;
            started_at?: string | null;
            finished_at?: string | null;
            result_count?: number;
            error_message?: string | null;
            error?: string;
          }>(jobResponse);

          if (!jobResponse.ok) {
            throw new Error(jobPayload.error ?? "Nem sikerült lekérdezni a summary jobot.");
          }

          updateSubblockSummaryJob(subject, topicTitle, sourceGroupLabel, {
            id: payload.jobId!,
            status:
              jobPayload.status === "queued" ||
              jobPayload.status === "extracting" ||
              jobPayload.status === "structuring" ||
              jobPayload.status === "completed" ||
              jobPayload.status === "failed"
                ? jobPayload.status
                : "queued",
            requestedAt: jobPayload.requested_at ?? requestedAt,
            startedAt: jobPayload.started_at ?? null,
            finishedAt: jobPayload.finished_at ?? null,
            resultCount: jobPayload.result_count ?? 0,
            errorMessage: jobPayload.error_message ?? null,
          });

          if (jobPayload.status === "completed") {
            clearInterval(summaryPollersRef.current[pollerKey]!);
            delete summaryPollersRef.current[pollerKey];
            setActiveKey(null);
            setMessage(`${sourceGroupLabel}: összefoglaló elkészült (${jobPayload.result_count ?? 0} lecke).`);
            router.refresh();
          }

          if (jobPayload.status === "failed") {
            clearInterval(summaryPollersRef.current[pollerKey]!);
            delete summaryPollersRef.current[pollerKey];
            setActiveKey(null);
            router.refresh();
            setError(jobPayload.error_message ?? "Az összefoglaló generálása nem sikerült.");
          }
        } catch (pollError) {
          clearInterval(summaryPollersRef.current[pollerKey]!);
          delete summaryPollersRef.current[pollerKey];
          setActiveKey(null);
          setError(formatRequestError(pollError, "A summary job állapotának lekérése nem sikerült"));
        }
      }, 1500);

      return;
    } catch (summaryError) {
      setError(formatRequestError(summaryError, "Az összefoglaló generálása nem sikerult"));
    } finally {
      if (!summaryPollersRef.current[`${subject}:${topicTitle}:${sourceGroupLabel}`]) {
        setActiveKey(null);
      }
    }
  }

  async function runSubblockQuiz(subject: string, topicTitle: string, sourceGroupLabel: string) {
    const key = `quiz:${subject}:${topicTitle}:${sourceGroupLabel}`;
    setActiveKey(key);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/quiz/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ childName: learnerName, subject, topicTitle, sourceGroupLabel }),
      });

      const payload = await readJsonResponse<QuizResponse>(response);

      if (!response.ok) {
        throw new Error(
          formatRequestError(null, "A kvíz generálása nem sikerult", {
            status: response.status,
            bodyError: payload.error,
          }),
        );
      }

      const generatedItems = payload.items ?? [];
      const generatedAt = new Date().toISOString();

      setSubjectState((current) =>
        current.map((subjectItem) =>
          subjectItem.subject !== subject
            ? subjectItem
            : {
                ...subjectItem,
                topics: subjectItem.topics.map((topicItem) =>
                  topicItem.title !== topicTitle
                    ? topicItem
                    : {
                        ...topicItem,
                        subblocks: topicItem.subblocks.map((subblockItem) =>
                          subblockItem.label !== sourceGroupLabel
                            ? subblockItem
                            : {
                                ...subblockItem,
                                quizItems: generatedItems.flatMap((result) =>
                                  result.items.map((item) => ({
                                    lessonTitle: result.lessonTitle,
                                    question: item.question,
                                    options: item.options,
                                    correctAnswer: item.correctAnswer,
                                    explanation: item.explanation,
                                    createdAt: generatedAt,
                                  })),
                                ),
                              },
                        ),
                      },
                ),
              },
        ),
      );

      setMessage(`${sourceGroupLabel}: kvíz elkészült és megjelent az alblokk alatt.`);
    } catch (quizError) {
      setError(formatRequestError(quizError, "A kvíz generálása nem sikerult"));
    } finally {
      setActiveKey(null);
    }
  }

  async function runSubblockFactCheck(
    subject: string,
    topicTitle: string,
    sourceGroupLabel: string,
    vectorStoreId: string | null,
  ) {
    const key = `fact-check:${subject}:${topicTitle}:${sourceGroupLabel}`;
    setActiveKey(key);
    setMessage(null);
    setError(null);

    if (!vectorStoreId) {
      setActiveKey(null);
      setError("Ehhez a tantárgyhoz még nincs használható vector store. Előbb építsd fel a tudásbázist.");
      return;
    }

    try {
      const response = await fetch("/api/summaries/review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          childName: learnerName,
          subject,
          topicTitle,
          sourceGroupLabel,
          vectorStoreId,
        }),
      });

      const payload = await readJsonResponse<FactCheckResponse>(response);

      if (!response.ok) {
        throw new Error(
          formatRequestError(null, "A fact check nem sikerult", {
            status: response.status,
            bodyError: payload.error,
          }),
        );
      }

      setSubjectState((current) =>
        current.map((subjectItem) =>
          subjectItem.subject !== subject
            ? subjectItem
            : {
                ...subjectItem,
                topics: subjectItem.topics.map((topicItem) =>
                  topicItem.title !== topicTitle
                    ? topicItem
                    : {
                      ...topicItem,
                      subblocks: topicItem.subblocks.map((subblockItem) =>
                        subblockItem.label !== sourceGroupLabel
                          ? subblockItem
                          : {
                              ...subblockItem,
                                summaryReviews:
                                  payload.items?.map((item) => ({
                                    lessonId: item.lessonId,
                                    lessonTitle: item.lessonTitle,
                                    summaryType: item.summaryType,
                                    sourceMode: item.sourceMode,
                                    qualityScore: item.qualityScore,
                                  factualityScore: item.factualityScore,
                                  issues: item.issues,
                                  improvementNotes: item.improvementNotes,
                                  correctedContent: item.correctedContent,
                                  createdAt: item.createdAt,
                                })) ?? [],
                            },
                      ),
                    }
                ),
              }
        ),
      );

      setMessage(`${sourceGroupLabel}: fact check elkészült (${payload.count} ellenőrzés).`);
      router.refresh();
    } catch (factCheckError) {
      setError(formatRequestError(factCheckError, "A fact check nem sikerult"));
    } finally {
      setActiveKey(null);
    }
  }

  async function clearSubblockSummaries(subject: string, topicTitle: string, sourceGroupLabel: string) {
    if (!window.confirm(`Törlöd az összes összefoglalót és vázlatot ennél: ${sourceGroupLabel}?`)) {
      return;
    }

    const key = `clear-summaries:${subject}:${topicTitle}:${sourceGroupLabel}`;
    setActiveKey(key);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/summaries/manage", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "clear_summaries",
          childName: learnerName,
          subject,
          topicTitle,
          sourceGroupLabel,
        }),
      });
      const payload = await readJsonResponse<ManageSummaryResponse>(response);
      if (!response.ok) {
        throw new Error(
          formatRequestError(null, "Az összefoglalók törlése nem sikerult", {
            status: response.status,
            bodyError: payload.error,
          }),
        );
      }

      setMessage(`${sourceGroupLabel}: összefoglalók és vázlat törölve.`);
      router.refresh();
    } catch (manageError) {
      setError(formatRequestError(manageError, "Az összefoglalók törlése nem sikerult"));
    } finally {
      setActiveKey(null);
    }
  }

  async function clearSubblockFactChecks(subject: string, topicTitle: string, sourceGroupLabel: string) {
    if (!window.confirm(`Törlöd az összes fact check eredményt ennél: ${sourceGroupLabel}?`)) {
      return;
    }

    const key = `clear-reviews:${subject}:${topicTitle}:${sourceGroupLabel}`;
    setActiveKey(key);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/summaries/manage", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "clear_reviews",
          childName: learnerName,
          subject,
          topicTitle,
          sourceGroupLabel,
        }),
      });
      const payload = await readJsonResponse<ManageSummaryResponse>(response);
      if (!response.ok) {
        throw new Error(
          formatRequestError(null, "A fact check törlése nem sikerult", {
            status: response.status,
            bodyError: payload.error,
          }),
        );
      }

      setMessage(`${sourceGroupLabel}: fact check eredmények törölve.`);
      router.refresh();
    } catch (manageError) {
      setError(formatRequestError(manageError, "A fact check törlése nem sikerult"));
    } finally {
      setActiveKey(null);
    }
  }

  async function setSubblockPublishState(
    subject: string,
    topicTitle: string,
    sourceGroupLabel: string,
    publish: boolean,
  ) {
    const key = `${publish ? "publish" : "unpublish"}:${subject}:${topicTitle}:${sourceGroupLabel}`;
    setActiveKey(key);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/summaries/manage", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: publish ? "publish_summaries" : "unpublish_summaries",
          childName: learnerName,
          subject,
          topicTitle,
          sourceGroupLabel,
        }),
      });
      const payload = await readJsonResponse<ManageSummaryResponse>(response);
      if (!response.ok) {
        throw new Error(
          formatRequestError(null, publish ? "A kimehet állítás nem sikerult" : "A visszavonás nem sikerult", {
            status: response.status,
            bodyError: payload.error,
          }),
        );
      }

      setMessage(`${sourceGroupLabel}: ${publish ? "kimehet a gyereknek" : "visszavonva a gyereknézetből"}.`);
      router.refresh();
    } catch (stateError) {
      setError(formatRequestError(stateError, publish ? "A kimehet állítás nem sikerult" : "A visszavonás nem sikerult"));
    } finally {
      setActiveKey(null);
    }
  }

  async function editSubblockSummary(
    subject: string,
    topicTitle: string,
    sourceGroupLabel: string,
    currentContent: string,
  ) {
    setSummaryEditor({
      subject,
      topicTitle,
      sourceGroupLabel,
      type: "summary",
      content: currentContent,
    });
  }

  async function editSubblockKeyPoints(
    subject: string,
    topicTitle: string,
    sourceGroupLabel: string,
    currentPoints: string[],
  ) {
    setSummaryEditor({
      subject,
      topicTitle,
      sourceGroupLabel,
      type: "key_points",
      content: currentPoints.join("\n"),
    });
  }

  async function saveSummaryEditor() {
    if (!summaryEditor) {
      return;
    }

    const content = summaryEditor.content.trim();
    if (!content) {
      setError("A szerkesztett tartalom nem lehet üres.");
      return;
    }

    const key = `save-editor:${summaryEditor.subject}:${summaryEditor.topicTitle}:${summaryEditor.sourceGroupLabel}:${summaryEditor.type}`;
    setActiveKey(key);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/summaries/manage", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: summaryEditor.type === "summary" ? "update_summary" : "update_key_points",
          childName: learnerName,
          subject: summaryEditor.subject,
          topicTitle: summaryEditor.topicTitle,
          sourceGroupLabel: summaryEditor.sourceGroupLabel,
          content,
        }),
      });
      const payload = await readJsonResponse<ManageSummaryResponse>(response);
      if (!response.ok) {
        throw new Error(
          formatRequestError(null, "A szerkesztett tartalom mentése nem sikerult", {
            status: response.status,
            bodyError: payload.error,
          }),
        );
      }

      setMessage(
        `${summaryEditor.sourceGroupLabel}: ${
          summaryEditor.type === "summary" ? "összefoglaló" : "vázlat"
        } mentve.`,
      );
      setSummaryEditor(null);
      router.refresh();
    } catch (manageError) {
      setError(formatRequestError(manageError, "A szerkesztett tartalom mentése nem sikerult"));
    } finally {
      setActiveKey(null);
    }
  }

  async function clearSubblockIngest(subject: string, topicTitle: string, sourceGroupLabel: string) {
    if (
      !window.confirm(
        `Törlöd az ingestelt adatokat ennél: ${sourceGroupLabel}? Ez törli a kapcsolódó könyv/leckék/chunkok adatait is.`,
      )
    ) {
      return;
    }

    const key = `clear-ingest:${subject}:${topicTitle}:${sourceGroupLabel}`;
    setActiveKey(key);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/summaries/manage", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "clear_ingest",
          childName: learnerName,
          subject,
          topicTitle,
          sourceGroupLabel,
        }),
      });
      const payload = await readJsonResponse<ManageSummaryResponse>(response);
      if (!response.ok) {
        throw new Error(
          formatRequestError(null, "Az ingest törlése nem sikerult", {
            status: response.status,
            bodyError: payload.error,
          }),
        );
      }

      setMessage(`${sourceGroupLabel}: ingestelt adatok törölve.`);
      router.refresh();
    } catch (manageError) {
      setError(formatRequestError(manageError, "Az ingest törlése nem sikerult"));
    } finally {
      setActiveKey(null);
    }
  }

  async function applyReviewNote(
    subject: string,
    topicTitle: string,
    sourceGroupLabel: string,
    lessonId: string,
    summaryType: "short_summary" | "key_points",
    correctedContent: string,
    note: string,
  ) {
    const key = `apply-note:${lessonId}:${summaryType}:${note}`;
    setActiveKey(key);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/summaries/apply-note", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lessonId, summaryType, correctedContent, note }),
      });

      const payload = await readJsonResponse<{ ok?: boolean; error?: string }>(response);

      if (!response.ok) {
        throw new Error(
          formatRequestError(null, "A javítás beszúrása nem sikerult", {
            status: response.status,
            bodyError: payload.error,
          }),
        );
      }

      router.refresh();
      setMessage(`${sourceGroupLabel}: javítás beszúrva.`);
    } catch (applyError) {
      setError(formatRequestError(applyError, "A javítás beszúrása nem sikerult"));
    } finally {
      setActiveKey(null);
    }
  }

  async function requestReview(bookId: string) {
    const key = `request-review:${bookId}`;
    setActiveKey(key);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/progress/books", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          bookId,
          childName: learnerName,
          mode: "request_review",
        }),
      });

      const payload = await readJsonResponse<ProgressResponse>(response);

      if (!response.ok) {
        throw new Error(
          formatRequestError(null, "A készre jelölés nem sikerult", {
            status: response.status,
            bodyError: payload.error,
          }),
        );
      }

      setMessage("A téma késznek jelölve, most a szülő jóváhagyására vár.");
      router.refresh();
      setSubjectState((current) =>
        current.map((subjectItem) => ({
          ...subjectItem,
          topics: subjectItem.topics.map((topicItem) => ({
            ...topicItem,
            subblocks: topicItem.subblocks.map((subblockItem) =>
              subblockItem.book?.id !== bookId
                ? subblockItem
                : {
                    ...subblockItem,
                    progress: {
                      status: "needs_review",
                      completedAt: null,
                    },
                  },
            ),
          })),
        })),
      );
    } catch (progressError) {
      setError(formatRequestError(progressError, "A készre jelölés nem sikerult"));
    } finally {
      setActiveKey(null);
    }
  }

  async function approveDone(bookId: string) {
    const key = `approve:${bookId}`;
    setActiveKey(key);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/progress/books", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          childName: learnerName,
          bookId,
          mode: "approve",
        }),
      });

      const payload = await readJsonResponse<ProgressResponse>(response);

      if (!response.ok) {
        throw new Error(
          formatRequestError(null, "A szülői jóváhagyás nem sikerult", {
            status: response.status,
            bodyError: payload.error,
          }),
        );
      }

      setMessage("A szülő jóváhagyta a témát.");
      router.refresh();
      setSubjectState((current) =>
        current.map((subjectItem) => ({
          ...subjectItem,
          topics: subjectItem.topics.map((topicItem) => ({
            ...topicItem,
            subblocks: topicItem.subblocks.map((subblockItem) =>
              subblockItem.book?.id !== bookId
                ? subblockItem
                : {
                    ...subblockItem,
                    progress: {
                      ...subblockItem.progress,
                      status: "completed",
                      completedAt: new Date().toISOString(),
                    },
                  },
            ),
          })),
        })),
      );
    } catch (progressError) {
      setError(formatRequestError(progressError, "A szülői jóváhagyás nem sikerult"));
    } finally {
      setActiveKey(null);
    }
  }

  async function resetDone(bookId: string) {
    const key = `reset:${bookId}`;
    setActiveKey(key);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/progress/books", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          childName: learnerName,
          bookId,
          mode: "reset",
        }),
      });

      const payload = await readJsonResponse<ProgressResponse>(response);

      if (!response.ok) {
        throw new Error(
          formatRequestError(null, "A státusz visszavonása nem sikerult", {
            status: response.status,
            bodyError: payload.error,
          }),
        );
      }

      setMessage("A szülő visszavonta a kész státuszt.");
      router.refresh();
      setSubjectState((current) =>
        current.map((subjectItem) => ({
          ...subjectItem,
          topics: subjectItem.topics.map((topicItem) => ({
            ...topicItem,
            subblocks: topicItem.subblocks.map((subblockItem) =>
              subblockItem.book?.id !== bookId
                ? subblockItem
                : {
                    ...subblockItem,
                    progress: {
                      ...subblockItem.progress,
                      status: "in_progress",
                      completedAt: null,
                    },
                  },
            ),
          })),
        })),
      );
    } catch (progressError) {
      setError(formatRequestError(progressError, "A státusz visszavonása nem sikerult"));
    } finally {
      setActiveKey(null);
    }
  }

  async function submitQuiz(bookId: string, quizItems: Subblock["quizItems"]) {
    const answers = quizItems.map((item, index) => ({
      key: `${bookId}:${index}`,
      selected: quizSelections[`${bookId}:${index}`] ?? "",
      correct: item.correctAnswer,
    }));

    if (answers.some((item) => !item.selected)) {
      setError("A kvíz elküldéséhez minden kérdésre válaszolni kell.");
      setMessage(null);
      return;
    }

    const score = answers.filter((item) => item.selected === item.correct).length;
    const total = answers.length;
    const key = `quiz-submit:${bookId}`;
    setActiveKey(key);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/progress/books", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: "quiz",
          childName: learnerName,
          bookId,
          score,
          total,
        }),
      });

      const payload = await readJsonResponse<ProgressResponse>(response);

      if (!response.ok) {
        throw new Error(
          formatRequestError(null, "A kvíz eredményének mentése nem sikerult", {
            status: response.status,
            bodyError: payload.error,
          }),
        );
      }

      const now = new Date().toISOString();
      setQuizResults((current) => ({
        ...current,
        [bookId]: {
          score,
          total,
          answers: answers.map((item) => ({
            selected: item.selected,
            correct: item.correct,
          })),
        },
      }));
      setSubjectState((current) =>
        current.map((subjectItem) => ({
          ...subjectItem,
          topics: subjectItem.topics.map((topicItem) => ({
            ...topicItem,
            subblocks: topicItem.subblocks.map((subblockItem) =>
              subblockItem.book?.id !== bookId
                ? subblockItem
                : {
                    ...subblockItem,
                    progress: {
                      status: subblockItem.progress?.status === "completed" ? "completed" : "in_progress",
                      completedAt: subblockItem.progress?.completedAt ?? null,
                      quizScore: score,
                      quizTotal: total,
                      quizCompletedAt: now,
                    },
                  },
            ),
          })),
        })),
      );
      setMessage(null);
    } catch (quizSaveError) {
      setError(formatRequestError(quizSaveError, "A kvíz eredményének mentése nem sikerult"));
    } finally {
      setActiveKey(null);
    }
  }

  async function saveMissingSourceLink(subject: string, topicTitle: string, sourceGroupLabel: string) {
    const inputKey = `${subject}:${topicTitle}:${sourceGroupLabel}`;
    const url = overrideInputs[inputKey]?.trim() ?? "";

    if (!url) {
      setError("Adj meg egy NKP leckeoldal vagy közvetlen PDF linket.");
      setMessage(null);
      return;
    }

    const key = `override:${inputKey}`;
    setActiveKey(key);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/exam-sources/override", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ childId: learnerId, subject, topicTitle, sourceGroupLabel, url }),
      });

      const payload = await readJsonResponse<OverrideResponse>(response);

      if (!response.ok) {
        throw new Error(
          formatRequestError(null, "A forráslink mentése nem sikerult", {
            status: response.status,
            bodyError: payload.error,
          }),
        );
      }

      setOverrideInputs((current) => ({ ...current, [inputKey]: "" }));
      setSubjectState((current) =>
        current.map((subjectItem) =>
          subjectItem.subject !== subject
            ? subjectItem
            : {
                ...subjectItem,
                topics: subjectItem.topics.map((topicItem) =>
                  topicItem.title !== topicTitle
                    ? topicItem
                    : {
                        ...topicItem,
                        subblocks: topicItem.subblocks.map((subblockItem) =>
                          subblockItem.label !== sourceGroupLabel
                            ? subblockItem
                            : {
                                ...subblockItem,
                                status:
                                  countIngestableLinks(
                                    payload.alreadyExists
                                      ? subblockItem.links
                                      : [
                                          ...subblockItem.links,
                                          {
                                            url,
                                            sourceType: payload.sourceType ?? inferClientSourceType(url),
                                          },
                                        ],
                                  ) > 0
                                    ? "ready"
                                    : "missing",
                                urlCount: Math.max(1, subblockItem.urlCount + (payload.alreadyExists ? 0 : 1)),
                                links: payload.alreadyExists
                                  ? subblockItem.links
                                  : [
                                      ...subblockItem.links,
                                      { url, sourceType: payload.sourceType ?? inferClientSourceType(url) },
                                    ],
                              },
                        ),
                      },
                ),
              },
        ),
      );
      setMessage(
        payload.alreadyExists
          ? `${sourceGroupLabel}: ez a link már bent volt.`
          : `${sourceGroupLabel}: link elmentve, az alblokk most már ready.`,
      );
      router.refresh();
    } catch (overrideError) {
      setError(formatRequestError(overrideError, "A forráslink mentése nem sikerult"));
    } finally {
      setActiveKey(null);
    }
  }

  async function removeSourceLink(subject: string, topicTitle: string, sourceGroupLabel: string, url: string) {
    const confirmed = window.confirm("Biztosan törlöd ezt a linket?");
    if (!confirmed) {
      return;
    }

    const key = `delete-link:${subject}:${topicTitle}:${sourceGroupLabel}:${url}`;
    setActiveKey(key);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/exam-sources/override", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ childId: learnerId, subject, topicTitle, sourceGroupLabel, url }),
      });

      const payload = await readJsonResponse<OverrideResponse>(response);
      if (!response.ok) {
        throw new Error(
          formatRequestError(null, "A link törlése nem sikerult", {
            status: response.status,
            bodyError: payload.error,
          }),
        );
      }

      setSubjectState((current) =>
        current.map((subjectItem) =>
          subjectItem.subject !== subject
            ? subjectItem
            : {
                ...subjectItem,
                topics: subjectItem.topics.map((topicItem) =>
                  topicItem.title !== topicTitle
                    ? topicItem
                    : {
                        ...topicItem,
                        subblocks: topicItem.subblocks.map((subblockItem) =>
                          subblockItem.label !== sourceGroupLabel
                            ? subblockItem
                            : {
                                ...subblockItem,
                                links: subblockItem.links.filter((link) => link.url !== url),
                                urlCount: Math.max(0, subblockItem.links.filter((link) => link.url !== url).length),
                                status:
                                  countIngestableLinks(
                                    subblockItem.links.filter((link) => link.url !== url),
                                  ) > 0
                                    ? "ready"
                                    : "missing",
                              },
                        ),
                      },
                ),
              },
        ),
      );

      setMessage(`${sourceGroupLabel}: link törölve.`);
      router.refresh();
    } catch (deleteError) {
      setError(formatRequestError(deleteError, "A link törlése nem sikerult"));
    } finally {
      setActiveKey(null);
    }
  }

  async function unlockParentView() {
    const key = "parent-unlock";
    setActiveKey(key);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/admin-session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: parentPassword }),
      });

      const payload = await readJsonResponse<AdminSessionResponse>(response);

      if (!response.ok) {
        throw new Error(
          formatRequestError(null, "A szülői nézet feloldása nem sikerult", {
            status: response.status,
            bodyError: payload.error,
          }),
        );
      }

      setIsParentUnlocked(true);
      setParentPassword("");
      setMessage("Szülői nézet feloldva.");
    } catch (unlockError) {
      setError(formatRequestError(unlockError, "A szülői nézet feloldása nem sikerult"));
    } finally {
      setActiveKey(null);
    }
  }

  async function createChild() {
    const key = "create-child";
    setActiveKey(key);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/admin/children", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: newChildName,
          grade: Number(newChildGrade),
        }),
      });

      const payload = await readJsonResponse<CreateChildResponse>(response);
      if (!response.ok) {
        throw new Error(
          formatRequestError(null, "A gyerek felvitele nem sikerult", {
            status: response.status,
            bodyError: payload.error,
          }),
        );
      }

      setLearnerState((current) => [
        ...current,
        {
          id: payload.child.id,
          name: payload.child.name,
          grade: payload.child.grade ?? 5,
        },
      ]);
      setNewChildName("");
      setNewChildGrade("5");
      setMessage(`Új gyerek felvéve: ${payload.child.name}.`);
      router.refresh();
      selectLearner(payload.child.id);
    } catch (createError) {
      setError(formatRequestError(createError, "A gyerek felvitele nem sikerult"));
    } finally {
      setActiveKey(null);
    }
  }

  async function createSubject() {
    const key = "create-subject";
    setActiveKey(key);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/admin/curriculum", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          entity: "subject",
          grade: Number.parseInt(gradeLabel, 10),
          name: newSubjectName,
          childId: learnerId,
        }),
      });

      const payload = await readJsonResponse<CreateCurriculumResponse>(response);
      if (!response.ok || !payload.subject) {
        throw new Error(
          formatRequestError(null, "A tantárgy létrehozása nem sikerult", {
            status: response.status,
            bodyError: payload.error,
          }),
        );
      }
      const createdSubject = payload.subject;

      setSubjectState((current) => [
        ...current,
        {
          id: createdSubject.id,
          subject: createdSubject.name,
          knowledgeBase: null,
          topics: [],
        },
      ]);
      setNewSubjectName("");
      setMessage(`Új tantárgy létrehozva: ${createdSubject.name}.`);
      router.refresh();
    } catch (createError) {
      setError(formatRequestError(createError, "A tantárgy létrehozása nem sikerult"));
    } finally {
      setActiveKey(null);
    }
  }

  async function createTopic(subjectId: string, subjectName: string) {
    const input = newTopicTitles[subjectId]?.trim() ?? "";
    if (!input) {
      return;
    }

    const key = `create-topic:${subjectId}`;
    setActiveKey(key);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/admin/curriculum", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          entity: "topic",
          subjectId,
          title: input,
        }),
      });

      const payload = await readJsonResponse<CreateCurriculumResponse>(response);
      if (!response.ok || !payload.topic) {
        throw new Error(
          formatRequestError(null, "A blokk létrehozása nem sikerult", {
            status: response.status,
            bodyError: payload.error,
          }),
        );
      }
      const createdTopic = payload.topic;

      setSubjectState((current) =>
        current.map((subject) =>
          subject.id !== subjectId
            ? subject
            : {
                ...subject,
                topics: [
                  ...subject.topics,
                  {
                    id: createdTopic.id,
                    title: createdTopic.title,
                    subblocks: [],
                  },
                ],
              },
        ),
      );
      setNewTopicTitles((current) => ({ ...current, [subjectId]: "" }));
      setMessage(`${subjectName}: új blokk létrehozva.`);
      router.refresh();
    } catch (createError) {
      setError(formatRequestError(createError, "A blokk létrehozása nem sikerult"));
    } finally {
      setActiveKey(null);
    }
  }

  async function createSubblock(subjectName: string, topicId: string, topicTitle: string) {
    const input = newSubblockTitles[topicId]?.trim() ?? "";
    if (!input) {
      return;
    }

    const key = `create-subblock:${topicId}`;
    setActiveKey(key);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/admin/curriculum", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          entity: "subblock",
          topicId,
          title: input,
        }),
      });

      const payload = await readJsonResponse<CreateCurriculumResponse>(response);
      if (!response.ok || !payload.subblock) {
        throw new Error(
          formatRequestError(null, "Az alblokk létrehozása nem sikerult", {
            status: response.status,
            bodyError: payload.error,
          }),
        );
      }
      const createdSubblock = payload.subblock;

      setSubjectState((current) =>
        current.map((subject) =>
          subject.subject !== subjectName
            ? subject
            : {
                ...subject,
                topics: subject.topics.map((topic) =>
                  topic.id !== topicId
                    ? topic
                    : {
                        ...topic,
                        subblocks: [
                          ...topic.subblocks,
                          {
                            label: createdSubblock.title,
                            status: "missing",
                            urlCount: 0,
                            links: [],
                            book: null,
                            progress: null,
                            summaries: [],
                            summaryReviews: [],
                            summaryJob: null,
                            quizItems: [],
                            ingestItems: [],
                          },
                        ],
                      },
                ),
              },
        ),
      );
      setNewSubblockTitles((current) => ({ ...current, [topicId]: "" }));
      setMessage(`${topicTitle}: új alblokk létrehozva.`);
      router.refresh();
    } catch (createError) {
      setError(formatRequestError(createError, "Az alblokk létrehozása nem sikerult"));
    } finally {
      setActiveKey(null);
    }
  }

  async function renameSubject(subjectId: string, currentName: string) {
    const nextName = window.prompt("Új tantárgynév", currentName)?.trim();
    if (!nextName || nextName === currentName) {
      return;
    }

    const key = `rename-subject:${subjectId}`;
    setActiveKey(key);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/admin/curriculum", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          entity: "subject",
          id: subjectId,
          name: nextName,
        }),
      });

      const payload = await readJsonResponse<CreateCurriculumResponse>(response);
      if (!response.ok || !payload.subject) {
        throw new Error(
          formatRequestError(null, "A tantárgy átnevezése nem sikerult", {
            status: response.status,
            bodyError: payload.error,
          }),
        );
      }

      setSubjectState((current) =>
        current.map((subject) =>
          subject.id !== subjectId ? subject : { ...subject, subject: payload.subject!.name },
        ),
      );
      setMessage(`Tantárgy átnevezve: ${payload.subject.name}.`);
      router.refresh();
    } catch (renameError) {
      setError(formatRequestError(renameError, "A tantárgy átnevezése nem sikerult"));
    } finally {
      setActiveKey(null);
    }
  }

  async function deleteSubject(subjectId: string, subjectName: string) {
    if (!window.confirm(`Törlöd ezt a tantárgyat: ${subjectName}?`)) {
      return;
    }

    const key = `delete-subject:${subjectId}`;
    setActiveKey(key);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/admin/curriculum", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          entity: "subject",
          id: subjectId,
        }),
      });

      const payload = await readJsonResponse<DeleteResponse>(response);
      if (!response.ok) {
        throw new Error(
          formatRequestError(null, "A tantárgy törlése nem sikerult", {
            status: response.status,
            bodyError: payload.error,
          }),
        );
      }

      setSubjectState((current) => current.filter((subject) => subject.id !== subjectId));
      setMessage(`Tantárgy törölve: ${subjectName}.`);
      router.refresh();
    } catch (deleteError) {
      setError(formatRequestError(deleteError, "A tantárgy törlése nem sikerult"));
    } finally {
      setActiveKey(null);
    }
  }

  async function renameTopic(subjectId: string, topicId: string, currentTitle: string) {
    const nextTitle = window.prompt("Új blokkcím", currentTitle)?.trim();
    if (!nextTitle || nextTitle === currentTitle) {
      return;
    }

    const key = `rename-topic:${topicId}`;
    setActiveKey(key);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/admin/curriculum", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          entity: "topic",
          id: topicId,
          title: nextTitle,
        }),
      });

      const payload = await readJsonResponse<CreateCurriculumResponse>(response);
      if (!response.ok || !payload.topic) {
        throw new Error(
          formatRequestError(null, "A blokk átnevezése nem sikerult", {
            status: response.status,
            bodyError: payload.error,
          }),
        );
      }

      setSubjectState((current) =>
        current.map((subject) =>
          subject.id !== subjectId
            ? subject
            : {
                ...subject,
                topics: subject.topics.map((topic) =>
                  topic.id !== topicId ? topic : { ...topic, title: payload.topic!.title },
                ),
              },
        ),
      );
      setMessage(`Blokk átnevezve: ${payload.topic.title}.`);
      router.refresh();
    } catch (renameError) {
      setError(formatRequestError(renameError, "A blokk átnevezése nem sikerult"));
    } finally {
      setActiveKey(null);
    }
  }

  async function deleteTopic(subjectId: string, topicId: string, topicTitle: string) {
    if (!window.confirm(`Törlöd ezt a blokkot: ${topicTitle}?`)) {
      return;
    }

    const key = `delete-topic:${topicId}`;
    setActiveKey(key);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/admin/curriculum", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          entity: "topic",
          id: topicId,
        }),
      });

      const payload = await readJsonResponse<DeleteResponse>(response);
      if (!response.ok) {
        throw new Error(
          formatRequestError(null, "A blokk törlése nem sikerult", {
            status: response.status,
            bodyError: payload.error,
          }),
        );
      }

      setSubjectState((current) =>
        current.map((subject) =>
          subject.id !== subjectId
            ? subject
            : {
                ...subject,
                topics: subject.topics.filter((topic) => topic.id !== topicId),
              },
        ),
      );
      setMessage(`Blokk törölve: ${topicTitle}.`);
      router.refresh();
    } catch (deleteError) {
      setError(formatRequestError(deleteError, "A blokk törlése nem sikerult"));
    } finally {
      setActiveKey(null);
    }
  }

  async function renameSubblock(
    subjectName: string,
    topicId: string,
    topicTitle: string,
    currentLabel: string,
  ) {
    const nextTitle = window.prompt("Új alblokkcím", currentLabel)?.trim();
    if (!nextTitle || nextTitle === currentLabel) {
      return;
    }

    const key = `rename-subblock:${topicId}:${currentLabel}`;
    setActiveKey(key);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/admin/curriculum", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          entity: "subblock",
          topicId,
          title: currentLabel,
          nextTitle,
        }),
      });

      const payload = await readJsonResponse<CreateCurriculumResponse>(response);
      if (!response.ok || !payload.subblock) {
        throw new Error(
          formatRequestError(null, "Az alblokk átnevezése nem sikerult", {
            status: response.status,
            bodyError: payload.error,
          }),
        );
      }

      setSubjectState((current) =>
        current.map((subject) =>
          subject.subject !== subjectName
            ? subject
            : {
                ...subject,
                topics: subject.topics.map((topic) =>
                  topic.id !== topicId
                    ? topic
                    : {
                        ...topic,
                        subblocks: topic.subblocks.map((subblock) =>
                          subblock.label !== currentLabel
                            ? subblock
                            : { ...subblock, label: payload.subblock!.title },
                        ),
                      },
                ),
              },
        ),
      );
      setMessage(`${topicTitle}: alblokk átnevezve.`);
      router.refresh();
    } catch (renameError) {
      setError(formatRequestError(renameError, "Az alblokk átnevezése nem sikerult"));
    } finally {
      setActiveKey(null);
    }
  }

  async function deleteSubblock(
    subjectName: string,
    topicId: string,
    topicTitle: string,
    label: string,
  ) {
    if (!window.confirm(`Törlöd ezt az alblokkot: ${label}?`)) {
      return;
    }

    const key = `delete-subblock:${topicId}:${label}`;
    setActiveKey(key);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/admin/curriculum", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          entity: "subblock",
          topicId,
          title: label,
        }),
      });

      const payload = await readJsonResponse<DeleteResponse>(response);
      if (!response.ok) {
        throw new Error(
          formatRequestError(null, "Az alblokk törlése nem sikerult", {
            status: response.status,
            bodyError: payload.error,
          }),
        );
      }

      setSubjectState((current) =>
        current.map((subject) =>
          subject.subject !== subjectName
            ? subject
            : {
                ...subject,
                topics: subject.topics.map((topic) =>
                  topic.id !== topicId
                    ? topic
                    : {
                        ...topic,
                        subblocks: topic.subblocks.filter((subblock) => subblock.label !== label),
                      },
                ),
              },
        ),
      );
      setMessage(`${topicTitle}: alblokk törölve.`);
      router.refresh();
    } catch (deleteError) {
      setError(formatRequestError(deleteError, "Az alblokk törlése nem sikerult"));
    } finally {
      setActiveKey(null);
    }
  }

  function buildCombinedSummary(
    summaries: SubblockSummary[],
    type: "short_summary" | "child_friendly_explanation",
  ) {
    const latestByLesson = new Map<string, SubblockSummary>();
    for (const summary of [...summaries]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .filter((summary) => summary.type === type && !isMetaLessonTitle(summary.lessonTitle))) {
      if (!latestByLesson.has(summary.lessonTitle)) {
        latestByLesson.set(summary.lessonTitle, summary);
      }
    }

    const filtered = Array.from(latestByLesson.values())
      .map((summary) => summary.content.trim())
      .filter(Boolean);

    const unique = [...new Set(filtered)];
    if (unique.length === 0) {
      return null;
    }

    return unique.join("\n\n");
  }

  function buildKeyPoints(summaries: SubblockSummary[]) {
    const latestByLesson = new Map<string, SubblockSummary>();
    for (const summary of [...summaries]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .filter((summary) => summary.type === "key_points" && !isMetaLessonTitle(summary.lessonTitle))) {
      if (!latestByLesson.has(summary.lessonTitle)) {
        latestByLesson.set(summary.lessonTitle, summary);
      }
    }

    return [...new Set(
      Array.from(latestByLesson.values())
        .flatMap((summary) =>
          summary.content
            .split(/\n+/)
            .map((item) => item.replace(/^[-*•]\s*/, "").trim())
            .filter(Boolean),
        ),
    )];
  }

  function getLatestSummarySourceMode(summaries: SubblockSummary[]) {
    return (
      [...summaries]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .find((summary) => !isMetaLessonTitle(summary.lessonTitle))?.sourceMode ?? "legacy"
    );
  }

  function buildSummaryReviewCards(reviews: SubblockSummaryReview[]) {
    const byLessonAndType = new Map<string, SubblockSummaryReview>();

    for (const review of [...reviews].sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
      const key = `${review.lessonId}:${review.summaryType}`;
      if (!byLessonAndType.has(key)) {
        byLessonAndType.set(key, review);
      }
    }

    return Array.from(byLessonAndType.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  const completedCount = subjectState
    .flatMap((subject) => subject.topics)
    .flatMap((topic) => topic.subblocks)
    .filter((subblock) => subblock.progress?.status === "completed").length;
  const totalSubblocks = subjectState.flatMap((subject) => subject.topics).flatMap((topic) => topic.subblocks).length;
  const totalMissingSources = subjectState
    .flatMap((subject) => subject.topics)
    .flatMap((topic) => topic.subblocks)
    .filter((subblock) => subblock.status === "missing").length;
  const totalQuizCompleted = subjectState
    .flatMap((subject) => subject.topics)
    .flatMap((topic) => topic.subblocks)
    .filter((subblock) => typeof subblock.progress?.quizScore === "number").length;

  const parentSubjectStats = subjectState.map((subject) => {
    const subblocks = subject.topics.flatMap((topic) => topic.subblocks);
    const completed = subblocks.filter((subblock) => subblock.progress?.status === "completed").length;
    const missing = subblocks.filter((subblock) => subblock.status === "missing").length;
    const quizDone = subblocks.filter((subblock) => typeof subblock.progress?.quizScore === "number").length;

    return {
      subject: subject.subject,
      total: subblocks.length,
      completed,
      missing,
      quizDone,
    };
  });

  const parentTopicStats = subjectState.flatMap((subject) =>
    subject.topics.map((topic) => {
      const completed = topic.subblocks.filter((subblock) => subblock.progress?.status === "completed").length;
      const missing = topic.subblocks.filter((subblock) => subblock.status === "missing").length;
      const quizDone = topic.subblocks.filter((subblock) => typeof subblock.progress?.quizScore === "number").length;

      return {
        subject: subject.subject,
        title: topic.title,
        total: topic.subblocks.length,
        completed,
        missing,
        quizDone,
      };
    }),
  );

  return (
    <section className="rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-6 shadow-[0_18px_48px_rgba(23,32,42,0.06)] backdrop-blur">
      <h1 className="mt-3 text-4xl font-semibold tracking-tight">Tanulási tér</h1>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 rounded-full border border-[var(--line)] bg-white px-3 py-2 text-sm font-semibold text-[var(--ink)]">
          <span>Gyerek</span>
          <select
            value={learnerId}
            onChange={(event) => selectLearner(event.target.value)}
            className="bg-transparent outline-none"
          >
            {learnerState.map((learner) => (
              <option key={learner.id} value={learner.id}>
                {learner.name} ({learner.grade}. osztály)
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => setMode("parent")}
          className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
            mode === "parent" ? "bg-[var(--accent)] text-white" : "border border-[var(--line)] bg-white"
          }`}
        >
          Szülő / admin
        </button>
        <button
          type="button"
          onClick={() => setMode("child")}
          className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
            mode === "child" ? "bg-[var(--accent)] text-white" : "border border-[var(--line)] bg-white"
          }`}
        >
          Gyerek nézet
        </button>
      </div>

      {mode === "child" ? (
        <div className="mt-6 rounded-[1.5rem] border border-[var(--line)] bg-white/90 p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-lg font-semibold">Haladás</p>
              <p className="text-base text-[var(--ink)]">
                {completedCount} / {totalSubblocks} alblokk kész
              </p>
            </div>
            {completedCount > 0 ? (
              <div className="rounded-full bg-[#fff0c7] px-4 py-2 text-sm font-semibold text-[#7e5b00]">
                Rakétafokozat: {completedCount}
              </div>
            ) : null}
          </div>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-[#efe7d7]">
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,#ffb84d_0%,#f47c48_50%,#6cc36c_100%)] transition-all"
              style={{ width: `${totalSubblocks === 0 ? 0 : (completedCount / totalSubblocks) * 100}%` }}
            />
          </div>
        </div>
      ) : null}

      {mode === "parent" && isParentUnlocked ? (
        <div className="mt-6 space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-[1.4rem] border border-[var(--line)] bg-white p-5">
              <p className="text-lg font-semibold">Gyerek admin</p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <input
                  type="text"
                  value={newChildName}
                  onChange={(event) => setNewChildName(event.target.value)}
                  placeholder="Új gyerek neve"
                  className="min-w-0 flex-1 rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-sm text-[var(--ink)] outline-none"
                />
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={newChildGrade}
                  onChange={(event) => setNewChildGrade(event.target.value)}
                  className="w-28 rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-sm text-[var(--ink)] outline-none"
                />
                <button
                  type="button"
                  onClick={createChild}
                  disabled={activeKey === "create-child" || newChildName.trim().length === 0}
                  className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {activeKey === "create-child" ? "Mentés..." : "Gyerek felvitele"}
                </button>
              </div>
            </div>

            <div className="rounded-[1.4rem] border border-[var(--line)] bg-white p-5">
              <p className="text-lg font-semibold">Tantárgy admin</p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <input
                  type="text"
                  value={newSubjectName}
                  onChange={(event) => setNewSubjectName(event.target.value)}
                  placeholder="Új tantárgy neve"
                  className="min-w-0 flex-1 rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-sm text-[var(--ink)] outline-none"
                />
                <button
                  type="button"
                  onClick={createSubject}
                  disabled={activeKey === "create-subject" || newSubjectName.trim().length === 0}
                  className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {activeKey === "create-subject" ? "Mentés..." : "Tantárgy létrehozása"}
                </button>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-[1.4rem] border border-[var(--line)] bg-white p-5">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--accent-strong)]">Kész alblokkok</p>
              <p className="mt-2 text-3xl font-semibold">{completedCount} / {totalSubblocks}</p>
              <p className="mt-2 text-sm text-[var(--ink)]">{percentage(completedCount, totalSubblocks)}% kész</p>
            </div>
            <div className="rounded-[1.4rem] border border-[var(--line)] bg-white p-5">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--accent-strong)]">Hiányzó források</p>
              <p className="mt-2 text-3xl font-semibold">{totalMissingSources}</p>
              <p className="mt-2 text-sm text-[var(--ink)]">Ennyi alblokk vár még linkpótlásra.</p>
            </div>
            <div className="rounded-[1.4rem] border border-[var(--line)] bg-white p-5">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--accent-strong)]">Kitöltött kvízek</p>
              <p className="mt-2 text-3xl font-semibold">{totalQuizCompleted}</p>
              <p className="mt-2 text-sm text-[var(--ink)]">Ennyi alblokkhoz van már elmentett kvízeredmény.</p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_1.15fr]">
            <div className="rounded-[1.4rem] border border-[var(--line)] bg-white p-5">
              <p className="text-lg font-semibold">Tantárgyi áttekintés</p>
              <div className="mt-4 space-y-4">
                {parentSubjectStats.map((stat) => (
                  <div key={stat.subject} className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-base font-semibold">{stat.subject}</p>
                      <p className="text-sm text-[var(--ink)]">{stat.completed}/{stat.total} kész</p>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#efe7d7]">
                      <div
                        className="h-full rounded-full bg-[linear-gradient(90deg,#ffb84d_0%,#f47c48_50%,#6cc36c_100%)]"
                        style={{ width: `${percentage(stat.completed, stat.total)}%` }}
                      />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ink)]">
                      <span className="rounded-full bg-white px-3 py-1">{stat.missing} hiányzik</span>
                      <span className="rounded-full bg-white px-3 py-1">{stat.quizDone} kvíz kész</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[1.4rem] border border-[var(--line)] bg-white p-5">
              <p className="text-lg font-semibold">Blokkok állapota</p>
              <div className="mt-4 space-y-3">
                {parentTopicStats.map((stat) => (
                  <div key={`${stat.subject}:${stat.title}`} className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--accent-strong)]">{stat.subject}</p>
                        <p className="mt-1 text-base font-semibold">{stat.title}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">{stat.completed}/{stat.total}</p>
                        <p className="text-xs text-[var(--ink)]">kész</p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ink)]">
                      <span className="rounded-full bg-white px-3 py-1">{stat.missing} hiányzó link</span>
                      <span className="rounded-full bg-white px-3 py-1">{stat.quizDone} kvíz</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {mode === "parent" && !isParentUnlocked ? (
        <div className="mt-6 max-w-xl rounded-[1.5rem] border border-[var(--line)] bg-white p-5">
          <p className="text-xl font-semibold">Szülői nézet zárolva</p>
          <p className="mt-2 text-base leading-7 text-[var(--ink)]">
            A szülői felületen látszik a forrásállapot, az ingest, az összefoglaló-generálás és a gyerek készültsége. Ehhez jelszó kell.
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              type="password"
              value={parentPassword}
              onChange={(event) => setParentPassword(event.target.value)}
              placeholder="Szülői jelszó"
              className="min-w-0 flex-1 rounded-full border border-[var(--line)] bg-white px-4 py-3 text-base text-[var(--ink)] outline-none placeholder:text-[#7a7a7a]"
            />
            <button
              type="button"
              onClick={unlockParentView}
              disabled={activeKey === "parent-unlock" || parentPassword.trim().length === 0}
              className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {activeKey === "parent-unlock" ? "Feloldás..." : "Belépés"}
            </button>
          </div>
        </div>
      ) : null}

      {message ? <div className="mt-4 rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm">{message}</div> : null}
      {error ? <div className="mt-4 rounded-2xl border border-[#d7a0a0] bg-[#fff1f1] px-4 py-3 text-sm text-[#7a2424]">{error}</div> : null}

      <div className="mt-6 space-y-5">
        {subjectState.map((subject) => (
          <details key={subject.subject} className="rounded-[1.75rem] border border-[var(--line)] bg-white/75 p-5">
            <summary className="cursor-pointer list-none">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-3xl font-semibold">{subject.subject}</p>
                  <p className="mt-1 text-base text-[var(--ink)]">{subject.topics.length} blokk</p>
                </div>
                {mode === "parent" && isParentUnlocked && subject.id ? (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        renameSubject(subject.id!, subject.subject);
                      }}
                      disabled={activeKey === `rename-subject:${subject.id}`}
                      className="rounded-full border border-[var(--line)] bg-white px-3 py-1 text-xs font-semibold disabled:opacity-50"
                    >
                      Átnevezés
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        deleteSubject(subject.id!, subject.subject);
                      }}
                      disabled={activeKey === `delete-subject:${subject.id}`}
                      className="rounded-full border border-[var(--line)] bg-white px-3 py-1 text-xs font-semibold disabled:opacity-50"
                    >
                      Törlés
                    </button>
                  </div>
                ) : null}
              </div>
            </summary>

            <div className="mt-5 space-y-4">
              {mode === "parent" && isParentUnlocked && subject.id ? (
                <section className="rounded-[1.5rem] border border-[var(--line)] bg-[var(--surface)] p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xl font-semibold">Tantárgyi PDF tudásbázis</p>
                      <p className="mt-1 text-base text-[var(--ink)]">
                        Átállási alap a linkes ingest helyett. A következő körben ide jön a PDF feltöltés és a vector store build.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => initializeSubjectKnowledgeBase(subject.id!, subject.subject)}
                      disabled={
                        activeKey === `knowledge-base-init:${subject.id}` ||
                        activeKey === `knowledge-base-process:${subject.id}`
                      }
                      className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
                    >
                      {activeKey === `knowledge-base-init:${subject.id}`
                        ? "Inicializálás..."
                        : subject.knowledgeBase
                          ? "Tudásbázis megnyitva"
                          : "Tudásbázis inicializálása"}
                    </button>
                    {subject.knowledgeBase ? (
                      <button
                        type="button"
                        onClick={() =>
                          processKnowledgeBase(subject.id!, subject.subject, subject.knowledgeBase!.id)
                        }
                        disabled={
                          activeKey === `knowledge-base-process:${subject.id}` ||
                          subject.knowledgeBase.fileCount === 0
                        }
                        className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
                      >
                        {activeKey === `knowledge-base-process:${subject.id}` ? "Feldolgozás..." : "PDF-ek feldolgozása"}
                      </button>
                    ) : null}
                    {subject.knowledgeBase ? (
                      <button
                        type="button"
                        onClick={() =>
                          buildKnowledgeBaseVectorStore(subject.id!, subject.subject, subject.knowledgeBase!.id)
                        }
                        disabled={
                          activeKey === `knowledge-base-build:${subject.id}` ||
                          subject.knowledgeBase.segments.length === 0
                        }
                        className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
                      >
                        {activeKey === `knowledge-base-build:${subject.id}` ? "Build..." : "Vector store build"}
                      </button>
                    ) : null}
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-4">
                    <div className="rounded-xl border border-[var(--line)] bg-white px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--ink)]">Állapot</p>
                      <p className="mt-2 text-base font-semibold text-[var(--ink)]">
                        {subject.knowledgeBase ? knowledgeBaseStatusLabel(subject.knowledgeBase.status) : "Még nincs"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-[var(--line)] bg-white px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--ink)]">Provider</p>
                      <p className="mt-2 text-base font-semibold text-[var(--ink)]">
                        {subject.knowledgeBase?.provider === "openai_vector_store" ? "OpenAI vector store" : "Nincs még"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-[var(--line)] bg-white px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--ink)]">PDF-ek</p>
                      <p className="mt-2 text-base font-semibold text-[var(--ink)]">
                        {subject.knowledgeBase?.fileCount ?? 0}
                      </p>
                    </div>
                    <div className="rounded-xl border border-[var(--line)] bg-white px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--ink)]">Utolsó build</p>
                      <p className="mt-2 text-base font-semibold text-[var(--ink)]">
                        {formatTimestamp(subject.knowledgeBase?.lastBuiltAt ?? null) ?? "Még nem volt"}
                      </p>
                    </div>
                  </div>

                  {subject.knowledgeBase?.vectorStoreId ? (
                    <p className="mt-4 break-all rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm text-[var(--ink)]">
                      Vector store: {subject.knowledgeBase.vectorStoreId}
                    </p>
                  ) : null}

                  {subject.knowledgeBase?.errorMessage ? (
                    <p className="mt-4 rounded-xl bg-[#fff1f1] px-3 py-2 text-sm text-[#8a2e2e]">
                      {subject.knowledgeBase.errorMessage}
                    </p>
                  ) : null}

                  {subject.knowledgeBase ? (
                    <div className="mt-4 rounded-xl border border-dashed border-[var(--line)] bg-white px-4 py-4">
                      <p className="text-sm font-semibold text-[var(--ink)]">PDF feltöltés ehhez a tantárgyhoz</p>
                      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                        <input
                          type="file"
                          accept="application/pdf"
                          onChange={(event) =>
                            {
                              const nextFile = event.target.files?.[0] ?? null;
                              setKnowledgeBaseUploads((current) => ({
                                ...current,
                                [subject.id!]: nextFile,
                              }));
                              setKnowledgeBaseUploadNames((current) => ({
                                ...current,
                                [subject.id!]: nextFile?.name ?? null,
                              }));
                            }
                          }
                          className="min-w-0 flex-1 text-sm text-[var(--ink)]"
                        />
                        <button
                          type="button"
                          onClick={() => uploadKnowledgeBasePdf(subject.id!, subject.subject)}
                          disabled={activeKey === `knowledge-base-upload:${subject.id}` || !knowledgeBaseUploads[subject.id]}
                          className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
                        >
                          {activeKey === `knowledge-base-upload:${subject.id}` ? "Feltöltés..." : "PDF feltöltése"}
                        </button>
                      </div>
                      <p className="mt-2 text-xs text-[var(--ink)]">
                        {knowledgeBaseUploadNames[subject.id!] ? `Kiválasztott fájl: ${knowledgeBaseUploadNames[subject.id!]}` : "Még nincs kiválasztott PDF."}
                      </p>

                      <div className="mt-4 space-y-2">
                        {subject.knowledgeBase.files.length > 0 ? (
                          subject.knowledgeBase.files.map((file) => (
                            <div
                              key={file.id}
                              className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-3"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-sm font-semibold text-[var(--ink)]">{file.fileName}</p>
                                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[var(--ink)]">
                                  {file.processingStatus}
                                </span>
                              </div>
                              <p className="mt-1 text-xs text-[var(--ink)]">
                                {file.mimeType} · {file.fileSizeBytes ? `${Math.round(file.fileSizeBytes / 1024 / 1024)} MB` : "ismeretlen méret"}
                              </p>
                              <p className="mt-1 text-xs text-[var(--ink)]">
                                Feltöltve: {formatTimestamp(file.createdAt)}
                              </p>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-[var(--ink)]">Ehhez a tantárgyhoz még nincs feltöltött PDF.</p>
                        )}
                      </div>

                      {subject.knowledgeBase.segments.length > 0 ? (
                        <div className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-3">
                          <p className="text-sm font-semibold text-[var(--ink)]">Tisztított preview</p>
                          <div className="mt-3 space-y-3">
                            {subject.knowledgeBase.segments.slice(0, 5).map((segment) => (
                              <div key={segment.id} className="rounded-xl border border-[var(--line)] bg-white px-3 py-3">
                                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--ink)]">
                                  {segment.segmentType} · oldal {segment.pageNumber}
                                </p>
                                <p className="mt-2 whitespace-pre-line text-sm leading-6 text-[var(--ink)]">
                                  {segment.cleanedText.slice(0, 500)}
                                  {segment.cleanedText.length > 500 ? "..." : ""}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </section>
              ) : null}

              {subject.topics.map((topic) => (
                <section key={`${subject.subject}:${topic.title}`} className="rounded-[1.5rem] border border-[var(--line)] bg-[var(--surface)] p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-2xl font-semibold">{topic.title}</p>
                      <p className="mt-1 text-base text-[var(--ink)]">{topic.subblocks.length} alblokk</p>
                    </div>
                    {mode === "parent" && isParentUnlocked && topic.id && subject.id ? (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => renameTopic(subject.id!, topic.id!, topic.title)}
                          disabled={activeKey === `rename-topic:${topic.id}`}
                          className="rounded-full border border-[var(--line)] bg-white px-3 py-1 text-xs font-semibold disabled:opacity-50"
                        >
                          Átnevezés
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteTopic(subject.id!, topic.id!, topic.title)}
                          disabled={activeKey === `delete-topic:${topic.id}`}
                          className="rounded-full border border-[var(--line)] bg-white px-3 py-1 text-xs font-semibold disabled:opacity-50"
                        >
                          Törlés
                        </button>
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-4 space-y-4">
                    {mode === "parent" && isParentUnlocked && topic.id ? (
                      <div className="rounded-xl border border-dashed border-[var(--line)] bg-white px-4 py-4">
                        <p className="text-sm font-semibold text-[var(--ink)]">Új alblokk ehhez a blokkhoz</p>
                        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                          <input
                            type="text"
                            value={newSubblockTitles[topic.id] ?? ""}
                            onChange={(event) =>
                              setNewSubblockTitles((current) => ({
                                ...current,
                                [topic.id!]: event.target.value,
                              }))
                            }
                            placeholder="Új alblokk címe"
                            className="min-w-0 flex-1 rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-sm text-[var(--ink)] outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => createSubblock(subject.subject, topic.id!, topic.title)}
                            disabled={activeKey === `create-subblock:${topic.id}` || !(newSubblockTitles[topic.id] ?? "").trim()}
                            className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
                          >
                            {activeKey === `create-subblock:${topic.id}` ? "Mentés..." : "Alblokk hozzáadása"}
                          </button>
                        </div>
                      </div>
                    ) : null}
                    {topic.subblocks.map((subblock) => {
                      const visibleSummaries =
                        mode === "child"
                          ? subblock.summaries.filter(
                              (summary) =>
                                summary.type === "short_summary" &&
                                summary.approved &&
                                !isMetaLessonTitle(summary.lessonTitle),
                            )
                          : subblock.summaries.filter(
                              (summary) => !isMetaLessonTitle(summary.lessonTitle),
                            );
                      const childApprovedSummaries = subblock.summaries.filter(
                        (summary) => summary.approved && !isMetaLessonTitle(summary.lessonTitle),
                      );

                      const hasVectorStore = Boolean(subject.knowledgeBase?.vectorStoreId);
                      const canSummarize = Boolean(subblock.book);
                      const combinedSummary = buildCombinedSummary(subblock.summaries, "short_summary") ?? "";
                      const combinedKeyPoints = buildKeyPoints(subblock.summaries);
                      const seedKey = `seed:${subject.subject}:${topic.title}:${subblock.label}`;
                      const summaryKey = `summary:${subject.subject}:${topic.title}:${subblock.label}`;
                      const factCheckKey = `fact-check:${subject.subject}:${topic.title}:${subblock.label}`;
                      const quizKey = `quiz:${subject.subject}:${topic.title}:${subblock.label}`;
                      const requestReviewKey = subblock.book ? `request-review:${subblock.book.id}` : null;
                      const approveKey = subblock.book ? `approve:${subblock.book.id}` : null;
                      const resetKey = subblock.book ? `reset:${subblock.book.id}` : null;
                      const overrideInputKey = `${subject.subject}:${topic.title}:${subblock.label}`;
                      const overrideSaveKey = `override:${overrideInputKey}`;
                      const subblockBusyPrefix = `${subject.subject}:${topic.title}:${subblock.label}`;
                      const isSubblockBusy =
                        activeKey === `seed:${subblockBusyPrefix}` ||
                        activeKey === `summary:${subblockBusyPrefix}` ||
                        activeKey === `fact-check:${subblockBusyPrefix}` ||
                        activeKey === `quiz:${subblockBusyPrefix}` ||
                        activeKey === `override:${subblockBusyPrefix}` ||
                        (subblock.book ? activeKey === `request-review:${subblock.book.id}` : false) ||
                        (subblock.book ? activeKey === `approve:${subblock.book.id}` : false) ||
                        (subblock.book ? activeKey === `reset:${subblock.book.id}` : false) ||
                        (subblock.book ? activeKey === `quiz-submit:${subblock.book.id}` : false);

                      return (
                        <div
                          key={`${topic.title}:${subblock.label}`}
                          className={`rounded-[1.25rem] border p-4 ${
                            mode === "child"
                              ? subblock.progress?.status === "completed"
                                ? "border-[#b8dca7] bg-[linear-gradient(180deg,#fffef8_0%,#f4ffe8_100%)] shadow-[0_18px_40px_rgba(123,163,74,0.10)]"
                                : "border-[#eadfcb] bg-[linear-gradient(180deg,#ffffff_0%,#fff9ef_100%)]"
                              : "border-[var(--line)] bg-white/85"
                          }`}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-4">
                            <div>
                              <p className="text-xl font-semibold">{subblock.label}</p>
                              {mode === "parent" ? (
                                <p className="mt-1 text-base text-[var(--ink)]">
                                  {subblock.status === "ready" ? "Van forrás" : "Hiányzik a forrás"}
                                </p>
                              ) : (
                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                  <span
                                    className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] ${
                                      subblock.progress?.status === "completed"
                                        ? "bg-[#dff5c7] text-[#48611f]"
                                        : visibleSummaries.length > 0
                                          ? "bg-[#ffe8bf] text-[#8b5a00]"
                                          : "bg-white text-[var(--ink)]"
                                    }`}
                                  >
                                    {subblock.progress?.status === "completed"
                                      ? "Kész"
                                      : childApprovedSummaries.length > 0
                                        ? "Olvasásra kész"
                                        : subblock.summaries.length > 0
                                          ? "Szülői jóváhagyásra vár"
                                        : "Még nincs kész"}
                                  </span>
                                  {subblock.progress?.status === "completed" ? (
                                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#48611f] shadow-sm animate-pulse">
                                      Konfetti mód
                                    </span>
                                  ) : null}
                                </div>
                              )}
                            </div>

                            {mode === "parent" && isParentUnlocked ? (
                              <div className="flex flex-wrap gap-2">
                                {topic.id ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        renameSubblock(subject.subject, topic.id!, topic.title, subblock.label)
                                      }
                                      disabled={activeKey === `rename-subblock:${topic.id}:${subblock.label}` || isSubblockBusy}
                                      className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
                                    >
                                      Átnevezés
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        deleteSubblock(subject.subject, topic.id!, topic.title, subblock.label)
                                      }
                                      disabled={activeKey === `delete-subblock:${topic.id}:${subblock.label}` || isSubblockBusy}
                                      className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
                                    >
                                      Törlés
                                    </button>
                                  </>
                                ) : null}
                                <button
                                  type="button"
                                  onClick={() => runSubblockSeed(subject.subject, topic.title, subblock.label)}
                                  disabled={subblock.status !== "ready" || isSubblockBusy}
                                  className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:opacity-50"
                                >
                                  {activeKey === seedKey ? "Ingest..." : "Ingest"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    runSubblockSummary(
                                      subject.subject,
                                      topic.title,
                                      subblock.label,
                                      subject.knowledgeBase?.vectorStoreId ?? null,
                                    )
                                  }
                                  disabled={!hasVectorStore || isSubblockBusy}
                                  className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold transition disabled:opacity-50"
                                  title={
                                    subject.knowledgeBase?.vectorStoreId
                                      ? `Vector store: ${subject.knowledgeBase.vectorStoreId}`
                                      : "Nincs tantárgyi vector store"
                                  }
                                >
                                  {activeKey === summaryKey ? "Összefoglaló..." : "Összefoglaló generálása"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => runSubblockQuiz(subject.subject, topic.title, subblock.label)}
                                  disabled={!canSummarize || isSubblockBusy}
                                  className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold transition disabled:opacity-50"
                                  title="Valóban legenerál 3-4 gyakorló kérdést az adott alblokkhoz."
                                >
                                  {activeKey === quizKey ? "Kvíz..." : subblock.quizItems.length > 0 ? "Kvíz újragenerálása" : "Kvíz generálása"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    runSubblockFactCheck(
                                      subject.subject,
                                      topic.title,
                                      subblock.label,
                                      subject.knowledgeBase?.vectorStoreId ?? null,
                                    )
                                  }
                                  disabled={
                                    !hasVectorStore ||
                                    subblock.summaries.length === 0 ||
                                    isSubblockBusy
                                  }
                                  className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold transition disabled:opacity-50"
                                  title={
                                    subject.knowledgeBase?.vectorStoreId
                                      ? "Külön fact check az elkészült vázlatra és összefoglalóra."
                                      : "Nincs tantárgyi vector store"
                                  }
                                >
                                  {activeKey === factCheckKey ? "Fact check..." : "Fact check"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    editSubblockSummary(subject.subject, topic.title, subblock.label, combinedSummary)
                                  }
                                  disabled={!combinedSummary || isSubblockBusy}
                                  className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold transition disabled:opacity-50"
                                >
                                  Összefoglaló szerkesztése
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    editSubblockKeyPoints(subject.subject, topic.title, subblock.label, combinedKeyPoints)
                                  }
                                  disabled={combinedKeyPoints.length === 0 || isSubblockBusy}
                                  className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold transition disabled:opacity-50"
                                >
                                  Vázlat szerkesztése
                                </button>
                                <button
                                  type="button"
                                  onClick={() => clearSubblockSummaries(subject.subject, topic.title, subblock.label)}
                                  disabled={subblock.summaries.length === 0 || isSubblockBusy}
                                  className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold transition disabled:opacity-50"
                                >
                                  Összefoglalók törlése
                                </button>
                                <button
                                  type="button"
                                  onClick={() => clearSubblockFactChecks(subject.subject, topic.title, subblock.label)}
                                  disabled={subblock.summaryReviews.length === 0 || isSubblockBusy}
                                  className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold transition disabled:opacity-50"
                                >
                                  Fact check törlése
                                </button>
                                <button
                                  type="button"
                                  onClick={() => clearSubblockIngest(subject.subject, topic.title, subblock.label)}
                                  disabled={!subblock.book || isSubblockBusy}
                                  className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold transition disabled:opacity-50"
                                >
                                  Ingest törlése
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setSubblockPublishState(subject.subject, topic.title, subblock.label, true)}
                                  disabled={subblock.summaries.length === 0 || isSubblockBusy}
                                  className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold transition disabled:opacity-50"
                                >
                                  Kimehet a gyereknek
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setSubblockPublishState(subject.subject, topic.title, subblock.label, false)}
                                  disabled={subblock.summaries.length === 0 || isSubblockBusy}
                                  className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold transition disabled:opacity-50"
                                >
                                  Visszavonom
                                </button>
                              </div>
                            ) : mode === "parent" ? null : subblock.book ? (
                              <button
                                type="button"
                                onClick={() => requestReview(subblock.book!.id)}
                                disabled={
                                  subblock.progress?.status === "completed" ||
                                  subblock.progress?.status === "needs_review" ||
                                  isSubblockBusy ||
                                  visibleSummaries.length === 0
                                }
                                className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:opacity-50"
                              >
                                {requestReviewKey && activeKey === requestReviewKey
                                  ? "Küldés..."
                                  : subblock.progress?.status === "completed"
                                    ? "A szülő jóváhagyta"
                                    : subblock.progress?.status === "needs_review"
                                      ? "Jóváhagyásra vár"
                                      : "Késznek jelölöm"}
                              </button>
                            ) : subblock.book ? (
                              null
                            ) : null}
                          </div>

                          {mode === "parent" &&
                          summaryEditor &&
                          summaryEditor.subject === subject.subject &&
                          summaryEditor.topicTitle === topic.title &&
                          summaryEditor.sourceGroupLabel === subblock.label ? (
                            <div className="mt-4 rounded-xl border border-[var(--line)] bg-white p-4">
                              <p className="text-sm font-semibold text-[var(--ink)]">
                                {summaryEditor.type === "summary" ? "Összefoglaló szerkesztése" : "Vázlat szerkesztése"}
                              </p>
                              <textarea
                                value={summaryEditor.content}
                                onChange={(event) =>
                                  setSummaryEditor((current) =>
                                    current ? { ...current, content: event.target.value } : current,
                                  )
                                }
                                rows={12}
                                className="mt-3 w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-sm leading-6 text-[var(--ink)] outline-none"
                              />
                              <div className="mt-3 flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => void saveSummaryEditor()}
                                  disabled={
                                    activeKey ===
                                    `save-editor:${summaryEditor.subject}:${summaryEditor.topicTitle}:${summaryEditor.sourceGroupLabel}:${summaryEditor.type}`
                                  }
                                  className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
                                >
                                  Mentés
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setSummaryEditor(null)}
                                  className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold"
                                >
                                  Mégse
                                </button>
                              </div>
                            </div>
                          ) : null}

                          {mode === "parent" ? (
                            isParentUnlocked ? (
                            <div className="mt-4 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
                              <div className="space-y-3">
                                {subblock.summaryJob ? (
                                  <div className="rounded-xl border border-[var(--line)] bg-white px-4 py-3">
                                    <p className="text-sm font-semibold text-[var(--ink)]">Summary job</p>
                                    <div className="mt-2 flex flex-wrap items-center gap-2">
                                      <span className="rounded-full bg-[#eef7ff] px-3 py-1 text-xs font-semibold text-[#14507a]">
                                        {subblock.summaryJob.status}
                                      </span>
                                      <span className="text-xs text-[var(--ink)]">
                                        Indítva: {formatTimestamp(subblock.summaryJob.requestedAt)}
                                      </span>
                                      {subblock.summaryJob.resultCount > 0 ? (
                                        <span className="text-xs text-[var(--ink)]">
                                          Leckék: {subblock.summaryJob.resultCount}
                                        </span>
                                      ) : null}
                                    </div>
                                    {subblock.summaryJob.errorMessage ? (
                                      <p className="mt-2 rounded-xl bg-[#fff1f1] px-3 py-2 text-sm text-[#8a2e2e]">
                                        {subblock.summaryJob.errorMessage}
                                      </p>
                                    ) : null}
                                  </div>
                                ) : null}

                                <div className="rounded-xl border border-[var(--line)] bg-white px-4 py-3">
                                  <p className="text-sm font-semibold text-[var(--ink)]">Forrás</p>
                                  <p className="mt-1 text-base text-[var(--ink)]">
                                    {subblock.status === "ready" ? "Ready" : "Hiányzik"}
                                  </p>
                                  <p className="mt-1 text-sm text-[var(--ink)]">URL-ek: {subblock.urlCount}</p>
                                  <div className="mt-3 space-y-2">
                                    {subblock.links.length > 0 ? (
                                      <div className="space-y-2">
                                        {subblock.links.map((link) => {
                                          const deleteKey = `delete-link:${subject.subject}:${topic.title}:${subblock.label}:${link.url}`;

                                          return (
                                            <div key={link.url} className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-3">
                                              <p className="break-all text-sm text-[var(--ink)]">{link.url}</p>
                                              <div className="mt-2 flex flex-wrap gap-2">
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    removeSourceLink(subject.subject, topic.title, subblock.label, link.url)
                                                  }
                                                  disabled={isSubblockBusy}
                                                  className="rounded-full border border-[var(--line)] bg-white px-3 py-1 text-xs font-semibold disabled:opacity-50"
                                                >
                                                  {activeKey === deleteKey ? "Törlés..." : "Link törlése"}
                                                </button>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    ) : null}

                                    <div className="flex flex-col gap-2">
                                      <input
                                        type="url"
                                        value={overrideInputs[overrideInputKey] ?? ""}
                                        onChange={(event) =>
                                          setOverrideInputs((current) => ({
                                            ...current,
                                            [overrideInputKey]: event.target.value,
                                          }))
                                        }
                                        placeholder="NKP leckeoldal vagy PDF link"
                                        className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm text-[var(--ink)] outline-none placeholder:text-[#7a7a7a]"
                                      />
                                      <button
                                        type="button"
                                        onClick={() =>
                                          saveMissingSourceLink(subject.subject, topic.title, subblock.label)
                                        }
                                        disabled={isSubblockBusy}
                                        className="self-start rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
                                      >
                                        {activeKey === overrideSaveKey ? "Mentés..." : "Link mentése"}
                                      </button>
                                    </div>
                                  </div>
                                </div>

                                <div className="rounded-xl border border-[var(--line)] bg-white px-4 py-3">
                                  <p className="text-sm font-semibold text-[var(--ink)]">Ingestelt forrás</p>
                                  {subblock.book ? (
                                    <>
                                      <p className="mt-1 text-base text-[var(--ink)]">{subblock.book.title}</p>
                                      <p className="mt-1 text-sm text-[var(--ink)]">
                                        {subblock.book.sourceType} / {formatTimestamp(subblock.book.createdAt)}
                                      </p>
                                      <p className="mt-2 break-all text-xs text-[var(--ink)]">
                                        Forráslink: {subblock.book.sourceUri}
                                      </p>
                                      {subblock.ingestItems.length > 0 ? (
                                        <div className="mt-3 space-y-3">
                                          {subblock.ingestItems.map((item, itemIndex) => (
                                            <div
                                              key={`${item.title}:${item.chapter}:${item.sourceUri ?? "no-source"}:${item.createdAt}:${itemIndex}`}
                                              className="rounded-xl bg-[var(--surface)] px-3 py-3"
                                            >
                                              <p className="text-sm font-semibold text-[var(--ink)]">{item.title}</p>
                                              <p className="text-xs text-[var(--ink)]">{item.chapter}</p>
                                              {item.sourceUri ? (
                                                <p className="mt-1 break-all text-xs text-[var(--ink)]">
                                                  Ebből jött: {item.sourceUri}
                                                </p>
                                              ) : null}
                                              <div className="mt-2 space-y-2">
                                                {item.chunks.map((chunk) => (
                                                  <div key={`${chunk.pageFrom}:${chunk.pageTo}`} className="rounded-lg bg-white px-3 py-2 text-sm text-[var(--ink)]">
                                                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--accent-strong)]">
                                                      {chunk.pageFrom}-{chunk.pageTo}. oldal
                                                    </p>
                                                    <p className="mt-1">{chunk.preview}</p>
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      ) : null}
                                    </>
                                  ) : (
                                    <p className="mt-1 text-sm text-[var(--ink)]">Még nincs ingestelve.</p>
                                  )}
                                </div>

                                <div className="rounded-xl border border-[var(--line)] bg-white px-4 py-3">
                                  <p className="text-sm font-semibold text-[var(--ink)]">Gyerek készültsége</p>
                                  <p className="mt-1 text-base font-semibold text-[var(--ink)]">
                                    {subblock.progress?.status === "completed"
                                      ? "Kész"
                                      : subblock.progress?.status === "needs_review"
                                        ? "A gyerek késznek jelölte, szülői jóváhagyásra vár"
                                      : subblock.book
                                        ? "Még nincs készre jelölve"
                                        : "Még nincs tananyag"}
                                  </p>
                                  {(subblock.progress?.status === "needs_review" ||
                                    subblock.progress?.status === "completed") &&
                                  subblock.book ? (
                                    <div className="mt-3 flex flex-wrap gap-2">
                                      {subblock.progress?.status === "needs_review" ? (
                                        <button
                                          type="button"
                                          onClick={() => approveDone(subblock.book!.id)}
                                          disabled={isSubblockBusy}
                                          className="rounded-full bg-[var(--accent)] px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
                                        >
                                          {approveKey && activeKey === approveKey ? "Jóváhagyás..." : "Szülői jóváhagyás"}
                                        </button>
                                      ) : null}
                                      <button
                                        type="button"
                                        onClick={() => resetDone(subblock.book!.id)}
                                        disabled={isSubblockBusy}
                                        className="rounded-full border border-[var(--line)] bg-white px-3 py-1 text-xs font-semibold disabled:opacity-50"
                                      >
                                        {resetKey && activeKey === resetKey ? "Visszavonás..." : "Visszavonás"}
                                      </button>
                                    </div>
                                  ) : null}
                                  {subblock.progress?.completedAt ? (
                                    <p className="mt-1 text-sm text-[var(--ink)]">
                                      Jelölve: {formatTimestamp(subblock.progress.completedAt)}
                                    </p>
                                  ) : null}
                                  {typeof subblock.progress?.quizScore === "number" &&
                                  typeof subblock.progress?.quizTotal === "number" ? (
                                    <p className="mt-1 text-sm text-[var(--ink)]">
                                      Kvíz: {subblock.progress.quizScore}/{subblock.progress.quizTotal}
                                    </p>
                                  ) : null}
                                </div>

                                {subblock.summaryReviews.length > 0 ? (
                                  <div className="rounded-xl border border-[var(--line)] bg-white px-4 py-3">
                                    <p className="text-sm font-semibold text-[var(--ink)]">Fact check a leckékhez</p>
                                    <p className="mt-1 text-xs text-[var(--ink)]">
                                      Az alblokk több leckéből is állhat, ezért a review-k leckénként külön jelennek meg.
                                    </p>
                                    <div className="mt-3 space-y-3">
                                      {buildSummaryReviewCards(subblock.summaryReviews).map((review) => (
                                        <div key={`${review.summaryType}:${review.createdAt}`} className="rounded-xl bg-[var(--surface)] px-3 py-3">
                                          <div className="flex flex-wrap items-center justify-between gap-3">
                                            <div>
                                              <p className="text-sm font-semibold text-[var(--ink)]">
                                                {summaryTypeLabel(review.summaryType)}
                                              </p>
                                              <p className="text-xs text-[var(--ink)]">{review.lessonTitle}</p>
                                            </div>
                                            <div className="text-right">
                                              <p className="text-xs font-semibold text-[var(--ink)]">
                                                {summarySourceModeLabel(review.sourceMode)}
                                              </p>
                                              <p className="text-xs text-[var(--ink)]">
                                                {formatTimestamp(review.createdAt)}
                                              </p>
                                            </div>
                                          </div>
                                          <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
                                            <span className="rounded-full bg-[#eef7ff] px-3 py-1 text-[#14507a]">
                                              Quality: {review.qualityScore}/100
                                            </span>
                                            <span className="rounded-full bg-[#f2f8ea] px-3 py-1 text-[#42651d]">
                                              Fact check: {review.factualityScore}/100
                                            </span>
                                          </div>
                                          {review.issues.length > 0 ? (
                                            <div className="mt-3">
                                              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#8a2e2e]">
                                                Talált gondok
                                              </p>
                                              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--ink)]">
                                                {review.issues.map((issue) => (
                                                  <li key={issue}>{issue}</li>
                                                ))}
                                              </ul>
                                            </div>
                                          ) : null}
                                          {review.improvementNotes.length > 0 ? (
                                            <div className="mt-3">
                                              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--accent-strong)]">
                                                Javítási javaslat
                                              </p>
                                              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--ink)]">
                                                {review.improvementNotes.map((note) => {
                                                  const applyKey = `apply-note:${review.lessonId}:${review.summaryType}:${note}`;

                                                  return (
                                                    <li key={note} className="flex flex-wrap items-start justify-between gap-2">
                                                      <span className="flex-1">{note}</span>
                                                      <button
                                                        type="button"
                                                        onClick={() =>
                                                          applyReviewNote(
                                                            subject.subject,
                                                            topic.title,
                                                            subblock.label,
                                                            review.lessonId,
                                                            review.summaryType,
                                                            review.correctedContent,
                                                            note,
                                                          )
                                                        }
                                                        disabled={isSubblockBusy || !review.lessonId}
                                                        className="rounded-full border border-[var(--line)] bg-white px-3 py-1 text-xs font-semibold disabled:opacity-50"
                                                      >
                                                        {activeKey === applyKey ? "Beszúrás..." : "Beszúr"}
                                                      </button>
                                                    </li>
                                                  );
                                                })}
                                              </ul>
                                            </div>
                                          ) : null}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ) : null}
                              </div>

                              <div className="space-y-3">
                                <p className="text-sm font-semibold text-[var(--ink)]">Tananyag az alblokkhoz</p>
                                {!buildCombinedSummary(subblock.summaries, "short_summary") ? (
                                  <div className="rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-sm text-[var(--ink)]">
                                    Ehhez az alblokkhoz még nincs summary.
                                  </div>
                                ) : (
                                  <div className="space-y-3">
                                    <div className="rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-xs font-semibold uppercase tracking-[0.15em] text-[var(--ink)]">
                                      Forrásmód: {summarySourceModeLabel(getLatestSummarySourceMode(subblock.summaries))}
                                    </div>
                                    {buildKeyPoints(subblock.summaries).length > 0 ? (
                                      <details className="rounded-xl border border-[var(--line)] bg-white px-4 py-3" open>
                                        <summary className="cursor-pointer list-none">
                                          <div>
                                            <p className="font-semibold">{subblock.label}</p>
                                            <p className="text-sm text-[var(--ink)]">Vázlatpontok</p>
                                          </div>
                                        </summary>
                                        <ul className="mt-3 list-disc space-y-2 pl-5 text-base leading-8 text-[var(--ink)]">
                                          {buildKeyPoints(subblock.summaries).map((point) => (
                                            <li key={point}>{point}</li>
                                          ))}
                                        </ul>
                                      </details>
                                    ) : null}
                                    <details className="rounded-xl border border-[var(--line)] bg-white px-4 py-3" open>
                                      <summary className="cursor-pointer list-none">
                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                          <div>
                                            <p className="font-semibold">{subblock.label}</p>
                                            <p className="text-sm text-[var(--ink)]">Összefoglaló</p>
                                          </div>
                                        </div>
                                      </summary>
                                      <div className="mt-3 whitespace-pre-wrap text-base leading-8 text-[var(--ink)]">
                                        {renderInlineBold(buildCombinedSummary(subblock.summaries, "short_summary") ?? "")}
                                      </div>
                                    </details>
                                  </div>
                                )}
                              </div>
                            </div>
                            ) : null
                          ) : (
                            <div className="mt-4 space-y-3">
                              {!buildCombinedSummary(childApprovedSummaries, "short_summary") ? (
                                <div className="rounded-xl border border-[var(--line)] bg-white px-4 py-4 text-base leading-8 text-[var(--ink)]">
                                  Ehhez az alblokkhoz még nincs szülő által jóváhagyott tananyag.
                                </div>
                              ) : (
                                <>
                                  <div className="rounded-xl border border-[#eadfcb] bg-white px-5 py-3 text-xs font-semibold uppercase tracking-[0.15em] text-[#424b55] shadow-[0_10px_24px_rgba(52,39,22,0.05)]">
                                    Forrásmód: {summarySourceModeLabel(getLatestSummarySourceMode(childApprovedSummaries))}
                                  </div>
                                  {buildKeyPoints(childApprovedSummaries).length > 0 ? (
                                    <details className="rounded-xl border border-[#eadfcb] bg-white px-5 py-5 shadow-[0_10px_24px_rgba(52,39,22,0.05)]" open>
                                      <summary className="cursor-pointer list-none">
                                        <div>
                                          <p className="text-[1.1rem] font-semibold text-[#1f252c]">{subblock.label}</p>
                                          <p className="text-sm text-[#424b55]">Vázlatos kivonat</p>
                                        </div>
                                      </summary>
                                      <ul className="mt-4 list-disc space-y-2 pl-5 text-[1.04rem] leading-8 text-[#1e252d]">
                                        {buildKeyPoints(childApprovedSummaries).map((point) => (
                                          <li key={point}>{point}</li>
                                        ))}
                                      </ul>
                                    </details>
                                  ) : null}
                                  <details
                                    className="rounded-xl border border-[#eadfcb] bg-white px-5 py-5 shadow-[0_10px_24px_rgba(52,39,22,0.05)]"
                                    open
                                  >
                                    <summary className="cursor-pointer list-none">
                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                          <div>
                                            <p className="text-[1.25rem] font-semibold text-[#1f252c]">{subblock.label}</p>
                                            <p className="text-sm text-[#424b55]">Összefoglaló</p>
                                          </div>
                                          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#424b55]">
                                            {summarySourceModeLabel(getLatestSummarySourceMode(childApprovedSummaries))}
                                          </p>
                                          {subblock.progress?.completedAt ? (
                                            <p className="text-sm text-[#424b55]">{formatTimestamp(subblock.progress.completedAt)}</p>
                                          ) : null}
                                        </div>
                                    </summary>
                                    <div className="mt-4 whitespace-pre-wrap text-[1.08rem] leading-9 text-[#1e252d]">
                                      {renderInlineBold(buildCombinedSummary(childApprovedSummaries, "short_summary") ?? "")}
                                    </div>
                                  </details>

                                  {subblock.quizItems.length > 0 ? (
                                    <details className="rounded-xl border border-[#eadfcb] bg-white px-5 py-5 shadow-[0_10px_24px_rgba(52,39,22,0.05)]">
                                      <summary className="cursor-pointer list-none">
                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                          <div>
                                            <p className="text-[1.1rem] font-semibold text-[#1f252c]">Gyakorló kvíz</p>
                                            <p className="text-sm text-[#424b55]">
                                              {subblock.quizItems.length} kérdés
                                              {typeof subblock.progress?.quizScore === "number" &&
                                              typeof subblock.progress?.quizTotal === "number"
                                                ? ` • Legutóbbi eredmény: ${subblock.progress.quizScore}/${subblock.progress.quizTotal}`
                                                : ""}
                                            </p>
                                          </div>
                                        </div>
                                      </summary>
                                      <div className="mt-4 space-y-4">
                                        {subblock.quizItems.map((quizItem, index) => (
                                          <div key={`${quizItem.question}:${index}`} className="rounded-xl border border-[var(--line)] bg-[#fffaf1] px-4 py-4">
                                            <p className="text-base font-semibold text-[#1f252c]">
                                              {index + 1}. {quizItem.question}
                                            </p>
                                            <ul className="mt-3 space-y-2">
                                              {quizItem.options.map((option) => (
                                                <li key={option}>
                                                  <label
                                                    className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2 text-base ${
                                                      quizResults[subblock.book?.id ?? ""]?.answers[index]
                                                        ? option === quizItem.correctAnswer
                                                          ? "border-[#8bc34a] bg-[#f3ffe8] text-[#1f3a12]"
                                                          : quizResults[subblock.book?.id ?? ""]?.answers[index]?.selected === option
                                                            ? "border-[#ef9a9a] bg-[#fff1f1] text-[#6a1f1f]"
                                                            : "border-[#eadfcb] bg-white text-[#28313a]"
                                                        : "border-[#eadfcb] bg-white text-[#28313a]"
                                                    }`}
                                                  >
                                                    <input
                                                      type="radio"
                                                      name={`${subblock.book?.id}:${index}`}
                                                      disabled={Boolean(quizResults[subblock.book?.id ?? ""])}
                                                      checked={quizSelections[`${subblock.book?.id}:${index}`] === option}
                                                      onChange={() =>
                                                        setQuizSelections((current) => ({
                                                          ...current,
                                                          [`${subblock.book?.id}:${index}`]: option,
                                                        }))
                                                      }
                                                      className="mt-1"
                                                    />
                                                    <span>{option}</span>
                                                  </label>
                                                </li>
                                              ))}
                                            </ul>
                                            {quizResults[subblock.book?.id ?? ""]?.answers[index] ? (
                                              <div className="mt-3 rounded-xl bg-white px-3 py-3 text-sm leading-6 text-[#28313a]">
                                                <p>
                                                  Helyes válasz:{" "}
                                                  <strong>{quizItem.correctAnswer}</strong>
                                                </p>
                                                {quizResults[subblock.book?.id ?? ""]?.answers[index]?.selected !==
                                                quizItem.correctAnswer ? (
                                                  <p className="mt-1 text-[#8a2e2e]">
                                                    A te válaszod: {quizResults[subblock.book?.id ?? ""]?.answers[index]?.selected}
                                                  </p>
                                                ) : (
                                                  <p className="mt-1 text-[#2e6b1f]">Ezt jól válaszoltad meg.</p>
                                                )}
                                                <p className="mt-2">{quizItem.explanation}</p>
                                              </div>
                                            ) : null}
                                          </div>
                                        ))}
                                        <div className="flex flex-wrap items-center gap-3">
                                          <button
                                            type="button"
                                            onClick={() => subblock.book && submitQuiz(subblock.book.id, subblock.quizItems)}
                                            disabled={!subblock.book || isSubblockBusy}
                                            className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                                          >
                                            {activeKey === `quiz-submit:${subblock.book?.id}` ? "Mentés..." : "Kvíz elküldése"}
                                          </button>
                                          {typeof subblock.progress?.quizScore === "number" &&
                                          typeof subblock.progress?.quizTotal === "number" ? (
                                            <span className="rounded-full bg-[#fff0c7] px-3 py-1 text-sm font-semibold text-[#7e5b00]">
                                              Eredmény: {subblock.progress.quizScore}/{subblock.progress.quizTotal}
                                            </span>
                                          ) : null}
                                        </div>
                                      </div>
                                    </details>
                                  ) : null}
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
              {mode === "parent" && isParentUnlocked && subject.id ? (
                <div className="rounded-[1.5rem] border border-dashed border-[var(--line)] bg-white px-5 py-5">
                  <p className="text-sm font-semibold text-[var(--ink)]">Új blokk ehhez a tantárgyhoz</p>
                  <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                    <input
                      type="text"
                      value={newTopicTitles[subject.id] ?? ""}
                      onChange={(event) =>
                        setNewTopicTitles((current) => ({
                          ...current,
                          [subject.id!]: event.target.value,
                        }))
                      }
                      placeholder="Új blokk címe"
                      className="min-w-0 flex-1 rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-sm text-[var(--ink)] outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => createTopic(subject.id!, subject.subject)}
                      disabled={activeKey === `create-topic:${subject.id}` || !(newTopicTitles[subject.id] ?? "").trim()}
                      className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
                    >
                      {activeKey === `create-topic:${subject.id}` ? "Mentés..." : "Blokk hozzáadása"}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
