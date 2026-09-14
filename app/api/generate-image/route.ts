import { NextResponse } from "next/server";
import { buildVisualPrompt, type WorldContext } from "@/lib/arthenis";

export async function POST(request: Request) {
  const body = await request.json();
  const context = body.context as WorldContext;
  const entity = body.entity as { type: string; name: string; description: string };

  if (!context || !entity?.name || !entity?.description) {
    return NextResponse.json({ error: "Invalid visual generation request." }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY is not configured." }, { status: 503 });
  }

  const visualSpec = buildVisualPrompt(context, entity);
  const imagePrompt = JSON.stringify(visualSpec);

  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + apiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-image-1",
      prompt: imagePrompt,
      size: "1024x1024"
    })
  });

  if (!response.ok) {
    return NextResponse.json({ error: "Image generation failed." }, { status: 502 });
  }

  const data = await response.json();
  const image = data.data?.[0];

  if (image?.b64_json) {
    return NextResponse.json({ imageData: "data:image/png;base64," + image.b64_json, visualSpec });
  }

  return NextResponse.json({ imageUrl: image?.url ?? null, visualSpec });
}
