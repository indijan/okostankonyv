import { createClient } from "@supabase/supabase-js";

import { getSupabaseServerEnv, hasSupabaseServerEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";

export function createSupabaseServerClient() {
  const env = getSupabaseServerEnv();

  if (!env.url || !env.serviceRoleKey) {
    throw new Error("Missing Supabase server environment variables.");
  }

  return createClient<Database>(env.url, env.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function isSupabaseConfigured() {
  return hasSupabaseServerEnv();
}
