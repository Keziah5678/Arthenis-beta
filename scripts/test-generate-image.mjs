const baseUrl = process.env.ARTHENIS_URL;

if (!baseUrl) {
  console.error("Missing ARTHENIS_URL. Example: ARTHENIS_URL=https://your-domain.vercel.app");
  process.exit(2);
}

const url = new URL("/api/generate-image", baseUrl).toString();
const context = {
  name: "Test World",
  theme: "Medieval fantasy",
  fictionEnabled: true,
  fictionalCreaturesEnabled: true,
  magicEnabled: true,
  rules: [],
  memory: { day: 1 },
  visualBible: { palette: "dark neon purple" }
};

const validPayload = {
  context,
  entity: {
    type: "Région",
    name: "Test Valley",
    description: "A misty valley surrounded by ancient mountains."
  }
};

async function main() {
  const malformed = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{invalid-json"
  });
  if (malformed.status !== 400) throw new Error(`Malformed JSON expected 400, got ${malformed.status}`);

  const invalid = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({})
  });
  if (invalid.status !== 400) throw new Error(`Invalid payload expected 400, got ${invalid.status}`);

  const generated = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(validPayload)
  });
  const data = await generated.json().catch(() => ({}));

  if (generated.status === 503 && data.error === "OPENAI_API_KEY is not configured.") {
    console.log("VALIDATION_OK: endpoint is reachable; OpenAI key is not configured in this environment.");
    process.exit(0);
  }

  if (!generated.ok) throw new Error(`Generation request failed with ${generated.status}: ${JSON.stringify(data)}`);
  if (!data.imageData && !data.imageUrl) throw new Error("Generation succeeded without imageData or imageUrl.");

  console.log("GENERATION_OK: image generation returned an image payload.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
