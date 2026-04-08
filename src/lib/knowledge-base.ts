import type { ExtractedPage } from "@/lib/domain";

type KnowledgeSegment = {
  pageNumber: number;
  segmentType: "content" | "exercise" | "noise" | "source_note";
  rawText: string;
  cleanedText: string;
};

function normalizeLine(line: string) {
  return line.replace(/\s+/g, " ").trim();
}

function isPageNumberLine(line: string) {
  return /^\d{1,4}$/.test(line.trim());
}

function isSourceNoteLine(line: string) {
  return /^\d+\s*(Forrás:|forrás:|kelengye:|Megjegyzés:)/i.test(line.trim());
}

function isExerciseHeavy(text: string) {
  return /(Olvassátok|Olvasd el|Párosítsátok|Fogalmazzátok|Búvárkodjatok|Melyik mesetípusba|Feladatok|Kérdések)/i.test(
    text,
  );
}

function isMostlyNoise(text: string) {
  return text.trim().length < 20;
}

export function cleanPdfKnowledgePages(pages: ExtractedPage[]): KnowledgeSegment[] {
  const segments = pages.map<KnowledgeSegment | null>((page) => {
      const lines = page.text
        .split("\n")
        .map((line) => normalizeLine(line))
        .filter(Boolean)
        .filter((line) => !isPageNumberLine(line));

      if (lines.length === 0) {
        return null;
      }

      const sourceNotes = lines.filter((line) => isSourceNoteLine(line));
      const contentLines = lines.filter((line) => !isSourceNoteLine(line));
      const cleanedText = contentLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();

      if (!cleanedText) {
        return {
          pageNumber: page.pageNumber,
          segmentType: "noise" as const,
          rawText: lines.join("\n"),
          cleanedText: lines.join("\n"),
        };
      }

      return {
        pageNumber: page.pageNumber,
        segmentType: isMostlyNoise(cleanedText)
          ? ("noise" as const)
          : isExerciseHeavy(cleanedText)
            ? ("exercise" as const)
            : ("content" as const),
        rawText: lines.join("\n"),
        cleanedText: cleanedText + (sourceNotes.length > 0 ? `\n\n${sourceNotes.join("\n")}` : ""),
      };
    });

  return segments.filter((item): item is KnowledgeSegment => item !== null);
}
