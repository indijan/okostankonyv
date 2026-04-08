import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { parse } from "yaml";

import type { BookSourceType } from "@/lib/domain";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

type ExamSourceLink = {
  id?: string;
  url: string;
  sourceType?: BookSourceType | null;
  contentHint?: string | null;
  includePattern?: string | null;
  excludePattern?: string | null;
};

type ExamSourceGroup = {
  id?: string;
  label: string;
  status: "ready" | "missing";
  urls: string[];
  links?: ExamSourceLink[];
};

type ExamTopic = {
  id?: string;
  title: string;
  tags?: string[];
  notes?: string[];
  source_groups: ExamSourceGroup[];
};

type ExamSubject = {
  id?: string;
  subject: string;
  exam_modes?: string[];
  notes?: string[];
  topics: ExamTopic[];
};

type ExamRegistry = {
  grade: number;
  title: string;
  source_document: string;
  subjects: ExamSubject[];
  next_steps?: string[];
};

export type ReadyIngestItem = {
  subject: string;
  topicTitle: string;
  sourceGroupLabel: string;
  sourceLabel: string;
  sourceUri: string;
  sourceType: BookSourceType;
  gradeLabel: string;
  contentHint?: string | null;
  includePattern?: string | null;
  excludePattern?: string | null;
};

const REGISTRY_FILE_PATH = join(process.cwd(), "vizsgaanyag_5evfolyam_sources.yaml");

function inferSourceType(sourceUri: string): BookSourceType | null {
  if (/\.pdf(\?|#|$)/i.test(sourceUri)) {
    return "nkp_pdf";
  }

  if (/^https?:\/\/www\.nkp\.hu\/tankonyv\/.+\/(lecke|fejezet)_/i.test(sourceUri)) {
    return "nkp_lesson_page";
  }

  return null;
}

function isSupportedReadySourceWithFilters(item: {
  url: string;
  sourceType: BookSourceType | null;
  contentHint?: string | null;
  includePattern?: string | null;
  excludePattern?: string | null;
}): item is {
  url: string;
  sourceType: BookSourceType;
  contentHint?: string | null;
  includePattern?: string | null;
  excludePattern?: string | null;
} {
  return item.sourceType !== null;
}

function getSupportedLinks(
  links: Array<{
    url: string;
    sourceType?: BookSourceType | null;
    contentHint?: string | null;
    includePattern?: string | null;
    excludePattern?: string | null;
  }>,
) {
  return links.filter((link) =>
    isSupportedReadySourceWithFilters({
      url: link.url,
      sourceType: link.sourceType ?? inferSourceType(link.url),
      contentHint: link.contentHint ?? null,
      includePattern: link.includePattern ?? null,
      excludePattern: link.excludePattern ?? null,
    }),
  );
}

async function loadYamlRegistry(): Promise<ExamRegistry> {
  const raw = await readFile(REGISTRY_FILE_PATH, "utf8");
  return parse(raw) as ExamRegistry;
}

async function loadDbRegistry(childId?: string, grade?: number): Promise<ExamRegistry | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  try {
    const supabase = createSupabaseServerClient();
    const subjectQuery = childId
      ? supabase
          .from("curriculum_subjects")
          .select(
            "id,grade,name,sort_order,topics:curriculum_topics(id,title,sort_order,notes,subblocks:curriculum_subblocks(id,title,sort_order,notes,links:curriculum_subblock_links(id,sort_order,content_hint,include_pattern,exclude_pattern,source_link:curriculum_source_links(id,url,source_type,active,label))))",
          )
          .eq("child_id", childId)
      : supabase
          .from("curriculum_subjects")
          .select(
            "id,grade,name,sort_order,topics:curriculum_topics(id,title,sort_order,notes,subblocks:curriculum_subblocks(id,title,sort_order,notes,links:curriculum_subblock_links(id,sort_order,content_hint,include_pattern,exclude_pattern,source_link:curriculum_source_links(id,url,source_type,active,label))))",
          )
          .is("child_id", null);

    const { data, error } = await subjectQuery;

    if (error) {
      throw error;
    }

    const subjects = data as unknown[] | null;

    if (!subjects || subjects.length === 0) {
      if (childId) {
        return {
          grade: grade ?? 5,
          title: `${grade ?? 5}. évfolyamos vizsgaanyag`,
          source_document: REGISTRY_FILE_PATH,
          subjects: [],
        };
      }

      return null;
    }

    const normalizedSubjects = subjects as Array<{
      id: string;
      grade: number;
      name: string;
      sort_order: number;
      topics?: unknown[];
    }>;
    normalizedSubjects.sort((a, b) => a.sort_order - b.sort_order);
    const resolvedGrade = normalizedSubjects[0]?.grade ?? 5;

    return {
      grade: resolvedGrade,
      title: `${resolvedGrade}. évfolyamos vizsgaanyag`,
      source_document: REGISTRY_FILE_PATH,
      subjects: normalizedSubjects.map((subject) => ({
        id: subject.id,
        subject: subject.name,
        topics: ((subject.topics as unknown[]) ?? [])
          .map((topic) => topic as {
            id: string;
            title: string;
            notes: string | null;
            sort_order: number;
            subblocks?: unknown[];
          })
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((topic) => ({
            id: topic.id,
            title: topic.title,
            notes: topic.notes ? [topic.notes] : undefined,
            source_groups: ((topic.subblocks as unknown[]) ?? [])
              .map((subblock) => subblock as {
                id: string;
                title: string;
                sort_order: number;
                notes: string | null;
                links?: unknown[];
              })
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((subblock) => {
                const links = ((subblock.links as unknown[]) ?? [])
                  .map((linkRow) => linkRow as {
                    source_link?: {
                      id: string;
                      url: string;
                      source_type: BookSourceType;
                      active: boolean;
                    } | null;
                    sort_order: number;
                    content_hint?: string | null;
                    include_pattern?: string | null;
                    exclude_pattern?: string | null;
                  })
                  .filter((linkRow) => linkRow.source_link?.active)
                  .sort((a, b) => a.sort_order - b.sort_order)
                  .map((linkRow) => ({
                    id: linkRow.source_link!.id,
                    url: linkRow.source_link!.url,
                    sourceType: linkRow.source_link!.source_type,
                    contentHint: linkRow.content_hint ?? null,
                    includePattern: linkRow.include_pattern ?? null,
                    excludePattern: linkRow.exclude_pattern ?? null,
                  }));
                const supportedLinks = getSupportedLinks(links);

                return {
                  id: subblock.id,
                  label: subblock.title,
                  status: supportedLinks.length > 0 ? "ready" : "missing",
                  urls: links.map((link) => link.url),
                  links,
                } satisfies ExamSourceGroup;
              }),
          })),
      })),
    };
  } catch {
    return null;
  }
}

export async function loadExamRegistry(options?: { childId?: string; grade?: number }): Promise<ExamRegistry> {
  const dbRegistry = await loadDbRegistry(options?.childId, options?.grade);
  if (dbRegistry) {
    return dbRegistry;
  }

  if (options?.childId) {
    return {
      grade: options.grade ?? 5,
      title: `${options.grade ?? 5}. évfolyamos vizsgaanyag`,
      source_document: REGISTRY_FILE_PATH,
      subjects: [],
    };
  }

  if (isSupabaseConfigured()) {
    try {
      await importYamlRegistryToCurriculum();
      const importedRegistry = await loadDbRegistry(options?.childId, options?.grade);
      if (importedRegistry) {
        return importedRegistry;
      }
    } catch {
      // fall through to YAML bootstrap mode
    }
  }

  return loadYamlRegistry();
}

export async function importYamlRegistryToCurriculum() {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured.");
  }

  const registry = await loadYamlRegistry();
  const supabase = createSupabaseServerClient();

  for (const [subjectIndex, subject] of registry.subjects.entries()) {
    const { data: subjectRow, error: subjectError } = await supabase
      .from("curriculum_subjects")
      .upsert(
        {
          grade: registry.grade,
          name: subject.subject,
          sort_order: subjectIndex,
        },
        { onConflict: "grade,name" },
      )
      .select("id")
      .single();

    if (subjectError || !subjectRow) {
      throw new Error(`Failed to import subject ${subject.subject}: ${subjectError?.message}`);
    }

    for (const [topicIndex, topic] of subject.topics.entries()) {
      const { data: topicRow, error: topicError } = await supabase
        .from("curriculum_topics")
        .upsert(
          {
            subject_id: subjectRow.id,
            title: topic.title,
            sort_order: topicIndex,
            notes: topic.notes?.join("\n") ?? null,
          },
          { onConflict: "subject_id,title" },
        )
        .select("id")
        .single();

      if (topicError || !topicRow) {
        throw new Error(`Failed to import topic ${topic.title}: ${topicError?.message}`);
      }

      for (const [groupIndex, group] of topic.source_groups.entries()) {
        const { data: subblockRow, error: subblockError } = await supabase
          .from("curriculum_subblocks")
          .upsert(
            {
              topic_id: topicRow.id,
              title: group.label,
              sort_order: groupIndex,
            },
            { onConflict: "topic_id,title" },
          )
          .select("id")
          .single();

        if (subblockError || !subblockRow) {
          throw new Error(`Failed to import subblock ${group.label}: ${subblockError?.message}`);
        }

        for (const [linkIndex, url] of group.urls.entries()) {
          const sourceType = inferSourceType(url);
          if (!sourceType) {
            continue;
          }

          const { data: sourceLinkRow, error: sourceLinkError } = await supabase
            .from("curriculum_source_links")
            .upsert(
              {
                label: group.label,
                source_type: sourceType,
                url,
                active: true,
              },
              { onConflict: "url" },
            )
            .select("id")
            .single();

          if (sourceLinkError || !sourceLinkRow) {
            throw new Error(`Failed to import source link ${url}: ${sourceLinkError?.message}`);
          }

          const { error: joinError } = await supabase.from("curriculum_subblock_links").upsert(
            {
              subblock_id: subblockRow.id,
              source_link_id: sourceLinkRow.id,
              sort_order: linkIndex,
            },
            { onConflict: "subblock_id,source_link_id" },
          );

          if (joinError) {
            throw new Error(`Failed to link source ${url} to ${group.label}: ${joinError.message}`);
          }
        }
      }
    }
  }

  return { imported: true };
}

export async function addExamSourceOverride(input: {
  childId?: string;
  subject: string;
  topicTitle: string;
  sourceGroupLabel: string;
  url: string;
}) {
  const normalizedUrl = input.url.trim();
  const sourceType = inferSourceType(normalizedUrl);

  if (!sourceType) {
    throw new Error("Csak ingestelhető NKP leckeoldal vagy közvetlen PDF link adható meg.");
  }

  if (!isSupabaseConfigured()) {
    throw new Error("A linkkezeléshez Supabase kapcsolat kell.");
  }

  const supabase = createSupabaseServerClient();
  const registry = await loadExamRegistry({ childId: input.childId });
  const subject = registry.subjects.find((item) => item.subject === input.subject);
  const topic = subject?.topics.find((item) => item.title === input.topicTitle);
  const group = topic?.source_groups.find((item) => item.label === input.sourceGroupLabel);

  if (!group) {
    throw new Error("Nem találtam a megadott alblokkot a tematikában.");
  }

  const { data: subjectRow, error: subjectError } = await supabase
    .from("curriculum_subjects")
    .select("id")
    .eq("child_id", input.childId ?? "")
    .eq("name", input.subject)
    .maybeSingle();

  if (subjectError) {
    throw new Error(`Nem sikerült betölteni a tantárgyat: ${subjectError.message}`);
  }

  if (!subjectRow) {
    throw new Error("Nem találtam a megadott gyerekhez tartozó tantárgyat.");
  }

  const { data: topicRow, error: topicError } = await supabase
    .from("curriculum_topics")
    .select("id")
    .eq("subject_id", subjectRow.id)
    .eq("title", input.topicTitle)
    .maybeSingle();

  if (topicError) {
    throw new Error(`Nem sikerült betölteni a blokkot: ${topicError.message}`);
  }

  if (!topicRow) {
    throw new Error("Nem találtam a megadott blokkot.");
  }

  const { data: matchedSubblock, error: subblockError } = await supabase
    .from("curriculum_subblocks")
    .select("id")
    .eq("topic_id", topicRow.id)
    .eq("title", input.sourceGroupLabel)
    .maybeSingle();

  if (subblockError) {
    throw new Error(`Nem sikerült betölteni az alblokkot: ${subblockError.message}`);
  }

  if (!matchedSubblock) {
    throw new Error("Nem találtam a megadott alblokk DB-rekordját.");
  }

  const { data: sourceLink, error: sourceLinkError } = await supabase
    .from("curriculum_source_links")
    .upsert(
      {
        label: input.sourceGroupLabel,
        source_type: sourceType,
        url: normalizedUrl,
        active: true,
      },
      { onConflict: "url" },
    )
    .select("id")
    .single();

  if (sourceLinkError || !sourceLink) {
    throw new Error(`Nem sikerült elmenteni a source linket: ${sourceLinkError?.message}`);
  }

  const { error: joinError } = await supabase.from("curriculum_subblock_links").upsert(
    {
      subblock_id: matchedSubblock.id,
      source_link_id: sourceLink.id,
    },
    { onConflict: "subblock_id,source_link_id" },
  );

  if (joinError) {
    return { alreadyExists: true, sourceType };
  }

  return { alreadyExists: false, sourceType };
}

export async function updateExamSourceLinkSettings(input: {
  childId?: string;
  subject: string;
  topicTitle: string;
  sourceGroupLabel: string;
  url: string;
  contentHint?: string | null;
  includePattern?: string | null;
  excludePattern?: string | null;
}) {
  if (!isSupabaseConfigured()) {
    throw new Error("A linkkezeléshez Supabase kapcsolat kell.");
  }

  const supabase = createSupabaseServerClient();
  const { data: sourceLink, error: linkError } = await supabase
    .from("curriculum_source_links")
    .select("id")
    .eq("url", input.url)
    .maybeSingle();

  if (linkError || !sourceLink) {
    throw new Error(`Nem sikerült betölteni a linket: ${linkError?.message ?? "Nincs ilyen link."}`);
  }

  const { data: subjectRow, error: subjectError } = await supabase
    .from("curriculum_subjects")
    .select("id")
    .eq("child_id", input.childId ?? "")
    .eq("name", input.subject)
    .maybeSingle();

  if (subjectError) {
    throw new Error(`Nem sikerült betölteni a tantárgyat: ${subjectError.message}`);
  }

  if (!subjectRow) {
    throw new Error("Nem találtam a megadott gyerekhez tartozó tantárgyat.");
  }

  const { data: topicRow, error: topicError } = await supabase
    .from("curriculum_topics")
    .select("id")
    .eq("subject_id", subjectRow.id)
    .eq("title", input.topicTitle)
    .maybeSingle();

  if (topicError) {
    throw new Error(`Nem sikerült betölteni a blokkot: ${topicError.message}`);
  }

  if (!topicRow) {
    throw new Error("Nem találtam a megadott blokkot.");
  }

  const { data: matchedSubblock, error: subblockError } = await supabase
    .from("curriculum_subblocks")
    .select("id")
    .eq("topic_id", topicRow.id)
    .eq("title", input.sourceGroupLabel)
    .maybeSingle();

  if (subblockError) {
    throw new Error(`Nem sikerült betölteni az alblokkot: ${subblockError.message}`);
  }

  if (!matchedSubblock) {
    throw new Error("Nem találtam a megadott alblokk DB-rekordját.");
  }

  const { error: updateError } = await supabase
    .from("curriculum_subblock_links")
    .update({
      content_hint: input.contentHint?.trim() || null,
      include_pattern: input.includePattern?.trim() || null,
      exclude_pattern: input.excludePattern?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("subblock_id", matchedSubblock.id)
    .eq("source_link_id", sourceLink.id);

  if (updateError) {
    throw new Error(`Nem sikerült menteni a link beállításait: ${updateError.message}`);
  }

  return { updated: true };
}

export async function removeExamSourceLink(input: {
  childId?: string;
  subject: string;
  topicTitle: string;
  sourceGroupLabel: string;
  url: string;
}) {
  if (!isSupabaseConfigured()) {
    throw new Error("A linkkezeléshez Supabase kapcsolat kell.");
  }

  const supabase = createSupabaseServerClient();
  const { data: sourceLink, error: linkError } = await supabase
    .from("curriculum_source_links")
    .select("id")
    .eq("url", input.url)
    .maybeSingle();

  if (linkError) {
    throw new Error(`Nem sikerült betölteni a linket: ${linkError.message}`);
  }

  if (!sourceLink) {
    return { removed: false };
  }

  const { data: subjectRow, error: subjectError } = await supabase
    .from("curriculum_subjects")
    .select("id")
    .eq("child_id", input.childId ?? "")
    .eq("name", input.subject)
    .maybeSingle();

  if (subjectError) {
    throw new Error(`Nem sikerült betölteni a tantárgyat: ${subjectError.message}`);
  }

  if (!subjectRow) {
    throw new Error("Nem találtam a megadott gyerekhez tartozó tantárgyat.");
  }

  const { data: topicRow, error: topicError } = await supabase
    .from("curriculum_topics")
    .select("id")
    .eq("subject_id", subjectRow.id)
    .eq("title", input.topicTitle)
    .maybeSingle();

  if (topicError) {
    throw new Error(`Nem sikerült betölteni a blokkot: ${topicError.message}`);
  }

  if (!topicRow) {
    throw new Error("Nem találtam a megadott blokkot.");
  }

  const { data: matchedSubblock, error: subblockError } = await supabase
    .from("curriculum_subblocks")
    .select("id")
    .eq("topic_id", topicRow.id)
    .eq("title", input.sourceGroupLabel)
    .maybeSingle();

  if (subblockError) {
    throw new Error(`Nem sikerült betölteni az alblokkot: ${subblockError.message}`);
  }

  if (!matchedSubblock) {
    throw new Error("Nem találtam a megadott alblokk DB-rekordját.");
  }

  const { error: deleteError } = await supabase
    .from("curriculum_subblock_links")
    .delete()
    .eq("subblock_id", matchedSubblock.id)
    .eq("source_link_id", sourceLink.id);

  if (deleteError) {
    throw new Error(`Nem sikerült törölni a link-hozzárendelést: ${deleteError.message}`);
  }

  return { removed: true };
}

export async function getExamRegistryOverview(options?: { childId?: string; grade?: number }) {
  const registry = await loadExamRegistry(options);
  const topics = registry.subjects.flatMap((subject) =>
    subject.topics.map((topic) => ({
      subject: subject.subject,
      title: topic.title,
      readyGroups: topic.source_groups.filter((group) => group.status === "ready").length,
      missingGroups: topic.source_groups.filter((group) => group.status === "missing").length,
      totalUrls: topic.source_groups.flatMap((group) => group.urls).length,
    })),
  );

  return {
    registry,
    topics,
    readyTopics: topics.filter((topic) => topic.readyGroups > 0),
    missingTopics: topics.filter((topic) => topic.missingGroups > 0),
  };
}

export async function listReadyIngestItems(options?: {
  childId?: string;
  grade?: number;
  subject?: string;
  topicTitle?: string;
  sourceGroupLabel?: string;
}): Promise<ReadyIngestItem[]> {
  const registry = await loadExamRegistry({ childId: options?.childId, grade: options?.grade });
  const subjectFilter = options?.subject?.trim().toLowerCase();
  const topicFilter = options?.topicTitle?.trim().toLowerCase();
  const sourceGroupFilter = options?.sourceGroupLabel?.trim().toLowerCase();

  return registry.subjects.flatMap((subject) =>
    subjectFilter && subject.subject.toLowerCase() !== subjectFilter
      ? []
      : subject.topics.flatMap((topic) =>
          topicFilter && topic.title.toLowerCase() !== topicFilter
            ? []
            : topic.source_groups.flatMap((group) =>
                sourceGroupFilter && group.label.toLowerCase() !== sourceGroupFilter
                  ? []
                  : (() => {
                      const candidateItems = (
                        group.links ?? group.urls.map((url) => ({ url, sourceType: inferSourceType(url) }))
                      )
                        .map((item) => ({
                          url: item.url,
                          sourceType: item.sourceType ?? inferSourceType(item.url),
                          contentHint: "contentHint" in item ? item.contentHint ?? null : null,
                          includePattern: "includePattern" in item ? item.includePattern ?? null : null,
                          excludePattern: "excludePattern" in item ? item.excludePattern ?? null : null,
                        }));

                      const normalizedItems = candidateItems.filter(
                        isSupportedReadySourceWithFilters,
                      );

                      return normalizedItems.flatMap((item): ReadyIngestItem[] => {
                        if (!item.sourceType) {
                          return [];
                        }

                        return [
                          {
                            subject: subject.subject,
                            topicTitle: topic.title,
                            sourceGroupLabel: group.label,
                            sourceLabel: group.label,
                            sourceUri: item.url,
                            sourceType: item.sourceType,
                            gradeLabel: `${registry.grade}. évfolyam`,
                            contentHint: item.contentHint,
                            includePattern: item.includePattern,
                            excludePattern: item.excludePattern,
                          },
                        ];
                      });
                    })(),
              ),
        ),
  );
}
