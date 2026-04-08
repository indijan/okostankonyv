import { NextResponse } from "next/server";

import { describeAppError } from "@/lib/errors";
import {
  clearSubblockIngestData,
  clearSubblockSummaries,
  clearSubblockSummaryReviews,
  setSubblockSummaryApproval,
  updateSubblockSummaryContent,
} from "@/lib/repositories";

type ManageSummaryRequest =
  | {
      action: "clear_summaries" | "clear_reviews" | "clear_ingest" | "publish_summaries" | "unpublish_summaries";
      childName?: string;
      subject?: string;
      topicTitle?: string;
      sourceGroupLabel?: string;
    }
  | {
      action: "update_summary" | "update_key_points";
      childName?: string;
      subject?: string;
      topicTitle?: string;
      sourceGroupLabel?: string;
      content?: string;
    };

export async function POST(request: Request) {
  let body: ManageSummaryRequest | null = null;

  try {
    body = (await request.json()) as ManageSummaryRequest;
  } catch {
    body = null;
  }

  try {
    if (!body || !body.action) {
      return NextResponse.json({ error: "Hiányzik az action." }, { status: 400 });
    }

    if (!body.subject || !body.topicTitle || !body.sourceGroupLabel) {
      return NextResponse.json(
        { error: "Hiányzik a subject, topicTitle vagy sourceGroupLabel." },
        { status: 400 },
      );
    }

    if (body.action === "clear_summaries") {
      const result = await clearSubblockSummaries({
        childName: body.childName,
        subject: body.subject,
        topicTitle: body.topicTitle,
        sourceGroupLabel: body.sourceGroupLabel,
      });
      return NextResponse.json(result);
    }

    if (body.action === "clear_reviews") {
      const result = await clearSubblockSummaryReviews({
        childName: body.childName,
        subject: body.subject,
        topicTitle: body.topicTitle,
        sourceGroupLabel: body.sourceGroupLabel,
      });
      return NextResponse.json(result);
    }

    if (body.action === "clear_ingest") {
      const result = await clearSubblockIngestData({
        childName: body.childName,
        subject: body.subject,
        topicTitle: body.topicTitle,
        sourceGroupLabel: body.sourceGroupLabel,
      });
      return NextResponse.json(result);
    }

    if (body.action === "publish_summaries" || body.action === "unpublish_summaries") {
      const result = await setSubblockSummaryApproval({
        childName: body.childName,
        subject: body.subject,
        topicTitle: body.topicTitle,
        sourceGroupLabel: body.sourceGroupLabel,
        approved: body.action === "publish_summaries",
      });
      return NextResponse.json(result);
    }

    if (body.action === "update_summary" || body.action === "update_key_points") {
      if (!body.content || !body.content.trim()) {
        return NextResponse.json({ error: "Hiányzik a szerkesztett content." }, { status: 400 });
      }

      const result = await updateSubblockSummaryContent({
        childName: body.childName,
        subject: body.subject,
        topicTitle: body.topicTitle,
        sourceGroupLabel: body.sourceGroupLabel,
        summaryType: body.action === "update_summary" ? "short_summary" : "key_points",
        content: body.content,
      });
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "Ismeretlen action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      {
        error: describeAppError(error, "A summary kezelés nem sikerult."),
      },
      { status: 422 },
    );
  }
}
