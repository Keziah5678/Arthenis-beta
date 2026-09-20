"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { WorldVisualIdentity } from "../lib/world/identity";
import { sampleTerrain } from "../lib/world/terrain";
import TerrainCanvas, { type View } from "./TerrainCanvas";
import { placeholderFor } from "./placeholder";

/**
 * The world map.
 *
 * The ground is procedural and deterministic, so a world is never empty and
 * never changes shape between visits. What the creator actually wrote sits on
 * top of it as markers. The two are deliberately distinct: the terrain is
 * scenery, and it never invents a settlement, a people or a history.
 *
 * Five levels of representation, from the whole world down to the ground at
 * your feet. Each one shows what is legible at that distance and nothing else,
 * because a single flat set of pins is readable at exactly one scale.
 */

export type MapItem = {
  id: string; kind: string; name: string; description: string;
  x: number; y: number; imageUrl?: string | null;
};

const MIN_Z = 0.25;
const MAX_Z = 120;
const MAX_MARKERS = 48;

export const LEVELS = [
  { name: "Monde", below: 0.75, hint: "continents, océans, grands reliefs" },
  { name: "Continent", below: 2.5, hint: "royaumes, régions, grandes villes" },
  { name: "Région", below: 7, hint: "villes, villages, ressources" },
  { name: "Local", below: 22, hint: "bâtiments, habitants, créatures" },
  { name: "Exploration", below: Infinity, hint: "le terrain sous vos pieds" }
] as const;

export function levelFor(z: number): number {
  for (let i = 0; i < LEVELS.length; i++) if (z < LEVELS[i].below) return i;
  return LEVELS.length - 1;
}

/** The level at which each kind of creation becomes legible. */
const MIN_LEVEL: Record<string, number> = {
  "Région": 0, "Civilisation": 1, "Village": 2,
  "Influence": 2, "Personnage": 3, "Créature": 3
};

/** Used when too many markers fall in view at once. */
const IMPORTANCE: Record<string, number> = {
  "Région": 6, "Civilisation": 5, "Village": 3, "Influence": 2, "Personnage": 2, "Créature": 2
};

const KIND_ICON: Record<string, string> = {
  "Région": "⌁", "Civilisation": "♜", "Village": "⌂",
  "Personnage": "♙", "Créature": "◈", "Influence": "✦"
};


export default function WorldMap<T extends MapItem>({
  items, mapImageUrl, worldName, identity, canEdit, onSelect, onGenerateMap, selectedId
}: {
  items: T[];
  mapImageUrl?: string | null;
  worldName: string;
  identity: WorldVisualIdentity;
  canEdit: boolean;
  onSelect: (i: T) => void;
  onGenerateMap: () => void;
  selectedId?: string | null;
}) {
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [z, setZ] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [fullscreen, setFullscreen] = useState(false);
  const [focus, setFocus] = useState<string | null>(null);

  // Authoritative view, mirrored outside React state so a pinch or a wheel burst
  // reads what it just wrote. Only ever touched in effects and event handlers.
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

  const clampPan = useCallback((p: { x: number; y: number }, scale: number) => {
    const { w, h } = view.current;
    if (!w || !h) return p;
    const mx = w * 0.7, my = h * 0.7;
    return {
      x: Math.min(mx, Math.max(w - w * scale - mx, p.x)),
      y: Math.min(my, Math.max(h - h * scale - my, p.y))
    };
  }, []);

  const zoomAt = useCallback((nextZ: number, sx: number, sy: number) => {
    const { z: cz, pan: cp } = view.current;
    const clamped = Math.max(MIN_Z, Math.min(MAX_Z, nextZ));
    const wx = (sx - cp.x) / cz, wy = (sy - cp.y) / cz;
    commit(clamped, clampPan({ x: sx - wx * clamped, y: sy - wy * clamped }, clamped));
  }, [clampPan, commit]);

  /* ------------------------------------------------- pointer, wheel, keys */

  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ dist: number; z: number } | null>(null);
  const lastTap = useRef(0);
  const press = useRef({ t: 0, moved: 0 });
  const captured = useRef(false);

  const local = (e: React.PointerEvent) => {
    const r = surfaceRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  function onPointerDown(e: React.PointerEvent) {
    // Capturing now would retarget the click away from whatever marker is under
    // the finger, so capture waits until a drag actually begins.
    pointers.current.set(e.pointerId, local(e));
    press.current = { t: Date.now(), moved: 0 };
    if (pointers.current.size === 2) {
      try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); captured.current = true; } catch { /* best effort */ }
      const [a, b] = [...pointers.current.values()];
      gesture.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), z: view.current.z };
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
      if (gesture.current.dist > 4) zoomAt(gesture.current.z * (dist / gesture.current.dist), (a.x + b.x) / 2, (a.y + b.y) / 2);
      return;
    }
    const dx = now.x - prev.x, dy = now.y - prev.y;
    press.current.moved += Math.hypot(dx, dy);
    if (!captured.current && press.current.moved > 6) {
      try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); captured.current = true; } catch { /* best effort */ }
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
    if (e.type === "pointerup" && pointers.current.size === 0) {
      const t = Date.now();
      // Only a brief, stationary press counts, so releasing a drag never zooms.
      if (press.current.moved < 8 && t - press.current.t < 250) {
        if (t - lastTap.current < 300) { const p = local(e); zoomAt(view.current.z * 2, p.x, p.y); lastTap.current = 0; }
        else lastTap.current = t;
      }
    }
  }

  // React's onWheel is passive, so preventDefault there cannot stop the page
  // from scrolling underneath the map.
  useEffect(() => {
    const el = surfaceRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomAt(view.current.z * Math.exp(-e.deltaY * 0.0022), e.clientX - r.left, e.clientY - r.top);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  const reset = () => { commit(1, { x: 0, y: 0 }); setFocus(null); };

  const flyTo = useCallback((item: MapItem, target: number) => {
    const { w, h } = view.current;
    const nz = Math.max(MIN_Z, Math.min(MAX_Z, target));
    commit(nz, clampPan({ x: w / 2 - (item.x / 100) * w * nz, y: h / 2 - (item.y / 100) * h * nz }, nz));
    setFocus(item.id);
  }, [clampPan, commit]);

  /** Steps back out one level, keeping the same spot centred. */
  const levelOut = () => {
    const lvl = levelFor(view.current.z);
    const target = lvl <= 0 ? MIN_Z : (LEVELS[lvl - 1].below / 1.6);
    zoomAt(target, view.current.w / 2, view.current.h / 2);
  };

  /* ------------------------------------------------------------- content */

  const level = levelFor(z);
  const canonVisible = useMemo(() => {
    const cx = size.w ? ((size.w / 2 - pan.x) / (size.w * z)) * 100 : 50;
    const cy = size.h ? ((size.h / 2 - pan.y) / (size.h * z)) * 100 : 50;
    return items
      .filter(i => level >= (MIN_LEVEL[i.kind] ?? 0))
      .map(i => {
        const d = Math.hypot(i.x - cx, i.y - cy);
        // Selected first, then what the creator made and what is near the eye.
        const score = (i.id === selectedId || i.id === focus ? 1000 : 0)
          + (IMPORTANCE[i.kind] ?? 1) * 10
          - Math.min(60, d);
        return { item: i, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_MARKERS);
  }, [items, level, size.w, size.h, pan, z, selectedId, focus]);

  const hiddenCount = items.length - canonVisible.length;
  const showArt = level >= 3;
  const showText = level >= 4;
  const markerScale = 1 / z;
  // A generated map is authoritative while it is legible, then yields to the
  // terrain rather than being magnified into a blur.
  const rasterOpacity = mapImageUrl ? (z <= 1.5 ? 1 : Math.max(0, 1 - (z - 1.5) / 1)) : 0;
  const mapView: View = useMemo(() => ({ x: pan.x, y: pan.y, z, w: size.w, h: size.h }), [pan, z, size]);

  /** Where the eye is, described from the terrain itself. */
  const here = useMemo(() => {
    if (!size.w) return null;
    const cx = ((size.w / 2 - pan.x) / (size.w * z)) * 100;
    const cy = ((size.h / 2 - pan.y) / (size.h * z)) * 100;
    if (cx < 0 || cx > 100 || cy < 0 || cy > 100) return null;
    return sampleTerrain(identity, cx, cy, 5).biome;
  }, [identity, pan, z, size]);

  const BIOME_FR: Record<string, string> = {
    ocean: "Haute mer", shallow: "Eaux côtières", beach: "Littoral", plain: "Plaines",
    steppe: "Steppe", forest: "Forêt", deepforest: "Forêt profonde", hills: "Collines",
    mountain: "Montagnes", snow: "Neiges", desert: "Désert", swamp: "Marais",
    volcanic: "Terres volcaniques", tundra: "Toundra"
  };

  return (
    <div className={`mapLayout${fullscreen ? " mapFull" : ""}`}>
      <div className="mapToolbar">
        <button aria-label="Zoomer" onClick={() => zoomAt(z * 1.7, size.w / 2, size.h / 2)}>＋</button>
        <button aria-label="Dézoomer" onClick={() => zoomAt(z / 1.7, size.w / 2, size.h / 2)}>−</button>
        <button aria-label="Niveau précédent" onClick={levelOut} disabled={level === 0}>↑ Reculer</button>
        <button onClick={reset}>Recentrer</button>
        <button onClick={() => setFullscreen(f => !f)}>{fullscreen ? "Réduire" : "Plein écran"}</button>
        <span className="zoomBadge">{LEVELS[level].name} · {z < 1 ? z.toFixed(2) : Math.round(z * 10) / 10}×</span>
        {canEdit && <button onClick={onGenerateMap}>✦ Générer la carte</button>}
      </div>

      <div
        ref={surfaceRef}
        className="gameMap"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
      >
        <TerrainCanvas identity={identity} view={mapView} showScenery={level >= 2} />

        {mapImageUrl && rasterOpacity > 0.01 && (
          <div className="mapWorld" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${z})`, transformOrigin: "0 0", width: size.w || "100%", height: size.h || "100%" }}>
            <img className="mapBase" src={mapImageUrl} alt="" draggable={false} style={{ opacity: rasterOpacity }} />
          </div>
        )}

        <div className="mapWorld markerLayer" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${z})`, transformOrigin: "0 0", width: size.w || "100%", height: size.h || "100%" }}>
          {canonVisible.map(({ item: i }) => {
            const appearsAt = MIN_LEVEL[i.kind] ?? 0;
            const fade = level > appearsAt ? 1 : Math.min(1, Math.max(0.15, (z - (appearsAt > 0 ? LEVELS[appearsAt - 1].below : MIN_Z)) / 0.6));
            const active = i.id === selectedId || i.id === focus;
            return (
              <button
                key={i.id}
                className={`mapPin${active ? " focused" : ""}${showArt ? " rich" : ""}`}
                style={{ left: `${i.x}%`, top: `${i.y}%`, transform: `translate(-50%,-50%) scale(${markerScale})`, opacity: fade }}
                onClick={e => { e.stopPropagation(); onSelect(i); }}
                onDoubleClick={e => { e.stopPropagation(); flyTo(i, Math.max(9, z * 2.2)); }}
              >
                {showArt && (
                  <span className="pinArt">
                    <img src={i.imageUrl || placeholderFor(identity, { id: i.id, kind: i.kind, name: i.name, description: i.description })} alt="" />
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
          <span className="mapHere">{here ? BIOME_FR[here] : "Au large"}</span>
          <span className="mapLevelHint">{LEVELS[level].hint}</span>
          {hiddenCount > 0 && <span className="mapMore">+{hiddenCount} en zoomant</span>}
        </div>
        <div className="compassBadge">🧭</div>
        <div className="levelRail" aria-hidden="true">
          {LEVELS.map((l, k) => <i key={l.name} className={k === level ? "on" : ""} />)}
        </div>
      </div>

      <div className="mapJump">
        <span className="mapJumpLabel">Aller à</span>
        <div className="mapJumpRow">
          {items.length === 0 && <span className="muted">Ce monde n&apos;a pas encore de lieu. Le terrain existe déjà, à toi d&apos;y placer ton histoire.</span>}
          {items.map(i => (
            <button key={i.id} onClick={() => flyTo(i, i.kind === "Région" ? 4 : 12)}>
              {KIND_ICON[i.kind] ?? "✦"} {i.name}
            </button>
          ))}
        </div>
      </div>
      <p className="mapTip">Pince ou molette pour zoomer, glisse pour te déplacer, double-tape un élément pour y plonger. Le relief, les forêts et les rivières de {worldName} sont générés et ne changent jamais de place.</p>
    </div>
  );
}
