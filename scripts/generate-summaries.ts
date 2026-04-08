import { generateSummariesForLessons } from "@/lib/repositories";

function readFlag(name: string) {
  const index = process.argv.indexOf(name);

  if (index === -1) {
    return null;
  }

  return process.argv[index + 1] ?? null;
}

async function main() {
  const lessonId = readFlag("--lesson-id") ?? undefined;
  const subject = readFlag("--subject") ?? undefined;
  const limitValue = readFlag("--limit");
  const limit = limitValue ? Number.parseInt(limitValue, 10) : undefined;

  const results = await generateSummariesForLessons({
    lessonId,
    subject,
    limit: Number.isFinite(limit) ? limit : undefined,
  });

  console.log(
    JSON.stringify(
      {
        count: results.length,
        items: results,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
