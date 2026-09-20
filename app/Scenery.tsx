/**
 * Scene vocabulary.
 *
 * The named scenes the rest of the app classifies entities into. The artwork
 * for each lives in `art.ts`; this file is only the shared list of names, kept
 * separate so the classifier and the art library cannot drift apart.
 */
export type SceneKind =
  | "ice" | "forest" | "desert" | "volcano" | "ocean"
  | "city" | "village" | "mountain" | "character" | "creature" | "relic";
