import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://kqymkheiildnbqaksdlx.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

function clientFor(request: Request) {
  const authorization = request.headers.get("authorization");
  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: authorization ? { Authorization: authorization } : {} },
  });
}

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function requireUser(supabase: ReturnType<typeof clientFor>) {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Authentification requise.");
  return data.user;
}

export async function POST(request: Request) {
  const supabase = clientFor(request);
  try {
    const user = await requireUser(supabase);
    const body = await request.json().catch(() => null);
    if (!body || typeof body.worldId !== "string" || typeof body.action !== "string") return jsonError("Requête invalide.");

    const worldId = body.worldId;
    const action = body.action;

    if (action === "advance") {
      const { data: world, error: worldError } = await supabase.from("worlds").select("id,name,theme,world_memory,fiction_enabled,fictional_creatures_enabled,magic_enabled").eq("id", worldId).single();
      if (worldError || !world) return jsonError("Monde introuvable ou accès refusé.", 404);

      const previousDay = Number((world.world_memory as Record<string, unknown> | null)?.day ?? 1);
      const nextDay = previousDay + 1;
      const { count: regionCount } = await supabase.from("regions").select("id", { count: "exact", head: true }).eq("world_id", worldId);
      const { count: civilizationCount } = await supabase.from("civilizations").select("id", { count: "exact", head: true }).eq("world_id", worldId);
      const { count: creatureCount } = await supabase.from("creatures").select("id", { count: "exact", head: true }).eq("world_id", worldId);

      let title = `Évolution du monde — Jour ${nextDay}`;
      let description = `Le passage du temps transforme progressivement ${world.name}. Les territoires, sociétés et créatures continuent d'évoluer selon les règles établies.`;
      let consequences: unknown[] = [
        `Le monde entre dans son jour ${nextDay}.`,
        `${regionCount ?? 0} région(s), ${civilizationCount ?? 0} civilisation(s) et ${creatureCount ?? 0} créature(s) sont actuellement enregistrées.`,
      ];

      const apiKey = process.env.OPENAI_API_KEY;
      if (apiKey) {
        const prompt = `Tu es le moteur d'évolution d'Arthenis. Génère un événement cohérent et sobre pour le jour ${nextDay} du monde "${world.name}". Thème: ${world.theme}. Fiction: ${world.fiction_enabled}. Créatures fictives: ${world.fictional_creatures_enabled}. Magie: ${world.magic_enabled}. Ne crée aucune technologie moderne ou élément surréaliste non autorisé. Réponds uniquement en JSON: {"title":"...","description":"...","consequences":["...","..."]}.`;
        const response = await fetch("https://api.openai.com/v1/responses", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({ model: "gpt-5.6-luna", input: prompt, max_output_tokens: 500 }),
        });
        if (response.ok) {
          const upstream = await response.json().catch(() => null);
          const text = upstream?.output_text;
          if (typeof text === "string") {
            try {
              const generated = JSON.parse(text);
              if (typeof generated?.title === "string" && typeof generated?.description === "string" && Array.isArray(generated?.consequences)) {
                title = generated.title.slice(0, 180);
                description = generated.description.slice(0, 1200);
                consequences = generated.consequences.filter((item: unknown): item is string => typeof item === "string").slice(0, 6);
              }
            } catch {
              // Keep deterministic fallback event when the model does not return strict JSON.
            }
          }
        }
      }

      const { data: event, error: eventError } = await supabase.from("timeline_events").insert({ world_id: worldId, title, description, world_day: nextDay, consequences }).select().single();
      if (eventError) return jsonError("Impossible d'enregistrer l'évolution du monde.", 500);
      const { error: updateError } = await supabase.from("worlds").update({ world_memory: { ...(world.world_memory ?? {}), day: nextDay } }).eq("id", worldId);
      if (updateError) return jsonError("L'événement a été créé, mais le jour n'a pas pu être sauvegardé.", 500);
      return NextResponse.json({ day: nextDay, event });
    }

    if (action === "member-upsert") {
      if (typeof body.userId !== "string") return jsonError("userId requis.");
      const role = ["admin", "creator", "contributor", "viewer"].includes(body.role) ? body.role : "viewer";
      const permissions = body.permissions && typeof body.permissions === "object" ? body.permissions : {};
      const { data, error } = await supabase.from("world_members").upsert({ world_id: worldId, user_id: body.userId, role, permissions }, { onConflict: "world_id,user_id" }).select().single();
      if (error) return jsonError("Impossible de modifier l'autorisation du membre.", 403);
      return NextResponse.json({ member: data });
    }

    if (action === "member-remove") {
      if (typeof body.userId !== "string") return jsonError("userId requis.");
      const { error } = await supabase.from("world_members").delete().eq("world_id", worldId).eq("user_id", body.userId);
      if (error) return jsonError("Impossible de retirer ce membre.", 403);
      return NextResponse.json({ ok: true });
    }

    if (action === "rule-update") {
      if (typeof body.ruleId !== "string" || typeof body.title !== "string" || typeof body.description !== "string") return jsonError("Données de règle invalides.");
      const { data: existing } = await supabase.from("world_rules").select("immutable").eq("id", body.ruleId).eq("world_id", worldId).single();
      if (!existing) return jsonError("Règle introuvable.", 404);
      if (existing.immutable) return jsonError("Cette loi fondamentale est immuable.", 403);
      const { data, error } = await supabase.from("world_rules").update({ title: body.title.trim().slice(0, 160), description: body.description.trim().slice(0, 1200) }).eq("id", body.ruleId).eq("world_id", worldId).select().single();
      if (error) return jsonError("Impossible de modifier cette règle.", 403);
      return NextResponse.json({ rule: data });
    }

    if (action === "proposal") {
      const type = typeof body.type === "string" ? body.type : "unknown";
      const payload = body.payload && typeof body.payload === "object" ? body.payload : {};
      const coherenceResult = body.coherenceResult && typeof body.coherenceResult === "object" ? body.coherenceResult : {};
      const coherenceStatus = body.coherenceStatus === "rejected" ? "rejected" : "accepted";
      const { data, error } = await supabase.from("creation_proposals").insert({ world_id: worldId, author_id: user.id, type, payload, coherence_status: coherenceStatus, coherence_result: coherenceResult }).select().single();
      if (error) return jsonError("Impossible d'enregistrer la proposition.", 403);
      return NextResponse.json({ proposal: data });
    }

    return jsonError("Action inconnue.");
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Erreur interne.", 401);
  }
}
