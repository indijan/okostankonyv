import OpenAI from "openai";

import { getOpenAiServerEnv, hasOpenAiServerEnv } from "@/lib/env";

export function createOpenAiServerClient() {
  const env = getOpenAiServerEnv();

  if (!env.apiKey) {
    throw new Error("Missing OPENAI_API_KEY.");
  }

  return new OpenAI({
    apiKey: env.apiKey,
  });
}

export function isOpenAiConfigured() {
  return hasOpenAiServerEnv();
}
