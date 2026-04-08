import { createClient } from "@supabase/supabase-js";

import type { Database } from "../src/lib/supabase/database.types.ts";

function createSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Hiányzik a NEXT_PUBLIC_SUPABASE_URL vagy a SUPABASE_SERVICE_ROLE_KEY.");
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function main() {
  const childRef = process.argv[2]?.trim();

  if (!childRef) {
    throw new Error('Használat: npx tsx scripts/migrate-global-curriculum-to-child.ts "Ádám"');
  }

  const supabase = createSupabaseServerClient();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(childRef);
  const childQuery = supabase.from("children").select("id,name,grade").limit(1);
  const { data: child, error: childError } = await (isUuid
    ? childQuery.eq("id", childRef).maybeSingle()
    : childQuery.eq("name", childRef).maybeSingle());

  if (childError || !child) {
    throw new Error(`Nem találtam a gyereket: ${childError?.message ?? childRef}`);
  }

  const { data: globalSubjects, error: subjectsError } = await supabase
    .from("curriculum_subjects")
    .select("id,grade,name,sort_order")
    .is("child_id", null)
    .eq("grade", child.grade ?? 5)
    .order("sort_order", { ascending: true });

  if (subjectsError) {
    throw new Error(`Nem sikerült betölteni a globális tantárgyakat: ${subjectsError.message}`);
  }

  const migrated: Array<{ subject: string; topics: number; subblocks: number; links: number }> = [];
  console.log(`Gyerek: ${child.name} (${child.id}), globális tantárgyak: ${(globalSubjects ?? []).length}`);

  for (const globalSubject of globalSubjects ?? []) {
    console.log(`Migrálás indul: ${globalSubject.name}`);
    const { data: targetSubject, error: targetSubjectError } = await supabase
      .from("curriculum_subjects")
      .upsert(
        {
          child_id: child.id,
          grade: globalSubject.grade,
          name: globalSubject.name,
          sort_order: globalSubject.sort_order,
        },
        { onConflict: "child_id,grade,name" },
      )
      .select("id")
      .single();

    if (targetSubjectError || !targetSubject) {
      throw new Error(`Nem sikerült létrehozni a tantárgyat (${globalSubject.name}): ${targetSubjectError?.message}`);
    }

    const { data: topics, error: topicsError } = await supabase
      .from("curriculum_topics")
      .select("id,title,sort_order,notes")
      .eq("subject_id", globalSubject.id)
      .order("sort_order", { ascending: true });

    if (topicsError) {
      throw new Error(`Nem sikerült betölteni a blokkokat (${globalSubject.name}): ${topicsError.message}`);
    }

    let subblockCount = 0;
    let linkCount = 0;

    for (const topic of topics ?? []) {
      const { data: targetTopic, error: targetTopicError } = await supabase
        .from("curriculum_topics")
        .upsert(
          {
            subject_id: targetSubject.id,
            title: topic.title,
            sort_order: topic.sort_order,
            notes: topic.notes,
          },
          { onConflict: "subject_id,title" },
        )
        .select("id")
        .single();

      if (targetTopicError || !targetTopic) {
        throw new Error(`Nem sikerült létrehozni a blokkot (${topic.title}): ${targetTopicError?.message}`);
      }

      const { data: subblocks, error: subblocksError } = await supabase
        .from("curriculum_subblocks")
        .select(
          "id,title,sort_order,notes,links:curriculum_subblock_links(source_link_id,sort_order,content_hint,include_pattern,exclude_pattern)",
        )
        .eq("topic_id", topic.id)
        .order("sort_order", { ascending: true });

      if (subblocksError) {
        throw new Error(`Nem sikerült betölteni az alblokkokat (${topic.title}): ${subblocksError.message}`);
      }

      for (const subblock of subblocks ?? []) {
        const { data: targetSubblock, error: targetSubblockError } = await supabase
          .from("curriculum_subblocks")
          .upsert(
            {
              topic_id: targetTopic.id,
              title: subblock.title,
              sort_order: subblock.sort_order,
              notes: subblock.notes,
            },
            { onConflict: "topic_id,title" },
          )
          .select("id")
          .single();

        if (targetSubblockError || !targetSubblock) {
          throw new Error(
            `Nem sikerült létrehozni az alblokkot (${subblock.title}): ${targetSubblockError?.message}`,
          );
        }

        subblockCount += 1;

        const links = ((subblock.links as Array<{
          source_link_id: string;
          sort_order: number;
          content_hint: string | null;
          include_pattern: string | null;
          exclude_pattern: string | null;
        }> | null) ?? []);

        for (const link of links) {
          const { error: joinError } = await supabase.from("curriculum_subblock_links").upsert(
            {
              subblock_id: targetSubblock.id,
              source_link_id: link.source_link_id,
              sort_order: link.sort_order,
              content_hint: link.content_hint,
              include_pattern: link.include_pattern,
              exclude_pattern: link.exclude_pattern,
            },
            { onConflict: "subblock_id,source_link_id" },
          );

          if (joinError) {
            throw new Error(
              `Nem sikerült átmásolni a link-hozzárendelést (${subblock.title}): ${joinError.message}`,
            );
          }

          linkCount += 1;
        }
      }
    }

    migrated.push({
      subject: globalSubject.name,
      topics: (topics ?? []).length,
      subblocks: subblockCount,
      links: linkCount,
    });

    console.log(
      `Migrálás kész: ${globalSubject.name} | blokkok: ${(topics ?? []).length}, alblokkok: ${subblockCount}, linkek: ${linkCount}`,
    );
  }

  console.log(
    JSON.stringify(
      {
        child: {
          id: child.id,
          name: child.name,
          grade: child.grade,
        },
        migrated,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
