function readEnv(name: string) {
  const value = process.env[name];

  if (!value || value.trim().length === 0) {
    return null;
  }

  return value;
}

export function getSupabaseServerEnv() {
  return {
    url: readEnv("NEXT_PUBLIC_SUPABASE_URL"),
    serviceRoleKey: readEnv("SUPABASE_SERVICE_ROLE_KEY"),
  };
}

export function getOpenAiServerEnv() {
  return {
    apiKey: readEnv("OPENAI_API_KEY"),
  };
}

export function getParentAdminEnv() {
  return {
    password: readEnv("PARENT_DASHBOARD_PASSWORD"),
  };
}

export function hasSupabaseServerEnv() {
  const env = getSupabaseServerEnv();

  return Boolean(env.url && env.serviceRoleKey);
}

export function hasOpenAiServerEnv() {
  const env = getOpenAiServerEnv();

  return Boolean(env.apiKey);
}

export function hasParentAdminPassword() {
  const env = getParentAdminEnv();

  return Boolean(env.password);
}
