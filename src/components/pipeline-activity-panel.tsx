type PipelineActivityPanelProps = {
  latestBooks: Array<{
    id: string;
    title: string;
    subject: string;
    sourceType: string;
    createdAt: string;
  }>;
  latestSummaries: Array<{
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
  }>;
};

function formatTimestamp(value: string) {
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

export function PipelineActivityPanel({
  latestBooks,
  latestSummaries,
}: PipelineActivityPanelProps) {
  return (
    <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
      <section className="rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[0_18px_48px_rgba(23,32,42,0.06)] backdrop-blur">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--ink-soft)]">
          Perzisztens előzmények
        </p>
        <h2 className="mt-3 text-2xl font-semibold">Legutóbbi ingestek</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">
          Ezek adatbázisból jönnek, ezért frissítés után sem tűnnek el.
        </p>

        <div className="mt-5 space-y-3">
          {latestBooks.length === 0 ? (
            <div className="rounded-2xl border border-[var(--line)] bg-white/70 px-4 py-3 text-sm text-[var(--ink-soft)]">
              Még nincs mentett ingest.
            </div>
          ) : (
            latestBooks.map((book) => (
              <div
                key={book.id}
                className="rounded-2xl border border-[var(--line)] bg-white/70 px-4 py-3"
              >
                <p className="font-medium">{book.title}</p>
                <p className="text-sm text-[var(--ink-soft)]">
                  {book.subject} / {book.sourceType}
                </p>
                <p className="text-sm text-[var(--ink-soft)]">
                  {formatTimestamp(book.createdAt)}
                </p>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[0_18px_48px_rgba(23,32,42,0.06)] backdrop-blur">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--ink-soft)]">
          Generált tartalom
        </p>
        <h2 className="mt-3 text-2xl font-semibold">Legenerált összefoglalók</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">
          Itt látod a már elkészült summarykat és magyarázatokat, preview-val.
        </p>

        <div className="mt-5 space-y-3">
          {latestSummaries.length === 0 ? (
            <div className="rounded-2xl border border-[var(--line)] bg-white/70 px-4 py-3 text-sm text-[var(--ink-soft)]">
              Még nincs mentett summary.
            </div>
          ) : (
            latestSummaries.map((summary) => (
              <details
                key={summary.lessonId}
                className="rounded-2xl border border-[var(--line)] bg-white/70 px-4 py-3"
              >
                <summary className="cursor-pointer text-sm font-medium text-[var(--accent-strong)]">
                  Teljes összefoglalók megnyitása
                </summary>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{summary.lessonTitle}</p>
                    <p className="text-sm text-[var(--ink-soft)]">
                      {summary.subject} / {summary.bookTitle}
                    </p>
                  </div>
                  <p className="text-sm text-[var(--ink-soft)]">
                    {formatTimestamp(summary.createdAt)}
                  </p>
                </div>
                <div className="mt-2 space-y-3">
                  {summary.items.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-xl border border-[var(--line)] bg-white/80 px-3 py-3"
                    >
                      <p className="text-sm font-medium text-[var(--ink-soft)]">
                        {item.summaryType}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-[var(--ink-soft)]">
                        {item.preview}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 space-y-4">
                  {summary.items.map((item) => (
                    <div
                      key={`${item.id}-full`}
                      className="rounded-xl border border-[var(--line)] bg-white px-4 py-4"
                    >
                      <p className="text-sm font-medium text-[var(--ink-soft)]">
                        {item.summaryType}
                      </p>
                      <div className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[var(--ink-soft)]">
                        {item.content}
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            ))
          )}
        </div>
      </section>
    </section>
  );
}
