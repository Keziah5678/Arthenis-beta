import { NextResponse } from "next/server";
import { OPENAI_IMAGE_MODEL, OPENAI_TEXT_MODEL } from "../../../lib/ai/config";
import { describeUpstreamFailure } from "../../../lib/ai/errors";

// Which build is actually being served. Vercel pins every hash-suffixed URL to
// one deployment, so without this there is no way to tell from the outside
// whether a URL serves the latest commit or a weeks-old one.
function buildInfo() {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA || "";
  return {
    commit: sha ? sha.slice(0, 7) : "local",
    branch: process.env.VERCEL_GIT_COMMIT_REF || "local",
    environment: process.env.VERCEL_ENV || "development"
  };
}

/**
 * Verifies the key and the image model without generating anything. Retrieving
 * a model costs nothing, and it separates "bad key" and "no access to this
 * model" from "out of credit", which only shows up on a real generation.
 */
async function probeOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { ok: false, detail: "Aucune clé OpenAI n'est configurée sur ce déploiement." };
  }
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 15_000);
  try {
    const response = await fetch(`https://api.openai.com/v1/models/${encodeURIComponent(OPENAI_IMAGE_MODEL)}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: abort.signal
    });
    if (response.ok) {
      return { ok: true, detail: `Clé valide et modèle « ${OPENAI_IMAGE_MODEL} » accessible.` };
    }
    return { ok: false, detail: describeUpstreamFailure(response.status, await response.text()) };
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    return { ok: false, detail: aborted ? "OpenAI n'a pas répondu dans le délai imparti." : "Impossible de joindre OpenAI depuis le serveur." };
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(request: Request) {
  const deep = new URL(request.url).searchParams.get("deep") === "1";
  const base = {
    ok: true,
    service: "Arthenis",
    build: buildInfo(),
    models: { text: OPENAI_TEXT_MODEL, image: OPENAI_IMAGE_MODEL },
    features: {
      coherenceEngine: Boolean(process.env.OPENAI_API_KEY),
      imageGeneration: Boolean(process.env.OPENAI_API_KEY),
      supabase: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
    }
  };
  if (!deep) return NextResponse.json(base);
  return NextResponse.json({ ...base, openai: await probeOpenAI() });
}
