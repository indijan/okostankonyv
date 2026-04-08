import { NextResponse } from "next/server";

import { describeAppError } from "@/lib/errors";
import { ensureSubjectKnowledgeBase } from "@/lib/repositories";

export async function POST(request: Request) {
  let body: {
    childId?: string;
    subjectId?: string;
  } = {};

  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  try {
    if (!body.childId || !body.subjectId) {
      return NextResponse.json({ error: "Hianyzik a gyerek vagy a tantargy azonositoja." }, { status: 400 });
    }

    const knowledgeBase = await ensureSubjectKnowledgeBase({
      childId: body.childId,
      subjectId: body.subjectId,
    });

    return NextResponse.json({ knowledgeBase });
  } catch (error) {
    return NextResponse.json(
      {
        error: describeAppError(error, "A tantargyi tudasbazis inicializalasa nem sikerult."),
      },
      { status: 422 },
    );
  }
}
