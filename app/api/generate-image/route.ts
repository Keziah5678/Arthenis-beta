import { NextResponse } from "next/server";
import { buildVisualPrompt, type WorldContext } from "../../../lib/arthenis";
import { OPENAI_IMAGE_MODEL } from "../../../lib/ai/config";

// Image generation fails silently from the user's point of view (the UI falls
// back to placeholder art), which makes a misconfigured key indistinguishable
// from a working one. Turn the upstream failure into something actionable.
// OpenAI error bodies never contain the API key, so they are safe to relay.
function describeUpstreamFailure(status: number, body: string): string {
  let message = "";
  let code = "";
  try {
    const parsed = JSON.parse(body);
    message = String(parsed?.error?.message ?? "");
    code = String(parsed?.error?.code ?? parsed?.error?.type ?? "");
  } catch {
    message = body.slice(0, 200);
  }
  const haystack = `${code} ${message}`.toLowerCase();
  if (status === 401 || haystack.includes("invalid_api_key") || haystack.includes("incorrect api key")) {
    return "Clé OpenAI invalide ou révoquée (vérifie OPENAI_API_KEY dans Vercel).";
  }
  if (haystack.includes("insufficient_quota") || haystack.includes("billing") || haystack.includes("exceeded your current quota")) {
    return "Crédit OpenAI insuffisant : la génération d'images est facturée à l'usage, il faut recharger le compte.";
  }
  if (haystack.includes("model_not_found") || haystack.includes("does not exist") || haystack.includes("do not have access")) {
    return `Le modèle d'images « ${OPENAI_IMAGE_MODEL} » n'est pas accessible avec cette clé (change OPENAI_IMAGE_MODEL dans Vercel).`;
  }
  if (status === 429) return "Trop de requêtes vers OpenAI, réessaie dans un instant.";
  if (haystack.includes("must be verified") || haystack.includes("organization")) {
    return "Ce modèle exige une organisation OpenAI vérifiée.";
  }
  return `OpenAI a répondu ${status}${message ? ` : ${message.slice(0, 160)}` : ""}.`;
}

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
  if (!apiKey) return NextResponse.json({ error: "OPENAI_API_KEY is not configured.", detail: "Aucune clé OpenAI n'est configurée sur ce déploiement." }, { status: 503 });

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
      return NextResponse.json({ error: "Image generation failed.", detail: describeUpstreamFailure(response.status, errorText) }, { status: 502 });
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

    return NextResponse.json({ error: "Image generation returned no image.", detail: "OpenAI a répondu sans image." }, { status: 502 });
  } catch (error) {
    console.error("Arthenis image generation request failed:", error);
    return NextResponse.json({ error: "Image generation request failed.", detail: "Impossible de joindre OpenAI depuis le serveur." }, { status: 502 });
  }
}
