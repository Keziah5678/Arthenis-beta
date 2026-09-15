import fs from "node:fs";

const path = "app/page.tsx";
let s = fs.readFileSync(path, "utf8");

const replace = (from, to, label) => {
  if (!s.includes(from)) throw new Error(`Patch target not found: ${label}`);
  s = s.replace(from, to);
};

replace(
  'type Kind = "Région" | "Civilisation" | "Village" | "Personnage" | "Influence";',
  'type Kind = "Région" | "Civilisation" | "Village" | "Personnage" | "Créature" | "Influence";',
  "Kind"
);
replace(
  'const iconFor=(kind:Kind)=>kind==="Région"?"⌁":kind==="Civilisation"?"♜":kind==="Village"?"⌂":kind==="Personnage"?"♙":"✦";',
  'const iconFor=(kind:Kind)=>kind==="Région"?"⌁":kind==="Civilisation"?"♜":kind==="Village"?"⌂":kind==="Personnage"?"♙":kind==="Créature"?"◈":"✦";',
  "iconFor"
);
replace('if(item.kind==="Personnage")return "character";', 'if(item.kind==="Personnage")return "character";\n if(item.kind==="Créature")return "creature";', "visualFor creature");
replace('...map(p.data||[],"Personnage","description",43)', '...map(p.data||[],"Créature","description",43)', "load creatures");

const oldModal = `type AuthModalProps = {
 authMode: "signin" | "signup";
 email: string;
 password: string;
 busy: boolean;
 notice: string;
 onClose: () => void;
 onEmailChange: (value: string) => void;
 onPasswordChange: (value: string) => void;
 onAuthenticate: () => void;
 onToggleMode: () => void;
};

function AuthModal({authMode,email,password,busy,notice,onClose,onEmailChange,onPasswordChange,onAuthenticate,onToggleMode}: AuthModalProps){
 return <div className="commandOverlay">
  <section className="commandModal">
   <div className="panelHeader">
    <div><p className="panelTag">ARTHENIS ACCOUNT</p><h2>{authMode==="signin"?"Connexion":"Créer un compte"}</h2></div>
    <button onClick={onClose}>×</button>
   </div>
   <input type="email" value={email} onChange={e=>onEmailChange(e.target.value)} placeholder="E-mail"/>
   <input type="password" value={password} onChange={e=>onPasswordChange(e.target.value)} placeholder="Mot de passe (6 caractères minimum)"/>
   <button className="primary createNow" disabled={busy} onClick={onAuthenticate}>{busy?"Patiente…":authMode==="signin"?"Se connecter":"Créer mon compte"}</button>
   {notice&&<p className="authNotice">{notice}</p>}<button onClick={onToggleMode}>{authMode==="signin"?"Créer un compte":"J'ai déjà un compte"}</button>
  </section>
 </div>;
}`;
const newModal = `type AuthModalProps = {
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
}`;
replace(oldModal, newModal, "AuthModal");

const oldAuth = ` async function authenticate(){
  setNotice("");
  if(!supabaseConfigured){setNotice(getSupabaseConfigurationError()||"Supabase n'est pas configuré.");return;}
  if(!email.trim()||!password){setNotice("Entre ton e-mail et ton mot de passe.");return;}
  if(authMode==="signup"&&password.length<6){setNotice("Le mot de passe doit contenir au moins 6 caractères.");return;}
  setBusy(true);
  try{
   const result=authMode==="signup"
    ?await supabase.auth.signUp({email:email.trim(),password})
    :await supabase.auth.signInWithPassword({email:email.trim(),password});
   if(result.error){setNotice(result.error.message);return;}
   setAuthOpen(false);
   setNotice(authMode==="signup"
    ?"Compte créé. Vérifie ton e-mail si une confirmation est demandée, puis reconnecte-toi."
    :"Connexion réussie.");
  }catch(error){
   setNotice(error instanceof Error?error.message:"Une erreur est survenue pendant l'authentification.");
  }finally{setBusy(false);}
 }`;
const newAuth = ` async function authenticate(){
  setNotice("");
  if(!supabaseConfigured){setNotice(getSupabaseConfigurationError()||"Supabase n'est pas configuré.");return;}
  const normalizedEmail=email.trim().toLowerCase();
  if(!normalizedEmail||!password){setNotice("Entre ton e-mail et ton mot de passe.");return;}
  if(!/^\\S+@\\S+\\.\\S+$/.test(normalizedEmail)){setNotice("Entre une adresse e-mail valide.");return;}
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
  if(!/^\\S+@\\S+\\.\\S+$/.test(normalizedEmail)){setNotice("Entre ton e-mail pour recevoir le lien de réinitialisation.");return;}
  setBusy(true);
  try{
   const {error}=await supabase.auth.resetPasswordForEmail(normalizedEmail,{redirectTo:window.location.origin});
   setNotice(error?error.message:"Si ce compte existe, un lien de réinitialisation vient d'être envoyé à ton e-mail.");
  }catch(error){setNotice(error instanceof Error?error.message:"Impossible d'envoyer le lien de réinitialisation.");}
  finally{setBusy(false);}
 }`;
replace(oldAuth, newAuth, "authenticate");

const oldCoh = `  const context={name:world.name,theme:world.theme,fictionEnabled:world.fiction_enabled,fictionalCreaturesEnabled:world.fictional_creatures_enabled,magicEnabled:world.magic_enabled,rules:[],memory:{day},visualBible:world.visual_bible};
  let coherence:any={decision:"accept",reason:"Validation locale"};
  try{const res=await fetch("/api/coherence",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({context,proposal:{type:kind,name:finalName,description}})});if(res.ok)coherence=await res.json();}catch{}
  if(coherence.decision==="reject"){setBusy(false);setNotice("✦ Idée refusée : "+(coherence.reason||"elle contredit les règles du monde."));return;}`;
const newCoh = `  const {data:rulesData,error:rulesError}=await supabase.from("world_rules").select("category,title,description,immutable").eq("world_id",world.id);
  if(rulesError){setBusy(false);setNotice("Impossible de charger les lois du monde. Réessaie.");return;}
  const context={name:world.name,theme:world.theme,fictionEnabled:world.fiction_enabled,fictionalCreaturesEnabled:world.fictional_creatures_enabled,magicEnabled:world.magic_enabled,rules:(rulesData||[]).map(r=>({title:r.title,description:r.description,immutable:r.immutable})),memory:{day},visualBible:world.visual_bible};
  let coherence:any;
  try{
   const res=await fetch("/api/coherence",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({context,proposal:{type:kind,name:finalName,description}})});
   const payload=await res.json().catch(()=>null);
   if(!res.ok){setBusy(false);setNotice(payload?.error||"Le moteur de cohérence est indisponible. Réessaie.");return;}
   coherence=payload;
  }catch{setBusy(false);setNotice("Impossible de vérifier la cohérence du monde. Vérifie ta connexion et réessaie.");return;}
  if(coherence?.decision==="reject"){setBusy(false);setNotice("✦ Idée refusée : "+(coherence.reason||"elle contredit les règles du monde."));return;}`;
replace(oldCoh, newCoh, "coherence");

replace(
  `  else if(kind==="Personnage"){table="characters";row={world_id:world.id,name:finalName,biography:text,ai_can_evolve:true};descKey="biography";}
  else {table="timeline_events";row={world_id:world.id,title:finalName,description:text,world_day:day};}`,
  `  else if(kind==="Personnage"){table="characters";row={world_id:world.id,name:finalName,biography:text,ai_can_evolve:true};descKey="biography";}
  else if(kind==="Créature"){table="creatures";row={world_id:world.id,name:finalName,classification:"Créature",fictional:world.fictional_creatures_enabled,description:text};}
  else {table="timeline_events";row={world_id:world.id,title:finalName,description:text,world_day:day};}`,
  "creature persistence"
);

const oldImg = `   if(res.ok){const img=await res.json();const dataUrl=img.imageData;if(dataUrl){const blob=await (await fetch(dataUrl)).blob();const path=world.id+"/"+table+"/"+data.id+".png";const upload=await supabase.storage.from("arthenis-assets").upload(path,blob,{contentType:"image/png",upsert:true});if(!upload.error){const {data:signed}=await supabase.storage.from("arthenis-assets").createSignedUrl(path,60*60*24*365);const url=signed?.signedUrl||null;const updateField=table==="regions"?"image_url":"image_url";await supabase.from(table).update({[updateField]:url}).eq("id",data.id);setItems(cur=>cur.map(v=>v.id===data.id?{...v,imageUrl:url}:v));setSelected(cur=>cur?.id===data.id?{...v,imageUrl:url}:cur);setNotice("✦ "+finalName+" a été généré et sauvegardé visuellement.");}}}`;
// The current code has a slightly different selected-state expression; patch using a broader exact block instead.
const imgMarker = `   if(res.ok){const img=await res.json();const dataUrl=img.imageData;if(dataUrl){const blob=await (await fetch(dataUrl)).blob();const path=world.id+"/"+table+"/"+data.id+".png";const upload=await supabase.storage.from("arthenis-assets").upload(path,blob,{contentType:"image/png",upsert:true});if(!upload.error){const {data:signed}=await supabase.storage.from("arthenis-assets").createSignedUrl(path,60*60*24*365);const url=signed?.signedUrl||null;const updateField=table==="regions"?"image_url":"image_url";await supabase.from(table).update({[updateField]:url}).eq("id",data.id);setItems(cur=>cur.map(v=>v.id===data.id?{...v,imageUrl:url}:v));setSelected(cur=>cur?.id===data.id?{...cur,imageUrl:url}:cur);setNotice("✦ "+finalName+" a été généré et sauvegardé visuellement.");}}}`;
const imgReplacement = `   const imagePayload=await res.json().catch(()=>null);
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
   }`;
replace(imgMarker, imgReplacement, "image handling");
replace('onAuthenticate={authenticate} onToggleMode=', 'onAuthenticate={authenticate} onResetPassword={resetPassword} onToggleMode=', "reset callback");
replace('{sessionEmail&&<small>Connecté : {sessionEmail}</small>}', '{sessionEmail&&<div className="accountBar"><small>Connecté : {sessionEmail}</small><button onClick={async()=>{await supabase.auth.signOut();setSessionEmail(null);setWorld(null);setItems([]);setScreen("home");setNotice("Tu es déconnecté.");}}>Se déconnecter</button></div>}', "sign out");

fs.writeFileSync(path, s);
console.log("Arthenis stabilization patch applied.");
