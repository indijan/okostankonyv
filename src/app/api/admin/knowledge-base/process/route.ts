import { NextResponse } from "next/server";

import { cleanPdfKnowledgePages } from "@/lib/knowledge-base";
import { extractPdfPagesStructured } from "@/lib/pdf";
import { describeAppError } from "@/lib/errors";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

const SUBJECT_KNOWLEDGE_BUCKET = "subject-knowledge";

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase nincs beállítva." }, { status: 422 });
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

  const supabase = createSupabaseServerClient();
  const knowledgeBaseId = body.knowledgeBaseId;

  try {
    await supabase
      .from("subject_knowledge_bases")
      .update({
        status: "processing",
        updated_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("id", knowledgeBaseId);

    const { data: files, error: filesError } = await supabase
      .from("subject_knowledge_files")
      .select("id,storage_path,file_name,mime_type,file_size_bytes")
      .eq("knowledge_base_id", knowledgeBaseId)
      .order("created_at", { ascending: true });

    if (filesError) {
      throw new Error(`Failed to load knowledge base files: ${filesError.message}`);
    }

    const eligibleFiles = (files ?? []).filter((file) => file.mime_type === "application/pdf");
    if (eligibleFiles.length === 0) {
      throw new Error("Ehhez a tudásbázishoz még nincs feldolgozható PDF.");
    }

    for (const file of eligibleFiles) {
      await supabase
        .from("subject_knowledge_files")
        .update({
          processing_status: "processing",
          updated_at: new Date().toISOString(),
        })
        .eq("id", file.id);

      const { data: blob, error: downloadError } = await supabase.storage
        .from(SUBJECT_KNOWLEDGE_BUCKET)
        .download(file.storage_path);

      if (downloadError || !blob) {
        throw new Error(`A PDF letoltese sikertelen: ${downloadError?.message}`);
      }

      const bytes = new Uint8Array(await blob.arrayBuffer());
      const pages = await extractPdfPagesStructured(bytes);
      const segments = cleanPdfKnowledgePages(pages);

      await supabase.from("subject_knowledge_segments").delete().eq("file_id", file.id);

      if (segments.length > 0) {
        const { error: insertError } = await supabase.from("subject_knowledge_segments").insert(
          segments.map((segment) => ({
            knowledge_base_id: knowledgeBaseId,
            file_id: file.id,
            page_number: segment.pageNumber,
            segment_type: segment.segmentType,
            raw_text: segment.rawText,
            cleaned_text: segment.cleanedText,
          })),
        );

        if (insertError) {
          throw new Error(`Failed to save knowledge segments: ${insertError.message}`);
        }
      }

      await supabase
        .from("subject_knowledge_files")
        .update({
          processing_status: "ready",
          page_count: pages.length,
          updated_at: new Date().toISOString(),
        })
        .eq("id", file.id);
    }

    await supabase
      .from("subject_knowledge_bases")
      .update({
        status: "ready",
        last_built_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("id", knowledgeBaseId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    await supabase
      .from("subject_knowledge_bases")
      .update({
        status: "failed",
        updated_at: new Date().toISOString(),
        error_message: describeAppError(error, "A PDF feldolgozása nem sikerült."),
      })
      .eq("id", knowledgeBaseId);

    return NextResponse.json(
      {
        error: describeAppError(error, "A PDF feldolgozása nem sikerült."),
      },
      { status: 422 },
    );
  }
}
