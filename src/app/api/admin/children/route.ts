import { NextResponse } from "next/server";

import { describeAppError } from "@/lib/errors";
import { createChildProfile } from "@/lib/repositories";

export async function POST(request: Request) {
  let body: {
    name?: string;
    grade?: number;
  } = {};

  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  try {
    if (!body.name?.trim() || !body.grade) {
      return NextResponse.json(
        {
          error: "Hianyzik a gyerek neve vagy evfolyama.",
        },
        { status: 400 },
      );
    }

    const child = await createChildProfile({
      name: body.name,
      grade: body.grade,
    });

    return NextResponse.json({ child });
  } catch (error) {
    return NextResponse.json(
      {
        error: describeAppError(error, "A gyerek felvitele nem sikerult."),
      },
      { status: 422 },
    );
  }
}
