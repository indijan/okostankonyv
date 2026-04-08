"use client";

import { useState } from "react";

import { formatRequestError, readJsonResponse } from "@/lib/http";

type SummaryGenerationPanelProps = {
  subjects: Array<{
    subject: string;
    readyTopics: number;
    missingTopics: number;
  }>;
  availableSubjects: string[];
};

type SummaryGenerationResponse = {
  count: number;
  items: Array<{
    lessonId: string;
    lessonTitle: string;
    subject: string | null;
    summaryMode: "openai" | "disabled";
    explanationMode: "openai" | "disabled";
    summaryLength: number;
    explanationLength: number;
  }>;
};

export function SummaryGenerationPanel({
  subjects,
  availableSubjects,
}: SummaryGenerationPanelProps) {
  const [activeSubject, setActiveSubject] = useState<string | null>(null);
  const [result, setResult] = useState<SummaryGenerationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runGeneration(subject: string) {
    setActiveSubject(subject);
    setResult(null);
    setError(null);

    try {
      const response = await fetch("/api/summaries/generate", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          subject,
          limit: 5,
        }),
      });

      const payload = await readJsonResponse<SummaryGenerationResponse>(response);

      if (!response.ok) {
        throw new Error(
          formatRequestError(null, "A summary generalas nem sikerult", {
            status: response.status,
            bodyError: payload.error,
          }),
        );
      }

      setResult(payload);
    } catch (generationError) {
      setError(
        formatRequestError(generationError, "A summary generalas nem sikerult"),
      );
    } finally {
      setActiveSubject(null);
    }
  }

  const runnableSubjects = subjects.filter((item) =>
    availableSubjects.includes(item.subject),
  );

  return (
    <section className="rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[0_18px_48px_rgba(23,32,42,0.06)] backdrop-blur">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--ink-soft)]">
        Summary pipeline
      </p>
      <h2 className="mt-3 text-2xl font-semibold">
        Összefoglalók generálása UI-ból
      </h2>
      <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">
        Itt tudsz tárgyanként summaryt és gyerekbarát magyarázatot generálni a
        már ingestelt leckékre. Az eredmény rögtön visszajelez, nem kell terminál.
      </p>

      <div className="mt-5 space-y-3">
        {runnableSubjects.length === 0 ? (
          <div className="rounded-2xl border border-[var(--line)] bg-white/70 px-4 py-3 text-sm text-[var(--ink-soft)]">
            Előbb futtass egy `Seed this subject` lépést. Summary csak olyan tárgyra
            indítható, ahol már van ingestelt lecke.
          </div>
        ) : null}

        {runnableSubjects.map((item) => (
          <div
            key={item.subject}
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--line)] bg-white/70 px-4 py-3"
          >
            <div>
              <p className="font-medium">{item.subject}</p>
              <p className="text-sm text-[var(--ink-soft)]">
                Ready témák: {item.readyTopics}, hiányos: {item.missingTopics}
              </p>
            </div>
            <button
              type="button"
              onClick={() => runGeneration(item.subject)}
              disabled={activeSubject !== null}
              className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--accent-strong)] disabled:opacity-60"
            >
              {activeSubject === item.subject
                ? "Generálás..."
                : "Summary erre a tárgyra"}
            </button>
          </div>
        ))}

        {result ? (
          <div className="rounded-2xl border border-[var(--line)] bg-white/75 px-4 py-3">
            <p className="text-sm text-[var(--ink-soft)]">Generálás eredménye</p>
            <p className="mt-1 font-medium">Feldolgozott leckék: {result.count}</p>
            <div className="mt-3 space-y-2">
              {result.items.map((item) => (
                <div
                  key={item.lessonId}
                  className="rounded-2xl border border-[var(--line)] bg-white px-3 py-2"
                >
                  <p className="font-medium">{item.lessonTitle}</p>
                  <p className="text-sm text-[var(--ink-soft)]">
                    summary: {item.summaryMode}, magyarazat: {item.explanationMode}
                  </p>
                  <p className="text-sm text-[var(--ink-soft)]">
                    Hossz: {item.summaryLength} / {item.explanationLength} karakter
                  </p>
                </div>
              ))}
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
