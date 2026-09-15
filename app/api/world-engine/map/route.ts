import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { OPENAI_TEXT_MODEL } from "../../../../lib/ai/config";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://kqymkheiildnbqaksdlx.supabase.co";
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization");
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: authorization ? { Authorization: authorization } : {} } });
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body.worldId !== "string") return NextResponse.json({ error: "worldId requis." }, { status: 400 });
  const { data: world, error } = await supabase.from("worlds").select("id,name,theme,fiction_enabled,fictional_creatures_enabled,magic_enabled,visual_bible,world_memory").eq("id", body.worldId).single();
  if (error || !world) return NextResponse.json({ error: "Monde introuvable ou accès refusé." }, { status: 404 });
  const { data: regions } = await supabase.from("regions").select("id,name,biome,description,climate,resources,x,y,width,height").eq("world_id", world.id).order("created_at");
  const { data: civilizations } = await supabase.from("civilizations").select("id,name,culture,technology_level,description,region_id").eq("world_id", world.id).order("created_at");
  const base = { world: world.name, theme: world.theme, regions: regions ?? [], civilizations: civilizations ?? [], rules: { fiction: world.fiction_enabled, fictionalCreatures: world.fictional_creatures_enabled, magic: world.magic_enabled } };
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json(base);
  const response = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` }, body: JSON.stringify({ model: OPENAI_TEXT_MODEL, input: `Construis une spécification cartographique JSON cohérente pour Arthenis, monde "${world.name}". Thème: ${world.theme}. Conserve strictement les données existantes et n'invente pas de technologie moderne, de surnaturel non autorisé ou de géographie contradictoire. Fiction=${world.fiction_enabled}; créatures fictives=${world.fictional_creatures_enabled}; magie=${world.magic_enabled}. Retourne uniquement {"notes":["..."],"links":[{"from":"","to":"","relation":""}]}. Données: ${JSON.stringify(base)}`, max_output_tokens: 700 }) });
  if (!response.ok) return NextResponse.json(base);
  const result = await response.json().catch(() => null);
  if (typeof result?.output_text !== "string") return NextResponse.json(base);
  try { return NextResponse.json({ ...base, ai: JSON.parse(result.output_text) }); } catch { return NextResponse.json(base); }
}
