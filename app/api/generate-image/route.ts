import { NextResponse } from "next/server";
import type { WorldContext } from "../../../lib/arthenis";
import { OPENAI_IMAGE_MODEL } from "../../../lib/ai/config";
import { buildImagePrompt, type ImageEntity, type ImageOptions } from "../../../lib/ai/images";
import { describeUpstreamFailure } from "../../../lib/ai/errors";
import { IMAGE_MODEL_CANDIDATES, imageRequestBody, isModelAccessFailure } from "../../../lib/ai/models";

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
    // Walk the candidate engines. A model-access refusal means try the next one;
    // anything else (bad key, no credit, content policy) applies to all of them,
    // so stop and report it rather than burning time on certain failures.
    let data: any = null;
    let usedModel = "";
    let lastStatus = 0;
    let lastBody = "";
    for (const model of IMAGE_MODEL_CANDIDATES) {
      const response = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(imageRequestBody(model, prompt, IMAGE_SIZE)),
        signal: abort.signal
      });
      if (response.ok) { data = await response.json(); usedModel = model; break; }
      lastStatus = response.status;
      lastBody = await response.text();
      console.error("Arthenis image generation error:", model, lastStatus, lastBody);
      if (!isModelAccessFailure(lastStatus, lastBody)) break;
    }

    if (!data) {
      return NextResponse.json(
        { error: "Image generation failed.", detail: describeUpstreamFailure(lastStatus, lastBody) },
        { status: 502 }
      );
    }

    const image = data.data?.[0];
    if (image?.b64_json) return NextResponse.json({ imageData: `data:image/png;base64,${image.b64_json}`, spec, category, model: usedModel });
    if (image?.url) return NextResponse.json({ imageUrl: image.url, spec, category, model: usedModel });
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
