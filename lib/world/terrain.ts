import type { Biome, WorldVisualIdentity } from "./identity";

/**
 * Deterministic procedural terrain.
 *
 * Everything here is a pure function of the world seed and a coordinate, so the
 * map is identical after a reload, after zooming out and back, and on another
 * device. Nothing is stored and nothing is random. Higher zoom asks for more
 * noise octaves, which is what makes descending reveal finer ground instead of
 * enlarging the same shapes.
 *
 * This layer draws scenery only. It never invents a settlement, a people or a
 * history: that is the creator's canon, and it lives in the world's own data.
 */

/* ------------------------------------------------------------------ noise */

function hash2(ix: number, iy: number, seed: number): number {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(seed, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

const smooth = (t: number) => t * t * (3 - 2 * t);

function valueNoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = smooth(x - ix), fy = smooth(y - iy);
  const a = hash2(ix, iy, seed), b = hash2(ix + 1, iy, seed);
  const c = hash2(ix, iy + 1, seed), d = hash2(ix + 1, iy + 1, seed);
  return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
}

/** Fractal noise. `octaves` grows with zoom, which is where the extra detail comes from. */
export function fbm(x: number, y: number, seed: number, octaves: number): number {
  let sum = 0, amp = 0.5, freq = 1, norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += valueNoise(x * freq, y * freq, seed + o * 7919) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

/** Ridged noise, for mountain chains that read as chains rather than blobs. */
function ridge(x: number, y: number, seed: number, octaves: number): number {
  let sum = 0, amp = 0.5, freq = 1, norm = 0;
  for (let o = 0; o < octaves; o++) {
    const n = 1 - Math.abs(valueNoise(x * freq, y * freq, seed + o * 3571) * 2 - 1);
    sum += n * n * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

/* -------------------------------------------------------------- sampling */

export type TerrainSample = {
  height: number;    // 0 abyss … 1 peak
  moisture: number;  // 0 arid … 1 saturated
  biome: Biome;
  river: boolean;
};

/** World coordinates are percentages, matching how entities store x and y. */
export function sampleTerrain(id: WorldVisualIdentity, x: number, y: number, octaves = 5): TerrainSample {
  const s = id.seed;
  const u = x / 100, v = y / 100;

  // A continental mask keeps ocean at the edges so the land reads as a landmass.
  const dx = u - 0.5, dy = v - 0.5;
  const radial = 1 - Math.min(1, Math.hypot(dx * 1.15, dy) * 2);
  const coast = fbm(u * 2.6 + 11, v * 2.6 + 7, s, Math.min(4, octaves)) - 0.5;
  const mask = radial * (0.62 + id.landmass * 0.6) + coast * 0.78;

  const base = fbm(u * 3.4, v * 3.4, s + 101, octaves);
  const chains = ridge(u * 2.2 + 3, v * 2.2 + 5, s + 227, Math.min(6, octaves + 1));
  let height = mask * 0.62 + base * 0.26 + chains * id.ruggedness * 0.44 - 0.16;
  height = Math.max(0, Math.min(1, height));

  // Moisture falls with altitude and rises near the sea, plus a slow band pattern.
  const damp = fbm(u * 2.1 + 41, v * 2.1 + 29, s + 613, Math.min(4, octaves));
  let moisture = damp * 0.72 + (1 - height) * 0.34 + id.moistureBias;
  moisture = Math.max(0, Math.min(1, moisture));

  // Rivers follow the thin valleys of a second ridged field, only on land.
  const flow = ridge(u * 5.1 + 71, v * 5.1 + 17, s + 977, Math.min(5, octaves));
  const river = height > 0.34 && height < 0.78 && flow > 0.965 - id.moistureBias * 0.05;

  return { height, moisture, biome: biomeFor(id, height, moisture, v), river };
}

export function biomeFor(id: WorldVisualIdentity, height: number, moisture: number, v: number): Biome {
  if (height < 0.26) return "ocean";
  if (height < 0.32) return "shallow";
  if (height < 0.35) return "beach";

  // Latitude bands: poles are colder. Volcanic worlds burn their high ground.
  const polar = Math.abs(v - 0.5) * 2;
  const cold = id.climate === "arctique" ? 0.35 : 0;
  const chill = polar * 0.45 + height * 0.55 + cold;

  if (id.climate === "volcanique" && height > 0.74) return "volcanic";
  if (chill > 0.92) return "snow";
  if (chill > 0.78) return height > 0.7 ? "mountain" : "tundra";
  if (height > 0.72) return "mountain";
  if (height > 0.58) return "hills";
  if (moisture < 0.26) return id.climate === "arctique" ? "tundra" : "desert";
  if (moisture > 0.82 && height < 0.44) return "swamp";
  if (moisture > 0.62) return "deepforest";
  if (moisture > 0.44) return "forest";
  if (moisture > 0.34) return "plain";
  return "steppe";
}

/* -------------------------------------------------------------- features */

export type FeatureKind = "tree" | "conifer" | "palm" | "rock" | "boulder" | "reed" | "cactus" | "dune" | "peak" | "iceblock";
export type Feature = { x: number; y: number; kind: FeatureKind; scale: number; tone: number };

const BIOME_FEATURES: Record<Biome, { kinds: FeatureKind[]; density: number }> = {
  ocean: { kinds: [], density: 0 },
  shallow: { kinds: [], density: 0 },
  beach: { kinds: ["rock"], density: 0.5 },
  plain: { kinds: ["tree", "rock"], density: 1.1 },
  steppe: { kinds: ["rock", "tree"], density: 0.7 },
  forest: { kinds: ["tree", "conifer"], density: 2.6 },
  deepforest: { kinds: ["conifer", "tree"], density: 3.4 },
  hills: { kinds: ["tree", "rock", "boulder"], density: 1.3 },
  mountain: { kinds: ["peak", "boulder", "rock"], density: 1.5 },
  snow: { kinds: ["iceblock", "peak"], density: 1.1 },
  desert: { kinds: ["dune", "cactus", "rock"], density: 0.8 },
  swamp: { kinds: ["reed", "tree"], density: 2 },
  volcanic: { kinds: ["boulder", "rock"], density: 1.2 },
  tundra: { kinds: ["rock", "conifer"], density: 0.7 }
};

/**
 * Scenery for one cell of the world, at a density the current zoom can show.
 *
 * Keyed by cell index and cell size, so the same patch of ground always grows
 * the same trees, and descending subdivides into new ones rather than scaling
 * up the old ones.
 */
export function featuresForCell(id: WorldVisualIdentity, cx: number, cy: number, cell: number, octaves: number): Feature[] {
  const mid = sampleTerrain(id, (cx + 0.5) * cell, (cy + 0.5) * cell, octaves);
  const spec = BIOME_FEATURES[mid.biome];
  if (!spec.kinds.length) return [];

  const out: Feature[] = [];
  const want = Math.round(spec.density * 6);
  for (let k = 0; k < want; k++) {
    const r1 = hash2(cx * 131 + k, cy * 977, id.seed + 31);
    const r2 = hash2(cx * 613, cy * 409 + k, id.seed + 53);
    const r3 = hash2(cx * 7 + k, cy * 11 + k, id.seed + 97);
    const x = (cx + r1) * cell, y = (cy + r2) * cell;
    const here = sampleTerrain(id, x, y, Math.min(octaves, 4));
    if (here.biome !== mid.biome || here.river) continue;
    const kinds = spec.kinds;
    let kind = kinds[Math.floor(r3 * kinds.length) % kinds.length];
    // A peak belongs on a summit, not anywhere the biome happens to be rock.
    if (kind === "peak" && here.height < 0.79) kind = "boulder";
    out.push({ x, y, kind, scale: 0.5 + r1 * 0.95, tone: r2 });
  }
  return out;
}
