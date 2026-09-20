/**
 * Bundled painted artwork.
 *
 * Generated illustrations are the goal, but a world must look finished before
 * anyone has generated anything, and geometric placeholders read as unfinished.
 * These are real paintings, shipped with the app, keyed by the same scene names
 * the rest of the code already uses. A generated image always wins when one
 * exists; this is what fills the gap until then.
 */
export const ART: Record<string, string> = {
  hero: "/art/hero.jpg",
  cover: "/art/cover.jpg",
  map: "/art/map.jpg",
  character: "/art/portrait.jpg",
  creature: "/art/creature.jpg",
  city: "/art/city.jpg",
  volcano: "/art/volcano.jpg",
  forest: "/art/forest.jpg",
  mountain: "/art/mountain.jpg",
  ice: "/art/mountain.jpg",
  village: "/art/village.jpg",
  ocean: "/art/water.jpg",
  desert: "/art/cover.jpg",
  relic: "/art/volcano.jpg"
};

export const artFor = (kind: string): string => ART[kind] ?? ART.forest;

/**
 * A deterministic tint per entity.
 *
 * Two characters in the same world would otherwise fall back to the identical
 * painting, which reads as a bug. Shifting hue, exposure and warmth by name
 * makes them distinct without pretending to be different artwork, and a
 * generated image replaces this entirely once one exists.
 */
export function variantFilter(seed: string): string {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  const a = (h >>> 0) % 1000 / 1000;
  const b = (h >>> 10) % 1000 / 1000;
  const c = (h >>> 20) % 1000 / 1000;
  const hue = Math.round(-26 + a * 52);
  const bright = (0.9 + b * 0.22).toFixed(2);
  const sat = (0.92 + c * 0.28).toFixed(2);
  return `hue-rotate(${hue}deg) brightness(${bright}) saturate(${sat})`;
}
