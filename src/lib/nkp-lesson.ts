import { AppError } from "@/lib/errors";
import { fetchWithTimeout } from "@/lib/fetch";
import type { ExtractedPage } from "@/lib/domain";

const NKP_API_BASE = "https://www.nkp.hu/api/";

type NkpBookStructureLesson = {
  lesson_id: number;
  lesson_uri_segment: string;
  lesson_name?: string | null;
  chapter_name?: string | null;
};

type NkpBookStructureChapter = {
  chapter_name?: string | null;
  lessons?: NkpBookStructureLesson[];
};

type NkpBookStructureResponse = {
  id: number;
  name?: string | null;
  uri_segment: string;
  lessons?: NkpBookStructureLesson[];
  chapters?: NkpBookStructureChapter[];
};

type NkpSection = {
  id: number;
  name?: string | null;
  html?: string | null;
  blockTemplateName?: string | null;
};

type NkpLessonContentResponse = {
  renderedSections?: NkpSection[];
};

function isGenericSectionTitle(value: string) {
  return /^(sz[oö]veg|vend[eé]gsz[oö]veg|id[eé]zet|feladat|k[eé]p|vide[oó]|hang|defin[ií]ci[oó]|vers)\s+szekci[oó]$|^form[aá]zott\s+sz[oö]veg$|^kifut[oó]\s+c[ií]msor\s+szekci[oó]$|^k[eé]rd[eé]sek,\s*feladatok$|^feladatok,\s*k[eé]rd[eé]sek$|^munkaf[uü]zeti\s+feladatok$|^eszk[oö]z[oö]k,\s*t[aá]rgyak$|^kapcsol[oó]d[oó]\s+szekci[oó]$/i.test(
    value.trim(),
  );
}

function isSkippableSectionTitle(value: string) {
  return /^(form[aá]zott\s+sz[oö]veg(?:\s+szekci[oó])?|kifut[oó]\s+c[ií]msor(?:\s+szekci[oó])?|k[eé]rd[eé]sek,\s*feladatok(?:\s+szekci[oó])?|feladatok,\s*k[eé]rd[eé]sek(?:\s+szekci[oó])?|munkaf[uü]zeti\s+feladatok|eszk[oö]z[oö]k,\s*t[aá]rgyak|tov[aá]bbi\s+okosfeladatok|kapcsol[oó]d[oó]\s+szekci[oó]|defin[ií]ci[oó]\s+szekci[oó]|vers\s+szekci[oó])$/i.test(
    value.trim(),
  );
}

function isSkippableParagraph(value: string) {
  const line = value.trim();

  if (!line) {
    return true;
  }

  return [
    /szekci[oó]\s+v[eé]ge$/i,
    /^(kapcsol[oó]d[oó]\s+szekci[oó]|form[aá]zott\s+sz[oö]veg(?:\s+szekci[oó])?|kifut[oó]\s+c[ií]msor(?:\s+szekci[oó])?|defin[ií]ci[oó]\s+szekci[oó](?:\s+v[eé]ge)?|vers\s+szekci[oó](?:\s+v[eé]ge)?|k[eé]rd[eé]sek,\s*feladatok(?:\s+szekci[oó])?|feladatok,\s*k[eé]rd[eé]sek(?:\s+szekci[oó])?|munkaf[uü]zeti\s+feladatok|eszk[oö]z[oö]k,\s*t[aá]rgyak|tov[aá]bbi\s+okosfeladatok)$/i,
    /^\(.{1,160}\)$/,
    /^(oldd meg|gondold v[eé]gig|besz[eé]lj[eé]tek meg|dolgozzatok|gy[uű]jtsd|figyeld meg|keresd meg|v[aá]laszolj|nevezd meg|p[aá]ros[ií]tsd|rajzold le|eg[eé]sz[ií]tsd ki)\b/i,
    /^tud[aá]sod ellen[oő]rz[eé]se$/i,
    /^kulcsszavak$/i,
  ].some((pattern) => pattern.test(line));
}

function cleanSectionText(text: string) {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => !isSkippableParagraph(paragraph))
    .join("\n\n")
    .trim();
}

function decodeHtml(value: string) {
  return value
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("\u00a0", " ");
}

function stripHtml(html: string) {
  return decodeHtml(
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
      .replace(/\s(?:aria-label|alt|title)="([^"]+)"/gi, " $1 ")
      .replace(/\s(?:aria-label|alt|title)='([^']+)'/gi, " $1 ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/text>/gi, "\n")
      .replace(/<\/(p|div|section|article|li|h1|h2|h3|h4|h5|h6|figcaption)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/\r/g, "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim(),
  );
}

function splitIntoPseudoPages(text: string): ExtractedPage[] {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  if (paragraphs.length === 0) {
    return [{ pageNumber: 1, text }];
  }

  const pages: ExtractedPage[] = [];
  let current = "";
  let pageNumber = 1;

  for (const paragraph of paragraphs) {
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;

    if (candidate.length > 1800 && current.length > 0) {
      pages.push({ pageNumber, text: current });
      pageNumber += 1;
      current = paragraph;
      continue;
    }

    current = candidate;
  }

  if (current.length > 0) {
    pages.push({ pageNumber, text: current });
  }

  return pages;
}

function parseNkpLessonUrl(sourceUri: string) {
  let url: URL;

  try {
    url = new URL(sourceUri);
  } catch {
    throw new AppError(
      "NKP_LESSON_URL_INVALID",
      "Az NKP leckeoldal URL-je ervenytelen.",
    );
  }

  const parts = url.pathname.split("/").filter(Boolean);
  const tankonyvIndex = parts.indexOf("tankonyv");
  const bookUriSegment = parts[tankonyvIndex + 1];
  const lessonUriSegment = parts[tankonyvIndex + 2];

  if (!bookUriSegment || !lessonUriSegment) {
    throw new AppError(
      "NKP_LESSON_URL_UNSUPPORTED",
      "Az NKP lecke URL-bol nem sikerult kinyerni a konyv- vagy leckeazonositot.",
    );
  }

  return {
    bookUriSegment,
    lessonUriSegment,
  };
}

async function readJson<T>(path: string) {
  let response: Response;

  try {
    response = await fetchWithTimeout(`${NKP_API_BASE}${path}`);
  } catch {
    throw new AppError(
      "NKP_API_UNREACHABLE",
      "Az NKP tartalom API nem erheto el ebbol a kornyezetbol.",
    );
  }

  if (!response.ok) {
    throw new AppError(
      "NKP_API_HTTP_ERROR",
      `Az NKP tartalom API hibaval valaszolt (${response.status}).`,
    );
  }

  return (await response.json()) as T;
}

function collectLessons(structure: NkpBookStructureResponse): NkpBookStructureLesson[] {
  const chapterLessons = (structure.chapters ?? []).flatMap((chapter) =>
    (chapter.lessons ?? []).map((lesson) => ({
      ...lesson,
      chapter_name: lesson.chapter_name ?? chapter.chapter_name ?? null,
    })),
  );

  const directLessons = structure.lessons ?? [];

  return [...chapterLessons, ...directLessons];
}

function normalizeLessonText(sections: NkpSection[]) {
  const blocks = sections
    .map((section) => {
      const html = section.html?.trim();
      if (!html) {
        return "";
      }

      const text = stripHtml(html);
      if (text.length === 0) {
        return "";
      }
      const cleanedText = cleanSectionText(text);
      if (cleanedText.length === 0) {
        return "";
      }

      const sectionName = section.name?.trim() ?? "";
      const blockTemplateName = section.blockTemplateName?.trim() ?? "";
      const rawTitles = [sectionName, blockTemplateName].filter(Boolean);

      if (rawTitles.some((item) => isSkippableSectionTitle(item))) {
        return "";
      }

      const title = [sectionName, blockTemplateName]
        .filter(Boolean)
        .find((item) => !isGenericSectionTitle(item));

      return title ? `${title}\n\n${cleanedText}` : cleanedText;
    })
    .filter((item) => item.length > 0);

  return blocks.join("\n\n");
}

export async function extractNkpLessonPages(sourceUri: string): Promise<ExtractedPage[]> {
  const { bookUriSegment, lessonUriSegment } = parseNkpLessonUrl(sourceUri);

  const structure = await readJson<NkpBookStructureResponse>(
    `get_book_structure?book_uri_segment=${encodeURIComponent(bookUriSegment)}`,
  );
  const lessons = collectLessons(structure);
  const lesson = lessons.find((item) => item.lesson_uri_segment === lessonUriSegment);

  if (!lesson) {
    throw new AppError(
      "NKP_LESSON_NOT_FOUND",
      "Az NKP konyvstruktura alapjan nem talaltam meg a keresett lecket.",
    );
  }

  const content = await readJson<NkpLessonContentResponse>(
    `get_book_lesson_content?id=${lesson.lesson_id}&published=true`,
  );
  const text = normalizeLessonText(content.renderedSections ?? []);
  const lessonHeader = [lesson.chapter_name?.trim(), lesson.lesson_name?.trim()]
    .filter((item) => Boolean(item) && !isGenericSectionTitle(item!))
    .join("\n");
  const normalizedText = lessonHeader ? `${lessonHeader}\n\n${text}` : text;

  if (normalizedText.length === 0) {
    throw new AppError(
      "NKP_LESSON_EMPTY",
      "Az NKP lecke tartalmabol nem sikerult tananyag-szoveget kinyerni.",
    );
  }

  return splitIntoPseudoPages(normalizedText);
}
