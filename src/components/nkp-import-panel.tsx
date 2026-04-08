"use client";

import { useState } from "react";

import { formatRequestError, readJsonResponse } from "@/lib/http";

const exampleSources = [
  {
    label: "NKP katalogus oldal",
    sourceUri: "https://nat2012.nkp.hu/tankonyv/tortenelem_9/index.html",
    title: "Tortenelem 9",
    subject: "Tortenelem",
    grade: "9. evfolyam",
  },
  {
    label: "Kozvetlen NKP PDF",
    sourceUri:
      "https://www.nkp.hu/api/media/relpath/NKP%20K%C3%B6z%C3%B6s%20f%C3%A1jlok/R%C3%A9gi%20-%20Nyilv%C3%A1nos%20tartalmak/K%C3%B6rnyezetismeret/K%C3%B6rnyezetismeret%201.%20%282016%29/K%C3%B6rnyezetismeret%201./FI-505010101_1__Kornyezetismeret_1_TK__BELIV__0404%20NKP.pdf",
    title: "Kornyezetismeret 1",
    subject: "Kornyezetismeret",
    grade: "1. evfolyam",
  },
] as const;

type ResolveResponse = {
  sourceUri: string;
  pdfUrl: string;
};

type InspectResponse = {
  headings: Array<{
    pageNumber: number;
    heading: string | null;
    preview: string;
  }>;
  lessonPlans: Array<{
    order: number;
    title: string;
    chapter: string;
    goal: string;
    pageFrom: number;
    pageTo: number;
  }>;
};

type IngestResponse = {
  message: string;
  data: {
    persistenceMode: "mock" | "supabase";
    book: {
      id: string;
      title: string;
    };
    job: {
      id: string;
      status: string;
    };
    lessons: Array<{ id: string }>;
    chunkCandidates: Array<{ pageFrom: number; pageTo: number }>;
  };
};

export function NkpImportPanel() {
  const [title, setTitle] = useState("Tortenelem 9");
  const [subject, setSubject] = useState("Tortenelem");
  const [grade, setGrade] = useState("9. evfolyam");
  const [sourceUri, setSourceUri] = useState(
    "https://nat2012.nkp.hu/tankonyv/tortenelem_9/index.html",
  );
  const [resolvedPdfUrl, setResolvedPdfUrl] = useState<string | null>(null);
  const [result, setResult] = useState<IngestResponse | null>(null);
  const [inspectResult, setInspectResult] = useState<InspectResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [isIngesting, setIsIngesting] = useState(false);
  const [isInspecting, setIsInspecting] = useState(false);

  async function handleResolve() {
    setError(null);
    setResult(null);
    setInspectResult(null);
    setIsResolving(true);

    try {
      const response = await fetch("/api/nkp/resolve", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ sourceUri }),
      });

      const payload = await readJsonResponse<ResolveResponse>(response);

      if (!response.ok) {
        throw new Error(
          formatRequestError(null, "A PDF feloldasa nem sikerult", {
            status: response.status,
            bodyError: payload.error,
          }),
        );
      }

      setResolvedPdfUrl(payload.pdfUrl);
    } catch (resolveError) {
      setResolvedPdfUrl(null);
      setError(formatRequestError(resolveError, "A PDF feloldasa nem sikerult"));
    } finally {
      setIsResolving(false);
    }
  }

  async function handleIngest() {
    setError(null);
    setResult(null);
    setInspectResult(null);
    setIsIngesting(true);

    try {
      const response = await fetch("/api/ingest/books", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          title,
          subject,
          grade,
          sourceType: "nkp_pdf",
          sourceUri,
        }),
      });

      const payload = await readJsonResponse<IngestResponse>(response);

      if (!response.ok) {
        throw new Error(
          formatRequestError(null, "Az ingest inditasa nem sikerult", {
            status: response.status,
            bodyError: payload.error,
          }),
        );
      }

      setResult(payload);
    } catch (ingestError) {
      setError(formatRequestError(ingestError, "Az ingest inditasa nem sikerult"));
    } finally {
      setIsIngesting(false);
    }
  }

  async function handleInspect() {
    setError(null);
    setIsInspecting(true);

    try {
      const response = await fetch("/api/ingest/inspect", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ sourceUri }),
      });

      const payload = await readJsonResponse<InspectResponse>(response);

      if (!response.ok) {
        throw new Error(
          formatRequestError(null, "Az inspect lepes nem sikerult", {
            status: response.status,
            bodyError: payload.error,
          }),
        );
      }

      setInspectResult(payload);
    } catch (inspectError) {
      setInspectResult(null);
      setError(formatRequestError(inspectError, "Az inspect lepes nem sikerult"));
    } finally {
      setIsInspecting(false);
    }
  }

  function applyExample(index: number) {
    const example = exampleSources[index];
    setTitle(example.title);
    setSubject(example.subject);
    setGrade(example.grade);
    setSourceUri(example.sourceUri);
    setResolvedPdfUrl(null);
    setResult(null);
    setInspectResult(null);
    setError(null);
  }

  return (
    <section className="rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[0_18px_48px_rgba(23,32,42,0.06)] backdrop-blur">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--ink-soft)]">
        Admin import
      </p>
      <h2 className="mt-3 text-2xl font-semibold">NKP URL import</h2>
      <div className="mt-5 space-y-4">
        <div className="flex flex-wrap gap-2">
          {exampleSources.map((example, index) => (
            <button
              key={example.label}
              type="button"
              onClick={() => applyExample(index)}
              className="rounded-full border border-[var(--line)] bg-white/80 px-3 py-2 text-sm font-medium transition hover:bg-white"
            >
              {example.label}
            </button>
          ))}
        </div>

        <Field label="Cim">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="w-full rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-3 outline-none"
          />
        </Field>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Tantargy">
            <input
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              className="w-full rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-3 outline-none"
            />
          </Field>
          <Field label="Evfolyam">
            <input
              value={grade}
              onChange={(event) => setGrade(event.target.value)}
              className="w-full rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-3 outline-none"
            />
          </Field>
        </div>

        <Field label="NKP URL vagy direkt PDF">
          <textarea
            value={sourceUri}
            onChange={(event) => setSourceUri(event.target.value)}
            rows={4}
            className="w-full rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-3 outline-none"
          />
        </Field>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleResolve}
            disabled={isResolving || isIngesting || isInspecting}
            className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-medium text-white transition hover:bg-[var(--accent-strong)] disabled:opacity-60"
          >
            {isResolving ? "Feloldas..." : "PDF URL feloldasa"}
          </button>
          <button
            type="button"
            onClick={handleInspect}
            disabled={isResolving || isIngesting || isInspecting}
            className="rounded-full border border-[var(--line)] bg-white/80 px-5 py-3 text-sm font-medium transition hover:bg-white disabled:opacity-60"
          >
            {isInspecting ? "Elemzes..." : "Structure preview"}
          </button>
          <button
            type="button"
            onClick={handleIngest}
            disabled={isResolving || isIngesting || isInspecting}
            className="rounded-full border border-[var(--line)] bg-white/80 px-5 py-3 text-sm font-medium transition hover:bg-white disabled:opacity-60"
          >
            {isIngesting ? "Ingest indul..." : "Ingest inditasa"}
          </button>
        </div>

        {resolvedPdfUrl ? (
          <div className="rounded-2xl border border-[var(--line)] bg-white/75 px-4 py-3">
            <p className="text-sm text-[var(--ink-soft)]">Feloldott PDF URL</p>
            <p className="mt-1 break-all text-sm font-medium">{resolvedPdfUrl}</p>
          </div>
        ) : null}

        {result ? (
          <div className="rounded-2xl border border-[var(--line)] bg-white/75 px-4 py-3">
            <p className="text-sm text-[var(--ink-soft)]">Ingest eredmeny</p>
            <p className="mt-1 font-medium">
              {result.data.book.title} / {result.data.persistenceMode}
            </p>
            <p className="mt-1 text-sm text-[var(--ink-soft)]">
              Job: {result.data.job.id} / {result.data.job.status}
            </p>
            <p className="mt-1 text-sm text-[var(--ink-soft)]">
              Leckek: {result.data.lessons.length}, chunkok:{" "}
              {result.data.chunkCandidates.length}
            </p>
          </div>
        ) : null}

        {inspectResult ? (
          <div className="space-y-3 rounded-2xl border border-[var(--line)] bg-white/75 px-4 py-3">
            <div>
              <p className="text-sm text-[var(--ink-soft)]">Tervezett leckek</p>
              <div className="mt-2 space-y-2">
                {inspectResult.lessonPlans.map((lesson) => (
                  <div
                    key={`${lesson.order}-${lesson.pageFrom}`}
                    className="rounded-2xl border border-[var(--line)] bg-white px-3 py-2"
                  >
                    <p className="font-medium">
                      {lesson.order}. {lesson.title}
                    </p>
                    <p className="text-sm text-[var(--ink-soft)]">
                      {lesson.chapter}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm text-[var(--ink-soft)]">Oldal eleji mintak</p>
              <div className="mt-2 space-y-2">
                {inspectResult.headings.slice(0, 6).map((item) => (
                  <div
                    key={item.pageNumber}
                    className="rounded-2xl border border-[var(--line)] bg-white px-3 py-2"
                  >
                    <p className="text-sm font-medium">
                      {item.pageNumber}. oldal: {item.heading ?? "nincs cimjelolt"}
                    </p>
                    <p className="mt-1 text-sm text-[var(--ink-soft)]">
                      {item.preview}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-[#d7a0a0] bg-[#fff1f1] px-4 py-3 text-sm text-[#7a2424]">
            {error}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function Field({
  label,
  children,
}: Readonly<{
  label: string;
  children: React.ReactNode;
}>) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm text-[var(--ink-soft)]">{label}</span>
      {children}
    </label>
  );
}
