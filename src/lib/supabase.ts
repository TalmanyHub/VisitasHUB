import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export function isSupabaseConfigured(): boolean {
  return Boolean(url?.trim() && anonKey?.trim());
}

/** Host de VITE_SUPABASE_URL (ex.: abc.supabase.co) — para diagnóstico de qual projeto está em uso. */
export function getSupabaseHost(): string {
  if (!url?.trim()) return "(VITE_SUPABASE_URL não definida)";
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env");
  }
  if (!client) {
    client = createClient(url!, anonKey!);
  }
  return client;
}
