import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Never throw during Next.js build: Vercel can build before public runtime
// variables are configured. The application will expose a clear runtime error
// instead of failing the entire production build.
const fallbackUrl = "https://placeholder.supabase.co";
const fallbackKey = "placeholder-public-key";

export const supabase = createClient(url ?? fallbackUrl, key ?? fallbackKey);

export const supabaseConfigured = Boolean(url && key);

export function getSupabaseConfigurationError() {
  return supabaseConfigured
    ? null
    : "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and a public Supabase key in the deployment environment.";
}
