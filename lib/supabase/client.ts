import { createClient } from "@supabase/supabase-js";

// Vercel environment variables take priority. These public fallback values
// keep the production site connected to the Arthenis Supabase project even
// before Vercel environment-variable management is configured.
const url =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "https://kqymkheiildnbqaksdlx.supabase.co";

const key =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "sb_publishable_6jgratCw-tM4JmmJbc4d1g_CZ1wyjKL";

export const supabase = createClient(url, key);
export const supabaseConfigured = Boolean(url && key);

export function getSupabaseConfigurationError() {
  return supabaseConfigured
    ? null
    : "Supabase is not configured.";
}
