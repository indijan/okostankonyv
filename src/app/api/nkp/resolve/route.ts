import { NextResponse } from "next/server";

import { describeAppError } from "@/lib/errors";
import { resolveNkpPdfUrl } from "@/lib/nkp";

export async function POST(request: Request) {
  const body = (await request.json()) as { sourceUri?: string };

  if (!body.sourceUri) {
    return NextResponse.json(
      { error: "Missing sourceUri." },
      { status: 400 },
    );
  }

  try {
    const pdfUrl = await resolveNkpPdfUrl(body.sourceUri);

    return NextResponse.json({
      sourceUri: body.sourceUri,
      pdfUrl,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: describeAppError(error, "Az NKP PDF URL feloldasa nem sikerult."),
      },
      { status: 422 },
    );
  }
}
