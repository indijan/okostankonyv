import { NextResponse } from "next/server";

import { describeAppError } from "@/lib/errors";
import { applySummaryImprovement, applySummaryReviewCorrection } from "@/lib/repositories";

export async function POST(request: Request) {
  let body: {
    lessonId?: string;
    note?: string;
    summaryType?: "short_summary" | "key_points";
    correctedContent?: string;
  } = {};

  try {
    body = (await request.json()) as {
      lessonId?: string;
      note?: string;
      summaryType?: "short_summary" | "key_points";
      correctedContent?: string;
    };
  } catch {
    body = {};
  }

  try {
    if (!body.lessonId) {
      return NextResponse.json({ error: "Hiányzik a lessonId." }, { status: 400 });
    }

    if (body.summaryType && body.correctedContent?.trim()) {
      const result = await applySummaryReviewCorrection({
        lessonId: body.lessonId,
        summaryType: body.summaryType,
        correctedContent: body.correctedContent,
      });

      return NextResponse.json(result);
    }

    if (!body.note) {
      return NextResponse.json({ error: "Hiányzik a note." }, { status: 400 });
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
