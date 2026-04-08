import { NextResponse } from "next/server";

import { describeAppError } from "@/lib/errors";
import { seedReadyExamIngests } from "@/lib/repositories";

export async function POST(request: Request) {
  let body: {
    childId?: string;
    childName?: string;
    subject?: string;
    topicTitle?: string;
    sourceGroupLabel?: string;
    limit?: number;
  } = {};

  try {
    body = (await request.json()) as {
      childId?: string;
      childName?: string;
      subject?: string;
      topicTitle?: string;
      sourceGroupLabel?: string;
      limit?: number;
    };
  } catch {
    body = {};
  }

  try {
    const results = await seedReadyExamIngests({
      childId: body.childId,
      childName: body.childName,
      subject: body.subject,
      topicTitle: body.topicTitle,
      sourceGroupLabel: body.sourceGroupLabel,
      limit: body.limit,
    });

    return NextResponse.json({
      count: results.length,
      items: results.map((item) => ({
        subject: item.subject,
        topicTitle: item.topicTitle,
        sourceLabel: item.sourceLabel,
        persistenceMode: item.persistenceMode,
        bookId: item.book.id,
        jobId: item.job.id,
        lessonCount: item.lessons.length,
        chunkCount: item.chunkCandidates.length,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: describeAppError(error, "A seed ingest nem sikerult."),
      },
      { status: 422 },
    );
  }
}
