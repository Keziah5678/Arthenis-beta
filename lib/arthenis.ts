export type CoherenceResult = {
  decision: "accept" | "modify" | "reject";
  reason: string;
  normalized?: Record<string, unknown>;
  consequences: string[];
};

export type WorldContext = {
  name: string;
  theme: string;
  fictionEnabled: boolean;
  fictionalCreaturesEnabled: boolean;
  magicEnabled: boolean;
  rules: Array<{ title: string; description: string; immutable?: boolean }>;
  memory?: Record<string, unknown>;
  visualBible?: Record<string, unknown>;
};

export const buildVisualPrompt = (context: WorldContext, entity: {
  type: string;
  name: string;
  description: string;
}) => ({
  subject: entity,
  world: {
    name: context.name,
    theme: context.theme,
    fictionEnabled: context.fictionEnabled,
    fictionalCreaturesEnabled: context.fictionalCreaturesEnabled,
    magicEnabled: context.magicEnabled,
    visualBible: context.visualBible ?? {}
  },
  rules: context.rules,
  instructions: [
    "Keep visual continuity with the world.",
    "Respect era, technology, geography and established magic rules.",
    "Do not introduce unauthorized modern, sci-fi or surreal elements.",
    "Create a premium cinematic environment concept illustration."
  ]
});
