// Central place for AI model configuration. Every OpenAI call in the app
// reads its model id from here instead of hardcoding it, so a model rename
// or upgrade is a single env var change (no redeploy of route logic needed).
//
// Defaults point at documented, generally available OpenAI models. Verify
// against your OpenAI account (this sandbox cannot reach api.openai.com to
// check for you) and override via OPENAI_TEXT_MODEL / OPENAI_IMAGE_MODEL if
// your account uses different model access.
export const OPENAI_TEXT_MODEL = process.env.OPENAI_TEXT_MODEL || "gpt-4o";
export const OPENAI_IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
