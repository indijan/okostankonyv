import { seedReadyExamIngests } from "@/lib/repositories";

const args = process.argv.slice(2);

function readFlag(flag: string) {
  const index = args.findIndex((arg) => arg === flag);

  if (index === -1) {
    return null;
  }

  return args[index + 1] ?? null;
}

const limitArg = readFlag("--limit") ?? args[0] ?? "5";
const subjectArg = readFlag("--subject");
const limit = Number(limitArg);

async function main() {
  const results = await seedReadyExamIngests({
    limit: Number.isFinite(limit) ? limit : 5,
    subject: subjectArg ?? undefined,
  });

  console.log(
    JSON.stringify(
      results.map((item) => ({
        subject: item.subject,
        topicTitle: item.topicTitle,
        sourceLabel: item.sourceLabel,
        persistenceMode: item.persistenceMode,
        bookId: item.book.id,
        jobId: item.job.id,
        lessonCount: item.lessons.length,
        chunkCount: item.chunkCandidates.length,
      })),
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
