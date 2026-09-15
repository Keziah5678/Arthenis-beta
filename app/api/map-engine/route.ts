import { NextResponse } from "next/server";

const OPENAI_URL = "https://api.openai.com/v1/responses";

type Body = {
  world: { name: string; theme: string; fictionEnabled: boolean; fictionalCreaturesEnabled: boolean; magicEnabled: boolean };
  request?: string;
};

function fallback(world: Body["world"], request = "") {
  const seed = `${world.name}:${world.theme}:${request}`.length;
  return {
    title: `${world.name} — carte du monde`,
    description: `Carte cohérente avec le thème ${world.theme}.`,
    regions: [
      { name: "Hautes-Terres", biome: "mountain", description: "Relief élevé et vallées naturelles.", x: 18, y: 20, resources: ["pierre", "bois"] },
      { name: "Plaines centrales", biome: "grassland", description: "Plaine fertile traversée par des cours d’eau.", x: 48, y: 44, resources: ["céréales", "eau"] },
      { name: "Frontière sauvage", biome: world.theme.toLowerCase().includes("glace") ? "ice" : "forest", description: "Zone périphérique à explorer.", x: 76, y: 70, resources: ["ressources locales"] }
    ].map((r, i) => ({ ...r, x: Math.max(8, Math.min(92, r.x + ((seed + i) % 5 - 2))), y: Math.max(8, Math.min(92, r.y + ((seed + i * 3) % 5 - 2))) }))
  };
}

export async function POST(request: Request) {
  let body: Body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "JSON invalide." }, { status: 400 }); }
  if (!body?.world?.name || !body.world.theme) return NextResponse.json({ error: "Contexte du monde incomplet." }, { status: 400 });

  const fallbackMap = fallback(body.world, body.request);
  const key = process.env.OPENAI_API_KEY;
  if (!key) return NextResponse.json(fallbackMap);

  try {
    const prompt = `Tu es le cartographe d'Arthenis. Génère une spécification de carte cohérente pour ce monde. Monde: ${JSON.stringify(body.world)}. Demande: ${body.request || "aucune"}. Retourne UNIQUEMENT JSON avec title, description et regions. Chaque region doit avoir name, biome, description, x, y, resources. Respecte strictement l'époque, le thème, les options de fiction/créatures/magie et n'invente aucun élément moderne incompatible.`;
    const upstream = await fetch(OPENAI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: "gpt-5.6-luna", input: prompt })
    });
    if (!upstream.ok) return NextResponse.json(fallbackMap);
    const data = await upstream.json();
    const text = data.output_text || data.output?.flatMap((o: any) => o.content || []).map((c: any) => c.text || "").join("") || "";
    const cleaned = text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
    const parsed = JSON.parse(cleaned);
    if (!parsed?.title || !Array.isArray(parsed.regions)) return NextResponse.json(fallbackMap);
    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json(fallbackMap);
  }
}
