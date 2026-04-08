import { after, NextResponse } from "next/server";

import { describeAppError } from "@/lib/errors";
import { createSummaryJob, generateSummariesForLessons, getSummaryJob, processSummaryJob } from "@/lib/repositories";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("jobId");

  if (!jobId) {
    return NextResponse.json({ error: "Hianyzik a jobId." }, { status: 400 });
  }

  try {
    const job = await getSummaryJob(jobId);
    if (!job) {
      return NextResponse.json({ error: "Nem talaltam ezt a summary jobot." }, { status: 404 });
    }

    return NextResponse.json(job, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: describeAppError(error, "A summary job lekerdezese nem sikerult."),
      },
      {
        status: 422,
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  }
}

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
    body = (await request.json()) as {
      lessonId?: string;
      childName?: string;
      subject?: string;
      topicTitle?: string;
      sourceGroupLabel?: string;
      vectorStoreId?: string;
      limit?: number;
    };
  } catch {
    body = {};
  }

  try {
    const liveMode = body.lessonId || body.limit;

    if (liveMode) {
      const results = await generateSummariesForLessons({
        lessonId: body.lessonId,
        childName: body.childName,
        subject: body.subject,
        topicTitle: body.topicTitle,
        sourceGroupLabel: body.sourceGroupLabel,
        vectorStoreId: body.vectorStoreId,
        limit: body.limit,
      });

      return NextResponse.json(
        {
          count: results.length,
          items: results,
        },
        {
          headers: {
            "Cache-Control": "no-store, max-age=0",
          },
        },
      );
    }

    const job = await createSummaryJob({
      lessonId: body.lessonId,
      childName: body.childName,
      subject: body.subject,
      topicTitle: body.topicTitle,
      sourceGroupLabel: body.sourceGroupLabel,
      vectorStoreId: body.vectorStoreId,
    });

    after(async () => {
      try {
        await processSummaryJob(job.id);
      } catch {
        // job state is persisted in DB; client polls for final status
      }
    });

    return NextResponse.json(
      {
        jobId: job.id,
        status: job.status,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: describeAppError(error, "A summary generalas nem sikerult."),
      },
      {
        status: 422,
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  }
}
