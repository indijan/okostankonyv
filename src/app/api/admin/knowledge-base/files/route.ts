import { NextResponse } from "next/server";

import { describeAppError } from "@/lib/errors";
import { createSubjectKnowledgeFile, ensureSubjectKnowledgeBase } from "@/lib/repositories";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

const SUBJECT_KNOWLEDGE_BUCKET = "subject-knowledge";

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_");
}

type SubjectKnowledgeStorageClient = {
  listBuckets: () => Promise<{ data: Array<{ name: string }> | null; error: { message: string } | null }>;
  createBucket: (name: string, options: { public: boolean }) => Promise<{ error: { message: string } | null }>;
};

async function ensureSubjectKnowledgeBucketExists() {
  const supabase = createSupabaseServerClient();
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();

  if (listError) {
    throw new Error(`Nem sikerult ellenorizni a storage bucketeket: ${listError.message}`);
  }

  if (buckets?.some((bucket) => bucket.name === SUBJECT_KNOWLEDGE_BUCKET)) {
    return;
  }

  const storageClient = supabase.storage as unknown as SubjectKnowledgeStorageClient;
  const { error: createError } = await storageClient.createBucket(SUBJECT_KNOWLEDGE_BUCKET, {
    public: false,
  });

  if (createError) {
    throw new Error(`Nem sikerult letrehozni a '${SUBJECT_KNOWLEDGE_BUCKET}' bucketet: ${createError.message}`);
  }
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase nincs beállítva." }, { status: 422 });
  }

  try {
    const formData = await request.formData();
    const childId = formData.get("childId");
    const subjectId = formData.get("subjectId");
    const file = formData.get("file");

    if (typeof childId !== "string" || typeof subjectId !== "string" || !(file instanceof File)) {
      return NextResponse.json({ error: "Hianyzik a gyerek, a tantargy vagy a PDF file." }, { status: 400 });
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "Csak PDF file toltheto fel." }, { status: 400 });
    }

    await ensureSubjectKnowledgeBucketExists();
    const knowledgeBase = await ensureSubjectKnowledgeBase({ childId, subjectId });
    const supabase = createSupabaseServerClient();
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const storagePath = `${childId}/${subjectId}/${Date.now()}-${sanitizeFileName(file.name)}`;

    const { error: uploadError } = await supabase.storage
      .from(SUBJECT_KNOWLEDGE_BUCKET)
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      throw new Error(
        uploadError.message.includes("Bucket not found")
          ? `Nem talaltam a '${SUBJECT_KNOWLEDGE_BUCKET}' storage bucketet. Hozd letre Supabase-ben.`
          : uploadError.message,
      );
    }

    const savedFile = await createSubjectKnowledgeFile({
      knowledgeBaseId: knowledgeBase.id,
      storagePath,
      fileName: file.name,
      mimeType: file.type,
      fileSizeBytes: file.size,
    });

    return NextResponse.json({
      file: savedFile,
      knowledgeBase: {
        ...knowledgeBase,
        fileCount: knowledgeBase.fileCount + 1,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: describeAppError(error, "A PDF feltoltese nem sikerult."),
      },
      { status: 422 },
    );
  }
}
