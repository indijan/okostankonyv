import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  addExamSourceOverride,
  removeExamSourceLink,
  updateExamSourceLinkSettings,
} from "@/lib/exam-sources";
import { hasParentAdminPassword } from "@/lib/env";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const parentUnlocked = !hasParentAdminPassword() || cookieStore.get("okostankonyv_parent_session")?.value === "1";

  if (!parentUnlocked) {
    return NextResponse.json({ error: "A szülői nézet zárolva van." }, { status: 401 });
  }

  const body = (await request.json()) as {
    childId?: string;
    subject?: string;
    topicTitle?: string;
    sourceGroupLabel?: string;
    url?: string;
  };

  if (!body.childId || !body.subject || !body.topicTitle || !body.sourceGroupLabel || !body.url) {
    return NextResponse.json({ error: "Hiányos kérés." }, { status: 400 });
  }

  try {
    const result = await addExamSourceOverride({
      childId: body.childId,
      subject: body.subject,
      topicTitle: body.topicTitle,
      sourceGroupLabel: body.sourceGroupLabel,
      url: body.url,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Nem sikerült elmenteni a forráslinket.",
      },
      { status: 422 },
    );
  }
}

export async function DELETE(request: Request) {
  const cookieStore = await cookies();
  const parentUnlocked = !hasParentAdminPassword() || cookieStore.get("okostankonyv_parent_session")?.value === "1";

  if (!parentUnlocked) {
    return NextResponse.json({ error: "A szülői nézet zárolva van." }, { status: 401 });
  }

  const body = (await request.json()) as {
    childId?: string;
    subject?: string;
    topicTitle?: string;
    sourceGroupLabel?: string;
    url?: string;
  };

  if (!body.childId || !body.subject || !body.topicTitle || !body.sourceGroupLabel || !body.url) {
    return NextResponse.json({ error: "Hiányos kérés." }, { status: 400 });
  }

  try {
    const result = await removeExamSourceLink({
      childId: body.childId,
      subject: body.subject,
      topicTitle: body.topicTitle,
      sourceGroupLabel: body.sourceGroupLabel,
      url: body.url,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Nem sikerült törölni a linket.",
      },
      { status: 422 },
    );
  }
}

export async function PUT(request: Request) {
  const cookieStore = await cookies();
  const parentUnlocked = !hasParentAdminPassword() || cookieStore.get("okostankonyv_parent_session")?.value === "1";

  if (!parentUnlocked) {
    return NextResponse.json({ error: "A szülői nézet zárolva van." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      childId?: string;
      subject?: string;
      topicTitle?: string;
      sourceGroupLabel?: string;
      url?: string;
      contentHint?: string | null;
      includePattern?: string | null;
      excludePattern?: string | null;
    };

    if (!body.childId || !body.subject || !body.topicTitle || !body.sourceGroupLabel || !body.url) {
      return NextResponse.json({ error: "Hiányos kérés." }, { status: 400 });
    }

    const result = await updateExamSourceLinkSettings({
      childId: body.childId,
      subject: body.subject,
      topicTitle: body.topicTitle,
      sourceGroupLabel: body.sourceGroupLabel,
      url: body.url,
      contentHint: body.contentHint,
      includePattern: body.includePattern,
      excludePattern: body.excludePattern,
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Nem sikerült menteni a link beállításait.",
      },
      { status: 422 },
    );
  }
}
