import { NextResponse } from "next/server";
import { toFile } from "openai";

import { describeAppError } from "@/lib/errors";
import { createOpenAiServerClient, isOpenAiConfigured } from "@/lib/openai/server";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

function buildKnowledgeMarkdown(input: {
  subjectName: string;
  childId: string;
  fileName: string;
  segments: Array<{
    page_number: number;
    segment_type: "content" | "exercise" | "noise" | "source_note";
    cleaned_text: string;
  }>;
}) {
  const header = [
    `# ${input.subjectName}`,
    "",
    `Child ID: ${input.childId}`,
    `Source file: ${input.fileName}`,
    "",
  ];

  const body = input.segments
    .filter((segment) => segment.segment_type !== "noise")
    .map((segment) =>
      [
        `## Page ${segment.page_number}`,
        `Type: ${segment.segment_type}`,
        "",
        segment.cleaned_text.trim(),
        "",
      ].join("\n"),
    );

  return [...header, ...body].join("\n");
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured() || !isOpenAiConfigured()) {
    return NextResponse.json({ error: "Supabase vagy OpenAI nincs beállítva." }, { status: 422 });
  }

  let body: { knowledgeBaseId?: string } = {};

  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  if (!body.knowledgeBaseId) {
    return NextResponse.json({ error: "Hianyzik a tudasbazis azonositoja." }, { status: 400 });
  }

  const knowledgeBaseId = body.knowledgeBaseId;
  const supabase = createSupabaseServerClient();
  const openai = createOpenAiServerClient();

  try {
    await supabase
      .from("subject_knowledge_bases")
      .update({
        status: "processing",
        updated_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("id", knowledgeBaseId);

    const { data: knowledgeBase, error: knowledgeBaseError } = await supabase
      .from("subject_knowledge_bases")
      .select("id,child_id,subject_id,vector_store_id,subject:curriculum_subjects(name)")
      .eq("id", knowledgeBaseId)
      .single();

    if (knowledgeBaseError || !knowledgeBase) {
      throw new Error(`Failed to load knowledge base: ${knowledgeBaseError?.message}`);
    }

    const { data: files, error: filesError } = await supabase
      .from("subject_knowledge_files")
      .select("id,file_name,openai_file_id")
      .eq("knowledge_base_id", knowledgeBaseId)
      .order("created_at", { ascending: true });

    if (filesError) {
      throw new Error(`Failed to load knowledge base files: ${filesError.message}`);
    }

    const openAiFileIds: string[] = [];

    for (const file of files ?? []) {
      const { data: segments, error: segmentsError } = await supabase
        .from("subject_knowledge_segments")
        .select("page_number,segment_type,cleaned_text")
        .eq("file_id", file.id)
        .order("page_number", { ascending: true });

      if (segmentsError) {
        throw new Error(`Failed to load knowledge segments: ${segmentsError.message}`);
      }

      if (!segments || segments.length === 0) {
        continue;
      }

      if (file.openai_file_id) {
        openAiFileIds.push(file.openai_file_id);
        continue;
      }

      const markdown = buildKnowledgeMarkdown({
        subjectName:
          knowledgeBase.subject && !Array.isArray(knowledgeBase.subject)
            ? knowledgeBase.subject.name
            : "Ismeretlen tantárgy",
        childId: knowledgeBase.child_id,
        fileName: file.file_name,
        segments,
      });

      const uploadedFile = await openai.files.create({
        purpose: "user_data",
        file: await toFile(Buffer.from(markdown, "utf8"), `${file.file_name}.md`, {
          type: "text/markdown",
        }),
      });

      await supabase
        .from("subject_knowledge_files")
        .update({
          openai_file_id: uploadedFile.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", file.id);

      openAiFileIds.push(uploadedFile.id);
    }

    if (openAiFileIds.length === 0) {
      throw new Error("Nincs feldolgozott segment, amiből vector store építhető.");
    }

    const vectorStore =
      knowledgeBase.vector_store_id
        ? await openai.vectorStores.retrieve(knowledgeBase.vector_store_id)
        : await openai.vectorStores.create({
            name: `okostankonyv-${knowledgeBase.child_id}-${knowledgeBase.subject_id}`,
          });

    await openai.vectorStores.fileBatches.createAndPoll(vectorStore.id, {
      file_ids: openAiFileIds,
      chunking_strategy: {
        type: "static",
        static: {
          max_chunk_size_tokens: 800,
          chunk_overlap_tokens: 200,
        },
      },
    });

    await supabase
      .from("subject_knowledge_bases")
      .update({
        status: "ready",
        vector_store_id: vectorStore.id,
        last_built_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("id", knowledgeBaseId);

    return NextResponse.json({
      ok: true,
      vectorStoreId: vectorStore.id,
    });
  } catch (error) {
    await supabase
      .from("subject_knowledge_bases")
      .update({
        status: "failed",
        updated_at: new Date().toISOString(),
        error_message: describeAppError(error, "A vector store build nem sikerült."),
      })
      .eq("id", knowledgeBaseId);

    return NextResponse.json(
      {
        error: describeAppError(error, "A vector store build nem sikerült."),
      },
      { status: 422 },
    );
  }
}
