import { NextResponse } from "next/server";
import { buildVisualPrompt, type WorldContext } from "../../../lib/arthenis";
import { OPENAI_IMAGE_MODEL } from "../../../lib/ai/config";

export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const context = body.context as WorldContext;
  const entity = body.entity as { type: string; name: string; description: string };

  if (!context || !entity?.name || !entity?.description) {
    return NextResponse.json({ error: "Invalid visual generation request." }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "OPENAI_API_KEY is not configured." }, { status: 503 });

  const visualSpec = buildVisualPrompt(context, entity);

  try {
    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: OPENAI_IMAGE_MODEL,
        prompt: JSON.stringify(visualSpec),
        size: "1024x1024"
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Arthenis image generation error:", response.status, errorText);
      return NextResponse.json({ error: "Image generation failed." }, { status: 502 });
    }

    const data = await response.json();
    const image = data.data?.[0];

    if (image?.b64_json) {
      return NextResponse.json({
        imageData: "data:image/png;base64," + image.b64_json,
        visualSpec
      });
    }

    if (image?.url) return NextResponse.json({ imageUrl: image.url, visualSpec });

    return NextResponse.json({ error: "Image generation returned no image." }, { status: 502 });
  } catch (error) {
    console.error("Arthenis image generation request failed:", error);
    return NextResponse.json({ error: "Image generation request failed." }, { status: 502 });
  }
}
