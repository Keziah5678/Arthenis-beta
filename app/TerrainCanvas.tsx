"use client";

import { useEffect, useRef } from "react";
import type { WorldVisualIdentity } from "../lib/world/identity";
import { fbm, featuresForCell, sampleTerrain, type Feature } from "../lib/world/terrain";

/**
 * Draws the world's natural environment.
 *
 * Two layers with different jobs. The ground is a low-resolution colour field,
 * cheap enough to redraw while the map moves and smooth enough that scaling it
 * up looks painted. The scenery on top is vector, drawn at full resolution, so
 * it stays sharp at any magnification.
 *
 * Noise octaves rise with the zoom, which is what makes descending uncover
 * finer ground rather than enlarge the same shapes. Nothing is stored: the same
 * seed and the same coordinates always give the same terrain, so leaving the
 * map and coming back shows the country exactly where it was.
 */

export type View = { x: number; y: number; z: number; w: number; h: number };

/** Ground is sampled at a fraction of screen resolution; scenery is not. */
const GROUND_STEP = 4;

function octavesFor(z: number): number {
  return Math.max(4, Math.min(10, 4 + Math.round(Math.log2(Math.max(1, z)))));
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function drawFeature(ctx: CanvasRenderingContext2D, f: Feature, sx: number, sy: number, px: number, p: WorldVisualIdentity["palette"]) {
  const s = px * f.scale;
  if (s < 1.2) return;
  const shade = 0.82 + f.tone * 0.32;
  const tint = (hex: string) => {
    const [r, g, b] = hexToRgb(hex);
    return `rgb(${Math.min(255, r * shade) | 0},${Math.min(255, g * shade) | 0},${Math.min(255, b * shade) | 0})`;
  };
  ctx.save();
  ctx.translate(sx, sy);
  // A dark seat under every object; without it scenery floats on the ground.
  ctx.fillStyle = "rgba(0,0,0,.3)";
  ctx.beginPath(); ctx.ellipse(0, 0, s * 0.62, s * 0.2, 0, 0, 6.3); ctx.fill();
  switch (f.kind) {
    case "conifer":
      ctx.fillStyle = "rgba(0,0,0,.22)";
      ctx.beginPath(); ctx.ellipse(0, 0, s * 0.5, s * 0.16, 0, 0, 6.3); ctx.fill();
      ctx.fillStyle = tint(p.deepforest);
      ctx.beginPath(); ctx.moveTo(0, -s * 1.7); ctx.lineTo(s * 0.52, 0); ctx.lineTo(-s * 0.52, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = tint(p.forest);
      ctx.beginPath(); ctx.moveTo(0, -s * 1.7); ctx.lineTo(s * 0.3, -s * 0.2); ctx.lineTo(-s * 0.52, 0); ctx.closePath(); ctx.fill();
      break;
    case "tree":
      ctx.fillStyle = "rgba(0,0,0,.22)";
      ctx.beginPath(); ctx.ellipse(0, 0, s * 0.55, s * 0.17, 0, 0, 6.3); ctx.fill();
      ctx.strokeStyle = "#4a3421"; ctx.lineWidth = Math.max(0.6, s * 0.14);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -s * 0.6); ctx.stroke();
      ctx.fillStyle = tint(p.forest);
      ctx.beginPath(); ctx.ellipse(0, -s * 0.95, s * 0.62, s * 0.55, 0, 0, 6.3); ctx.fill();
      ctx.fillStyle = tint(p.deepforest);
      ctx.beginPath(); ctx.ellipse(s * 0.18, -s * 0.8, s * 0.4, s * 0.36, 0, 0, 6.3); ctx.fill();
      break;
    case "palm":
      ctx.strokeStyle = "#6b5330"; ctx.lineWidth = Math.max(0.6, s * 0.12);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(s * 0.2, -s * 0.8, s * 0.1, -s * 1.3); ctx.stroke();
      ctx.fillStyle = tint(p.forest);
      for (let a = 0; a < 5; a++) {
        ctx.beginPath(); ctx.ellipse(s * 0.1, -s * 1.3, s * 0.6, s * 0.14, (a / 5) * Math.PI * 2, 0, 6.3); ctx.fill();
      }
      break;
    case "reed":
      ctx.strokeStyle = tint(p.swamp); ctx.lineWidth = Math.max(0.5, s * 0.1);
      for (let a = -1; a <= 1; a++) {
        ctx.beginPath(); ctx.moveTo(a * s * 0.22, 0);
        ctx.quadraticCurveTo(a * s * 0.36, -s * 0.6, a * s * 0.52, -s * 0.95); ctx.stroke();
      }
      break;
    case "cactus":
      ctx.fillStyle = tint(p.forest);
      ctx.fillRect(-s * 0.14, -s * 1.1, s * 0.28, s * 1.1);
      ctx.fillRect(-s * 0.5, -s * 0.8, s * 0.36, s * 0.14);
      ctx.fillRect(s * 0.14, -s * 0.95, s * 0.36, s * 0.14);
      break;
    case "dune":
      ctx.fillStyle = tint(p.desert);
      ctx.beginPath(); ctx.ellipse(0, 0, s * 1.6, s * 0.45, 0, Math.PI, 0); ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,.12)"; ctx.lineWidth = Math.max(0.4, s * 0.08);
      ctx.beginPath(); ctx.ellipse(0, 0, s * 1.6, s * 0.45, 0, Math.PI, 0); ctx.stroke();
      break;
    case "boulder":
      ctx.fillStyle = tint(p.mountain);
      ctx.beginPath(); ctx.moveTo(-s * 0.7, 0); ctx.lineTo(-s * 0.4, -s * 0.62);
      ctx.lineTo(s * 0.18, -s * 0.78); ctx.lineTo(s * 0.7, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.14)";
      ctx.beginPath(); ctx.moveTo(-s * 0.4, -s * 0.62); ctx.lineTo(s * 0.18, -s * 0.78); ctx.lineTo(s * 0.05, -s * 0.4); ctx.closePath(); ctx.fill();
      break;
    case "rock":
      ctx.fillStyle = tint(p.mountain);
      ctx.beginPath(); ctx.ellipse(0, -s * 0.16, s * 0.42, s * 0.3, 0, 0, 6.3); ctx.fill();
      break;
    case "peak":
      ctx.fillStyle = "rgba(0,0,0,.25)";
      ctx.beginPath(); ctx.moveTo(-s * 1.1, 0); ctx.lineTo(0, -s * 2.1); ctx.lineTo(s * 1.1, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = tint(p.mountain);
      ctx.beginPath(); ctx.moveTo(-s * 1.05, 0); ctx.lineTo(0, -s * 2); ctx.lineTo(s * 1.05, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "rgba(0,0,0,.18)";
      ctx.beginPath(); ctx.moveTo(0, -s * 2); ctx.lineTo(s * 1.05, 0); ctx.lineTo(s * 0.1, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = p.snow;
      ctx.beginPath(); ctx.moveTo(0, -s * 2); ctx.lineTo(s * 0.4, -s * 1.24); ctx.lineTo(s * 0.12, -s * 1.32);
      ctx.lineTo(-s * 0.16, -s * 1.16); ctx.lineTo(-s * 0.4, -s * 1.24); ctx.closePath(); ctx.fill();
      break;
    case "iceblock":
      ctx.fillStyle = p.snow;
      ctx.beginPath(); ctx.moveTo(-s * 0.6, 0); ctx.lineTo(-s * 0.3, -s * 0.7);
      ctx.lineTo(s * 0.34, -s * 0.58); ctx.lineTo(s * 0.62, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "rgba(120,180,220,.4)";
      ctx.beginPath(); ctx.moveTo(s * 0.34, -s * 0.58); ctx.lineTo(s * 0.62, 0); ctx.lineTo(s * 0.1, 0); ctx.closePath(); ctx.fill();
      break;
  }
  ctx.restore();
}

export function drawWorld(canvas: HTMLCanvasElement, id: WorldVisualIdentity, view: View, showScenery: boolean) {
  const dpr = Math.min(2, typeof window === "undefined" ? 1 : window.devicePixelRatio || 1);
  const W = Math.max(1, Math.round(view.w * dpr)), H = Math.max(1, Math.round(view.h * dpr));
  if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, view.w, view.h);

  const oct = octavesFor(view.z);
  const p = id.palette;
  // Micro-relief, tied to the sampling grid rather than to the zoom.
  //
  // The base terrain is defined in world units, so its high octaves shrink to
  // nothing on screen as you descend and the ground shades to a flat field.
  // A detail term fixes that, but only if its wavelength stays several samples
  // wide: pin it to the zoom instead and it aliases into television static.
  // `ds` is the world distance between two ground samples, so ten times that
  // is a ripple the grid can actually resolve. Biome classification ignores
  // this term, so the biome map is identical at every level.
  const ds = (GROUND_STEP / (view.w * view.z)) * 100;
  const dK = 1 / Math.max(1e-6, ds * 10);
  const dA = ds * 1.5;
  const detail = (wx: number, wy: number) => (fbm(wx * dK, wy * dK, id.seed + 7717, 3) - 0.5) * dA;
  // Screen to world: a point at percentage q sits at pan + (q/100) * size * z.
  const toWorldX = (sx: number) => ((sx - view.x) / (view.w * view.z)) * 100;
  const toWorldY = (sy: number) => ((sy - view.y) / (view.h * view.z)) * 100;

  /* ground */
  const gw = Math.max(2, Math.ceil(view.w / GROUND_STEP));
  const gh = Math.max(2, Math.ceil(view.h / GROUND_STEP));
  const img = ctx.createImageData(gw, gh);
  const data = img.data;
  const rgb: Record<string, [number, number, number]> = {};
  for (const [k, v] of Object.entries(p)) rgb[k] = hexToRgb(v);

  for (let j = 0; j < gh; j++) {
    const wy = toWorldY((j + 0.5) * GROUND_STEP);
    for (let i = 0; i < gw; i++) {
      const wx = toWorldX((i + 0.5) * GROUND_STEP);
      const t = sampleTerrain(id, wx, wy, oct);
      let [r, g, b] = rgb[t.river ? "river" : t.biome] ?? rgb.plain;
      // Elevation tinting. A single flat colour per biome leaves a whole
      // mountain range one shade of grey, so the ground is graded between a
      // low and a high anchor before any shading is applied.
      if (!t.river && t.biome !== "ocean" && t.biome !== "shallow") {
        const toward = (c: [number, number, number], k: number) => {
          r += (c[0] - r) * k; g += (c[1] - g) * k; b += (c[2] - b) * k;
        };
        if (t.height > 0.78) toward(rgb.snow, Math.min(0.55, (t.height - 0.78) * 2.6));
        else if (t.height < 0.46) toward(rgb.hills, Math.min(0.3, (0.46 - t.height) * 1.5));
      }
      // Relief shading: a cheap slope estimate gives the ground form.
      if (t.biome !== "ocean" && t.biome !== "shallow") {
        // Hill shading from a cheap slope estimate, plus a fine grain so large
        // areas of one biome still have surface rather than reading as paint.
        const step = 0.9 / Math.max(1, view.z);
        const h0 = t.height + detail(wx, wy);
        const e = sampleTerrain(id, wx + step, wy, Math.min(oct, 7)).height + detail(wx + step, wy);
        const n = sampleTerrain(id, wx, wy - step, Math.min(oct, 7)).height + detail(wx, wy - step);
        // Dividing by the step makes the shading independent of scale, so a
        // slope looks like a slope whether you are a continent or a metre away.
        const slope = ((h0 - e) * 2.4 + (h0 - n) * 1.5) / step * 0.55;
        const grain = (fbm(wx * dK * 0.45, wy * dK * 0.45, id.seed + 4441, 2) - 0.5) * 0.17;
        const k = 1 + Math.max(-0.52, Math.min(0.52, slope)) + grain;
        r = Math.min(255, Math.max(0, r * k));
        g = Math.min(255, Math.max(0, g * k));
        b = Math.min(255, Math.max(0, b * k));
      } else {
        // Water gets a slow swell instead of a flat fill.
        const swell = (fbm(wx * Math.min(2.2, dK * 0.3), wy * Math.min(2.2, dK * 0.3), id.seed + 881, 3) - 0.5) * 0.18;
        r = Math.min(255, Math.max(0, r * (1 + swell)));
        g = Math.min(255, Math.max(0, g * (1 + swell)));
        b = Math.min(255, Math.max(0, b * (1 + swell)));
      }
      const o = (j * gw + i) * 4;
      data[o] = r; data[o + 1] = g; data[o + 2] = b; data[o + 3] = 255;
    }
  }
  const off = document.createElement("canvas");
  off.width = gw; off.height = gh;
  off.getContext("2d")!.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(off, 0, 0, view.w, view.h);

  /* scenery */
  if (!showScenery) return;
  // One cell is about 90 screen pixels, so descending subdivides the ground.
  const cellWorld = (90 / (view.w * view.z)) * 100;
  const px = Math.max(2.2, Math.min(26, 7.5 * Math.min(2.6, Math.max(0.55, view.z / 6))));
  const i0 = Math.floor(toWorldX(0) / cellWorld), i1 = Math.ceil(toWorldX(view.w) / cellWorld);
  const j0 = Math.floor(toWorldY(0) / cellWorld), j1 = Math.ceil(toWorldY(view.h) / cellWorld);
  if ((i1 - i0) * (j1 - j0) > 600) return;

  const items: Array<{ f: Feature; sx: number; sy: number }> = [];
  for (let i = i0; i <= i1; i++) {
    for (let j = j0; j <= j1; j++) {
      for (const f of featuresForCell(id, i, j, cellWorld, oct)) {
        items.push({
          f,
          sx: view.x + (f.x / 100) * view.w * view.z,
          sy: view.y + (f.y / 100) * view.h * view.z
        });
      }
    }
  }
  // Painter's order, so nearer scenery overlaps what is behind it.
  items.sort((a, b) => a.sy - b.sy);
  for (const it of items) drawFeature(ctx, it.f, it.sx, it.sy, px, p);
}

export default function TerrainCanvas({ identity, view, showScenery }: { identity: WorldVisualIdentity; view: View; showScenery: boolean }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const pending = useRef(0);
  useEffect(() => {
    const cv = ref.current;
    if (!cv || !view.w || !view.h) return;
    cancelAnimationFrame(pending.current);
    pending.current = requestAnimationFrame(() => drawWorld(cv, identity, view, showScenery));
    return () => cancelAnimationFrame(pending.current);
  }, [identity, view, showScenery]);
  return <canvas ref={ref} className="terrainCanvas" style={{ width: view.w || "100%", height: view.h || "100%" }} aria-hidden="true" />;
}
