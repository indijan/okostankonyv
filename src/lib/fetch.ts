import { AppError } from "@/lib/errors";

const DEFAULT_TIMEOUT_MS = 12000;

export async function fetchWithTimeout(
  input: string | URL | Request,
  init?: RequestInit,
  timeoutMs = DEFAULT_TIMEOUT_MS,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new AppError(
        "REMOTE_FETCH_TIMEOUT",
        "A tavoli forras nem valaszolt idoben.",
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
