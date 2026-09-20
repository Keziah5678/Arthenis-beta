/**
 * World Visual Identity.
 *
 * Every world gets one, derived once from what the creator declared and then
 * persisted. Each generation, placeholder and terrain draw reads from it, which
 * is what stops a cold medieval world from suddenly producing neon towers or a
 * tropical canopy. It is data, not prose, so the terrain renderer and the image
 * prompt builder cannot drift apart.
 */

export type Era =
  | "préhistorique" | "antique" | "médiéval" | "renaissance"
  | "industriel" | "moderne" | "futur proche" | "futur lointain";

export type Climate = "arctique" | "tempéré" | "aride" | "tropical" | "volcanique" | "océanique";

export type Biome =
  | "ocean" | "shallow" | "beach" | "plain" | "steppe" | "forest" | "deepforest"
  | "hills" | "mountain" | "snow" | "desert" | "swamp" | "volcanic" | "tundra";

export type Palette = {
  ocean: string; shallow: string; beach: string; plain: string; steppe: string;
  forest: string; deepforest: string; hills: string; mountain: string; snow: string;
  desert: string; swamp: string; volcanic: string; tundra: string;
  river: string; road: string; haze: string;
};

export type WorldVisualIdentity = {
  version: number;
  seed: number;
  era: Era;
  climate: Climate;
  techLevel: number;          // 0 stone age … 10 far future
  magic: boolean;
  fantasyCreatures: boolean;
  fiction: boolean;
  palette: Palette;
  architecture: string;
  materials: string;
  vegetation: string;
  relief: string;
  atmosphere: string;
  light: string;
  artStyle: string;
  /** Terrain shape controls, so two worlds do not look like the same map. */
  landmass: number;           // 0.2 archipelago … 0.8 supercontinent
  ruggedness: number;         // 0.2 flat … 0.9 alpine
  moistureBias: number;       // -0.3 arid … 0.3 lush
  forbidden: string[];
};

export const IDENTITY_VERSION = 3;

/** Stable 32-bit hash. The same world always derives the same identity. */
export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function pickEra(text: string): Era {
  if (/préhist|prehist|néolith|neolith|tribal|âge de pierre/.test(text)) return "préhistorique";
  if (/antiqu|romain|grec|égypt|egypt|mésopot|mesopot/.test(text)) return "antique";
  if (/renaissance|baroque|mousquet/.test(text)) return "renaissance";
  if (/industriel|steampunk|vapeur|victorien|xixe/.test(text)) return "industriel";
  if (/futur lointain|galacti|interstell|space opera|vaisseau/.test(text)) return "futur lointain";
  if (/futur|cyber|science|sci-fi|néon|neon|dystop/.test(text)) return "futur proche";
  if (/moderne|contemporain|urbain|xxie/.test(text)) return "moderne";
  return "médiéval";
}

function pickClimate(text: string): Climate {
  if (/arctique|glac|givre|neige|toundra|polaire|froid/.test(text)) return "arctique";
  if (/désert|desert|sable|dune|aride|canyon/.test(text)) return "aride";
  if (/tropic|jungle|moiteur|équator|equator/.test(text)) return "tropical";
  if (/volcan|cendre|lave|magma|infernal/.test(text)) return "volcanique";
  if (/océan|ocean|archipel|île|ile|maritime|mer /.test(text)) return "océanique";
  return "tempéré";
}

const TECH_BY_ERA: Record<Era, number> = {
  "préhistorique": 0, "antique": 2, "médiéval": 3, "renaissance": 4,
  "industriel": 6, "moderne": 7, "futur proche": 8, "futur lointain": 10
};

/** Natural terrain colours. Arthenis purple belongs to the interface, not the ground. */
function paletteFor(climate: Climate, era: Era): Palette {
  const base: Palette = {
    ocean: "#173f63", shallow: "#2f77a6", beach: "#d8c9a0", plain: "#7b9455",
    steppe: "#9aa063", forest: "#3f6b42", deepforest: "#2c4f33", hills: "#7d8455",
    mountain: "#7c7a74", snow: "#e8eef2", desert: "#cfa869", swamp: "#4d5b3f",
    volcanic: "#4a3a38", tundra: "#9fa9a2", river: "#3f8ec0", road: "#b9a276",
    haze: "#0b0716"
  };
  if (climate === "arctique") Object.assign(base, {
    ocean: "#123049", shallow: "#3a7fa4", beach: "#cfd8dd", plain: "#8f9c8a",
    steppe: "#9aa79b", forest: "#33543f", deepforest: "#25412f", hills: "#8b9490",
    mountain: "#8c9095", snow: "#f1f6f9", tundra: "#b6c0bb", swamp: "#4a5a56"
  });
  if (climate === "aride") Object.assign(base, {
    ocean: "#1c4a63", shallow: "#3d8aa8", beach: "#e3d2a4", plain: "#b3a262",
    steppe: "#c0ad68", forest: "#5c7346", deepforest: "#445837",
    hills: "#b09660", mountain: "#94825f", desert: "#d9b271", snow: "#e6e2d4"
  });
  if (climate === "tropical") Object.assign(base, {
    ocean: "#0f5470", shallow: "#25a0b0", beach: "#e6dbb0", plain: "#6dad54",
    forest: "#2f7a45", deepforest: "#1d5730", hills: "#5f8b48",
    swamp: "#3f5e3a", mountain: "#6f7b66"
  });
  if (climate === "volcanique") Object.assign(base, {
    ocean: "#1b2f45", shallow: "#356a86", beach: "#8d7f74", plain: "#6b6250",
    steppe: "#7a6d55", forest: "#42513b", deepforest: "#2f3b2c", hills: "#6a5f52",
    mountain: "#584f4b", volcanic: "#6b3a2e", snow: "#ddd6d2", desert: "#9c7f5f"
  });
  if (climate === "océanique") Object.assign(base, {
    ocean: "#154663", shallow: "#2f8fb5", beach: "#dfd0a6", plain: "#6f9158",
    forest: "#3a6a46", deepforest: "#274d33", hills: "#6f8257", mountain: "#76807b"
  });
  if (era === "futur proche" || era === "futur lointain") base.road = "#8fa9c4";
  if (era === "industriel") base.haze = "#120d18";
  return base;
}

const ARCHITECTURE: Record<Era, string> = {
  "préhistorique": "abris de pierre et de peaux, huttes basses, cercles de menhirs",
  "antique": "colonnes de pierre taillée, toits de tuiles, murs de terrasse",
  "médiéval": "pierre appareillée, charpentes de bois, toits d'ardoise, remparts crénelés",
  "renaissance": "pierre ouvragée, fenêtres à meneaux, dômes et coupoles",
  "industriel": "brique rouge, fer forgé, verrières, cheminées d'usine",
  "moderne": "béton, acier, verre, immeubles orthogonaux",
  "futur proche": "structures composites, façades lumineuses, lignes tendues",
  "futur lointain": "alliages clairs, formes organiques, architectures suspendues"
};

const MATERIALS: Record<Era, string> = {
  "préhistorique": "pierre brute, bois, os, peaux, fibres tressées",
  "antique": "marbre, terre cuite, bronze, bois",
  "médiéval": "pierre, bois, fer forgé, chaume, cuir, laine",
  "renaissance": "pierre taillée, plâtre, cuivre, verre soufflé",
  "industriel": "acier, brique, charbon, verre, fonte",
  "moderne": "béton, aluminium, verre, plastique",
  "futur proche": "composites, polymères, alliages légers",
  "futur lointain": "métamatériaux, céramiques, alliages inconnus"
};

const VEGETATION: Record<Climate, string> = {
  "arctique": "conifères rabougris, lichens, mousses, herbe rase",
  "tempéré": "forêts de feuillus et de conifères, prairies, haies",
  "aride": "buissons épineux, herbes sèches, palmiers d'oasis",
  "tropical": "canopée dense, fougères géantes, lianes",
  "volcanique": "végétation clairsemée sur roche noire, fumerolles",
  "océanique": "landes, pins maritimes, herbes hautes"
};

const ATMOSPHERE: Record<Climate, string> = {
  "arctique": "air froid et limpide, brume basse, souffle de neige",
  "tempéré": "ciel changeant, nuages épars, brume matinale",
  "aride": "air chaud et tremblant, poussière en suspension",
  "tropical": "air lourd et humide, vapeur au ras du sol",
  "volcanique": "ciel chargé de cendre, lueurs rouges au loin",
  "océanique": "embruns, vent constant, ciel vaste"
};

const LIGHT: Record<Climate, string> = {
  "arctique": "lumière rasante et bleutée, ombres longues",
  "tempéré": "lumière dorée de fin d'après-midi",
  "aride": "soleil haut et dur, contrastes marqués",
  "tropical": "lumière filtrée par la canopée, taches vives",
  "volcanique": "contre-jour sombre percé de braise",
  "océanique": "lumière diffuse et argentée"
};

/** Things the world's own rules put out of bounds, stated so a generator can obey them. */
export function forbiddenFor(id: Pick<WorldVisualIdentity, "era" | "magic" | "fantasyCreatures" | "fiction" | "techLevel">): string[] {
  const out: string[] = [];
  if (!id.fiction) out.push("tout élément fictif, surnaturel ou imaginaire");
  if (!id.fantasyCreatures) out.push("dragon, troll, ogre, géant, licorne, gobelin, monstre fantastique");
  if (!id.magic) out.push("magie visible, sortilège, aura lumineuse, rune brillante, effet arcanique");
  if (id.techLevel <= 4) out.push("voiture, électricité, arme à feu moderne, béton, verre industriel, plastique, néon, gratte-ciel");
  else if (id.techLevel <= 6) out.push("informatique, néon, gratte-ciel de verre, vaisseau spatial");
  if (id.techLevel < 8) out.push("vaisseau spatial, laser, hologramme, robot");
  return out;
}

export function deriveVisualIdentity(world: {
  id: string; name: string; theme: string; description?: string | null;
  magic_enabled: boolean; fiction_enabled: boolean; fictional_creatures_enabled: boolean;
}, rules: Array<{ title: string; description: string }> = []): WorldVisualIdentity {
  const text = [world.theme, world.name, world.description || "", ...rules.map(r => `${r.title} ${r.description}`)]
    .join(" ").toLowerCase();
  const era = pickEra(text);
  const climate = pickClimate(text);
  const seed = hashString(world.id || world.name);
  const techLevel = TECH_BY_ERA[era];

  // Shape knobs come from the seed so two worlds of the same theme still differ.
  const r = (n: number) => ((seed >>> n) % 1000) / 1000;

  const core = {
    era, climate, techLevel,
    magic: world.magic_enabled,
    fantasyCreatures: world.fictional_creatures_enabled,
    fiction: world.fiction_enabled
  };

  return {
    version: IDENTITY_VERSION,
    seed,
    ...core,
    palette: paletteFor(climate, era),
    architecture: ARCHITECTURE[era],
    materials: MATERIALS[era],
    vegetation: VEGETATION[climate],
    relief: climate === "arctique" || /montagne|pic|sommet|alpin/.test(text)
      ? "relief montagneux, vallées encaissées"
      : climate === "aride" ? "plateaux, canyons, mers de dunes"
      : climate === "océanique" ? "côtes découpées, falaises, îles"
      : "collines, plaines et massifs isolés",
    atmosphere: ATMOSPHERE[climate],
    light: LIGHT[climate],
    artStyle: "peinture numérique de concept art, rendu cinématique, texture picturale",
    landmass: climate === "océanique" ? 0.34 + r(3) * 0.18 : 0.52 + r(3) * 0.26,
    ruggedness: climate === "arctique" ? 0.58 + r(7) * 0.3
      : climate === "aride" ? 0.3 + r(7) * 0.25
      : 0.38 + r(7) * 0.34,
    moistureBias: climate === "aride" ? -0.26 : climate === "tropical" ? 0.24
      : climate === "arctique" ? -0.06 : r(11) * 0.16 - 0.06,
    forbidden: forbiddenFor(core)
  };
}

/** Reads a stored identity, rebuilding it when it is missing or from an older version. */
export function resolveIdentity(
  world: Parameters<typeof deriveVisualIdentity>[0] & { visual_bible?: Record<string, unknown> | null },
  rules: Array<{ title: string; description: string }> = []
): WorldVisualIdentity {
  const stored = world.visual_bible?.identity as WorldVisualIdentity | undefined;
  if (stored && stored.version === IDENTITY_VERSION && stored.palette) return stored;
  return deriveVisualIdentity(world, rules);
}
