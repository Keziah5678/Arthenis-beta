"use client";

import { useEffect, useMemo, useState } from "react";

type Item = {
  id: number;
  kind: "Région" | "Civilisation" | "Village" | "Personnage" | "Influence";
  name: string;
  description: string;
  day: number;
  x: number;
  y: number;
};

const iconFor = (kind: Item["kind"]) =>
  kind === "Région" ? "⌁" :
  kind === "Civilisation" ? "♜" :
  kind === "Village" ? "⌂" :
  kind === "Personnage" ? "♙" : "✦";

export default function Home() {
  const [screen, setScreen] = useState<"home" | "create" | "world">("home");
  const [step, setStep] = useState(1);
  const [worldName, setWorldName] = useState("");
  const [theme, setTheme] = useState("Fantasy");
  const [magic, setMagic] = useState(true);
  const [day, setDay] = useState(1);
  const [tab, setTab] = useState("Carte");
  const [items, setItems] = useState<Item[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<Item["kind"]>("Région");
  const [allowNPC, setAllowNPC] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const [selected, setSelected] = useState<Item | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("arthenis-save");
    if (!saved) return;
    try {
      const data = JSON.parse(saved);
      setScreen(data.screen || "home");
      setWorldName(data.worldName || "");
      setTheme(data.theme || "Fantasy");
      setMagic(data.magic ?? true);
      setDay(data.day || 1);
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem("arthenis-save", JSON.stringify({ screen, worldName, theme, magic, day, items }));
  }, [screen, worldName, theme, magic, day, items]);

  useEffect(() => {
    const preventRefresh = (event: KeyboardEvent) => {
      if (event.key === "F5" || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "r")) event.preventDefault();
    };
    window.addEventListener("keydown", preventRefresh);
    return () => window.removeEventListener("keydown", preventRefresh);
  }, []);

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  const countByKind = (value: Item["kind"]) => items.filter((item) => item.kind === value).length;

  const createItem = () => {
    const finalName = name.trim();
    if (!finalName) {
      setNotice("Donne un nom à ton nouvel élément.");
      return;
    }
    if (kind === "Personnage" && !allowNPC && description.toLowerCase().includes("pnj")) {
      setNotice("Les PNJ doivent être autorisés par le créateur.");
      return;
    }
    const id = Date.now();
    const next: Item = {
      id,
      kind,
      name: finalName,
      description: description.trim() || "Élément créé par le créateur.",
      day,
      x: 12 + ((id * 37) % 72),
      y: 14 + ((id * 23) % 68)
    };
    setItems((current) => [...current, next]);
    setName("");
    setDescription("");
    setSelected(next);
    setNotice(iconFor(kind) + " " + finalName + " apparaît immédiatement sur la carte.");
    setTab("Carte");
  };

  const advance = () => {
    setDay((value) => value + 1);
    setNotice("Le temps avance. Le monde évolue à partir de ce que tu as déjà créé.");
  };

  const title = worldName || "MONDE SANS NOM";
  const timeline = useMemo(() => [...items].sort((a, b) => a.day - b.day || a.id - b.id), [items]);

  if (screen === "home") {
    return (
      <main className="landing">
        <section className="hero">
          <p className="eyebrow">✦ ARTHENIS · WHERE WORLDS ARE BORN</p>
          <h1>Crée un monde.<br />Observe ses conséquences.</h1>
          <p>Arthenis est un monde vivant : tu ajoutes, tu observes, tu avances dans le temps. Rien n'est généré à ta place sans règle.</p>
          <div className="heroActions">
            <button className="primary" onClick={() => setScreen("create")}>▶ Créer un monde</button>
            <button onClick={() => setScreen("world")}>Continuer ma partie</button>
          </div>
        </section>
      </main>
    );
  }

  if (screen === "create") {
    return (
      <main className="creator">
        <header className="creatorTop"><b>✦ ARTHENIS</b><span>CRÉATION DU MONDE · ÉTAPE {step}/3</span></header>
        <div className="stepDots"><i className={step >= 1 ? "on" : ""} /><i className={step >= 2 ? "on" : ""} /><i className={step >= 3 ? "on" : ""} /></div>
        {step === 1 && <section className="createCard"><p className="panelTag">IDENTITÉ</p><h1>Comment s'appelle ton monde ?</h1><input autoFocus value={worldName} onChange={(e) => setWorldName(e.target.value)} placeholder="Ex. Valdoria" /><button className="primary" onClick={() => setStep(2)}>Continuer →</button></section>}
        {step === 2 && <section className="createCard"><p className="panelTag">RÈGLES FONDAMENTALES</p><h1>Quelle est la nature de ce monde ?</h1><select value={theme} onChange={(e) => setTheme(e.target.value)}><option>Fantasy</option><option>Médiéval</option><option>Science-fiction</option><option>Historique</option><option>Contemporain</option></select><label className="toggle"><input type="checkbox" checked={magic} onChange={(e) => setMagic(e.target.checked)} /> Autoriser les éléments fantastiques et la magie</label><div className="heroActions"><button onClick={() => setStep(1)}>← Retour</button><button className="primary" onClick={() => setStep(3)}>Continuer →</button></div></section>}
        {step === 3 && <section className="createCard"><p className="panelTag">NAISSANCE</p><h1>{title} est prêt à être découvert.</h1><p>La carte commence vierge. Seuls les éléments que tu ajoutes apparaîtront.</p><div className="heroActions"><button onClick={() => setStep(2)}>← Retour</button><button className="primary" onClick={() => setScreen("world")}>Découvrir le monde →</button></div></section>}
      </main>
    );
  }

  return (
    <main className="game" onContextMenu={(event) => event.preventDefault()}>
      <header className="top">
        <button className="logo" onClick={() => setScreen("home")}>✦ ARTHENIS</button>
        <div className="worldTitle"><b>{title}</b><span>{theme} · Jour {day}</span></div>
        <button className="continueButton" onClick={advance}>▶ Continuer</button>
      </header>

      <div className="gameStatus">
        <span>◉ CRÉATION DIRECTE</span>
        <span>JOUR {day}</span>
        <span>{items.length} ÉLÉMENT{items.length > 1 ? "S" : ""} ACTIF{items.length > 1 ? "S" : ""}</span>
        <span className="statusHint">Aucun élément automatique</span>
      </div>

      {notice && <div className="toast">{notice}<button onClick={() => setNotice("")}>×</button></div>}

      <div className="hud">
        <aside className="side">
          {["Carte", "Ajouter", "Chronologie"].map((entry) => <button key={entry} className={tab === entry ? "active" : ""} onClick={() => setTab(entry)}>{entry === "Carte" ? "◈" : entry === "Ajouter" ? "＋" : "⌛"}<span>{entry}</span></button>)}
          <div className="sideStats">
            <small>MONDE</small>
            <span>⌁ {countByKind("Région")}</span>
            <span>♜ {countByKind("Civilisation")}</span>
            <span>⌂ {countByKind("Village")}</span>
            <span>♙ {countByKind("Personnage")}</span>
          </div>
        </aside>

        <section className="board">
          {tab === "Carte" && (
            <>
              <div className="boardTop"><div><p className="panelTag">CARTE DU MONDE · VUE LIBRE</p><h2>{title}</h2></div><button onClick={() => document.querySelector(".mapShell")?.requestFullscreen?.()}>⛶ Grand écran</button></div>
              <div className="mapShell">
                <div
                  className="gameMap"
                  onPointerDown={(event) => setDrag({ x: event.clientX, y: event.clientY })}
                  onPointerMove={(event) => {
                    if (!drag) return;
                    setPan((value) => ({ x: value.x + event.clientX - drag.x, y: value.y + event.clientY - drag.y }));
                    setDrag({ x: event.clientX, y: event.clientY });
                  }}
                  onPointerUp={() => setDrag(null)}
                  onPointerLeave={() => setDrag(null)}
                >
                  <div className="mapViewport" style={{ transform: "translate(" + pan.x + "px," + pan.y + "px) scale(" + zoom + ")" }}>
                    <div className="mapGrid" />
                    {items.map((item) => (
                      <button
                        key={item.id}
                        className={"marker marker" + item.kind}
                        style={{ left: item.x + "%", top: item.y + "%" }}
                        onClick={() => { setSelected(item); setNotice(iconFor(item.kind) + " " + item.name + " sélectionné."); }}
                      >
                        <b>{iconFor(item.kind)}</b><span>{item.name}</span>
                      </button>
                    ))}
                  </div>

                  {!items.length && <div className="emptyMap"><b>CARTE VIERGE</b><small>Ton monde n'existe encore que par tes choix. Ajoute un premier élément : il sera placé ici immédiatement.</small></div>}

                  <div className="mapLegend"><span>⌁ Région</span><span>♜ Civilisation</span><span>⌂ Village</span><span>♙ Personnage</span><span>✦ Influence</span></div>

                  {selected && <div className="entityInspector"><button className="closeInspect" onClick={() => setSelected(null)}>×</button><div className="inspectIcon">{iconFor(selected.kind)}</div><small>ÉLÉMENT DU MONDE</small><b>{selected.name}</b><p>{selected.description}</p><button onClick={() => setTab("Chronologie")}>Voir dans l'histoire →</button></div>}

                  <div className="zoomControls"><button onClick={() => setZoom((value) => Math.min(2.5, value + 0.2))}>＋</button><button onClick={() => setZoom((value) => Math.max(0.65, value - 0.2))}>−</button><button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}>⌖</button></div>
                </div>
              </div>

              <div className="actionDock"><button onClick={() => setTab("Ajouter")}>＋ Ajouter au monde</button><button onClick={() => { setKind("Région"); setTab("Ajouter"); }}>⌁ Région</button><button onClick={() => { setKind("Civilisation"); setTab("Ajouter"); }}>♜ Civilisation</button><button onClick={() => { setKind("Village"); setTab("Ajouter"); }}>⌂ Village</button></div>
            </>
          )}

          {tab === "Ajouter" && (
            <section className="panel">
              <p className="panelTag">COMMANDE DU CRÉATEUR</p>
              <h2>Ajouter au monde</h2>
              <p className="panelSub">Tout ajout est placé immédiatement sur la carte. Tu ne supprimes pas l'histoire : tu crées de nouvelles conséquences.</p>
              <div className="quickAdd">
                {(["Région", "Civilisation", "Village", "Personnage", "Influence"] as Item["kind"][]).map((entry) => <button key={entry} className={kind === entry ? "active" : ""} onClick={() => setKind(entry)}>{iconFor(entry)} {entry}</button>)}
              </div>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder={"Nom de " + kind.toLowerCase()} />
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description, rôle, pouvoir ou conséquence..." />
              {kind === "Personnage" && <label className="toggle"><input type="checkbox" checked={allowNPC} onChange={(e) => setAllowNPC(e.target.checked)} /> Autoriser les PNJ que le créateur ajoute volontairement</label>}
              <button className="primary" onClick={createItem}>Créer et placer immédiatement →</button>
            </section>
          )}

          {tab === "Chronologie" && (
            <section className="panel">
              <p className="panelTag">HISTOIRE PERMANENTE</p>
              <h2>Chronologie</h2>
              <p className="panelSub">Les personnages ne sont jamais créés automatiquement. Les événements viennent uniquement de tes créations et de leurs conséquences futures.</p>
              <div className="timeline">
                {timeline.map((item) => <div className="timelineItem" key={item.id}><b>JOUR {item.day}</b><p>{iconFor(item.kind)} {item.name}</p><span>{item.description}</span></div>)}
                {!timeline.length && <div className="emptyPanel">Le monde vient de naître. Son histoire attend ton premier choix.</div>}
              </div>
            </section>
          )}
        </section>

        <aside className="intel">
          <small>ACTIVITÉ DU MONDE</small>
          <div className="intelDay">JOUR {day}</div>
          <p>Le monde évolue à partir de ce que tu as créé. Aucune civilisation ou aucun personnage n'apparaît arbitrairement.</p>
          <button className="primary wide" onClick={advance}>Continuer l'histoire →</button>
        </aside>
      </div>
    </main>
  );
}
