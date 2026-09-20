import { OPENAI_IMAGE_MODEL } from "./config";

/**
 * Image models to try, best first.
 *
 * Access to `gpt-image-1` is not granted to every account: some need a
 * verified organization, and older keys may not carry it at all. Falling back
 * to a DALL·E model means a key that cannot reach the newest engine still
 * produces images instead of an error the user cannot act on.
 */
export const IMAGE_MODEL_CANDIDATES: string[] =
  [...new Set([OPENAI_IMAGE_MODEL, "gpt-image-1", "dall-e-3"])];

const DALL_E_3_SIZES = new Set(["1024x1024", "1792x1024", "1024x1792"]);

/** Each engine takes a slightly different request; this is the whole difference. */
export function imageRequestBody(model: string, prompt: string, size: string): Record<string, unknown> {
  const body: Record<string, unknown> = { model, prompt, n: 1 };
  if (model.startsWith("dall-e")) {
    // These default to a URL that expires within the hour, which would leave
    // dead images in a world. Base64 keeps one code path for storage.
    body.response_format = "b64_json";
    body.size = DALL_E_3_SIZES.has(size) ? size : "1024x1024";
  } else {
    // gpt-image-1 always answers in base64 and rejects response_format.
    body.size = size;
  }
  return body;
}

/** True when the failure is "this key cannot use this model", not "this key is broken". */
export function isModelAccessFailure(status: number, body: string): boolean {
  const h = body.toLowerCase();
  if (status === 404) return true;
  return h.includes("model_not_found")
    || h.includes("does not exist")
    || h.includes("do not have access")
    || h.includes("must be verified")
    || h.includes("unsupported_value")
    || h.includes("unknown parameter");
}
