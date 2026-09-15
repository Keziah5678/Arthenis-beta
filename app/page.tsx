"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase, supabaseConfigured, getSupabaseConfigurationError } from "../lib/supabase/client";

type Kind = "Région" | "Civilisation" | "Village" | "Personnage" | "Créature" | "Influence";
type Item = { id: string; kind: Kind; name: string; description: string; day: number; x: number; y: number; imageUrl?: string | null };
type World = { id: string; name: string; description: string; theme: string; magic_enabled: boolean; fiction_enabled: boolean; fictional_creatures_enabled: boolean; visual_bible?: Record<string, unknown>; world_memory?: Record<string, unknown> };

const iconFor=(kind:Kind)=>kind==="Région"?"⌁":kind==="Civilisation"?"♜":kind==="Village"?"⌂":kind==="Personnage"?"♙":kind==="Créature"?"◈":"✦";
const visualFor=(item:Item)=>{
 const t=(item.name+" "+item.description).toLowerCase();
 if(item.imageUrl)return "image";
 if(item.kind==="Personnage")return "character";
 if(item.kind==="Créature")return "creature";
 if(item.kind==="Influence")return "magic";
 if(item.kind==="Civilisation")return "city";
 if(item.kind==="Village")return "village";
 if(/glace|neige|arct|froid|gel/.test(t))return "ice";
 if(/forêt|foret|jungle|bois/.test(t))return "forest";
 if(/désert|desert|sable|dune/.test(t))return "desert";
 if(/volcan|lave|magma|feu/.test(t))return "volcano";
 if(/océan|ocean|mer|île|ile|rivage/.test(t))return "ocean";
 return "mountain";
};

type AuthModalProps = {
 authMode: "signin" | "signup";
 email: string;
 password: string;
 busy: boolean;
 notice: string;
 onClose: () => void;
 onEmailChange: (value: string) => void;
 onPasswordChange: (value: string) => void;
 onAuthenticate: () => void;
 onResetPassword: () => void;
 onToggleMode: () => void;
};

function AuthModal({authMode,email,password,busy,notice,onClose,onEmailChange,onPasswordChange,onAuthenticate,onResetPassword,onToggleMode}: AuthModalProps){
 return <div className="commandOverlay">
  <section className="commandModal">
   <div className="panelHeader">
    <div><p className="panelTag">ARTHENIS ACCOUNT</p><h2>{authMode==="signin"?"Connexion":"Créer un compte"}</h2></div>
    <button onClick={onClose} aria-label="Fermer">×</button>
   </div>
   <input type="email" value={email} onChange={e=>onEmailChange(e.target.value)} placeholder="E-mail" autoComplete="email"/>
   <input type="password" value={password} onChange={e=>onPasswordChange(e.target.value)} placeholder="Mot de passe (6 caractères minimum)" autoComplete={authMode==="signin"?"current-password":"new-password"}/>
   <button className="primary createNow" disabled={busy} onClick={onAuthenticate}>{busy?"Patiente…":authMode==="signin"?"Se connecter":"Créer mon compte"}</button>
   {authMode==="signin"&&<button disabled={busy} onClick={onResetPassword}>Mot de passe oublié ?</button>}
   {notice&&<p className="authNotice">{notice}</p>}
   <button disabled={busy} onClick={onToggleMode}>{authMode==="signin"?"Créer un compte":"J'ai déjà un compte"}</button>
  </section>
 </div>;
}


export default function Home(){
 const [ready,setReady]=useState(false),[sessionEmail,setSessionEmail]=useState<string|null>(null);
 const [authOpen,setAuthOpen]=useState(false),[email,setEmail]=useState(""),[password,setPassword]=useState(""),[authMode,setAuthMode]=useState<"signin"|"signup">("signin");
 const [screen,setScreen]=useState<"home"|"create"|"world">("home"),[step,setStep]=useState(1),[worldName,setWorldName]=useState(""),[theme,setTheme]=useState("Fantasy");
 const [magic,setMagic]=useState(true),[fiction,setFiction]=useState(true),[fictionalCreatures,setFictionalCreatures]=useState(true),[world,setWorld]=useState<World|null>(null);
 const [day,setDay]=useState(1),[tab,setTab]=useState("Carte"),[items,setItems]=useState<Item[]>([]),[name,setName]=useState(""),[description,setDescription]=useState(""),[kind,setKind]=useState<Kind>("Région"),[allowNPC,setAllowNPC]=useState(false);
 const [selected,setSelected]=useState<Item|null>(null),[notice,setNotice]=useState(""),[busy,setBusy]=useState(false),[zoom,setZoom]=useState(1),[pan,setPan]=useState({x:0,y:0}),[drag,setDrag]=useState<{x:number;y:number}|null>(null);

 useEffect(()=>{(async()=>{const {data:{session}}=await supabase.auth.getSession();setSessionEmail(session?.user.email??null);if(session){await loadWorlds();}setReady(true);})();const {data:{subscription}}=supabase.auth.onAuthStateChange((_e,s)=>{setSessionEmail(s?.user.email??null);if(s)loadWorlds();else {setWorld(null);setItems([]);}});return()=>subscription.unsubscribe();},[]);

 async function loadWorlds(){
  const {data,error}=await supabase.from("worlds").select("*").order("updated_at",{ascending:false}).limit(1);
  if(error){setNotice("Impossible de charger le monde : "+error.message);return;}
  if(data?.[0]){const w=data[0] as World;setWorld(w);setWorldName(w.name);setTheme(w.theme);setMagic(w.magic_enabled);setFiction(w.fiction_enabled);setFictionalCreatures(w.fictional_creatures_enabled);await loadItems(w.id);}
 }
 async function loadItems(worldId:string){
  const [r,c,v,p,e]=await Promise.all([
   supabase.from("regions").select("id,name,description,x,y,image_url,created_at").eq("world_id",worldId),
   supabase.from("civilizations").select("id,name,description,image_url,created_at").eq("world_id",worldId),
   supabase.from("characters").select("id,name,biography,image_url,created_at").eq("world_id",worldId),
   supabase.from("timeline_events").select("id,title,description,world_day,image_url,created_at").eq("world_id",worldId),
   supabase.from("creatures").select("id,name,description,image_url,created_at").eq("world_id",worldId)
  ]);
  const map=(data:any[],kind:Kind,desc:string,offset=0):Item[]=>data.map((x,i)=>({id:x.id,kind,name:x.name||x.title,description:x[desc]||"",day:x.world_day||1,x:kind==="Région"?(Number(x.x)||50):12+((i*19+offset)%72),y:kind==="Région"?(Number(x.y)||50):16+((i*23+offset)%65),imageUrl:x.image_url||null}));
  setItems([...map(r.data||[],"Région","description"),...map(c.data||[],"Civilisation","description",9),...map(v.data||[],"Personnage","biography",17),...map(e.data||[],"Influence","description",31),...map(p.data||[],"Créature","description",43)]);
 }

 async function authenticate(){
  setNotice("");
  if(!supabaseConfigured){setNotice(getSupabaseConfigurationError()||"Supabase n'est pas configuré.");return;}
  const normalizedEmail=email.trim().toLowerCase();
  if(!normalizedEmail||!password){setNotice("Entre ton e-mail et ton mot de passe.");return;}
  if(!/^\S+@\S+\.\S+$/.test(normalizedEmail)){setNotice("Entre une adresse e-mail valide.");return;}
  if(password.length<6){setNotice("Le mot de passe doit contenir au moins 6 caractères.");return;}
  setBusy(true);
  try{
   const result=authMode==="signup"
    ?await supabase.auth.signUp({email:normalizedEmail,password,options:{emailRedirectTo:window.location.origin}})
    :await supabase.auth.signInWithPassword({email:normalizedEmail,password});
   if(result.error){
    const message=result.error.message.toLowerCase();
    if(message.includes("email not confirmed")) setNotice("Ton e-mail n'est pas encore confirmé. Ouvre le message envoyé par Arthenis puis reconnecte-toi.");
    else if(message.includes("invalid login credentials")) setNotice("E-mail ou mot de passe incorrect.");
    else setNotice(result.error.message);
    return;
   }
   if(authMode==="signup"&&!result.data.session){
    setNotice("Compte créé. Un e-mail de confirmation peut être requis par Supabase. Vérifie ta boîte mail, puis clique sur « J'ai déjà un compte » pour te connecter. Tu peux fermer cette fenêtre et continuer à explorer Arthenis.");
    return;
   }
   setSessionEmail(result.data.user?.email??normalizedEmail);
   setAuthOpen(false);
   setNotice(authMode==="signup"?"Compte créé et connecté. Bienvenue dans Arthenis.":"Connexion réussie. Bienvenue dans Arthenis.");
   await loadWorlds();
  }catch(error){
   setNotice(error instanceof Error?error.message:"Une erreur est survenue pendant l'authentification. Réessaie.");
  }finally{setBusy(false);}
 }

 async function resetPassword(){
  setNotice("");
  const normalizedEmail=email.trim().toLowerCase();
  if(!/^\S+@\S+\.\S+$/.test(normalizedEmail)){setNotice("Entre ton e-mail pour recevoir le lien de réinitialisation.");return;}
  setBusy(true);
  try{
   const {error}=await supabase.auth.resetPasswordForEmail(normalizedEmail,{redirectTo:window.location.origin});
   setNotice(error?error.message:"Si ce compte existe, un lien de réinitialisation vient d'être envoyé à ton e-mail.");
  }catch(error){setNotice(error instanceof Error?error.message:"Impossible d'envoyer le lien de réinitialisation.");}
  finally{setBusy(false);}
 }

 async function createWorld(){
  if(!sessionEmail){setAuthOpen(true);setNotice("Connecte-toi pour créer et sauvegarder ton monde.");return;}
  if(!worldName.trim()){setNotice("Donne un nom à ton monde.");setStep(1);return;}
  setBusy(true);
  const {data:{user}}=await supabase.auth.getUser();
  if(!user){setBusy(false);setAuthOpen(true);return;}
  const payload={owner_id:user.id,name:worldName.trim(),description:"Monde créé avec Arthenis.",theme,magic_enabled:magic,fiction_enabled:fiction,fictional_creatures_enabled:fictionalCreatures,visual_bible:{theme,magic,fiction,fictionalCreatures},world_memory:{day:1}};
  const {data,error}=await supabase.from("worlds").insert(payload).select().single();
  setBusy(false);if(error){setNotice("Création impossible : "+error.message);return;}
  setWorld(data as World);setItems([]);setDay(1);setScreen("world");setNotice("✦ "+data.name+" est né et sauvegardé dans Arthenis.");
 }

 async function createItem(){
  if(!world){setNotice("Crée d'abord ton monde.");return;}
  const finalName=name.trim();if(!finalName){setNotice("Donne un nom à ton nouvel élément.");return;}
  if(kind==="Personnage"&&!allowNPC&&description.toLowerCase().includes("pnj")){setNotice("Les PNJ doivent être autorisés par le créateur.");return;}
  setBusy(true);setNotice("Arthenis vérifie la cohérence de ton idée…");
  const {data:rulesData,error:rulesError}=await supabase.from("world_rules").select("category,title,description,immutable").eq("world_id",world.id);
  if(rulesError){setBusy(false);setNotice("Impossible de charger les lois du monde. Réessaie.");return;}
  const context={name:world.name,theme:world.theme,fictionEnabled:world.fiction_enabled,fictionalCreaturesEnabled:world.fictional_creatures_enabled,magicEnabled:world.magic_enabled,rules:(rulesData||[]).map(r=>({title:r.title,description:r.description,immutable:r.immutable})),memory:{day},visualBible:world.visual_bible};
  let coherence:any;
  try{
   const res=await fetch("/api/coherence",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({context,proposal:{type:kind,name:finalName,description}})});
   const payload=await res.json().catch(()=>null);
   if(!res.ok){setBusy(false);setNotice(payload?.error||"Le moteur de cohérence est indisponible. Réessaie.");return;}
   coherence=payload;
  }catch{setBusy(false);setNotice("Impossible de vérifier la cohérence du monde. Vérifie ta connexion et réessaie.");return;}
  if(coherence?.decision==="reject"){setBusy(false);setNotice("✦ Idée refusée : "+(coherence.reason||"elle contredit les règles du monde."));return;}
  const text=description.trim()||"Élément créé par le créateur.";
  const x=12+((Date.now()*37)%72),y=14+((Date.now()*23)%68);
  let table="",row:any={},descKey="description";
  if(kind==="Région"){table="regions";row={world_id:world.id,name:finalName,description:text,x,y,biome:"custom",generation_status:"ready"};}
  else if(kind==="Civilisation"){table="civilizations";row={world_id:world.id,name:finalName,description:text};}
  else if(kind==="Village"){table="civilizations";row={world_id:world.id,name:finalName,description:text,culture:"Village"};}
  else if(kind==="Personnage"){table="characters";row={world_id:world.id,name:finalName,biography:text,ai_can_evolve:true};descKey="biography";}
  else if(kind==="Créature"){table="creatures";row={world_id:world.id,name:finalName,classification:"Créature",fictional:world.fictional_creatures_enabled,description:text};}
  else {table="timeline_events";row={world_id:world.id,title:finalName,description:text,world_day:day};}
  const {data,error}=await supabase.from(table).insert(row).select().single();
  if(error){setBusy(false);setNotice("Création impossible : "+error.message);return;}
  const item:Item={id:data.id,kind,name:finalName,description:text,day,x,y,imageUrl:null};
  setItems(cur=>[...cur,item]);setSelected(item);setName("");setDescription("");setTab("Carte");setNotice("✦ "+finalName+" est maintenant inscrit dans l'histoire. Génération visuelle en cours…");
  try{
   const res=await fetch("/api/generate-image",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({context,entity:{type:kind,name:finalName,description:text}})});
   const imagePayload=await res.json().catch(()=>null);
   if(!res.ok){setNotice("✦ "+finalName+" est créé, mais le visuel n'a pas pu être généré. Tu peux réessayer plus tard.");}
   else {
    const source=imagePayload?.imageData||imagePayload?.imageUrl;
    if(source){
     const blob=await (await fetch(source)).blob();
     const path=world.id+"/"+table+"/"+data.id+".png";
     const upload=await supabase.storage.from("arthenis-assets").upload(path,blob,{contentType:blob.type||"image/png",upsert:true});
     if(!upload.error){const {data:signed}=await supabase.storage.from("arthenis-assets").createSignedUrl(path,60*60*24*365);const url=signed?.signedUrl||null;await supabase.from(table).update({image_url:url}).eq("id",data.id);setItems(cur=>cur.map(v=>v.id===data.id?{...v,imageUrl:url}:v));setSelected(cur=>cur?.id===data.id?{...cur,imageUrl:url}:cur);setNotice("✦ "+finalName+" a été généré et sauvegardé visuellement.");}
     else setNotice("✦ "+finalName+" est créé, mais l'image n'a pas pu être sauvegardée.");
    } else setNotice("✦ "+finalName+" est créé, mais le moteur d'image n'a retourné aucun visuel.");
   }
  }catch{setNotice("✦ "+finalName+" est créé. Le visuel pourra être régénéré dès que le moteur d'image est disponible.");}
  setBusy(false);
 }

 async function advance(){
  if(!world)return;const next=day+1;setDay(next);await supabase.from("worlds").update({world_memory:{...(world as any).world_memory,day:next}}).eq("id",world.id);setNotice("Jour "+next+" — le monde continue d'évoluer.");
 }
 const title=worldName||"MONDE SANS NOM";const timeline=useMemo(()=>[...items].sort((a,b)=>a.day-b.day),[items]);

 if(!ready)return <main className="landing"><section className="hero"><p className="eyebrow">✦ ARTHENIS</p><h1>Chargement du monde…</h1></section></main>;

 if(screen==="home")return <main className="landing"><section className="hero"><p className="eyebrow">✦ ARTHENIS · WHERE WORLDS ARE BORN</p><h1>Crée un monde.<br/>Observe ses conséquences.</h1><p>Arthenis transforme tes idées en un univers cohérent, vivant et persistant.</p><div className="heroActions"><button className="primary" onClick={()=>setScreen("create")}>▶ Créer un monde</button><button onClick={()=>world?setScreen("world"):setAuthOpen(true)}>{world?"Continuer mon monde":"Se connecter"}</button></div>{sessionEmail&&<div className="accountBar"><small>Connecté : {sessionEmail}</small><button onClick={async()=>{await supabase.auth.signOut();setSessionEmail(null);setWorld(null);setItems([]);setScreen("home");setNotice("Tu es déconnecté.");}}>Se déconnecter</button></div>}</section>{authOpen&&<AuthModal authMode={authMode} email={email} password={password} busy={busy} notice={notice} onClose={()=>setAuthOpen(false)} onEmailChange={setEmail} onPasswordChange={setPassword} onAuthenticate={authenticate} onResetPassword={resetPassword} onToggleMode={()=>setAuthMode(v=>v==="signin"?"signup":"signin")}/>}</main>;

 if(screen==="create")return <main className="creator"><header className="creatorTop"><b>✦ ARTHENIS</b><span>CRÉATION DU MONDE · ÉTAPE {step}/3</span></header><div className="stepDots"><i className={step>=1?"on":""}/><i className={step>=2?"on":""}/><i className={step>=3?"on":""}/></div>
 {step===1&&<section className="createCard"><p className="panelTag">IDENTITÉ</p><h1>Comment s'appelle ton monde ?</h1><input autoFocus value={worldName} onChange={e=>setWorldName(e.target.value)} placeholder="Ex. Valdoria"/><button className="primary" onClick={()=>setStep(2)}>Continuer →</button></section>}
 {step===2&&<section className="createCard"><p className="panelTag">RÈGLES FONDAMENTALES</p><h1>Quelle est la nature de ce monde ?</h1><select value={theme} onChange={e=>setTheme(e.target.value)}><option>Fantasy</option><option>Médiéval</option><option>Science-fiction</option><option>Historique</option><option>Contemporain</option></select><label className="toggle"><input type="checkbox" checked={fiction} onChange={e=>setFiction(e.target.checked)}/> Autoriser la fiction</label><label className="toggle"><input type="checkbox" checked={fictionalCreatures} onChange={e=>setFictionalCreatures(e.target.checked)}/> Autoriser les créatures fictives</label><label className="toggle"><input type="checkbox" checked={magic} onChange={e=>setMagic(e.target.checked)}/> Autoriser la magie</label><div className="heroActions"><button onClick={()=>setStep(1)}>← Retour</button><button className="primary" onClick={()=>setStep(3)}>Continuer →</button></div></section>}
 {step===3&&<section className="createCard"><p className="panelTag">NAISSANCE</p><h1>{title} est prêt à naître.</h1><p>Arthenis créera une mémoire, des règles et une base persistante pour ton monde.</p><div className="heroActions"><button onClick={()=>setStep(2)}>← Retour</button><button className="primary" disabled={busy} onClick={createWorld}>{busy?"Création…":"Découvrir le monde →"}</button></div>{notice&&<p>{notice}</p>}</section>}{authOpen&&<AuthModal authMode={authMode} email={email} password={password} busy={busy} notice={notice} onClose={()=>setAuthOpen(false)} onEmailChange={setEmail} onPasswordChange={setPassword} onAuthenticate={authenticate} onToggleMode={()=>setAuthMode(v=>v==="signin"?"signup":"signin")}/>}</main>;

 return <main className="game arthenisFinal" onContextMenu={e=>e.preventDefault()}>
 <header className="finalTopbar"><button className="finalBrand" onClick={()=>setScreen("home")}><span>✧</span><div><strong>ARTHENIS</strong><small>WHERE WORLDS ARE BORN</small></div></button><nav className="finalNav">{[["Carte","◈"],["Ajouter","♙"],["Civilisations","♜"],["Événements","▣"],["Chronologie","⌛"]].map(([entry,icon])=><button key={entry} className={tab===entry?"selected":""} onClick={()=>{if(entry==="Civilisations"){setKind("Civilisation");setTab("Ajouter")}else if(entry==="Événements"){setKind("Influence");setTab("Ajouter")}else setTab(entry)}}><i>{icon}</i><span>{entry}</span></button>)}</nav><button className="saveButton" onClick={()=>world&&loadItems(world.id)}>▣ Synchroniser</button><button className="creatorAvatar" onClick={()=>{if(sessionEmail){supabase.auth.signOut();setScreen("home")}else setAuthOpen(true)}}>{sessionEmail?"K":"?"}</button></header>
 {notice&&<div className="toast finalToast">{notice}<button onClick={()=>setNotice("")}>×</button></div>}
 <section className="finalLayout"><aside className="finalLeft"><div className="glassPanel addPanel"><div className="panelHeader"><h3>Ajouter un élément</h3><button>×</button></div>{(["Région","Civilisation","Village","Personnage","Créature","Influence"] as Kind[]).map(entry=><button className={"addChoice "+(kind===entry&&tab==="Ajouter"?"chosen":"")} key={entry} onClick={()=>{setKind(entry);setTab("Ajouter")}}><b>{iconFor(entry)}</b><span><strong>{entry}</strong><small>Créer dans le monde</small></span></button>)}</div><div className="glassPanel mapTools"><div className="panelHeader"><h3>Outils de carte</h3></div><label className="zoomLine">Zoom <button onClick={()=>setZoom(v=>Math.max(.65,v-.2))}>−</button><input type="range" min=".65" max="2.5" step=".05" value={zoom} onChange={e=>setZoom(Number(e.target.value))}/><button onClick={()=>setZoom(v=>Math.min(2.5,v+.2))}>＋</button></label></div></aside>
 <section className="finalCenter"><div className="worldMapFrame"><div className="worldMap" onPointerDown={e=>setDrag({x:e.clientX,y:e.clientY})} onPointerMove={e=>{if(!drag)return;setPan(v=>({x:v.x+e.clientX-drag.x,y:v.y+e.clientY-drag.y}));setDrag({x:e.clientX,y:e.clientY})}} onPointerUp={()=>setDrag(null)} onPointerLeave={()=>setDrag(null)}><div className="mapViewport cinematicViewport" style={{transform:"translate("+pan.x+"px,"+pan.y+"px) scale("+zoom+")"}}><div className="fantasyTerrain"><div className="terrainIce"/><div className="terrainForest"/><div className="terrainSea"/><div className="terrainDesert"/><div className="terrainVolcano"/><div className="terrainMarsh"/><div className="terrainCastle"/></div>{items.map(item=>{const visual=visualFor(item);return <button key={item.id} className={"marker finalMarker marker"+item.kind} style={{left:item.x+"%",top:item.y+"%"}} onClick={()=>setSelected(item)}><div className={"worldTile tile-"+visual} style={item.imageUrl?{backgroundImage:"url("+item.imageUrl+")",backgroundSize:"cover",backgroundPosition:"center"}:undefined}><div className="tileSky"/><div className="tileScene"/></div><span className="markerLabel">{item.name}</span></button>})}</div>{!items.length&&<div className="cinematicEmpty"><span>✧</span><b>TON MONDE ATTEND SA PREMIÈRE IDÉE</b><small>Chaque élément créé est sauvegardé et devient une partie réelle du monde.</small></div>}{selected&&<div className="entityInspector finalInspector"><button className="closeInspect" onClick={()=>setSelected(null)}>×</button><div className="inspectIcon">{iconFor(selected.kind)}</div><small>ÉLÉMENT DU MONDE</small><b>{selected.name}</b><p>{selected.description}</p>{selected.imageUrl&&<img src={selected.imageUrl} alt={selected.name}/>}<button onClick={()=>setTab("Chronologie")}>Voir dans l'histoire →</button></div>}</div></div><div className="worldQuote">« Chaque idée façonne un monde. »</div></section>
 <aside className="finalRight"><div className="glassPanel currentWorld"><div className="panelHeader"><h3>Monde actuel</h3></div><div className="worldPreview"/><h2>{title}</h2><dl><div><dt>Thème :</dt><dd>{theme}</dd></div><div><dt>Éléments :</dt><dd>{items.length}</dd></div><div><dt>Statut :</dt><dd className="online">● Synchronisé</dd></div></dl></div><div className="glassPanel chronoCard"><div className="panelHeader"><h3>Chronologie</h3></div><b>Jour {day}</b><div className="chronoList">{timeline.slice(-4).map(item=><p key={item.id}><span>{iconFor(item.kind)}</span>{item.name}<small>Jour {item.day}</small></p>)}</div></div></aside></section>
 <footer className="finalFooter"><button onClick={()=>setTab("Ajouter")}>✧ <span>CRÉER</span><small>Ajouter au monde</small></button><button onClick={()=>{setKind("Civilisation");setTab("Ajouter")}}>◆ <span>DONNER VIE</span><small>Ajouter une civilisation</small></button><button onClick={()=>setTab("Chronologie")}>⌛ <span>HISTOIRE</span><small>Voir la chronologie</small></button><button onClick={advance}>✦ <span>FAÇONNER LE MONDE</span><small>Avancer dans le temps</small></button><div className="footerMark">✧ ARTHENIS</div></footer>
 {tab==="Ajouter"&&<div className="commandOverlay" onClick={()=>setTab("Carte")}><section className="commandModal" onClick={e=>e.stopPropagation()}><div className="panelHeader"><div><p className="panelTag">COMMANDE DU CRÉATEUR</p><h2>Ajouter au monde</h2></div><button onClick={()=>setTab("Carte")}>×</button></div><p className="panelSub">Arthenis vérifie la cohérence puis inscrit ton idée dans la mémoire du monde.</p><div className="quickAdd">{(["Région","Civilisation","Village","Personnage","Influence"] as Kind[]).map(entry=><button key={entry} className={kind===entry?"active":""} onClick={()=>setKind(entry)}>{iconFor(entry)} {entry}</button>)}</div><input value={name} onChange={e=>setName(e.target.value)} placeholder={"Nom de "+kind.toLowerCase()}/><textarea value={description} onChange={e=>setDescription(e.target.value)} placeholder="Décris précisément ce qui doit apparaître dans le monde..."/>{kind==="Personnage"&&<label className="toggle"><input type="checkbox" checked={allowNPC} onChange={e=>setAllowNPC(e.target.checked)}/> Autoriser les PNJ</label>}<button className="primary createNow" disabled={busy} onClick={createItem}>{busy?"Arthenis travaille…":"Créer, valider et visualiser →"}</button></section></div>}
 {tab==="Chronologie"&&<div className="commandOverlay" onClick={()=>setTab("Carte")}><section className="commandModal chronoModal" onClick={e=>e.stopPropagation()}><div className="panelHeader"><div><p className="panelTag">HISTOIRE PERMANENTE</p><h2>Chronologie</h2></div><button onClick={()=>setTab("Carte")}>×</button></div><div className="timeline">{timeline.map(item=><div className="timelineItem" key={item.id}><b>JOUR {item.day}</b><p>{iconFor(item.kind)} {item.name}</p><span>{item.description}</span></div>)}{!timeline.length&&<div className="emptyPanel">Le monde vient de naître. Son histoire attend ton premier choix.</div>}</div></section></div>}
 {authOpen&&<AuthModal authMode={authMode} email={email} password={password} busy={busy} notice={notice} onClose={()=>setAuthOpen(false)} onEmailChange={setEmail} onPasswordChange={setPassword} onAuthenticate={authenticate} onToggleMode={()=>setAuthMode(v=>v==="signin"?"signup":"signin")}/>}
 </main>;

}