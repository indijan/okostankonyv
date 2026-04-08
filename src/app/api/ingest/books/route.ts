import { NextResponse } from "next/server";

import type { IngestBookRequest } from "@/lib/domain";
import { listIngestJobs, queueCustomBookIngest, queuePilotBookIngest } from "@/lib/repositories";

export async function GET() {
  const jobs = await listIngestJobs();

  return NextResponse.json({
    items: jobs,
    count: jobs.length,
  });
}

export async function POST(request: Request) {
  let payload: IngestBookRequest | null = null;

  try {
    payload = (await request.json()) as IngestBookRequest;
  } catch {
    payload = null;
  }

  const result = payload
    ? await queueCustomBookIngest(payload)
    : await queuePilotBookIngest();

  return NextResponse.json(
    {
      message: "Ingest job queued.",
      data: result,
    },
    { status: 202 },
  );
}
