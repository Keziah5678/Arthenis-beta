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

type Visual = "ice" | "forest" | "desert" | "volcano" | "mountain" | "ocean" | "city" | "village" | "character" | "magic";

const visualFor = (item: Item): Visual => {
  const text = (item.name + " " + item.description).toLowerCase();
  if (item.kind === "Personnage") return "character";
  if (item.kind === "Influence") return "magic";
  if (item.kind === "Civilisation") return "city";
  if (item.kind === "Village") return "village";
  if (/glace|glacier|neige|neig|arct|froid|gel|ice|snow/.test(text)) return "ice";
  if (/forêt|foret|jungle|bois|verdure|forest/.test(text)) return "forest";
  if (/désert|desert|sable|dune/.test(text)) return "desert";
  if (/volcan|lave|magma|feu/.test(text)) return "volcano";
  if (/océan|ocean|mer|île|ile|rivage/.test(text)) return "ocean";
  return "mountain";
};

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
    <main className="game arthenisFinal" onContextMenu={(event) => event.preventDefault()}>
      <header className="finalTopbar">
        <button className="finalBrand" onClick={() => setScreen("home")}><span>✧</span><div><strong>ARTHENIS</strong><small>WHERE WORLDS ARE BORN</small></div></button>
        <nav className="finalNav">
          {[
            ["Carte","◈"],["Ajouter","♙"],["Civilisations","♜"],["Événements","▣"],["Chronologie","⌛"],["Paramètres","✦"]
          ].map(([entry,icon]) => <button key={entry} className={tab===entry || (entry==="Civilisations" && kind==="Civilisation") ? "selected" : ""} onClick={() => {
            if(entry==="Civilisations"){setKind("Civilisation");setTab("Ajouter");}
            else if(entry==="Événements"){setKind("Influence");setTab("Ajouter");}
            else if(entry==="Paramètres"){setNotice("Les règles fondamentales de "+title+" restent actives.");}
            else setTab(entry);
          }}><i>{icon}</i><span>{entry}</span></button>)}
        </nav>
        <button className="saveButton" onClick={() => setNotice("✓ Monde sauvegardé localement.")}>▣ Sauvegarder</button>
        <button className="creatorAvatar" onClick={() => setNotice("Créateur du monde : Keziah.")}>K</button>
      </header>

      {notice && <div className="toast finalToast">{notice}<button onClick={() => setNotice("")}>×</button></div>}

      <section className="finalLayout">
        <aside className="finalLeft">
          <div className="glassPanel addPanel">
            <div className="panelHeader"><h3>Ajouter un élément</h3><button onClick={() => setNotice("Choisis un type d'élément.")}>×</button></div>
            {([
              ["Région","◭","Montagnes, forêts, déserts..."],
              ["Civilisation","♜","Royaumes, empires, tribus..."],
              ["Village","⌂","Petites communautés"],
              ["Personnage","♙","Héros, PNJ, créatures..."],
              ["Influence","✦","Ruines, dons, merveilles..."]
            ] as [Item["kind"],string,string][]).map(([entry,icon,sub]) =>
              <button className={"addChoice "+(kind===entry && tab==="Ajouter" ? "chosen" : "")} key={entry} onClick={() => {setKind(entry);setTab("Ajouter");}}>
                <b>{icon}</b><span><strong>{entry}</strong><small>{sub}</small></span>
              </button>
            )}
          </div>

          <div className="glassPanel mapTools">
            <div className="panelHeader"><h3>Outils de carte</h3><button onClick={() => {setZoom(1);setPan({x:0,y:0});}}>×</button></div>
            <div className="toolRow">
              <button className="selected">↖</button><button>✋</button>
              <button onClick={() => setZoom(v=>Math.min(2.5,v+.2))}>⌕</button>
              <button onClick={() => setZoom(v=>Math.max(.65,v-.2))}>⊕</button><button>▱</button>
            </div>
            <label className="zoomLine">Zoom <button onClick={() => setZoom(v=>Math.max(.65,v-.2))}>−</button><input type="range" min=".65" max="2.5" step=".05" value={zoom} onChange={e=>setZoom(Number(e.target.value))}/><button onClick={() => setZoom(v=>Math.min(2.5,v+.2))}>＋</button></label>
            <button className="modeButton">Mode : <span>Exploration</span>⌄</button>
          </div>
        </aside>

        <section className="finalCenter">
          <div className="worldMapFrame">
            <div className="worldMap" onPointerDown={event=>setDrag({x:event.clientX,y:event.clientY})} onPointerMove={event=>{
              if(!drag)return;
              setPan(v=>({x:v.x+event.clientX-drag.x,y:v.y+event.clientY-drag.y}));
              setDrag({x:event.clientX,y:event.clientY});
            }} onPointerUp={()=>setDrag(null)} onPointerLeave={()=>setDrag(null)}>
              <div className="mapViewport cinematicViewport" style={{transform:"translate("+pan.x+"px,"+pan.y+"px) scale("+zoom+")"}}>
                <div className="fantasyTerrain">
                  <div className="terrainIce"/><div className="terrainForest"/><div className="terrainSea"/><div className="terrainDesert"/><div className="terrainVolcano"/><div className="terrainMarsh"/><div className="terrainCastle"/>
                </div>
                {items.map(item=>{const visual=visualFor(item);return <button key={item.id} className={"marker finalMarker marker"+item.kind} style={{left:item.x+"%",top:item.y+"%"}} onClick={()=>{setSelected(item);setNotice(iconFor(item.kind)+" "+item.name+" sélectionné.");}}>
                  <div className={"worldTile tile-"+visual}><div className="tileSky"/><div className="tileScene">
                    {visual==="ice"&&<><i className="icePeak p1"/><i className="icePeak p2"/><i className="snowDrift"/></>}
                    {visual==="forest"&&<><i className="tree t1"/><i className="tree t2"/><i className="tree t3"/><i className="tree t4"/></>}
                    {visual==="desert"&&<><i className="dune d1"/><i className="dune d2"/><i className="sun"/></>}
                    {visual==="volcano"&&<><i className="volcano"/><i className="lava"/><i className="smoke"/></>}
                    {visual==="mountain"&&<><i className="mountain m1"/><i className="mountain m2"/><i className="cloud"/></>}
                    {visual==="ocean"&&<><i className="island"/><i className="wave w1"/><i className="wave w2"/></>}
                    {visual==="city"&&<><i className="building b1"/><i className="building b2"/><i className="building b3"/><i className="building b4"/></>}
                    {visual==="village"&&<><i className="house h1"/><i className="house h2"/><i className="house h3"/></>}
                    {visual==="character"&&<><i className="heroHead"/><i className="heroBody"/><i className="heroGlow"/></>}
                    {visual==="magic"&&<><i className="crystal c1"/><i className="crystal c2"/><i className="crystal c3"/></>}
                  </div><div className="tileVignette"/></div><span className="markerLabel">{item.name}</span>
                </button>})}
              </div>

              {!items.length&&<div className="cinematicEmpty"><span>✧</span><b>TON MONDE ATTEND SA PREMIÈRE IDÉE</b><small>Choisis un élément à gauche : il apparaîtra immédiatement comme une partie réelle du monde.</small></div>}
              <div className="mapLabels">
                <span className="labelIce">◈ Les Terres Gelées</span><span className="labelForest">♣ Forêt d'Émeraude</span><span className="labelCity">♜ Royaume d'Astralys</span><span className="labelVolcano">♨ Monts Arkan</span><span className="labelDesert">△ Désert de Karsh</span><span className="labelMarsh">✦ Marais d'Ombrelune</span>
              </div>
              <div className="compass">✦<small>N</small></div>
              {selected&&<div className="entityInspector finalInspector"><button className="closeInspect" onClick={()=>setSelected(null)}>×</button><div className="inspectIcon">{iconFor(selected.kind)}</div><small>ÉLÉMENT DU MONDE</small><b>{selected.name}</b><p>{selected.description}</p><button onClick={()=>setTab("Chronologie")}>Voir dans l'histoire →</button></div>}
            </div>
          </div>
          <div className="worldQuote">« Chaque idée façonne un monde. »</div>
        </section>

        <aside className="finalRight">
          <div className="glassPanel currentWorld">
            <div className="panelHeader"><h3>Monde actuel</h3><button>×</button></div>
            <div className="worldPreview"/>
            <h2>{title}</h2>
            <dl><div><dt>Thème :</dt><dd>{theme}</dd></div><div><dt>Créé le :</dt><dd>13 septembre 2026</dd></div><div><dt>Éléments :</dt><dd>{items.length}</dd></div><div><dt>Statut :</dt><dd className="online">● En développement</dd></div></dl>
          </div>
          <div className="glassPanel chronoCard">
            <div className="panelHeader"><h3>Chronologie</h3><button onClick={()=>setTab("Chronologie")}>×</button></div>
            <b>Jour {day}</b>
            <div className="chronoList">
              {!timeline.length&&<p>✧ Création du monde {title}</p>}
              {timeline.slice(-4).map(item=><p key={item.id}><span>{iconFor(item.kind)}</span>{item.name}<small>Jour {item.day}</small></p>)}
            </div>
            <button className="fullChrono" onClick={()=>setTab("Chronologie")}>Voir toute la chronologie →</button>
          </div>
        </aside>
      </section>

      <footer className="finalFooter">
        <button onClick={()=>setTab("Ajouter")}>✧ <span>CRÉER</span><small>Ajouter au monde</small></button>
        <button onClick={()=>{setKind("Civilisation");setTab("Ajouter")}}>◆ <span>DONNER VIE</span><small>Ajouter une civilisation</small></button>
        <button onClick={()=>setTab("Chronologie")}>⌛ <span>SIMULER</span><small>Avancer dans le temps</small></button>
        <button onClick={advance}>✦ <span>FAÇONNER LE MONDE</span><small>Créer une conséquence</small></button>
        <div className="footerMark">✧ ARTHENIS</div>
      </footer>

      {tab==="Ajouter"&&<div className="commandOverlay" onClick={()=>setTab("Carte")}><section className="commandModal" onClick={e=>e.stopPropagation()}>
        <div className="panelHeader"><div><p className="panelTag">COMMANDE DU CRÉATEUR</p><h2>Ajouter au monde</h2></div><button onClick={()=>setTab("Carte")}>×</button></div>
        <p className="panelSub">Ton ajout apparaît immédiatement sur la carte et devient une conséquence réelle de l'histoire.</p>
        <div className="quickAdd">{(["Région","Civilisation","Village","Personnage","Influence"] as Item["kind"][]).map(entry=><button key={entry} className={kind===entry?"active":""} onClick={()=>setKind(entry)}>{iconFor(entry)} {entry}</button>)}</div>
        <input value={name} onChange={e=>setName(e.target.value)} placeholder={"Nom de "+kind.toLowerCase()}/>
        <textarea value={description} onChange={e=>setDescription(e.target.value)} placeholder="Décris précisément ce qui doit apparaître dans le monde..."/>
        {kind==="Personnage"&&<label className="toggle"><input type="checkbox" checked={allowNPC} onChange={e=>setAllowNPC(e.target.checked)}/> Autoriser les PNJ ajoutés volontairement par le créateur</label>}
        <button className="primary createNow" onClick={()=>{createItem();}}>Créer et placer immédiatement →</button>
      </section></div>}

      {tab==="Chronologie"&&<div className="commandOverlay" onClick={()=>setTab("Carte")}><section className="commandModal chronoModal" onClick={e=>e.stopPropagation()}>
        <div className="panelHeader"><div><p className="panelTag">HISTOIRE PERMANENTE</p><h2>Chronologie</h2></div><button onClick={()=>setTab("Carte")}>×</button></div>
        <div className="timeline">{timeline.map(item=><div className="timelineItem" key={item.id}><b>JOUR {item.day}</b><p>{iconFor(item.kind)} {item.name}</p><span>{item.description}</span></div>)}{!timeline.length&&<div className="emptyPanel">Le monde vient de naître. Son histoire attend ton premier choix.</div>}</div>
      </section></div>}
    </main>
  );}
