import { NextResponse } from "next/server";
import { OPENAI_TEXT_MODEL } from "../../../../lib/ai/config";

type Body = {
  world: { name: string; theme: string; fictionEnabled: boolean; fictionalCreaturesEnabled: boolean; magicEnabled: boolean };
  day: number;
};

function fallback(world: Body["world"], nextDay: number) {
  return {
    title: `Évolution du monde — Jour ${nextDay}`,
    description: `Le passage du temps transforme progressivement ${world.name}. Les territoires, sociétés et créatures continuent d'évoluer selon les règles établies.`,
    consequences: [`Le monde entre dans son jour ${nextDay}.`, "Les habitants s'adaptent aux derniers événements connus."]
  };
}

export async function POST(request: Request) {
  let body: Body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "JSON invalide." }, { status: 400 }); }
  if (!body?.world?.name || !body.world.theme || typeof body.day !== "number") return NextResponse.json({ error: "Contexte du monde incomplet." }, { status: 400 });

  const nextDay = Math.floor(body.day) + 1;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ day: nextDay, event: fallback(body.world, nextDay) });

  try {
    const prompt = `Tu es le moteur d'évolution d'Arthenis (mode démo). Génère un événement cohérent et sobre pour le jour ${nextDay} du monde "${body.world.name}". Thème: ${body.world.theme}. Fiction: ${body.world.fictionEnabled}. Créatures fictives: ${body.world.fictionalCreaturesEnabled}. Magie: ${body.world.magicEnabled}. Ne crée aucune technologie moderne ou élément surréaliste non autorisé. Réponds uniquement en JSON: {"title":"...","description":"...","consequences":["...","..."]}.`;
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: OPENAI_TEXT_MODEL, input: prompt, max_output_tokens: 500 })
    });
    if (!response.ok) return NextResponse.json({ day: nextDay, event: fallback(body.world, nextDay) });
    const data = await response.json().catch(() => null);
    const text = data?.output_text;
    if (typeof text !== "string") return NextResponse.json({ day: nextDay, event: fallback(body.world, nextDay) });
    const cleaned = text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
    const generated = JSON.parse(cleaned);
    if (typeof generated?.title !== "string" || typeof generated?.description !== "string" || !Array.isArray(generated?.consequences)) {
      return NextResponse.json({ day: nextDay, event: fallback(body.world, nextDay) });
    }
    return NextResponse.json({
      day: nextDay,
      event: {
        title: generated.title.trim().slice(0, 180),
        description: generated.description.trim().slice(0, 1200),
        consequences: generated.consequences.filter((c: unknown): c is string => typeof c === "string" && c.trim().length > 0).map((c: string) => c.trim().slice(0, 500)).slice(0, 6)
      }
    });
  } catch {
    return NextResponse.json({ day: nextDay, event: fallback(body.world, nextDay) });
  }
}
