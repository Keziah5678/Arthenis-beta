import { NextResponse } from "next/server";
import type { CoherenceResult, WorldContext } from "../../../lib/arthenis";

const reject = (reason: string): CoherenceResult => ({ decision: "reject", reason, consequences: [] });

function localCoherence(context: WorldContext, proposal: { type: string; name: string; description: string }): CoherenceResult | null {
  const text = `${proposal.name} ${proposal.description}`.toLowerCase();
  const worldText = `${context.theme} ${text}`.toLowerCase();
  const modern = /laser|pistolet|fusil d'assaut|smartphone|ordinateur|robot|cyborg|vaisseau spatial|internet|drone|sabre laser|technologie futuriste/.test(text);
  const surreal = /canapé volant|pizza magique qui parle|laser sur les yeux|téléportation interdimensionnelle/.test(text);
  const fictionalCreature = /dragon|troll|ogre|griffon|golem|phénix|kraken|géant|sirène/.test(text);
  const magic = /magie|magique|sortilège|enchantement|téléportation|boule de feu|nécromancie/.test(text);
  if (!context.fictionEnabled && (modern || surreal || fictionalCreature)) return reject("Cette proposition introduit un élément fictif ou technologique incompatible avec les règles actuelles du monde.");
  if (fictionalCreature && !context.fictionalCreaturesEnabled) return reject("Les créatures fictives sont désactivées dans ce monde.");
  if (!context.magicEnabled && magic) return reject("La magie est désactivée dans ce monde.");
  if (modern && /médiéval|medieval|antique|préhistoire|tribal/.test(worldText)) return reject("L'élément technologique ne correspond pas à l'époque et au thème établis du monde.");
  return null;
}

export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const context = body.context as WorldContext;
  const proposal = body.proposal as { type: string; name: string; description: string };
  if (!context || !proposal?.name || !proposal?.description) return NextResponse.json({ error: "Invalid world context or proposal." }, { status: 400 });

  const localDecision = localCoherence(context, proposal);
  if (localDecision) return NextResponse.json(localDecision);

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "OPENAI_API_KEY is not configured." }, { status: 503 });

  const prompt = `You are the Arthenis Coherence Engine. Validate a proposed addition against an existing world. Return ONLY valid JSON with keys decision (accept|modify|reject), reason (string), normalized (object optional), consequences (string array). Never invent rules absent from WORLD. Preserve theme, era, geography, technology, magic and creature constraints. If the proposal conflicts with a rule, reject it.\n\nWORLD:\n${JSON.stringify(context)}\n\nPROPOSAL:\n${JSON.stringify(proposal)}`;
  try {
    const response = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: "gpt-5.6-luna", input: prompt }) });
    if (!response.ok) return NextResponse.json({ error: "The coherence AI is temporarily unavailable." }, { status: 502 });
    const data = await response.json();
    const raw = String(data.output_text ?? "{}").replace(/^```json\s*/i, "").replace(/```\s*$/i, "");
    const result = JSON.parse(raw) as CoherenceResult;
    if (!["accept", "modify", "reject"].includes(result.decision) || typeof result.reason !== "string" || !Array.isArray(result.consequences)) throw new Error("Invalid coherence schema");
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "The coherence AI returned an invalid or unavailable response." }, { status: 502 });
  }
}
