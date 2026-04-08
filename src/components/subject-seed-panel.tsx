"use client";

import { useState } from "react";

import { formatRequestError, readJsonResponse } from "@/lib/http";

type SubjectSeedPanelProps = {
  subjects: Array<{
    subject: string;
    readyTopics: number;
    missingTopics: number;
  }>;
};

type SeedResponse = {
  count: number;
  items: Array<{
    subject: string;
    topicTitle: string;
    sourceLabel: string;
    persistenceMode: "mock" | "supabase";
    bookId: string;
    jobId: string;
    lessonCount: number;
    chunkCount: number;
  }>;
};

export function SubjectSeedPanel({ subjects }: SubjectSeedPanelProps) {
  const [activeSubject, setActiveSubject] = useState<string | null>(null);
  const [result, setResult] = useState<SeedResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runSeed(subject: string) {
    setActiveSubject(subject);
    setResult(null);
    setError(null);

    try {
      const response = await fetch("/api/ingest/seed", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          subject,
          limit: 5,
        }),
      });

      const payload = await readJsonResponse<SeedResponse>(response);

      if (!response.ok) {
        throw new Error(
          formatRequestError(null, "A subject seed nem sikerult", {
            status: response.status,
            bodyError: payload.error,
          }),
        );
      }

      setResult(payload);
    } catch (seedError) {
      setError(formatRequestError(seedError, "A subject seed nem sikerult"));
    } finally {
      setActiveSubject(null);
    }
  }

  return (
    <section className="rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[0_18px_48px_rgba(23,32,42,0.06)] backdrop-blur">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--ink-soft)]">
        Subject seed
      </p>
      <h2 className="mt-3 text-2xl font-semibold">Ready témák indítása tárgyanként</h2>
      <div className="mt-5 space-y-3">
        {subjects.map((item) => (
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
              onClick={() => runSeed(item.subject)}
              disabled={activeSubject !== null}
              className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--accent-strong)] disabled:opacity-60"
            >
              {activeSubject === item.subject ? "Indul..." : "Seed this subject"}
            </button>
          </div>
        ))}

        {result ? (
          <div className="rounded-2xl border border-[var(--line)] bg-white/75 px-4 py-3">
            <p className="text-sm text-[var(--ink-soft)]">Seed eredmény</p>
            <p className="mt-1 font-medium">Létrehozott elemek: {result.count}</p>
            <div className="mt-3 space-y-2">
              {result.items.slice(0, 5).map((item) => (
                <div
                  key={item.jobId}
                  className="rounded-2xl border border-[var(--line)] bg-white px-3 py-2"
                >
                  <p className="font-medium">{item.topicTitle}</p>
                  <p className="text-sm text-[var(--ink-soft)]">
                    {item.sourceLabel} / {item.persistenceMode}
                  </p>
                  <p className="text-sm text-[var(--ink-soft)]">
                    Lessons: {item.lessonCount}, chunks: {item.chunkCount}
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
