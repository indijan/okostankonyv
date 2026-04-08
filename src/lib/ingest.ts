import type {
  Book,
  BookSourceType,
  ExtractedPage,
  IngestBookRequest,
  IngestBookResult,
  IngestChunkCandidate,
  IngestJob,
  Lesson,
  PageHeadingCandidate,
} from "@/lib/domain";
import { extractNkpLessonPages } from "@/lib/nkp-lesson";
import { extractPdfPages } from "@/lib/pdf";
import { readSourceDocument } from "@/lib/source-document";
import { AppError } from "@/lib/errors";

type LessonPlan = {
  order: number;
  title: string;
  chapter: string;
  goal: string;
  pageFrom: number;
  pageTo: number;
};

type ContentFilterOptions = {
  contentHint?: string | null;
  includePattern?: string | null;
  excludePattern?: string | null;
  sourceGroupLabel?: string;
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function createBook(request: IngestBookRequest): Book {
  const slug = slugify(`${request.subject}-${request.title}`);

  return {
    id: `book-${slug}`,
    title: request.title,
    subject: request.subject,
    grade: request.grade,
    sourceType: request.sourceType,
    sourceUri: request.sourceUri,
  };
}

function createQueuedJob(bookId: string): IngestJob {
  return {
    id: `ingest-${bookId}`,
    bookId,
    status: "queued",
    requestedAt: new Date().toISOString(),
    startedAt: null,
    finishedAt: null,
    errorMessage: null,
  };
}

function createLessonSkeletons(book: Book, lessonPlans: LessonPlan[]): Lesson[] {
  return lessonPlans.map((plan) => ({
    id: `${book.id}-lesson-${plan.order}`,
    bookId: book.id,
    title: plan.title,
    chapter: plan.chapter,
    goal: plan.goal,
    status: "ingest",
  }));
}

function createFallbackChunkCandidates(): IngestChunkCandidate[] {
  return [
    {
      lessonOrder: 1,
      pageFrom: 1,
      pageTo: 1,
      rawText: "A forras nem volt kinyerheto, fallback chunk keszult.",
      cleanedText: "A forras nem volt kinyerheto, fallback chunk keszult.",
    },
  ];
}

function splitPatternInput(value?: string | null) {
  return (value ?? "")
    .split(/\n|[;,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function createTextMatcher(pattern: string) {
  const regexMatch = pattern.match(/^\/(.+)\/([a-z]*)$/i);
  if (regexMatch) {
    try {
      const [, source, flags] = regexMatch;
      const finalFlags = flags.includes("i") ? flags : `${flags}i`;
      const regex = new RegExp(source, finalFlags);
      return (text: string) => regex.test(text);
    } catch {
      // fall back to plain substring match
    }
  }

  const normalizedNeedle = pattern.toLocaleLowerCase("hu-HU");
  return (text: string) => text.toLocaleLowerCase("hu-HU").includes(normalizedNeedle);
}

function filterParagraphsWithContext(paragraphs: string[], matches: boolean[]) {
  const kept = new Set<number>();

  matches.forEach((match, index) => {
    if (!match) {
      return;
    }

    kept.add(index);
    if (index > 0) {
      kept.add(index - 1);
    }
    if (index < paragraphs.length - 1) {
      kept.add(index + 1);
    }
  });

  return paragraphs.filter((_, index) => kept.has(index));
}

function applyContentFilters(
  pages: ExtractedPage[],
  options: ContentFilterOptions,
): ExtractedPage[] {
  const hintPatterns = splitPatternInput(options.contentHint);
  const includePatterns = splitPatternInput(options.includePattern);
  const excludePatterns = splitPatternInput(options.excludePattern);
  const hintMatchers = hintPatterns.map(createTextMatcher);
  const includeMatchers = includePatterns.map(createTextMatcher);
  const excludeMatchers = excludePatterns.map(createTextMatcher);

  if (hintMatchers.length === 0 && includeMatchers.length === 0 && excludeMatchers.length === 0) {
    return pages;
  }

  const filteredPages = pages
    .map((page) => {
      const paragraphs = page.text
        .split(/\n{2,}/)
        .map((item) => item.trim())
        .filter(Boolean);

      if (paragraphs.length === 0) {
        return null;
      }

      const withoutExcluded = paragraphs.filter(
        (paragraph) => !excludeMatchers.some((matcher) => matcher(paragraph)),
      );

      if (withoutExcluded.length === 0) {
        return null;
      }

      if (includeMatchers.length === 0) {
        if (hintMatchers.length === 0) {
          return {
            pageNumber: page.pageNumber,
            text: withoutExcluded.join("\n\n"),
          } satisfies ExtractedPage;
        }

        const hintMatches = withoutExcluded.map((paragraph) =>
          hintMatchers.some((matcher) => matcher(paragraph)),
        );
        const hintKeptParagraphs = filterParagraphsWithContext(withoutExcluded, hintMatches);

        return {
          pageNumber: page.pageNumber,
          text:
            hintKeptParagraphs.length > 0
              ? hintKeptParagraphs.join("\n\n")
              : withoutExcluded.join("\n\n"),
        } satisfies ExtractedPage;
      }

      const matches = withoutExcluded.map((paragraph) =>
        includeMatchers.some((matcher) => matcher(paragraph)),
      );
      const keptParagraphs = filterParagraphsWithContext(withoutExcluded, matches);

      if (keptParagraphs.length === 0) {
        return null;
      }

      return {
        pageNumber: page.pageNumber,
        text: keptParagraphs.join("\n\n"),
      } satisfies ExtractedPage;
    })
    .filter((page): page is ExtractedPage => page !== null && page.text.trim().length > 0);

  if (filteredPages.length === 0) {
    throw new AppError(
      "INGEST_FILTER_EMPTY",
      `Az ingest szures utan nem maradt feldolgozhato tartalom${options.sourceGroupLabel ? ` ennél: ${options.sourceGroupLabel}` : ""}.`,
    );
  }

  return filteredPages;
}

function pickHeadingCandidate(text: string) {
  const lines = text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 12);

  const bannedExactPatterns = [
    /^(k[eé]rd[eé]sek,\s*feladatok|munkaf[uü]zeti\s+feladatok|form[aá]zott\s+sz[oö]veg|kifut[oó]\s+c[ií]msor\s+szekci[oó]|eszk[oö]z[oö]k,\s*t[aá]rgyak)$/i,
    /^feladatok,\s*k[eé]rd[eé]sek$/i,
    /^kapcsol[oó]d[oó]\s+szekci[oó]$/i,
    /^defin[ií]ci[oó]\s+szekci[oó](?:\s+v[eé]ge)?$/i,
    /^vers\s+szekci[oó](?:\s+v[eé]ge)?$/i,
    /^\(.+\)$/,
    /k[oö]nyvkiad[oó]/i,
    /\b\d{4}\b/,
  ];

  const bannedPatterns = [
    /szekci[oó]\s+v[eé]ge$/i,
    /^[„"].+[”"]$/u,
    /^kapcsol[oó]d[oó]\b/i,
    /^(k[eé]rdi|k[eé]rdezi|mondja|mond[oó]gatta|mond[aá]|biztatta|megsz[oó]lalt|megsz[oó]l[ií]tja|j[oö]tt bizony|alig v[aá]rta|ott [üu]lt|ahogy ezt mond[aá]|hiszen csak|azt mondta|azt mond[aá]|amint|odamegy)\b/i,
    /^[A-ZÁÉÍÓÖŐÚÜŰ][a-záéíóöőúüű]+(?:\s+[A-ZÁÉÍÓÖŐÚÜŰ][a-záéíóöőúüű]+){0,2}$/u,
  ];

  const filteredLines = lines.filter(
    (line) =>
      !/^(sz[oö]veg|vend[eé]gsz[oö]veg|id[eé]zet|feladat|k[eé]p|vide[oó]|hang)\s+szekci[oó]$/i.test(line) &&
      !bannedExactPatterns.some((pattern) => pattern.test(line)) &&
      !bannedPatterns.some((pattern) => pattern.test(line)),
  );

  for (const line of filteredLines) {
    if (
      line.length >= 3 &&
      line.length <= 60 &&
      !/[.!?…:;]$/.test(line) &&
      /^[A-ZÁÉÍÓÖŐÚÜŰ]/.test(line) &&
      !/^[-–—]/.test(line) &&
      /\b(?:fa|mese|monda|rege|mitosz|mítosz|biblia|j[aá]nos|vit[eé]z|f[ií]a|le[aá]ny|kir[aá]ly|kond[aá]s|s[aá]rk[aá]ny)\b/i.test(
        line,
      )
    ) {
      return line.slice(0, 120);
    }
  }

  for (const line of filteredLines) {
    if (
      line.length >= 4 &&
      line.length <= 80 &&
      !/[.!?…:;,]$/.test(line) &&
      /^[A-ZÁÉÍÓÖŐÚÜŰ„"(\-]/.test(line) &&
      /\s/.test(line) &&
      !/^\d+$/.test(line)
    ) {
      return line.slice(0, 120);
    }
  }

  for (const line of filteredLines) {
    if (
      /^(lecke|fejezet|tema|t[eé]mak[oö]r)\b/i.test(line) ||
      /^\d+[./)]\s+[A-ZA-ZÁÉÍÓÖŐÚÜŰ]/.test(line) ||
      /^[IVXLC]+\.\s+[A-ZA-ZÁÉÍÓÖŐÚÜŰ]/.test(line)
    ) {
      return line.slice(0, 120);
    }
  }

  const fallback = filteredLines.find(
    (line) =>
      line.length > 8 &&
      line.length <= 80 &&
      !/[.!?…:;,]$/.test(line) &&
      !/^[a-záéíóöőúüű]/.test(line) &&
      !/^[("„]/.test(line),
  );
  return fallback ? fallback.slice(0, 120) : null;
}

function buildHeadingCandidates(pages: ExtractedPage[]): PageHeadingCandidate[] {
  return pages.map((page) => ({
    pageNumber: page.pageNumber,
    heading: pickHeadingCandidate(page.text),
    preview: page.text.slice(0, 240),
  }));
}

function buildLessonPlansFromPages(pages: ExtractedPage[]): LessonPlan[] {
  if (pages.length === 0) {
    return [
      {
        order: 1,
        title: "Lecke 1",
        chapter: "1. oldal",
        goal: "A rendszer fallback leckeegyseget hozott letre.",
        pageFrom: 1,
        pageTo: 1,
      },
    ];
  }

  const starts = [0];

  for (let index = 1; index < pages.length; index += 1) {
    const heading = pickHeadingCandidate(pages[index].text);
    const prevLength = pages[index - 1].text.length;

    if (heading && prevLength > 250) {
      starts.push(index);
    }
  }

  return starts.map((start, idx) => {
    const endExclusive = starts[idx + 1] ?? pages.length;
    const slice = pages.slice(start, endExclusive);
    const pageFrom = slice[0].pageNumber;
    const pageTo = slice[slice.length - 1].pageNumber;
    const heading = pickHeadingCandidate(slice[0].text) ?? `Lecke ${idx + 1}`;

    return {
      order: idx + 1,
      title: heading,
      chapter: `${pageFrom}-${pageTo}. oldal`,
      goal: `A rendszer a ${pageFrom}-${pageTo}. oldalak tartalmat egy leckeegyseggé csoportositotta.`,
      pageFrom,
      pageTo,
    };
  });
}

function createChunkCandidatesFromPages(
  pages: ExtractedPage[],
  lessonPlans: LessonPlan[],
): IngestChunkCandidate[] {
  const chunkSize = 2;
  const chunks: IngestChunkCandidate[] = [];

  for (const lessonPlan of lessonPlans) {
    const lessonPages = pages.filter(
      (page) =>
        page.pageNumber >= lessonPlan.pageFrom && page.pageNumber <= lessonPlan.pageTo,
    );

    for (let index = 0; index < lessonPages.length; index += chunkSize) {
      const slice = lessonPages.slice(index, index + chunkSize);
      const rawText = slice.map((page) => page.text).join("\n\n");
      const cleanedText = rawText.replace(/\s+/g, " ").trim();

      if (cleanedText.length === 0) {
        continue;
      }

      chunks.push({
        lessonOrder: lessonPlan.order,
        pageFrom: slice[0].pageNumber,
        pageTo: slice[slice.length - 1].pageNumber,
        rawText,
        cleanedText,
      });
    }
  }

  return chunks;
}

async function extractPages(
  sourceType: BookSourceType,
  sourceUri: string,
  maxPages?: number,
): Promise<ExtractedPage[]> {
  if (sourceType === "nkp_lesson_page") {
    const pages = await extractNkpLessonPages(sourceUri);
    return typeof maxPages === "number" ? pages.slice(0, maxPages) : pages;
  }

  const bytes = await readSourceDocument(sourceUri);
  return extractPdfPages(bytes, maxPages ? { maxPages } : undefined);
}

async function extractStructuredContentByType(
  sourceType: BookSourceType,
  sourceUri: string,
  filters: ContentFilterOptions = {},
): Promise<{
  lessonPlans: LessonPlan[];
  chunkCandidates: IngestChunkCandidate[];
}> {
  try {
    const pages = applyContentFilters(await extractPages(sourceType, sourceUri), filters);
    const lessonPlans = buildLessonPlansFromPages(pages);
    const chunks = createChunkCandidatesFromPages(pages, lessonPlans);

    if (chunks.length === 0) {
      return {
        lessonPlans: [
          {
            order: 1,
            title: "Lecke 1",
            chapter: "1. oldal",
            goal: "A rendszer fallback leckeegyseget hozott letre.",
            pageFrom: 1,
            pageTo: 1,
          },
        ],
        chunkCandidates: createFallbackChunkCandidates(),
      };
    }

    return { lessonPlans, chunkCandidates: chunks };
  } catch (error) {
    if (
      error instanceof Error &&
      (sourceUri.includes("nkp.hu") ||
        sourceUri.includes("nat2012.nkp.hu") ||
        sourceUri.startsWith("nkp://"))
    ) {
      throw error;
    }

    return {
      lessonPlans: [
        {
          order: 1,
          title: "Lecke 1",
          chapter: "1. oldal",
          goal: "A rendszer fallback leckeegyseget hozott letre.",
          pageFrom: 1,
          pageTo: 1,
        },
      ],
      chunkCandidates: createFallbackChunkCandidates(),
    };
  }
}

export async function inspectSourceStructure(sourceUri: string): Promise<{
  headings: PageHeadingCandidate[];
  lessonPlans: LessonPlan[];
}> {
  const sourceType: BookSourceType = /\.pdf(\?|#|$)/i.test(sourceUri)
    ? "nkp_pdf"
    : "nkp_lesson_page";
  const pages = await extractPages(sourceType, sourceUri, 12);

  return {
    headings: buildHeadingCandidates(pages),
    lessonPlans: buildLessonPlansFromPages(pages),
  };
}

export async function queueBookIngest(
  request: IngestBookRequest,
): Promise<IngestBookResult> {
  const book = createBook(request);
  const job = createQueuedJob(book.id);
  const { lessonPlans, chunkCandidates } = await extractStructuredContentByType(
    request.sourceType,
    request.sourceUri,
    {
      contentHint: request.contentHint,
      includePattern: request.includePattern,
      excludePattern: request.excludePattern,
      sourceGroupLabel: request.sourceGroupLabel,
    },
  );
  const lessons = createLessonSkeletons(book, lessonPlans);

  return {
    book,
    job,
    lessons,
    chunkCandidates,
  };
}
