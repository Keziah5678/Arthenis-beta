import { NextResponse } from "next/server";
import type { CoherenceResult, WorldContext } from "@/lib/arthenis";

export async function POST(request: Request) {
  const body = await request.json();
  const context = body.context as WorldContext;
  const proposal = body.proposal as { type: string; name: string; description: string };

  if (!context || !proposal?.name || !proposal?.description) {
    return NextResponse.json({ error: "Invalid world context or proposal." }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const fallback: CoherenceResult = {
      decision: "modify",
      reason: "OPENAI_API_KEY is not configured. Arthenis cannot perform final AI validation yet.",
      consequences: []
    };
    return NextResponse.json(fallback, { status: 503 });
  }

  const prompt = {
    role: "Arthenis Coherence Engine",
    task: "Validate a proposed addition against an existing fictional world. Return strict JSON only.",
    schema: {
      decision: "accept | modify | reject",
      reason: "short explanation",
      normalized: "optional corrected proposal",
      consequences: ["list of likely world consequences"]
    },
    world: context,
    proposal
  };

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + apiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-5-mini",
      input: JSON.stringify(prompt),
      text: { format: { type: "json_object" } }
    })
  });

  if (!response.ok) {
    return NextResponse.json({ error: "Coherence model request failed." }, { status: 502 });
  }

  const data = await response.json();
  const raw = data.output_text ?? "{}";
  return NextResponse.json(JSON.parse(raw));
}
