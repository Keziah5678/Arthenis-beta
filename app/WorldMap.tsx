"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { SceneKind } from "./Scenery";
import { artFor, variantFilter } from "./art";

/**
 * The world map.
 *
 * Three things the previous version could not do, all of which were asked for:
 *
 * 1. Deep zoom. The range runs from well outside the continent down to street
 *    level — a span of over 250×, where before it was 0.6–2×.
 * 2. Touch. It only listened for mouse events, so on a phone the map could
 *    neither be panned reliably nor pinched at all.
 * 3. Detail that appears as you descend. A single flat set of pins is legible
 *    at one zoom level and wrong at every other, so markers are gated by scale
 *    and territories grow their own settlements, woods and roads as you close
 *    in on them.
 */

export type MapItem = {
  id: string; kind: string; name: string; description: string;
  x: number; y: number; imageUrl?: string | null;
};

const MIN_Z = 0.3;
const MAX_Z = 80;

/** Scale at which each kind becomes visible. Territories first, then what is inside them. */
const APPEARS_AT: Record<string, number> = {
  "Région": 0, "Civilisation": 0, "Village": 1.45,
  "Influence": 2.6, "Personnage": 3.6, "Créature": 3.6
};

const KIND_ICON: Record<string, string> = {
  "Région": "⌁", "Civilisation": "♜", "Village": "⌂",
  "Personnage": "♙", "Créature": "◈", "Influence": "✦"
};

const KIND_SCENE: Record<string, SceneKind> = {
  "Région": "forest", "Civilisation": "city", "Village": "village",
  "Personnage": "character", "Créature": "creature", "Influence": "relic"
};

function sceneFor(item: MapItem): SceneKind {
  const t = (item.name + " " + item.description).toLowerCase();
  if (item.kind === "Personnage") return "character";
  if (item.kind === "Créature") return "creature";
  if (item.kind === "Influence") return "relic";
  if (item.kind === "Civilisation") return "city";
  if (item.kind === "Village") return "village";
  if (/glace|neige|arct|froid|gel|givre/.test(t)) return "ice";
  if (/forêt|foret|jungle|bois|sylve/.test(t)) return "forest";
  if (/désert|desert|sable|dune/.test(t)) return "desert";
  if (/volcan|lave|magma|feu|cendre/.test(t)) return "volcano";
  if (/océan|ocean|mer|île|ile|rivage|port|côte|cote/.test(t)) return "ocean";
  return "mountain";
}

/** Names the current altitude, so the zoom number means something. */
function altitudeLabel(z: number): string {
  if (z < 0.7) return "Monde";
  if (z < 1.6) return "Continent";
  if (z < 3.5) return "Royaume";
  if (z < 8) return "Région";
  if (z < 20) return "Village";
  return "Rue";
}

/** Deterministic PRNG so a territory's generated detail never changes between renders. */
function seeded(key: string) {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; h |= 0; return (h >>> 0) % 100000 / 100000; };
}

type Ground = { i: number; j: number; scene: SceneKind; ox: number; oy: number; zoom: number; flip: boolean; rot: number; tint: number };

/** Nearest territory decides what a patch of ground looks like. */
function biomeAt(x: number, y: number, territories: MapItem[]): SceneKind {
  let best: MapItem | null = null, bd = Infinity;
  for (const t of territories) {
    const d = (t.x - x) * (t.x - x) + (t.y - y) * (t.y - y);
    if (d < bd) { bd = d; best = t; }
  }
  return best ? sceneFor(best) : "forest";
}

/**
 * The painted ground for the tiles currently on screen.
 *
 * A single background image is the wrong shape for deep zoom: magnify it and it
 * turns to mush. Instead the world is cut into tiles whose size halves with
 * every doubling of the scale, and each one is painted with the artwork of the
 * nearest territory's terrain. Descending therefore lands on fresh artwork at a
 * comfortable size rather than on an enlargement, the same ground appears every
 * time you return to it, and only what is visible is ever built.
 */
function groundTiles(i0: number, i1: number, j0: number, j1: number, T: number, territories: MapItem[]): Ground[] {
  const ground: Ground[] = [];
  if ((i1 - i0) * (j1 - j0) > 260) return ground;
  for (let i = i0; i <= i1; i++) {
    for (let j = j0; j <= j1; j++) {
      const cx = (i + 0.5) * T, cy = (j + 0.5) * T;
      if (cx < -8 || cx > 108 || cy < -8 || cy > 108) continue;
      const rnd = seeded(`${i}:${j}:${T.toFixed(4)}`);
      // Each tile takes a different crop of its terrain painting, and may be
      // mirrored and turned. Without that the same image repeating on a grid is
      // immediately obvious; with it the ground reads as continuous country.
      ground.push({
        i, j, scene: biomeAt(cx, cy, territories),
        ox: Math.round(rnd() * 100), oy: Math.round(rnd() * 100),
        zoom: 150 + Math.round(rnd() * 130),
        flip: rnd() > 0.5,
        rot: Math.round((rnd() - 0.5) * 22),
        tint: 0.82 + rnd() * 0.3
      });
    }
  }
  return ground;
}

const BIOME: Record<string, string> = {
  forest: "#2f6b4a", ice: "#a9cfe8", desert: "#d4a45c", volcano: "#6e3a33",
  ocean: "#2f86b0", city: "#6b5a86", village: "#8aa95c", mountain: "#79838f",
  character: "#7a5fa8", creature: "#8a4a4a", relic: "#3f6f9c"
};

/**
 * Vector terrain, generated from where the territories actually are.
 *
 * A painted map is a raster, so past a few multiples of magnification it turns
 * to mush — which is exactly what deep zoom would otherwise show. This layer
 * sits underneath it and is pure geometry, so it is as sharp at 80× as at 1×.
 * The raster fades out across the middle of the zoom range and hands over.
 */
function Terrain({ territories, z }: { territories: MapItem[]; z: number }) {
  const uid = useId().replace(/:/g, "");
  const blobs = useMemo(() => territories.map(t => {
    const rnd = seeded("terr" + t.id);
    return {
      id: t.id, x: t.x, y: t.y,
      land: 16 + rnd() * 12,
      biome: 8 + rnd() * 7,
      color: BIOME[sceneFor(t)] ?? "#2f6b4a",
      wobble: 0.75 + rnd() * 0.5
    };
  }), [territories]);

  return (
    <svg className="mapTerrain" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <filter id={`${uid}-soft`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation={2.2 / Math.max(1, z / 2.5)} />
        </filter>
        <filter id={`${uid}-softer`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation={3.4 / Math.max(1, z / 2.5)} />
        </filter>
        {/* Ground texture generated at a tile size inversely proportional to the
            zoom, so descending adds marks instead of enlarging the same ones. */}
        <pattern id={`${uid}-grain`} width={100 / (z * 2.2)} height={100 / (z * 2.2)} patternUnits="userSpaceOnUse">
          <g fill="#8d7c58" opacity="0.5">
            <circle cx={100 / (z * 8)} cy={100 / (z * 7)} r={100 / (z * 90)} />
            <circle cx={100 / (z * 3.2)} cy={100 / (z * 3.6)} r={100 / (z * 120)} />
          </g>
          <path d={`M0 ${100 / (z * 4.4)} q${100 / (z * 8)} ${-100 / (z * 26)} ${100 / (z * 4.4)} 0`}
                stroke="#9c8a63" strokeWidth={100 / (z * 340)} fill="none" opacity="0.45" />
        </pattern>
        <linearGradient id={`${uid}-sea`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1d5b85" />
          <stop offset="100%" stopColor="#123f61" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill={`url(#${uid}-sea)`} />
      {/* shelf, then coast, then land: three passes make an edge instead of a circle */}
      <g filter={`url(#${uid}-softer)`} opacity="0.55">
        {blobs.map(b => <ellipse key={b.id} cx={b.x} cy={b.y} rx={b.land * 1.25} ry={b.land * 1.25 * b.wobble} fill="#3d88ac" />)}
      </g>
      <g filter={`url(#${uid}-soft)`}>
        {blobs.map(b => <ellipse key={b.id} cx={b.x} cy={b.y} rx={b.land * 1.06} ry={b.land * 1.06 * b.wobble} fill="#d8c49a" />)}
      </g>
      <g filter={`url(#${uid}-soft)`}>
        {blobs.map(b => <ellipse key={b.id} cx={b.x} cy={b.y} rx={b.land} ry={b.land * b.wobble} fill="#c9b88f" />)}
      </g>
      {z >= 1.8 && (
        <g fill="none" stroke="#7d6a45" strokeWidth={Math.max(0.03, 0.34 / Math.sqrt(z))} opacity="0.6">
          {blobs.map(b => <ellipse key={b.id} cx={b.x} cy={b.y} rx={b.land} ry={b.land * b.wobble} />)}
        </g>
      )}
      {z >= 2.2 && <rect width="100" height="100" fill={`url(#${uid}-grain)`} opacity={Math.min(0.85, (z - 2.2) / 3)} />}
      <g filter={`url(#${uid}-soft)`} opacity="0.78">
        {blobs.map(b => <ellipse key={b.id} cx={b.x} cy={b.y} rx={b.biome} ry={b.biome * b.wobble} fill={b.color} />)}
      </g>
      {/* roads between neighbouring territories */}
      <g stroke="#a8916a" strokeWidth={0.45 / Math.sqrt(z)} fill="none" opacity="0.7" strokeLinecap="round">
        {blobs.map((b, i) => {
          const n = blobs[(i + 1) % blobs.length];
          if (blobs.length < 2) return null;
          const mx = (b.x + n.x) / 2 + (b.wobble - 1) * 9;
          const my = (b.y + n.y) / 2 - (b.wobble - 1) * 9;
          return <path key={b.id} d={`M${b.x} ${b.y} Q${mx} ${my} ${n.x} ${n.y}`} strokeDasharray={`${1.6 / Math.sqrt(z)} ${1.2 / Math.sqrt(z)}`} />;
        })}
      </g>
    </svg>
  );
}

export default function WorldMap<T extends MapItem>({
  items, mapImageUrl, worldName, canEdit, onSelect, onGenerateMap
}: {
  items: T[];
  mapImageUrl?: string | null;
  worldName: string;
  canEdit: boolean;
  onSelect: (i: T) => void;
  onGenerateMap: () => void;
}) {
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [z, setZ] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [fullscreen, setFullscreen] = useState(false);
  const [focus, setFocus] = useState<string | null>(null);

  // The authoritative view, mirrored outside React state so a pinch or a wheel
  // burst reads the value it just wrote instead of the one from the last render.
  // It is only ever touched from effects and event handlers, never during render.
  const view = useRef({ z: 1, pan: { x: 0, y: 0 }, w: 0, h: 0 });
  const commit = useCallback((nz: number, np: { x: number; y: number }) => {
    view.current.z = nz; view.current.pan = np;
    setZ(nz); setPan(np);
  }, []);

  useEffect(() => {
    const el = surfaceRef.current;
    if (!el) return;
    const measure = () => {
      view.current.w = el.clientWidth; view.current.h = el.clientHeight;
      setSize({ w: el.clientWidth, h: el.clientHeight });
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, [fullscreen]);

  /** Keeps a quarter of the viewport covered, so the map can never be flung out of sight. */
  const clampPan = useCallback((p: { x: number; y: number }, scale: number) => {
    const { w, h } = view.current;
    if (!w || !h) return p;
    const ww = w * scale, wh = h * scale;
    const marginX = w * 0.75, marginY = h * 0.75;
    return {
      x: Math.min(marginX, Math.max(w - ww - marginX, p.x)),
      y: Math.min(marginY, Math.max(h - wh - marginY, p.y))
    };
  }, []);

  /** Zoom about a point in surface coordinates, so the spot under the fingers stays put. */
  const zoomAt = useCallback((nextZ: number, sx: number, sy: number) => {
    const { z: cz, pan: cp } = view.current;
    const clamped = Math.max(MIN_Z, Math.min(MAX_Z, nextZ));
    const wx = (sx - cp.x) / cz, wy = (sy - cp.y) / cz;
    commit(clamped, clampPan({ x: sx - wx * clamped, y: sy - wy * clamped }, clamped));
  }, [clampPan, commit]);

  // Pointer handling: one pointer pans, two pinch. Pointer events cover mouse,
  // touch and pen with the same code path, which is why there is only one.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ dist: number; cx: number; cy: number; z: number } | null>(null);
  const lastTap = useRef(0);
  const press = useRef({ t: 0, x: 0, y: 0, moved: 0 });
  const captured = useRef(false);

  const local = (e: React.PointerEvent) => {
    const r = surfaceRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  function onPointerDown(e: React.PointerEvent) {
    // Capturing here would retarget the click away from whatever marker is
    // under the finger, so capture is deferred until a drag actually starts.
    const p0 = local(e);
    pointers.current.set(e.pointerId, p0);
    press.current = { t: Date.now(), x: p0.x, y: p0.y, moved: 0 };
    if (pointers.current.size === 2) {
      try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); captured.current = true; } catch { /* capture is best effort */ }
      const [a, b] = [...pointers.current.values()];
      gesture.current = {
        dist: Math.hypot(a.x - b.x, a.y - b.y),
        cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, z: view.current.z
      };
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId)) return;
    const prev = pointers.current.get(e.pointerId)!;
    const now = local(e);
    pointers.current.set(e.pointerId, now);

    if (pointers.current.size >= 2 && gesture.current) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (gesture.current.dist > 4) {
        zoomAt(gesture.current.z * (dist / gesture.current.dist), (a.x + b.x) / 2, (a.y + b.y) / 2);
      }
      return;
    }
    const dx = now.x - prev.x, dy = now.y - prev.y;
    press.current.moved += Math.hypot(dx, dy);
    // Past the slop threshold this is a drag, not a tap: take the pointer so
    // panning survives the cursor leaving the map.
    if (!captured.current && press.current.moved > 6) {
      try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); captured.current = true; } catch { /* capture is best effort */ }
    }
    if (!captured.current) return;
    const cp = view.current.pan;
    const np = clampPan({ x: cp.x + dx, y: cp.y + dy }, view.current.z);
    view.current.pan = np;
    setPan(np);
  }

  function endPointer(e: React.PointerEvent) {
    if (captured.current) {
      try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* already released */ }
    }
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) captured.current = false;
    if (pointers.current.size < 2) gesture.current = null;
    // Double tap zooms in. A press only counts as a tap if it was brief and did
    // not travel, otherwise releasing a drag would zoom the map unexpectedly.
    if (e.type === "pointerup" && pointers.current.size === 0) {
      const t = Date.now();
      const isTap = press.current.moved < 8 && t - press.current.t < 250;
      if (isTap) {
        if (t - lastTap.current < 300) { const p = local(e); zoomAt(view.current.z * 2, p.x, p.y); lastTap.current = 0; }
        else lastTap.current = t;
      }
    }
  }

  // Wheel must be a non-passive native listener: React's synthetic onWheel is
  // passive, so preventDefault there does not stop the page from scrolling.
  useEffect(() => {
    const el = surfaceRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const factor = Math.exp(-e.deltaY * 0.0022);
      zoomAt(view.current.z * factor, e.clientX - r.left, e.clientY - r.top);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  const reset = () => { commit(1, { x: 0, y: 0 }); setFocus(null); };

  /** Flies to an entity and descends far enough to see what surrounds it. */
  const flyTo = useCallback((item: MapItem, target = 6) => {
    const { w, h } = view.current;
    const nz = Math.max(MIN_Z, Math.min(MAX_Z, target));
    commit(nz, clampPan({ x: w / 2 - (item.x / 100) * w * nz, y: h / 2 - (item.y / 100) * h * nz }, nz));
    setFocus(item.id);
  }, [clampPan, commit]);

  const visible = useMemo(
    () => items.filter(i => z >= (APPEARS_AT[i.kind] ?? 0)),
    [items, z]
  );
  const territories = useMemo(
    () => items.filter(i => i.kind === "Région" || i.kind === "Civilisation" || i.kind === "Village"),
    [items]
  );
  // Tile size snapped to powers of two, aiming for roughly 90px on screen, so
  // the grid is stable while zooming instead of shimmering at every step.
  const T = useMemo(() => {
    if (!size.w || !z) return 25;
    const raw = 9000 / (size.w * z);
    return Math.min(25, Math.max(0.01, Math.pow(2, Math.round(Math.log2(raw)))));
  }, [size.w, z]);
  const i0 = size.w ? Math.floor((-pan.x / (size.w * z)) * 100 / T) : 0;
  const i1 = size.w ? Math.ceil(((size.w - pan.x) / (size.w * z)) * 100 / T) : 0;
  const j0 = size.h ? Math.floor((-pan.y / (size.h * z)) * 100 / T) : 0;
  const j1 = size.h ? Math.ceil(((size.h - pan.y) / (size.h * z)) * 100 / T) : 0;
  const ground = useMemo(
    () => groundTiles(i0, i1, j0, j1, T, territories),
    [i0, i1, j0, j1, T, territories]
  );

  // The painted map is authoritative while it is legible, then yields to the
  // vector terrain rather than being magnified into a blur.
  const rasterOpacity = z <= 2 ? 1 : Math.max(0, 1 - (z - 2) / 2.6);
  const showDetail = z >= 2.4;
  const showThumbs = z >= 3.2;
  const showText = z >= 7;
  // Markers hold a constant on-screen size instead of ballooning with the world.
  const markerScale = 1 / z;
  const hidden = items.length - visible.length;

  return (
    <div className={`mapLayout${fullscreen ? " mapFull" : ""}`}>
      <div className="mapToolbar">
        <button aria-label="Zoomer" onClick={() => zoomAt(z * 1.6, size.w / 2, size.h / 2)}>＋</button>
        <button aria-label="Dézoomer" onClick={() => zoomAt(z / 1.6, size.w / 2, size.h / 2)}>−</button>
        <button onClick={reset}>Recentrer</button>
        <button onClick={() => setFullscreen(f => !f)}>{fullscreen ? "Réduire" : "Plein écran"}</button>
        <span className="zoomBadge">{altitudeLabel(z)} · {z < 1 ? z.toFixed(2) : Math.round(z * 10) / 10}×</span>
        {canEdit && <button onClick={onGenerateMap}>✦ Générer la carte</button>}
      </div>

      <div
        ref={surfaceRef}
        className="gameMap"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onDoubleClick={e => {
          const r = surfaceRef.current!.getBoundingClientRect();
          zoomAt(view.current.z * 2, e.clientX - r.left, e.clientY - r.top);
        }}
      >
        <div className="mapWorld" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${z})`, transformOrigin: "0 0", width: size.w || "100%", height: size.h || "100%" }}>
          <Terrain territories={territories} z={z} />
          {mapImageUrl && <img className="mapBase" src={mapImageUrl} alt="" draggable={false} style={{ opacity: rasterOpacity }} />}

          {/* Territory interiors. Drawn in world units, so they grow as you descend. */}
          {showDetail && (
            <div className="groundLayer" style={{ opacity: Math.min(0.92, (z - 2.4) / 2.2) }}>
              {ground.map(g => (
                <div key={`${g.i}:${g.j}`} className="groundTile"
                     style={{
                       left: `${(g.i - 0.26) * T}%`, top: `${(g.j - 0.26) * T}%`,
                       width: `${T * 1.52}%`, height: `${T * 1.52}%`,
                       backgroundImage: `url(${artFor(g.scene)})`,
                       backgroundPosition: `${g.ox}% ${g.oy}%`,
                       backgroundSize: `${g.zoom}%`,
                       filter: `brightness(${g.tint})`,
                       transform: `rotate(${g.rot}deg) scaleX(${g.flip ? -1 : 1})`
                     }} />
              ))}
            </div>
          )}

          {visible.map(i => {
            const appeared = APPEARS_AT[i.kind] ?? 0;
            const fade = appeared ? Math.min(1, (z - appeared) / (appeared * 0.5 + 0.6)) : 1;
            return (
              <button
                key={i.id}
                className={`mapPin${focus === i.id ? " focused" : ""}${showThumbs ? " rich" : ""}`}
                style={{ left: `${i.x}%`, top: `${i.y}%`, transform: `translate(-50%,-50%) scale(${markerScale})`, opacity: fade }}
                onClick={e => { e.stopPropagation(); onSelect(i); }}
                onDoubleClick={e => { e.stopPropagation(); flyTo(i, Math.max(8, z * 2)); }}
              >
                {showThumbs && (
                  <span className="pinArt">
                    <img src={i.imageUrl || artFor(sceneFor(i))} alt="" style={i.imageUrl ? undefined : { filter: variantFilter(i.id + i.name) }} />
                  </span>
                )}
                <span className="pinRow">
                  <b>{KIND_ICON[i.kind] ?? "✦"}</b>
                  <span className="pinName">{i.name}</span>
                </span>
                {showText && <span className="pinDesc">{i.description}</span>}
              </button>
            );
          })}
        </div>

        <div className="mapHints">
          {hidden > 0
            ? <span>Zoome pour révéler {hidden} élément{hidden > 1 ? "s" : ""} de plus</span>
            : <span>Tout est visible à cette altitude</span>}
        </div>
        <div className="compassBadge">🧭</div>
      </div>

      <div className="mapJump">
        <span className="mapJumpLabel">Aller à</span>
        <div className="mapJumpRow">
          {items.map(i => (
            <button key={i.id} onClick={() => flyTo(i, i.kind === "Région" ? 5 : 11)}>
              {KIND_ICON[i.kind] ?? "✦"} {i.name}
            </button>
          ))}
        </div>
      </div>
      <p className="mapTip">Pince pour zoomer, glisse pour te déplacer, double-tape sur un élément pour y plonger. {worldName} se dévoile en descendant.</p>
    </div>
  );
}
