import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import type { ExtractedPage } from "@/lib/domain";
import { AppError } from "@/lib/errors";

const execFileAsync = promisify(execFile);
const debug = process.env.DEBUG === "1";

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

async function getPdfPageCount(filePath: string) {
  try {
    const { stdout } = await execFileAsync("pdfinfo", [filePath], {
      maxBuffer: 1024 * 1024,
    });
    const match = stdout.match(/^Pages:\s+(\d+)/m);

    if (!match) {
      throw new Error("Missing page count");
    }

    return Number(match[1]);
  } catch {
    throw new AppError(
      "PDF_INFO_ERROR",
      "A PDF oldalszamanak kiolvasasa sikertelen.",
    );
  }
}

async function extractPageText(filePath: string, pageNumber: number) {
  try {
    const { stdout } = await execFileAsync(
      "pdftotext",
      [
        "-f",
        String(pageNumber),
        "-l",
        String(pageNumber),
        "-layout",
        filePath,
        "-",
      ],
      {
        maxBuffer: 32 * 1024 * 1024,
      },
    );

    return normalizeWhitespace(stdout);
  } catch {
    throw new AppError(
      "PDF_PARSE_ERROR",
      `A PDF ${pageNumber}. oldalanak feldolgozasa sikertelen.`,
    );
  }
}

async function extractStructuredPageText(filePath: string, pageNumber: number) {
  try {
    const { stdout } = await execFileAsync(
      "pdftotext",
      [
        "-f",
        String(pageNumber),
        "-l",
        String(pageNumber),
        "-layout",
        filePath,
        "-",
      ],
      {
        maxBuffer: 32 * 1024 * 1024,
      },
    );

    return stdout.replace(/\r/g, "");
  } catch {
    throw new AppError(
      "PDF_PARSE_ERROR",
      `A PDF ${pageNumber}. oldalanak strukturalt feldolgozasa sikertelen.`,
    );
  }
}

export async function extractPdfPages(
  bytes: Uint8Array,
  options?: { maxPages?: number },
): Promise<ExtractedPage[]> {
  const workdir = await mkdtemp(join(tmpdir(), "okostankonyv-pdf-"));
  const filePath = join(workdir, "source.pdf");

  try {
    if (debug) {
      console.error("[pdf] writing temp file");
    }

    await writeFile(filePath, bytes);
    const totalPages = await getPdfPageCount(filePath);
    const maxPages = options?.maxPages
      ? Math.min(options.maxPages, totalPages)
      : totalPages;

    if (debug) {
      console.error(`[pdf] totalPages=${totalPages} maxPages=${maxPages}`);
    }

    const pages: ExtractedPage[] = [];

    for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
      if (debug) {
        console.error(`[pdf] page ${pageNumber} start`);
      }

      const text = await extractPageText(filePath, pageNumber);

      if (text.length > 0) {
        pages.push({
          pageNumber,
          text,
        });
      }

      if (debug) {
        console.error(`[pdf] page ${pageNumber} done chars=${text.length}`);
      }
    }

    return pages;
  } finally {
    await rm(workdir, { recursive: true, force: true });
  }
}

export async function extractPdfPagesStructured(
  bytes: Uint8Array,
  options?: { maxPages?: number },
): Promise<ExtractedPage[]> {
  const workdir = await mkdtemp(join(tmpdir(), "okostankonyv-pdf-"));
  const filePath = join(workdir, "source.pdf");

  try {
    await writeFile(filePath, bytes);
    const totalPages = await getPdfPageCount(filePath);
    const maxPages = options?.maxPages
      ? Math.min(options.maxPages, totalPages)
      : totalPages;

    const pages: ExtractedPage[] = [];

    for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
      const text = await extractStructuredPageText(filePath, pageNumber);

      if (text.trim().length > 0) {
        pages.push({
          pageNumber,
          text,
        });
      }
    }

    return pages;
  } finally {
    await rm(workdir, { recursive: true, force: true });
  }
}
