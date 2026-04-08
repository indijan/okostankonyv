import { NextResponse } from "next/server";

import { describeAppError } from "@/lib/errors";
import {
  createCurriculumSubject,
  createCurriculumSubblock,
  createCurriculumTopic,
  deleteCurriculumSubject,
  deleteCurriculumSubblock,
  deleteCurriculumTopic,
  updateCurriculumSubject,
  updateCurriculumSubblock,
  updateCurriculumTopic,
} from "@/lib/repositories";

export async function POST(request: Request) {
  let body:
    | {
        entity?: "subject";
        grade?: number;
        name?: string;
        childId?: string;
      }
    | {
        entity?: "topic";
        subjectId?: string;
        title?: string;
      }
    | {
        entity?: "subblock";
        topicId?: string;
        title?: string;
      } = {};

  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  try {
    if (body.entity === "subject") {
      if (!body.name?.trim() || !body.grade || !body.childId) {
        return NextResponse.json({ error: "Hianyzik a tantargy neve, az evfolyam vagy a gyerek azonositoja." }, { status: 400 });
      }

      const subject = await createCurriculumSubject({
        grade: body.grade,
        name: body.name,
        childId: body.childId,
      });

      return NextResponse.json({ subject });
    }

    if (body.entity === "topic") {
      if (!body.subjectId || !body.title?.trim()) {
        return NextResponse.json({ error: "Hianyzik a blokk cime vagy a tantargy azonositoja." }, { status: 400 });
      }

      const topic = await createCurriculumTopic({
        subjectId: body.subjectId,
        title: body.title,
      });

      return NextResponse.json({ topic });
    }

    if (body.entity === "subblock") {
      if (!body.topicId || !body.title?.trim()) {
        return NextResponse.json({ error: "Hianyzik az alblokk cime vagy a blokk azonositoja." }, { status: 400 });
      }

      const subblock = await createCurriculumSubblock({
        topicId: body.topicId,
        title: body.title,
      });

      return NextResponse.json({ subblock });
    }

    return NextResponse.json({ error: "Ismeretlen admin muvelet." }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      {
        error: describeAppError(error, "Az admin mentes nem sikerult."),
      },
      { status: 422 },
    );
  }
}

export async function PUT(request: Request) {
  let body:
    | {
        entity?: "subject";
        id?: string;
        name?: string;
      }
    | {
        entity?: "topic";
        id?: string;
        title?: string;
      }
    | {
        entity?: "subblock";
        topicId?: string;
        title?: string;
        nextTitle?: string;
      } = {};

  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  try {
    if (body.entity === "subject") {
      if (!body.id || !body.name?.trim()) {
        return NextResponse.json({ error: "Hianyzik a tantargy azonositoja vagy az uj neve." }, { status: 400 });
      }

      const subject = await updateCurriculumSubject({ id: body.id, name: body.name });
      return NextResponse.json({ subject });
    }

    if (body.entity === "topic") {
      if (!body.id || !body.title?.trim()) {
        return NextResponse.json({ error: "Hianyzik a blokk azonositoja vagy az uj cime." }, { status: 400 });
      }

      const topic = await updateCurriculumTopic({ id: body.id, title: body.title });
      return NextResponse.json({ topic });
    }

    if (body.entity === "subblock") {
      if (!body.topicId || !body.title?.trim() || !body.nextTitle?.trim()) {
        return NextResponse.json({ error: "Hianyzik az alblokk azonositoja vagy az uj cime." }, { status: 400 });
      }

      const subblock = await updateCurriculumSubblock({
        topicId: body.topicId,
        title: body.title,
        nextTitle: body.nextTitle,
      });
      return NextResponse.json({ subblock });
    }

    return NextResponse.json({ error: "Ismeretlen admin muvelet." }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      {
        error: describeAppError(error, "Az admin frissites nem sikerult."),
      },
      { status: 422 },
    );
  }
}

export async function DELETE(request: Request) {
  let body:
    | {
        entity?: "subject";
        id?: string;
      }
    | {
        entity?: "topic";
        id?: string;
      }
    | {
        entity?: "subblock";
        topicId?: string;
        title?: string;
      } = {};

  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  try {
    if (body.entity === "subject") {
      if (!body.id) {
        return NextResponse.json({ error: "Hianyzik a tantargy azonositoja." }, { status: 400 });
      }

      const result = await deleteCurriculumSubject({ id: body.id });
      return NextResponse.json(result);
    }

    if (body.entity === "topic") {
      if (!body.id) {
        return NextResponse.json({ error: "Hianyzik a blokk azonositoja." }, { status: 400 });
      }

      const result = await deleteCurriculumTopic({ id: body.id });
      return NextResponse.json(result);
    }

    if (body.entity === "subblock") {
      if (!body.topicId || !body.title?.trim()) {
        return NextResponse.json({ error: "Hianyzik az alblokk azonositoja." }, { status: 400 });
      }

      const result = await deleteCurriculumSubblock({
        topicId: body.topicId,
        title: body.title,
      });
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "Ismeretlen admin muvelet." }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      {
        error: describeAppError(error, "Az admin torles nem sikerult."),
      },
      { status: 422 },
    );
  }
}
