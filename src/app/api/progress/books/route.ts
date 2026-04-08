import { NextResponse } from "next/server";

import { describeAppError } from "@/lib/errors";
import {
  approveBookCompletion,
  requestBookReview,
  resetBookCompletion,
  saveBookQuizResult,
} from "@/lib/repositories";

export async function POST(request: Request) {
  let body: {
    childName?: string;
    bookId?: string;
    score?: number;
    total?: number;
    mode?: "request_review" | "approve" | "reset" | "quiz";
  } = {};

  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  try {
    if (!body.childName || !body.bookId) {
      return NextResponse.json(
        {
          error: "Hianyzik a childName vagy a bookId.",
        },
        { status: 400 },
      );
    }

    const result =
      body.mode === "quiz"
        ? await saveBookQuizResult({
            childName: body.childName,
            bookId: body.bookId,
            score: body.score ?? 0,
            total: body.total ?? 0,
          })
        : body.mode === "approve"
          ? await approveBookCompletion({
              childName: body.childName,
              bookId: body.bookId,
            })
          : body.mode === "reset"
            ? await resetBookCompletion({
                childName: body.childName,
                bookId: body.bookId,
              })
            : await requestBookReview({
                childName: body.childName,
                bookId: body.bookId,
              });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: describeAppError(error, "A készre jelölés nem sikerult."),
      },
      { status: 422 },
    );
  }
}
