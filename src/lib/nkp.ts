import { AppError } from "@/lib/errors";
import { fetchWithTimeout } from "@/lib/fetch";

const NKP_PDF_HOST = "https://www.nkp.hu";

function decodeHtml(value: string) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("\\u002F", "/")
    .replaceAll("\\/", "/");
}

function normalizePdfUrl(value: string) {
  const decoded = decodeHtml(value);

  if (decoded.startsWith("http://") || decoded.startsWith("https://")) {
    return decoded;
  }

  if (decoded.startsWith("/")) {
    return `${NKP_PDF_HOST}${decoded}`;
  }

  return `${NKP_PDF_HOST}/${decoded.replace(/^\.?\//, "")}`;
}

function isPdfUrl(value: string) {
  return value.toLowerCase().includes(".pdf");
}

export function isNkpSource(value: string) {
  return (
    value.includes("nkp.hu") ||
    value.includes("nat2012.nkp.hu") ||
    value.startsWith("nkp://")
  );
}

export function isDirectNkpPdfUrl(value: string) {
  return isNkpSource(value) && isPdfUrl(value);
}

export async function resolveNkpPdfUrl(sourceUri: string): Promise<string> {
  if (sourceUri.startsWith("nkp://")) {
    throw new AppError(
      "NKP_URI_UNSUPPORTED",
      "Az nkp:// forma mar nem tamogatott. Adj meg teljes NKP oldalt vagy kozvetlen PDF URL-t.",
    );
  }

  if (isDirectNkpPdfUrl(sourceUri)) {
    return sourceUri;
  }

  let response: Response;

  try {
    response = await fetchWithTimeout(sourceUri);
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(
      "NKP_PAGE_UNREACHABLE",
      "Az NKP oldal nem erheto el ebbol a kornyezetbol.",
    );
  }

  if (!response.ok) {
    throw new AppError(
      "NKP_PAGE_HTTP_ERROR",
      `Az NKP oldal betoltese sikertelen (${response.status}).`,
    );
  }

  const html = await response.text();
  const matches = Array.from(
    html.matchAll(/(?:https?:\/\/[^"'\\\s>]+|\/api\/media\/relpath\/[^"'\\\s>]+?\.pdf)/gi),
  );

  const firstPdf = matches
    .map((match) => normalizePdfUrl(match[0]))
    .find((candidate) => isPdfUrl(candidate));

  if (!firstPdf) {
    throw new AppError(
      "NKP_PDF_NOT_FOUND",
      "Nem talaltam PDF linket az NKP oldalon.",
    );
  }

  return firstPdf;
}
