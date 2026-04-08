import { NextResponse } from "next/server";

import { describeAppError } from "@/lib/errors";
import { runSummaryFactCheck } from "@/lib/repositories";

export async function POST(request: Request) {
  let body: {
    lessonId?: string;
    childName?: string;
    subject?: string;
    topicTitle?: string;
    sourceGroupLabel?: string;
    vectorStoreId?: string;
    limit?: number;
  } = {};

  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  try {
    const items = await runSummaryFactCheck({
      lessonId: body.lessonId,
      childName: body.childName,
      subject: body.subject,
      topicTitle: body.topicTitle,
      sourceGroupLabel: body.sourceGroupLabel,
      vectorStoreId: body.vectorStoreId,
      limit: body.limit,
    });

    return NextResponse.json({
      count: items.length,
      items,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: describeAppError(error, "A fact check nem sikerult."),
      },
      { status: 422 },
    );
  }
}
