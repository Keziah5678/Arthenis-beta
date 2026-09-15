import { NextRequest, NextResponse } from "next/server";

const OPENAI_URL = "https://api.openai.com/v1/responses";

function fallbackMap(theme: string) {
  return {
    regions: [
      { name: "Terres du Nord", biome: "montagnes", description: `Région septentrionale cohérente avec le thème ${theme}.`, x: 18, y: 18, width: 28, height: 30 },
      { name: "Plaines Centrales", biome: "plaines", description: `Cœur habitable du monde ${theme}.`, x: 38, y: 34, width: 30, height: 28 },
      { name: "Frontière Sauvage", biome: "forêt", description: "Zone naturelle riche en ressources et en dangers.", x: 65, y: 18, width: 25, height: 36 },
      { name: "Rives du Sud", biome: "côtes", description: "Littoral méridional ouvert aux échanges.", x: 24, y: 65, width: 52, height: 22 }
    ],
    resources: ["bois", "pierre", "eau", "terres fertiles"],
    civilizations: []
  };
}

export async function POST(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "JSON invalide." }, { status: 400 }); }
  const context = body?.context;
  if (!context?.name || !context?.theme) return NextResponse.json({ error: "Contexte du monde incomplet." }, { status: 400 });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ map: fallbackMap(context.theme), generated: false });

  const rules = Array.isArray(context.rules) ? context.rules : [];
  const prompt = `Generate a coherent world map specification for the fictional world below. Return JSON only. Never introduce modern technology, sci-fi or surreal elements unless explicitly permitted. Respect theme, fiction, fictional creatures, magic and rules. Coordinates are percentages from 0 to 100. Create 4-8 distinct regions and optional civilizations. World: ${context.name}. Theme: ${context.theme}. Fiction: ${Boolean(context.fictionEnabled)}. Fictional creatures: ${Boolean(context.fictionalCreaturesEnabled)}. Magic: ${Boolean(context.magicEnabled)}. Rules: ${JSON.stringify(rules)}. Existing elements: ${JSON.stringify(context.items ?? [])}. Schema: {regions:[{name,biome,description,x,y,width,height}],resources:[string],civilizations:[{name,region,description}]}`;

  try {
    const upstream = await fetch(OPENAI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: "gpt-5.6-luna", input: prompt, text: { format: { type: "json_object" } } })
    });
    if (!upstream.ok) return NextResponse.json({ map: fallbackMap(context.theme), generated: false });
    const result = await upstream.json();
    const raw = result?.output?.flatMap((item: any) => item?.content ?? [])?.find((part: any) => part?.type === "output_text")?.text;
    if (!raw) return NextResponse.json({ map: fallbackMap(context.theme), generated: false });
    const map = JSON.parse(raw);
    if (!Array.isArray(map.regions) || map.regions.length < 1) throw new Error("invalid map");
    return NextResponse.json({ map, generated: true });
  } catch {
    return NextResponse.json({ map: fallbackMap(context.theme), generated: false });
  }
}
