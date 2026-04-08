import { NextResponse } from "next/server";

import { describeAppError } from "@/lib/errors";
import { inspectSourceStructure } from "@/lib/ingest";

export async function POST(request: Request) {
  const body = (await request.json()) as { sourceUri?: string };

  if (!body.sourceUri) {
    return NextResponse.json({ error: "Missing sourceUri." }, { status: 400 });
  }

  try {
    const result = await inspectSourceStructure(body.sourceUri);

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: describeAppError(
          error,
          "A forras szerkezeti elemzese nem sikerult.",
        ),
      },
      { status: 422 },
    );
  }
}
