import type { WorldVisualIdentity } from "../lib/world/identity";
import { hashString } from "../lib/world/identity";

/**
 * World-coherent placeholder art.
 *
 * Shown wherever an entity has no generated illustration yet. It is drawn from
 * the world's own visual identity, so it can never be out of context: a cold
 * medieval world gets cold medieval scenery, and a world without magic gets no
 * glow. Everything derives from the entity id, so the same character always
 * gets the same placeholder and two characters never get the same one.
 *
 * This is scenery and silhouette only. It states nothing about the world that
 * the creator has not written.
 */

export type PlaceholderSubject = { id: string; kind: string; name: string; description: string };

function rng(seed: number) {
  let h = seed >>> 0;
  return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; h >>>= 0; return h / 4294967295; };
}

function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
    .map(v => Math.max(0, Math.min(255, Math.round(v * k))));
  return `#${c.map(v => v.toString(16).padStart(2, "0")).join("")}`;
}

/** Which terrain the subject reads as, from its own words then the world's climate. */
function terrainFor(id: WorldVisualIdentity, s: PlaceholderSubject): "mountain" | "forest" | "desert" | "coast" | "plain" | "volcanic" | "snow" {
  const t = (s.name + " " + s.description).toLowerCase();
  if (/glace|neige|givre|gel|arctique|polaire/.test(t)) return "snow";
  if (/montagne|pic|sommet|massif|falaise|grotte|mine/.test(t)) return "mountain";
  if (/forêt|foret|bois|sylve|jungle|arbre/.test(t)) return "forest";
  if (/désert|desert|sable|dune|oasis/.test(t)) return "desert";
  if (/mer|océan|ocean|port|côte|cote|rivage|île|ile|pêche|peche|baie/.test(t)) return "coast";
  if (/volcan|lave|magma|cendre|braise/.test(t)) return "volcanic";
  if (id.climate === "arctique") return "snow";
  if (id.climate === "aride") return "desert";
  if (id.climate === "volcanique") return "volcanic";
  if (id.climate === "océanique") return "coast";
  return "plain";
}

/** Rooflines follow the world's era. A medieval world never gets a flat glass block. */
function roof(x: number, y: number, w: number, h: number, id: WorldVisualIdentity, fill: string, dark: string): string {
  const t = id.techLevel;
  if (t >= 8) return `<rect x="${x}" y="${y - h}" width="${w}" height="${h}" rx="${w * 0.18}" fill="${fill}"/><rect x="${x + w * 0.55}" y="${y - h}" width="${w * 0.45}" height="${h}" rx="${w * 0.14}" fill="${dark}"/>`;
  if (t >= 6) return `<rect x="${x}" y="${y - h}" width="${w}" height="${h}" fill="${fill}"/><rect x="${x + w * 0.6}" y="${y - h}" width="${w * 0.4}" height="${h}" fill="${dark}"/>`;
  if (t <= 1) return `<path d="M${x - w * 0.1} ${y} L${x + w / 2} ${y - h} L${x + w * 1.1} ${y} Z" fill="${fill}"/>`;
  return `<rect x="${x}" y="${y - h * 0.6}" width="${w}" height="${h * 0.6}" fill="${fill}"/>`
    + `<path d="M${x - w * 0.16} ${y - h * 0.6} L${x + w / 2} ${y - h} L${x + w * 1.16} ${y - h * 0.6} Z" fill="${dark}"/>`;
}

function skyFor(id: WorldVisualIdentity, terrain: string): [string, string] {
  const p = id.palette;
  if (terrain === "volcanic") return ["#2a1922", "#a0563a"];
  if (terrain === "snow") return [shade(p.shallow, 0.7), shade(p.snow, 0.98)];
  if (terrain === "desert") return [shade(p.desert, 0.85), shade(p.beach, 1.12)];
  if (terrain === "coast") return [shade(p.shallow, 0.72), shade(p.beach, 1.08)];
  if (id.climate === "tropical") return [shade(p.shallow, 0.8), shade(p.plain, 1.25)];
  return [shade(p.shallow, 0.66), shade(p.beach, 1.05)];
}

/** Ground colour for a terrain, taken from the world's palette so nothing clashes. */
function groundFor(id: WorldVisualIdentity, terrain: string): [string, string, string] {
  const p = id.palette;
  switch (terrain) {
    case "snow": return [p.snow, shade(p.snow, 0.88), p.mountain];
    case "mountain": return [p.mountain, shade(p.mountain, 0.78), p.hills];
    case "forest": return [p.forest, p.deepforest, p.hills];
    case "desert": return [p.desert, shade(p.desert, 0.84), p.beach];
    case "coast": return [p.beach, p.shallow, p.ocean];
    case "volcanic": return [p.volcanic, shade(p.volcanic, 0.7), p.mountain];
    default: return [p.plain, shade(p.plain, 0.8), p.hills];
  }
}

function backdrop(id: WorldVisualIdentity, terrain: string, r: () => number, uid: string): string {
  // Dusk, not daylight. A pale illustration sits badly against the dark
  // interface, and a lit horizon behind a dark subject reads as composed rather
  // than as a missing image.
  const [g1, g2, g3] = groundFor(id, terrain).map(c => shade(c, 0.5)) as [string, string, string];
  const [sTop, sHorizon] = skyFor(id, terrain);
  const hx = 90 + r() * 140;
  let out = `<defs>`
    + `<linearGradient id="s${uid}" x1="0" y1="0" x2="0" y2="1">`
    + `<stop offset="0%" stop-color="${shade(sTop, 0.34)}"/>`
    + `<stop offset="62%" stop-color="${shade(sTop, 0.62)}"/>`
    + `<stop offset="100%" stop-color="${shade(sHorizon, 0.86)}"/></linearGradient>`
    + `<radialGradient id="g${uid}" cx="${(hx / 320 * 100).toFixed(0)}%" cy="72%" r="62%">`
    + `<stop offset="0%" stop-color="${shade(sHorizon, 1.25)}" stop-opacity="0.85"/>`
    + `<stop offset="100%" stop-color="${shade(sHorizon, 1.1)}" stop-opacity="0"/></radialGradient>`
    + `<radialGradient id="v${uid}" cx="50%" cy="50%" r="72%">`
    + `<stop offset="55%" stop-color="#000" stop-opacity="0"/>`
    + `<stop offset="100%" stop-color="#000" stop-opacity="0.62"/></radialGradient>`
    + `</defs>`
    + `<rect width="320" height="240" fill="url(#s${uid})"/>`
    + `<rect width="320" height="240" fill="url(#g${uid})"/>`;

  // Far ridges, mid ground, near ground: three planes are enough to read as depth.
  const ridge = (baseY: number, amp: number, fill: string, op: number) => {
    let d = `M0 240 L0 ${baseY}`;
    for (let x = 0; x <= 320; x += 40) d += ` L${x} ${Math.round(baseY - r() * amp)}`;
    return `<path d="${d} L320 240 Z" fill="${fill}" opacity="${op}"/>`;
  };
  out += ridge(118, terrain === "mountain" || terrain === "snow" ? 56 : 22, shade(g3, 1.35), 0.42);
  out += ridge(150, terrain === "desert" ? 14 : 32, shade(g3, 0.9), 0.8);
  out += `<path d="M0 240 L0 176 Q80 ${166 + r() * 16} 160 174 T320 172 L320 240 Z" fill="${g1}"/>`;
  out += `<path d="M0 240 L0 205 Q90 ${196 + r() * 14} 180 207 T320 203 L320 240 Z" fill="${shade(g2, 0.82)}"/>`;
  if (terrain === "coast") out += `<path d="M0 240 L0 213 Q120 205 320 215 L320 240 Z" fill="${shade(id.palette.ocean, 0.7)}" opacity="0.95"/>`;
  if (terrain === "volcanic") out += `<circle cx="${60 + r() * 200}" cy="${86 + r() * 30}" r="52" fill="#ff7a33" opacity="0.2"/>`;
  return out;
}

/** The subject itself, in silhouette. Recognisable at thumbnail size, not a portrait. */
function subjectLayer(id: WorldVisualIdentity, kind: string, r: () => number): string {
  const p = id.palette;
  const dark = "#0b0713";
  const mid = shade(p.mountain, 0.42);

  if (kind === "Personnage") {
    // Build varies with the seed so two people are not the same outline.
    const sh = 34 + r() * 16, head = 13 + r() * 4, cloak = r() > 0.5;
    const cx = 160, base = 230;
    return `<g>`
      + `<ellipse cx="${cx}" cy="${base}" rx="${sh + 14}" ry="9" fill="#000" opacity=".28"/>`
      + (cloak ? `<path d="M${cx - sh - 10} ${base} Q${cx} ${base - 40} ${cx + sh + 10} ${base} Z" fill="${shade(dark, 1.5)}"/>` : "")
      + `<path d="M${cx - sh} ${base} Q${cx - sh + 4} ${base - 82} ${cx} ${base - 92} Q${cx + sh - 4} ${base - 82} ${cx + sh} ${base} Z" fill="${dark}"/>`
      + `<circle cx="${cx}" cy="${base - 106}" r="${head}" fill="${dark}"/>`
      + (id.techLevel <= 4 && r() > 0.45
        ? `<path d="M${cx + sh - 6} ${base} L${cx + sh - 2} ${base - 108} L${cx + sh + 4} ${base - 108} L${cx + sh} ${base} Z" fill="${mid}"/>` : "")
      + `</g>`;
  }

  if (kind === "Créature") {
    const wings = id.fantasyCreatures && r() > 0.35;
    const cx = 160, base = 226, len = 52 + r() * 26;
    return `<g>`
      + `<ellipse cx="${cx}" cy="${base + 4}" rx="${len + 18}" ry="10" fill="#000" opacity=".28"/>`
      + (wings ? `<path d="M${cx - 10} ${base - 54} Q${cx - 96} ${base - 108} ${cx - 118} ${base - 58} Q${cx - 70} ${base - 56} ${cx - 34} ${base - 30} Z" fill="${dark}"/>`
               + `<path d="M${cx + 10} ${base - 54} Q${cx + 96} ${base - 108} ${cx + 118} ${base - 58} Q${cx + 70} ${base - 56} ${cx + 34} ${base - 30} Z" fill="${dark}"/>` : "")
      + `<path d="M${cx - len} ${base} Q${cx - len * 0.5} ${base - 46} ${cx} ${base - 42} Q${cx + len * 0.7} ${base - 44} ${cx + len} ${base} Z" fill="${dark}"/>`
      + `<path d="M${cx + len * 0.7} ${base - 40} L${cx + len + 26} ${base - 72} L${cx + len + 34} ${base - 58} L${cx + len * 0.9} ${base - 26} Z" fill="${dark}"/>`
      + `<path d="M${cx - len} ${base - 4} Q${cx - len - 42} ${base - 24} ${cx - len - 62} ${base + 4}" stroke="${dark}" stroke-width="7" fill="none" stroke-linecap="round"/>`
      + `</g>`;
  }

  if (kind === "Civilisation" || kind === "Village") {
    const n = kind === "Civilisation" ? 6 : 4;
    let g = `<g>`;
    for (let i = 0; i < n; i++) {
      const w = 22 + r() * 16;
      const x = 34 + i * (250 / n) + r() * 10;
      const h = (kind === "Civilisation" ? 34 : 22) + r() * (kind === "Civilisation" ? 58 : 22);
      g += roof(x, 226, w, h, id, dark, shade(dark, 1.8));
    }
    return g + `<path d="M0 232 Q160 222 320 234" stroke="${p.road}" stroke-width="7" fill="none" opacity=".55"/></g>`;
  }

  if (kind === "Influence") {
    const cx = 160, base = 224, h = 62 + r() * 30;
    return `<g>`
      + `<ellipse cx="${cx}" cy="${base + 2}" rx="46" ry="9" fill="#000" opacity=".3"/>`
      + `<path d="M${cx} ${base - h} L${cx + 26} ${base - h * 0.45} L${cx + 17} ${base} L${cx - 17} ${base} L${cx - 26} ${base - h * 0.45} Z" fill="${shade(p.mountain, 1.25)}"/>`
      + `<path d="M${cx} ${base - h} L${cx + 26} ${base - h * 0.45} L${cx + 17} ${base} L${cx} ${base} Z" fill="${shade(p.mountain, 0.72)}"/>`
      + (id.magic ? `<circle cx="${cx}" cy="${base - h * 0.55}" r="34" fill="#cfe6ff" opacity=".12"/>` : "")
      + `</g>`;
  }

  // Régions and anything else stay pure landscape; the backdrop already carries them.
  return "";
}

const CACHE = new Map<string, string>();

export function placeholderFor(id: WorldVisualIdentity, subject: PlaceholderSubject): string {
  const key = `${id.seed}:${id.version}:${subject.id}:${subject.kind}`;
  const hit = CACHE.get(key);
  if (hit) return hit;

  const seed = hashString(key);
  const r = rng(seed || 1);
  const uid = (seed % 100000).toString(36);
  const terrain = terrainFor(id, subject);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 240" preserveAspectRatio="xMidYMid slice">`
    + backdrop(id, terrain, r, uid)
    + subjectLayer(id, subject.kind, r)
    + `<rect width="320" height="240" fill="url(#v${uid})"/>`
    + `<rect width="320" height="240" fill="${id.palette.haze}" opacity="0.2"/>`
    + `</svg>`;

  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  if (CACHE.size > 400) CACHE.clear();
  CACHE.set(key, url);
  return url;
}
