import { NextResponse } from "next/server";
import { OPENAI_TEXT_MODEL } from "../../../lib/ai/config";

type Body = {
  context: { name: string; theme: string; magicEnabled: boolean; fictionEnabled: boolean; fictionalCreaturesEnabled: boolean; day: number; rules: Array<{ title: string; description: string }>; stats: { regions: number; civilizations: number; characters: number; places: number } };
  message: string;
  history: Array<{ role: "user" | "assistant"; text: string }>;
};

function fallback(context: Body["context"], message: string) {
  const trimmed = message.trim();
  return `Je ne suis pas disponible pour te répondre en détail pour le moment, mais voici une piste : décris "${trimmed.slice(0, 80)}" dans l'onglet Créer de ${context.name} — le moteur de cohérence vérifiera si l'idée respecte les règles du monde avant de l'ajouter.`;
}

export async function POST(request: Request) {
  let body: Body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "JSON invalide." }, { status: 400 }); }
  if (!body?.context?.name || typeof body.message !== "string" || !body.message.trim()) return NextResponse.json({ error: "Message ou contexte manquant." }, { status: 400 });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ reply: fallback(body.context, body.message) });

  const { context } = body;
  const systemPrompt = `Tu es l'assistant créatif d'Arthenis pour le monde "${context.name}" (thème: ${context.theme}, jour ${context.day}). Règles: magie=${context.magicEnabled}, fiction=${context.fictionEnabled}, créatures fictives=${context.fictionalCreaturesEnabled}. Le monde compte ${context.stats.regions} régions, ${context.stats.civilizations} civilisations, ${context.stats.characters} personnages/créatures et ${context.stats.places} lieux. Lois fondamentales: ${context.rules.map(r => `${r.title}: ${r.description}`).join(" | ") || "aucune"}. Réponds en français, de façon concise (4 phrases maximum), reste rigoureusement cohérent avec ces règles, et quand c'est pertinent propose une idée concrète que l'utilisateur peut ajouter via l'onglet "Créer". Tu ne crées rien toi-même : tu conseilles et imagines.`;
  const conversation = [...(body.history || []).slice(-6), { role: "user" as const, text: body.message }].map(m => `${m.role === "user" ? "Utilisateur" : "Assistant"}: ${m.text}`).join("\n");

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: OPENAI_TEXT_MODEL, input: `${systemPrompt}\n\n${conversation}\n\nAssistant:`, max_output_tokens: 300 })
    });
    if (!response.ok) return NextResponse.json({ reply: fallback(context, body.message) });
    const data = await response.json().catch(() => null);
    const text = data?.output_text;
    if (typeof text !== "string" || !text.trim()) return NextResponse.json({ reply: fallback(context, body.message) });
    return NextResponse.json({ reply: text.trim().slice(0, 1200) });
  } catch {
    return NextResponse.json({ reply: fallback(context, body.message) });
  }
}
