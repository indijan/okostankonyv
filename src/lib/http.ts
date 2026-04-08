export async function readJsonResponse<T>(
  response: Response,
): Promise<T & { error?: string }> {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return (await response.json()) as T & { error?: string };
  }

  const text = await response.text();

  return {
    error: text || `HTTP ${response.status}`,
  } as T & { error?: string };
}

export function formatRequestError(
  error: unknown,
  fallback: string,
  context?: { status?: number; bodyError?: string },
) {
  if (context?.bodyError) {
    return context.status
      ? `${fallback} (${context.status}): ${context.bodyError}`
      : `${fallback}: ${context.bodyError}`;
  }

  if (error instanceof Error) {
    if (error.message === "Failed to fetch" || error.message === "Load failed") {
      return `${fallback}: a browser nem erte el az API-t vagy a tavoli forrast.`;
    }

    return `${fallback}: ${error.message}`;
  }

  return fallback;
}
