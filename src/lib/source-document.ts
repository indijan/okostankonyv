import { readFile } from "node:fs/promises";

import { AppError } from "@/lib/errors";
import { fetchWithTimeout } from "@/lib/fetch";
import { isDirectNkpPdfUrl, isNkpSource, resolveNkpPdfUrl } from "@/lib/nkp";

const debug = process.env.DEBUG === "1";

function isHttpUrl(value: string) {
  return value.startsWith("http://") || value.startsWith("https://");
}

function resolveFilePath(sourceUri: string) {
  if (sourceUri.startsWith("file://")) {
    return new URL(sourceUri);
  }

  return sourceUri;
}

export async function readSourceDocument(sourceUri: string): Promise<Uint8Array> {
  if (isNkpSource(sourceUri) && !isDirectNkpPdfUrl(sourceUri)) {
    if (debug) {
      console.error("[source] resolving NKP source");
    }
    const pdfUrl = await resolveNkpPdfUrl(sourceUri);

    if (debug) {
      console.error(`[source] resolved pdf=${pdfUrl}`);
    }
    return readSourceDocument(pdfUrl);
  }

  if (isHttpUrl(sourceUri)) {
    if (debug) {
      console.error("[source] fetching remote document");
    }
    let response: Response;

    try {
      response = await fetchWithTimeout(sourceUri);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(
        "SOURCE_FETCH_UNREACHABLE",
        "A PDF forras nem erheto el ebbol a kornyezetbol.",
      );
    }

    if (!response.ok) {
      throw new AppError(
        "SOURCE_FETCH_HTTP_ERROR",
        `A PDF letoltese sikertelen (${response.status}).`,
      );
    }

    if (debug) {
      console.error("[source] reading remote arrayBuffer");
    }
    const arrayBuffer = await response.arrayBuffer();

    if (debug) {
      console.error(`[source] bytes=${arrayBuffer.byteLength}`);
    }

    return new Uint8Array(arrayBuffer);
  }

  let file: Uint8Array;

  try {
    if (debug) {
      console.error("[source] reading local file");
    }
    file = new Uint8Array(await readFile(resolveFilePath(sourceUri)));
  } catch {
    throw new AppError(
      "SOURCE_FILE_READ_ERROR",
      "A helyi PDF fajl nem olvashato.",
    );
  }

  if (debug) {
    console.error(`[source] local bytes=${file.byteLength}`);
  }
  return file;
}
