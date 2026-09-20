import { NextResponse } from "next/server";
import type { WorldContext } from "../../../lib/arthenis";
import { OPENAI_IMAGE_MODEL } from "../../../lib/ai/config";
import { buildImagePrompt, type ImageEntity, type ImageOptions } from "../../../lib/ai/images";

const IMAGE_SIZE = process.env.OPENAI_IMAGE_SIZE || "1024x1024";
const REQUEST_TIMEOUT_MS = 90_000;

// Cost guard. Each generation is billed, and this route is reachable without a
// session (demo mode legitimately generates). This is a per-instance window, so
// on serverless it limits a burst from one caller rather than enforcing a hard
// global quota — real quota enforcement belongs in OpenAI's own usage limits.
const WINDOW_MS = 10 * 60_000;
const MAX_PER_WINDOW_ANON = 6;
const MAX_PER_WINDOW_AUTH = 24;
const hits = new Map<string, number[]>();

function rateLimit(key: string, max: number): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter(t => now - t < WINDOW_MS);
  if (recent.length >= max) {
    const retryAfter = Math.ceil((WINDOW_MS - (now - recent[0])) / 1000);
    hits.set(key, recent);
    return { ok: false, retryAfter };
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 500) for (const [k, v] of hits) if (!v.some(t => now - t < WINDOW_MS)) hits.delete(k);
  return { ok: true, retryAfter: 0 };
}

// OpenAI error bodies never echo the API key, so relaying them is safe — and
// without a reason the UI can only show a blank placeholder, which is what made
// a misconfigured key indistinguishable from a working one.
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
  if (haystack.includes("must be verified") || haystack.includes("organization")) {
    return "Ce modèle exige une organisation OpenAI vérifiée.";
  }
  if (haystack.includes("content_policy") || haystack.includes("safety")) {
    return "La demande a été refusée par le filtre de contenu d'OpenAI : reformule la description.";
  }
  if (status === 429) return "Trop de requêtes vers OpenAI, réessaie dans un instant.";
  return `OpenAI a répondu ${status}${message ? ` : ${message.slice(0, 160)}` : ""}.`;
}

export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body.", detail: "Requête illisible." }, { status: 400 });
  }

  const context = body.context as WorldContext;
  const entity = body.entity as ImageEntity;
  const options = (body.options ?? {}) as ImageOptions;
  const references = Array.isArray(body.references) ? (body.references as unknown[]).filter((r): r is string => typeof r === "string") : undefined;

  if (!context?.name || !entity?.name || !entity?.type) {
    return NextResponse.json({ error: "Invalid visual generation request.", detail: "Contexte du monde ou élément manquant." }, { status: 400 });
  }

  const authenticated = Boolean(request.headers.get("authorization"));
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonyme";
  const limit = rateLimit(`${ip}:${authenticated ? "auth" : "anon"}`, authenticated ? MAX_PER_WINDOW_AUTH : MAX_PER_WINDOW_ANON);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Rate limited.", detail: `Limite de générations atteinte. Réessaie dans ${Math.ceil(limit.retryAfter / 60)} minute(s).` },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  const { prompt, spec, category } = buildImagePrompt(context, entity, options, references);

  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY is not configured.", detail: "Aucune clé OpenAI n'est configurée sur ce déploiement." }, { status: 503 });
  }

  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: OPENAI_IMAGE_MODEL, prompt, size: IMAGE_SIZE, n: 1 }),
      signal: abort.signal
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Arthenis image generation error:", response.status, errorText);
      return NextResponse.json({ error: "Image generation failed.", detail: describeUpstreamFailure(response.status, errorText) }, { status: 502 });
    }

    const data = await response.json();
    const image = data.data?.[0];
    if (image?.b64_json) return NextResponse.json({ imageData: `data:image/png;base64,${image.b64_json}`, spec, category });
    if (image?.url) return NextResponse.json({ imageUrl: image.url, spec, category });
    return NextResponse.json({ error: "Image generation returned no image.", detail: "OpenAI a répondu sans image." }, { status: 502 });
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    console.error("Arthenis image generation request failed:", error);
    return NextResponse.json(
      { error: "Image generation request failed.", detail: aborted ? "La génération a dépassé le délai d'attente." : "Impossible de joindre OpenAI depuis le serveur." },
      { status: aborted ? 504 : 502 }
    );
  } finally {
    clearTimeout(timer);
  }
}
