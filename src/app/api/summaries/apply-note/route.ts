import { NextResponse } from "next/server";

import { describeAppError } from "@/lib/errors";
import { applySummaryImprovement } from "@/lib/repositories";

export async function POST(request: Request) {
  let body: { lessonId?: string; note?: string } = {};

  try {
    body = (await request.json()) as { lessonId?: string; note?: string };
  } catch {
    body = {};
  }

  try {
    if (!body.lessonId || !body.note) {
      return NextResponse.json({ error: "Hiányzik a lessonId vagy a note." }, { status: 400 });
    }

    const result = await applySummaryImprovement({
      lessonId: body.lessonId,
      note: body.note,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: describeAppError(error, "A javítás beszúrása nem sikerult."),
      },
      { status: 422 },
    );
  }
}
