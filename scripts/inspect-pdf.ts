import { inspectSourceStructure } from "@/lib/ingest";

const sourceUri = process.argv[2];
const debug = process.env.DEBUG === "1";

if (!sourceUri) {
  console.error("Usage: npm run inspect:pdf -- <source-uri>");
  process.exit(1);
}

async function main() {
  if (debug) {
    console.error("[inspect] start");
    console.error(`[inspect] source=${sourceUri}`);
    console.error("[inspect] maxPages=12");
  }

  const result = await inspectSourceStructure(sourceUri);

  if (debug) {
    console.error(`[inspect] headings=${result.headings.length}`);
    console.error(`[inspect] lessonPlans=${result.lessonPlans.length}`);
  }

  console.log(
    JSON.stringify(
      {
        lessonPlans: result.lessonPlans,
        headings: result.headings.slice(0, 8),
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
