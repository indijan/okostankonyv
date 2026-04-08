import { NextResponse } from "next/server";

import { describeAppError } from "@/lib/errors";
import { generateQuizForLessons } from "@/lib/repositories";

export async function POST(request: Request) {
  let body: {
    lessonId?: string;
    childName?: string;
    subject?: string;
    topicTitle?: string;
    sourceGroupLabel?: string;
    limit?: number;
  } = {};

  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  try {
    const results = await generateQuizForLessons({
      lessonId: body.lessonId,
      childName: body.childName,
      subject: body.subject,
      topicTitle: body.topicTitle,
      sourceGroupLabel: body.sourceGroupLabel,
      limit: body.limit,
    });

    return NextResponse.json({
      count: results.length,
      items: results,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: describeAppError(error, "A kvíz generálása nem sikerült."),
      },
      { status: 422 },
    );
  }
}
