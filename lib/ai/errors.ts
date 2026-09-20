import { OPENAI_IMAGE_MODEL } from "./config";

/**
 * Turns an OpenAI error response into a sentence the end user can act on.
 *
 * OpenAI error bodies never echo the API key, so relaying them is safe — and
 * without a reason the UI can only show a blank placeholder, which is what made
 * a misconfigured key indistinguishable from a working one.
 */
export function describeUpstreamFailure(status: number, body: string): string {
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
