"use client";

import { useEffect, useState } from "react";
import { supabase, supabaseConfigured, getSupabaseConfigurationError } from "../lib/supabase/client";
import { AERION_WORLD, AERION_ITEMS, AERION_EVENTS, AERION_RULES, AERION_DAY } from "../lib/demo/aerion";
import { DEMO_COMMUNITY_WORLDS } from "../lib/demo/community";
import { IMAGE_CATEGORIES, IMAGE_STYLES, IMAGE_FRAMINGS, IMAGE_DETAILS, categoryForKind, type ImageCategory, type ImageOptions, type ImageEntity } from "../lib/ai/images";
import { artFor, variantFilter } from "./art";
import WorldMap from "./WorldMap";

type Kind = "Région" | "Civilisation" | "Village" | "Personnage" | "Créature" | "Influence";
type World = { id:string; owner_id:string; name:string; description:string; theme:string; magic_enabled:boolean; fiction_enabled:boolean; fictional_creatures_enabled:boolean; visual_bible?:Record<string,unknown>; world_memory?:Record<string,unknown>; is_public?:boolean };
type Item = { id:string; kind:Kind; name:string; description:string; day:number; x:number; y:number; imageUrl?:string|null };
type Rule = { id:string; category:string; title:string; description:string; immutable:boolean };
type Member = { id:string; user_id:string; role:string; permissions:Record<string,unknown> };
type Tab = "overview"|"map"|"habitants"|"lieux"|"galerie"|"create"|"notifications"|"profile"|"explore";
type StudioTarget = { scope:"entity"|"cover"|"map"; entity:ImageEntity; item?:Item };
type GalleryItem = { id:string; entity_type:string; image_url:string; entity_name?:string };
type CommunityCard = { id:string; name:string; description:string; theme:string; creatorHandle:string; likeCount:number; liked:boolean; following:boolean; coverImageUrl?:string|null; isDemo:boolean; raw?:World };

const kinds:Kind[]=["Région","Civilisation","Village","Personnage","Créature","Influence"];
const icon=(k:Kind)=>({Région:"⌁",Civilisation:"♜",Village:"⌂",Personnage:"♙",Créature:"◈",Influence:"✦"}[k]);
const ROLE_OPTIONS=["Roi","Reine","Chevalier","Guerrier","Mage","Marchand","Fermier","Forgeron","Explorateur","Diplomate","Pirate","Chef de village","Érudit"];
const PROFESSION_OPTIONS=["Mercenaire","Artisan","Soldat","Contrebandier","Marin","Alchimiste","Chasseur","Scribe"];
const magicLabel=(v:number)=>v<=0?"Aucune":v<34?"Faible":v<67?"Moyenne":v<90?"Forte":"Extrême";
// The declared theme decides the artwork; the description only breaks ties.
// Reading them as one string let a science-fiction world whose blurb mentions
// a collapse be painted as a volcano.
const themeVisual=(theme:string,description:string="")=>{
 const th=(theme||"").toLowerCase(), d=(description||"").toLowerCase();
 const pick=(t:string)=>{
  if(/science|futur|cyber|techno|spatial/.test(t))return "city";
  if(/post-apo|effondr|ruine|apocalyp/.test(t))return "volcano";
  if(/volcan|infernal|feu/.test(t))return "volcano";
  if(/glace|arctique|nord|neige|givre/.test(t))return "ice";
  if(/désert|desert|sable|dune/.test(t))return "desert";
  if(/océan|ocean|marine|île|ile|maritime/.test(t))return "ocean";
  if(/urbain|cité|cite|ville|moderne/.test(t))return "city";
  if(/forêt|foret|nature|sylv|jungle/.test(t))return "forest";
  if(/médiéval|medieval|fantasy|fantastique|royaume/.test(t))return "mountain";
  return "";
 };
 return pick(th)||pick(d)||"forest";
};
const translateAuthError=(msg:string)=>{const m=msg.toLowerCase();if(m.includes("already registered")||m.includes("already exists"))return "Un compte existe déjà avec cet e-mail. Essaie de te connecter.";if(m.includes("invalid login credentials"))return "E-mail ou mot de passe incorrect.";if(m.includes("email not confirmed"))return "Ton e-mail n'est pas encore confirmé. Vérifie ta boîte de réception (et tes spams).";if(m.includes("rate limit")||m.includes("too many requests")||m.includes("email rate limit"))return "Trop de tentatives — réessaie dans quelques minutes.";if(m.includes("password should be at least")||m.includes("password is too short"))return "Le mot de passe doit contenir au moins 6 caractères.";if(m.includes("user not found"))return "Aucun compte trouvé avec cet e-mail.";return msg;};
const visual=(i:Item)=>{const t=(i.name+" "+i.description).toLowerCase();if(i.kind==="Personnage")return "character";if(i.kind==="Créature")return "creature";if(i.kind==="Civilisation")return /futur|cyber|techno|spatial|gratte-ciel|tour-cit|néon|neon/.test(t)?"city":"village";if(i.kind==="Village")return /port|côte|cote|mer|rivage|pêche|peche|île|ile/.test(t)?"ocean":"village";if(i.kind==="Influence")return "relic";if(/glace|neige|arct|froid|gel/.test(t))return "ice";if(/forêt|foret|jungle|bois/.test(t))return "forest";if(/désert|desert|sable|dune/.test(t))return "desert";if(/volcan|lave|magma|feu/.test(t))return "volcano";if(/océan|ocean|mer|île|ile|rivage/.test(t))return "ocean";return "mountain"};
function Tile({kind,seed}:{kind:string;seed?:string}){return <img className="worldTile" src={artFor(kind)} alt="" loading="lazy" style={seed?{filter:variantFilter(seed)}:undefined}/>}
function EntityVisual({item}:{item:Item}){
 if(item.imageUrl)return <img className="worldTile" src={item.imageUrl} alt=""/>;
 return <span className="visualWrap"><Tile kind={visual(item)} seed={item.id+item.name}/><span className="provisional">Illustration provisoire</span></span>;
}
function Auth({mode,email,password,busy,notice,setEmail,setPassword,auth,reset,toggle,close}:{mode:"signin"|"signup";email:string;password:string;busy:boolean;notice:string;setEmail:(v:string)=>void;setPassword:(v:string)=>void;auth:()=>void;reset:()=>void;toggle:()=>void;close:()=>void}){return <div className="commandOverlay"><section className="commandModal"><div className="panelHeader"><div><p className="panelTag">ARTHENIS ACCOUNT</p><h2>{mode==="signin"?"Connexion":"Créer un compte"}</h2></div><button onClick={close}>×</button></div><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="E-mail" autoComplete="email"/><input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Mot de passe (6 caractères minimum)" autoComplete={mode==="signin"?"current-password":"new-password"}/><button className="primary" disabled={busy} onClick={auth}>{busy?"Patiente…":mode==="signin"?"Se connecter":"Créer mon compte"}</button>{mode==="signin"&&<button disabled={busy} onClick={reset}>Mot de passe oublié ?</button>}{notice&&<p className="authNotice">{notice}</p>}<button disabled={busy} onClick={toggle}>{mode==="signin"?"Créer un compte":"J'ai déjà un compte"}</button></section></div>}

export default function ArthenisApp(){
 const [ready,setReady]=useState(false),[session,setSession]=useState<any>(null),[authOpen,setAuthOpen]=useState(false),[authMode,setAuthMode]=useState<"signin"|"signup">("signin"),[email,setEmail]=useState(""),[password,setPassword]=useState("");
 const [worlds,setWorlds]=useState<World[]>([]),[world,setWorld]=useState<World|null>(null),[screen,setScreen]=useState<"home"|"create"|"world">("home"),[step,setStep]=useState(1),[worldName,setWorldName]=useState(""),[theme,setTheme]=useState("Fantasy"),[magic,setMagic]=useState(true),[fiction,setFiction]=useState(true),[fictionalCreatures,setFictionalCreatures]=useState(true);
 const [tab,setTab]=useState<Tab>("overview"),[items,setItems]=useState<Item[]>([]),[events,setEvents]=useState<any[]>([]),[rules,setRules]=useState<Rule[]>([]),[members,setMembers]=useState<Member[]>([]),[day,setDay]=useState(1),[busy,setBusy]=useState(false),[notice,setNotice]=useState(""),[selected,setSelected]=useState<Item|null>(null);
 const [name,setName]=useState(""),[description,setDescription]=useState(""),[kind,setKind]=useState<Kind>("Région"),[role,setRole]=useState(""),[profession,setProfession]=useState(""),[magicLevel,setMagicLevel]=useState("0"),[aiEvolve,setAiEvolve]=useState(true),[composerPortrait,setComposerPortrait]=useState<string|null>(null),[portraitBusy,setPortraitBusy]=useState(false),[memberId,setMemberId]=useState(""),[memberRole,setMemberRole]=useState("viewer"),[drafts,setDrafts]=useState<Record<string,{title:string;description:string}>>({}),[editingRuleId,setEditingRuleId]=useState<string|null>(null),[editingDescription,setEditingDescription]=useState(false),[descDraft,setDescDraft]=useState("");
 const [isPublic,setIsPublic]=useState(false);
 const [exploreSubTab,setExploreSubTab]=useState<"decouvrir"|"mesmondes"|"suivis">("decouvrir"),[exploreQuery,setExploreQuery]=useState(""),[communityCards,setCommunityCards]=useState<CommunityCard[]>([]),[followedCards,setFollowedCards]=useState<CommunityCard[]>([]),[communityLoading,setCommunityLoading]=useState(false),[demoLiked,setDemoLiked]=useState<Set<string>>(new Set()),[demoFollowed,setDemoFollowed]=useState<Set<string>>(new Set());
 const [studio,setStudio]=useState<StudioTarget|null>(null),[studioOptions,setStudioOptions]=useState<ImageOptions>({}),[studioBusy,setStudioBusy]=useState(false),[studioResult,setStudioResult]=useState<string|null>(null),[studioError,setStudioError]=useState<string|null>(null),[studioSaving,setStudioSaving]=useState(false),[gallery,setGallery]=useState<GalleryItem[]>([]);
 const [assistantOpen,setAssistantOpen]=useState(false),[chatMessages,setChatMessages]=useState<{role:"user"|"assistant";text:string}[]>([]),[chatInput,setChatInput]=useState(""),[chatBusy,setChatBusy]=useState(false);
 const [demoMode,setDemoMode]=useState(false);
 const [diag,setDiag]=useState<{build?:any;models?:any;features?:any;openai?:{ok:boolean;detail:string}}|null>(null),[diagBusy,setDiagBusy]=useState(false);
 function startDemo(){
  setDemoMode(true);
  setWorld(AERION_WORLD);
  setItems(AERION_ITEMS.map(i=>({...i})));
  setEvents(AERION_EVENTS.map(e=>({...e})));
  const rules=AERION_RULES.map(r=>({...r}));
  setRules(rules);
  setDrafts(Object.fromEntries(rules.map(r=>[r.id,{title:r.title,description:r.description}])));
  setMembers([]);
  setGallery([]);
  setDay(AERION_DAY);
  setSelected(null);
  setTab("overview");
  setScreen("world");
  setNotice("✦ Bienvenue dans Aerion — mode démo, aucune donnée n'est persistée.");
  ensureWorldVisuals(AERION_WORLD,true);
 }
 function exitDemo(){
  setDemoMode(false);
  setWorld(null);setItems([]);setEvents([]);setRules([]);setMembers([]);setDrafts({});setGallery([]);setStudio(null);
  setScreen("home");
  setNotice("");
  setChatMessages([]);setAssistantOpen(false);
 }
 async function ensureWorldVisuals(w:World,isDemo:boolean):Promise<string|null>{
  const vb:Record<string,unknown>={...(w.visual_bible||{})};
  const needCover=!vb.coverImageUrl,needMap=!vb.mapImageUrl;
  if(!needCover&&!needMap)return null;
  const context={name:w.name,theme:w.theme,fictionEnabled:w.fiction_enabled,fictionalCreaturesEnabled:w.fictional_creatures_enabled,magicEnabled:w.magic_enabled,rules:[],memory:{},visualBible:vb};
  let failure:string|null=null;
  const jobs:Promise<void>[]=[];
  if(needCover)jobs.push((async()=>{try{const r=await fetch("/api/generate-image",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({context,entity:{type:"Couverture de monde",name:w.name,description:w.description||`Vue cinématique et panoramique du monde ${w.name}, illustration numérique premium.`}})});const p=await r.json().catch(()=>null);const src=p?.imageData||p?.imageUrl;if(r.ok&&typeof src==="string")vb.coverImageUrl=src;else failure=failure||p?.detail||"raison inconnue.";}catch{failure=failure||"le serveur n'a pas répondu.";}})());
  if(needMap)jobs.push((async()=>{try{const r=await fetch("/api/generate-image",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({context,entity:{type:"Carte du monde",name:w.name,description:`Carte illustrée vue du dessus de l'ensemble du continent de ${w.name}, style carte de fantasy peinte à la main, avec reliefs et biomes visibles, sans texte ni étiquette.`}})});const p=await r.json().catch(()=>null);const src=p?.imageData||p?.imageUrl;if(r.ok&&typeof src==="string")vb.mapImageUrl=src;else failure=failure||p?.detail||"raison inconnue.";}catch{failure=failure||"le serveur n'a pas répondu.";}})());
  await Promise.all(jobs);
  if(vb.coverImageUrl||vb.mapImageUrl){
   setWorld(cur=>cur&&cur.id===w.id?{...cur,visual_bible:{...cur.visual_bible,...vb}}:cur);
   if(!isDemo){try{await supabase.from("worlds").update({visual_bible:vb}).eq("id",w.id);}catch{}}
  }
  return failure;
 }
 useEffect(()=>{if("serviceWorker" in navigator)navigator.serviceWorker.register("/sw.js").catch(()=>{})},[]);
 useEffect(()=>{if(!fiction&&fictionalCreatures)setFictionalCreatures(false)},[fiction,fictionalCreatures]);
 // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional mount-only effect; loadWorlds is stable enough for this init/subscribe pattern
 useEffect(()=>{(async()=>{const {data:{session:s}}=await supabase.auth.getSession();setSession(s);if(s)await loadWorlds();setReady(true)})();const {data:{subscription}}=supabase.auth.onAuthStateChange((_e,s)=>{setSession(s);if(s)loadWorlds();else{setWorld(null);setWorlds([]);setItems([])}});return()=>subscription.unsubscribe()},[]);
 async function loadWorlds(){const {data,error}=await supabase.from("worlds").select("*").order("updated_at",{ascending:false});if(error){setNotice(error.message);return}const list=(data||[]) as World[];setWorlds(list);const current=world&&list.find(x=>x.id===world.id);if(current)await selectWorld(current);else if(list[0])await selectWorld(list[0]);}
 async function selectWorld(w:World){setWorld(w);setWorldName(w.name);setTheme(w.theme);setMagic(w.magic_enabled);setFiction(w.fiction_enabled);setFictionalCreatures(w.fictional_creatures_enabled);setDay(Number(w.world_memory?.day||1));setSelected(null);setTab("overview");setChatMessages([]);setAssistantOpen(false);await Promise.all([loadItems(w.id),loadEvents(w.id),loadRules(w.id),loadMembers(w.id),loadGallery(w.id)]);setScreen("world");ensureWorldVisuals(w,false);}
 async function loadItems(id:string){const [r,c,p,e,cr]=await Promise.all([supabase.from("regions").select("id,name,description,x,y,image_url").eq("world_id",id),supabase.from("civilizations").select("id,name,description,culture,image_url").eq("world_id",id),supabase.from("characters").select("id,name,biography,image_url").eq("world_id",id),supabase.from("timeline_events").select("id,title,description,world_day,image_url").eq("world_id",id).order("world_day",{ascending:false}),supabase.from("creatures").select("id,name,description,image_url").eq("world_id",id)]);const map=(a:any[],k:Kind,d:string,o:number)=>a.map((x,i)=>({id:x.id,kind:k,name:x.name||x.title,description:x[d]||"",day:Number(x.world_day||1),x:k==="Région"?Number(x.x)||50:12+(i*19+o)%72,y:k==="Région"?Number(x.y)||50:15+(i*23+o)%65,imageUrl:x.image_url||null}));setItems([...map(r.data||[],"Région","description",0),...map(c.data||[],"Civilisation","description",9),...map(p.data||[],"Personnage","biography",17),...map(e.data||[],"Influence","description",31),...map(cr.data||[],"Créature","description",43)]);}
 async function loadEvents(id:string){const {data}=await supabase.from("timeline_events").select("id,title,description,world_day,consequences").eq("world_id",id).order("world_day",{ascending:false}).limit(100);setEvents(data||[]);}
 async function loadRules(id:string){const {data}=await supabase.from("world_rules").select("id,category,title,description,immutable").eq("world_id",id).order("importance",{ascending:false});const r=(data||[]) as Rule[];setRules(r);setDrafts(Object.fromEntries(r.map(x=>[x.id,{title:x.title,description:x.description}])));}
 async function loadMembers(id:string){const {data}=await supabase.from("world_members").select("id,user_id,role,permissions").eq("world_id",id);setMembers((data||[]) as Member[]);}
 function demoCommunityCards():CommunityCard[]{return DEMO_COMMUNITY_WORLDS.map(w=>({id:w.id,name:w.name,description:w.description,theme:w.theme,creatorHandle:w.creatorHandle,likeCount:w.likeCount+(demoLiked.has(w.id)?1:0),liked:demoLiked.has(w.id),following:demoFollowed.has(w.id),isDemo:true}));}
 async function loadCommunity(){
  if(demoMode){setCommunityCards(demoCommunityCards());setFollowedCards(demoCommunityCards().filter(c=>demoFollowed.has(c.id)));return;}
  if(!session)return;
  setCommunityLoading(true);
  try{
   const {data:likedRows}=await supabase.from("world_likes").select("world_id").eq("user_id",session.user.id);
   const likedIds=new Set((likedRows||[]).map((r:any)=>r.world_id));
   const {data:followedRows}=await supabase.from("world_follows").select("world_id").eq("user_id",session.user.id);
   const followedIds=new Set((followedRows||[]).map((r:any)=>r.world_id));
   const toCard=(w:any):CommunityCard=>({id:w.id,name:w.name,description:w.description||"",theme:w.theme,creatorHandle:w.profiles?.display_name||(w.owner_id as string).slice(0,8),likeCount:w.like_count||0,liked:likedIds.has(w.id),following:followedIds.has(w.id),coverImageUrl:(w.visual_bible as any)?.coverImageUrl||null,isDemo:false,raw:w});
   const {data:pub,error:pubErr}=await supabase.from("worlds").select("id,name,description,theme,owner_id,visual_bible,world_memory,magic_enabled,fiction_enabled,fictional_creatures_enabled,like_count,updated_at,profiles(display_name)").eq("is_public",true).order("updated_at",{ascending:false}).limit(30);
   if(pubErr)throw pubErr;
   setCommunityCards((pub||[]).map(toCard));
   const {data:fol,error:folErr}=await supabase.from("world_follows").select("worlds(id,name,description,theme,owner_id,visual_bible,world_memory,magic_enabled,fiction_enabled,fictional_creatures_enabled,like_count,updated_at,profiles(display_name))").eq("user_id",session.user.id);
   if(folErr)throw folErr;
   setFollowedCards((fol||[]).map((r:any)=>r.worlds).filter(Boolean).map(toCard));
  }catch{setCommunityCards([]);setFollowedCards([]);setNotice("La communauté n'est pas encore configurée sur ce projet Supabase (migration manquante).");}
  finally{setCommunityLoading(false);}
 }
 function demoCardsFrom(liked:Set<string>,followed:Set<string>):CommunityCard[]{return DEMO_COMMUNITY_WORLDS.map(w=>({id:w.id,name:w.name,description:w.description,theme:w.theme,creatorHandle:w.creatorHandle,likeCount:w.likeCount+(liked.has(w.id)?1:0),liked:liked.has(w.id),following:followed.has(w.id),isDemo:true}));}
 async function toggleLike(card:CommunityCard){
  if(card.isDemo){setDemoLiked(cur=>{const next=new Set(cur);next.has(card.id)?next.delete(card.id):next.add(card.id);setCommunityCards(demoCardsFrom(next,demoFollowed));setFollowedCards(f=>f.map(c=>c.id===card.id?{...c,liked:next.has(card.id),likeCount:c.likeCount+(next.has(card.id)?1:-1)}:c));return next;});return;}
  if(!session)return;
  const nowLiked=!card.liked;
  const patch=(c:CommunityCard)=>c.id===card.id?{...c,liked:nowLiked,likeCount:c.likeCount+(nowLiked?1:-1)}:c;
  setCommunityCards(cur=>cur.map(patch));setFollowedCards(cur=>cur.map(patch));
  try{if(nowLiked)await supabase.from("world_likes").insert({world_id:card.id,user_id:session.user.id});else await supabase.from("world_likes").delete().eq("world_id",card.id).eq("user_id",session.user.id);}catch{}
 }
 async function toggleFollow(card:CommunityCard){
  if(card.isDemo){setDemoFollowed(cur=>{const next=new Set(cur);next.has(card.id)?next.delete(card.id):next.add(card.id);setCommunityCards(demoCardsFrom(demoLiked,next));setFollowedCards(demoCardsFrom(demoLiked,next).filter(c=>next.has(c.id)));return next;});return;}
  if(!session)return;
  const nowFollowing=!card.following;
  setCommunityCards(cur=>cur.map(c=>c.id===card.id?{...c,following:nowFollowing}:c));
  try{if(nowFollowing)await supabase.from("world_follows").insert({world_id:card.id,user_id:session.user.id});else await supabase.from("world_follows").delete().eq("world_id",card.id).eq("user_id",session.user.id);await loadCommunity();}catch{}
 }
 async function openCommunityWorld(card:CommunityCard){if(card.isDemo){setNotice("✦ \""+card.name+"\" est un monde illustratif — connecte-toi pour explorer de vrais mondes créés par la communauté.");return;}if(card.raw)await selectWorld(card.raw);}
 async function toggleWorldPublic(){if(!world)return;const next=!world.is_public;setWorld(cur=>cur?{...cur,is_public:next}:cur);if(!demoMode){try{await supabase.from("worlds").update({is_public:next}).eq("id",world.id);}catch{}}}
 async function sendChatMessage(text?:string){
  if(!world)return;
  const message=(text??chatInput).trim();
  if(!message||chatBusy)return;
  const history=chatMessages;
  setChatMessages(cur=>[...cur,{role:"user",text:message}]);
  setChatInput("");
  setChatBusy(true);
  try{
   const context={name:world.name,theme:world.theme,magicEnabled:world.magic_enabled,fictionEnabled:world.fiction_enabled,fictionalCreaturesEnabled:world.fictional_creatures_enabled,day,rules:rules.map(r=>({title:r.title,description:r.description})),stats:{regions:regionCount,civilizations:civCount,characters:habitantItems.length,places:lieuItems.length}};
   const res=await fetch("/api/assistant",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({context,message,history})});
   const p=await res.json().catch(()=>null);
   setChatMessages(cur=>[...cur,{role:"assistant",text:typeof p?.reply==="string"?p.reply:"Je n'ai pas pu répondre pour le moment. Réessaie dans un instant."}]);
  }catch{
   setChatMessages(cur=>[...cur,{role:"assistant",text:"Je n'ai pas pu répondre pour le moment. Réessaie dans un instant."}]);
  }finally{setChatBusy(false);}
 }
 async function auth(){if(!supabaseConfigured){setNotice(getSupabaseConfigurationError()||"Supabase n'est pas configuré.");return}const e=email.trim().toLowerCase();if(!/^\S+@\S+\.\S+$/.test(e)||password.length<6){setNotice("E-mail valide et mot de passe de 6 caractères minimum requis.");return}setBusy(true);const r=authMode==="signup"?await supabase.auth.signUp({email:e,password,options:{emailRedirectTo:window.location.origin}}):await supabase.auth.signInWithPassword({email:e,password});setBusy(false);if(r.error){setNotice(translateAuthError(r.error.message));return}if(authMode==="signup"&&!r.data.session){setNotice("Compte créé. Vérifie ton e-mail puis reconnecte-toi.");return}setSession(r.data.session);setAuthOpen(false);await loadWorlds();}
 async function reset(){const e=email.trim().toLowerCase();if(!/^\S+@\S+\.\S+$/.test(e)){setNotice("Entre ton e-mail.");return}const {error}=await supabase.auth.resetPasswordForEmail(e,{redirectTo:window.location.origin});setNotice(error?translateAuthError(error.message):"Lien de réinitialisation envoyé si le compte existe.");}
 async function signOut(){await supabase.auth.signOut();setScreen("home");setWorld(null);setNotice("Déconnecté.");}
 async function createWorld(){if(!session){setAuthOpen(true);return}if(!worldName.trim()){setNotice("Donne un nom à ton monde.");return}if(!fiction&&fictionalCreatures){setNotice("Les créatures fictives nécessitent l'autorisation de la fiction.");return}setBusy(true);const {data:{user}}=await supabase.auth.getUser();const {data,error}=await supabase.from("worlds").insert({owner_id:user?.id,name:worldName.trim(),description:"Monde créé avec Arthenis.",theme,magic_enabled:magic,fiction_enabled:fiction,fictional_creatures_enabled:fictionalCreatures,is_public:isPublic,visual_bible:{theme,magic,fiction,fictionalCreatures},world_memory:{day:1,map_version:0}}).select().single();setBusy(false);if(error){setNotice(error.message);return}if(data){await loadWorlds();await selectWorld(data as World);setNotice("✦ Monde créé. Génération de la couverture et de la carte…");const f=await generateWorldVisuals(data as World);setNotice(f?`✦ Monde créé, mais ses illustrations ont échoué : ${f}`:"✦ Monde créé, couverture et carte générées.");return;}setNotice("✦ Monde créé.");}
 function resetComposer(){setName("");setDescription("");setRole("");setProfession("");setMagicLevel("0");setAiEvolve(true);setComposerPortrait(null)}
 async function generatePortrait(){if(!world)return;const n=name.trim()||"Personnage sans nom",text=description.trim()||"Portrait de personnage cohérent avec le monde.";setPortraitBusy(true);try{const context={name:world.name,theme:world.theme,fictionEnabled:world.fiction_enabled,fictionalCreaturesEnabled:world.fictional_creatures_enabled,magicEnabled:world.magic_enabled,rules:rules.map(r=>({title:r.title,description:r.description,immutable:r.immutable})),memory:{day},visualBible:world.visual_bible};const res=await fetch("/api/generate-image",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({context,entity:{type:"Portrait de personnage",name:n,description:`${text}${role?` Rôle : ${role}.`:""}${profession?` Profession : ${profession}.`:""}`}})});const p=await res.json().catch(()=>null);const src=p?.imageData||p?.imageUrl;if(res.ok&&typeof src==="string")setComposerPortrait(src);else setNotice("Portrait impossible — "+(p?.detail||"raison inconnue."));}catch{setNotice("Portrait impossible — le serveur n'a pas répondu.");}finally{setPortraitBusy(false)}}
 async function createItem(){if(!world){setNotice("Crée d'abord ton monde.");return}const n=name.trim(),text=description.trim()||"Élément créé par le créateur.";if(!n){setNotice("Donne un nom.");return}setBusy(true);try{if(demoMode){const context={name:world.name,theme:world.theme,fictionEnabled:world.fiction_enabled,fictionalCreaturesEnabled:world.fictional_creatures_enabled,magicEnabled:world.magic_enabled,rules:rules.map(r=>({title:r.title,description:r.description,immutable:r.immutable})),memory:{day},visualBible:world.visual_bible};const cres=await fetch("/api/coherence",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({context,proposal:{type:kind,name:n,description:text}})});const co=await cres.json().catch(()=>null);if(!cres.ok)throw new Error(co?.error||"Cohérence indisponible.");if(co?.decision!=="accept")throw new Error("✦ Idée refusée : "+(co?.reason||"elle contredit les lois du monde."));const demoId=`demo-${Date.now()}`;const newItem={id:demoId,kind,name:n,description:text,day,x:10+Math.round(Math.random()*80),y:10+Math.round(Math.random()*80),imageUrl:kind==="Personnage"?composerPortrait:null};setItems(cur=>[...cur,newItem]);resetComposer();setTab(kind==="Personnage"||kind==="Créature"?"habitants":kind==="Région"?"map":"lieux");setNotice("✦ Création acceptée. Génération de l'illustration…");
   if(!newItem.imageUrl){
    try{
     const ires=await fetch("/api/generate-image",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({context,entity:{type:kind,name:n,description:text}})});
     const ip=await ires.json().catch(()=>null);
     const isrc=ip?.imageData||ip?.imageUrl;
     if(ires.ok&&typeof isrc==="string"){setItems(cur=>cur.map(i=>i.id===demoId?{...i,imageUrl:isrc}:i));setNotice(`✦ ${n} est créé, avec son illustration (mode démo, non sauvegardé).`);}
     else setNotice(`✦ ${n} est créé, mais son illustration a échoué : ${ip?.detail||"génération refusée."}`);
    }catch{setNotice(`✦ ${n} est créé, mais la génération d'image n'a pas répondu.`);}
   }else setNotice(`✦ ${n} est créé (mode démo, non sauvegardé).`);
   return;}const {data:rr,error:re}=await supabase.from("world_rules").select("category,title,description,immutable").eq("world_id",world.id);if(re)throw new Error("Impossible de charger les lois.");const context={name:world.name,theme:world.theme,fictionEnabled:world.fiction_enabled,fictionalCreaturesEnabled:world.fictional_creatures_enabled,magicEnabled:world.magic_enabled,rules:(rr||[]).map(r=>({title:r.title,description:r.description,immutable:r.immutable})),memory:{day},visualBible:world.visual_bible};const cres=await fetch("/api/coherence",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({context,proposal:{type:kind,name:n,description:text}})});const co=await cres.json();if(!cres.ok)throw new Error(co?.error||"Cohérence indisponible.");if(co?.decision!=="accept")throw new Error("✦ Idée refusée : "+(co?.reason||"elle contredit les lois du monde."));let table:string;let row:any={world_id:world.id,name:n};if(kind==="Région"){table="regions";row={...row,description:text,x:12+((Date.now()*37)%72),y:14+((Date.now()*23)%68),biome:"custom",generation_status:"ready"};}else if(kind==="Civilisation"){table="civilizations";row={...row,description:text};}else if(kind==="Village"){table="civilizations";row={...row,description:text,culture:"Village"};}else if(kind==="Personnage"){table="characters";row={...row,biography:text,role:role||null,profession:profession||null,magic_level:Math.max(0,Math.min(100,Number(magicLevel)||0)),ai_can_evolve:aiEvolve};}else if(kind==="Créature"){table="creatures";row={...row,classification:"Créature",fictional:world.fictional_creatures_enabled,description:text};}else{table="timeline_events";row={world_id:world.id,title:n,description:text,world_day:day,consequences:[]};delete row.name;}const {data,error}=await supabase.from(table).insert(row).select().single();if(error)throw new Error(error.message);const token=(await supabase.auth.getSession()).data.session?.access_token||"";const pr=await fetch("/api/world-engine",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({worldId:world.id,action:"proposal",type:kind,payload:{name:n,description:text},coherenceStatus:"accepted",coherenceResult:co})});if(!pr.ok)throw new Error("La création a réussi mais son historique n'a pas pu être enregistré.");setNotice("✦ Création acceptée. Génération visuelle en cours…");const visualError=await generateAsset(table,data,context,kind,n,text,kind==="Personnage"?composerPortrait:null);resetComposer();await selectWorld(world);setTab(kind==="Personnage"||kind==="Créature"?"habitants":kind==="Région"?"map":"lieux");setNotice(visualError?`✦ ${n} est créé, mais son illustration a échoué : ${visualError}`:`✦ ${n} est créé, avec son illustration.`);}catch(e){setNotice(e instanceof Error?e.message:"Impossible de créer cet élément.");}finally{setBusy(false);}}
 /**
  * Generates and stores the illustration for a freshly created entity.
  *
  * Returns why it could not, rather than swallowing it. This used to end in an
  * empty catch, so a world that silently never produced a single image looked
  * identical to one that was working.
  */
 /**
  * Generates the cover and the map for a new world.
  *
  * Both run at creation rather than waiting to be asked, because a world whose
  * first screen is placeholder art does not look like it was built for you.
  */
 async function generateWorldVisuals(w:World){
  const context={name:w.name,theme:w.theme,fictionEnabled:w.fiction_enabled,fictionalCreaturesEnabled:w.fictional_creatures_enabled,magicEnabled:w.magic_enabled,rules:[],memory:{day:1},visualBible:w.visual_bible};
  const jobs:{key:string;entity:ImageEntity}[]=[
   {key:"coverImageUrl",entity:{type:"Couverture du monde",name:w.name,description:w.description||`Paysage emblématique du monde ${w.name}, thème ${w.theme}.`}},
   {key:"mapImageUrl",entity:{type:"Carte du monde",name:w.name,description:`Carte illustrée vue du dessus du continent de ${w.name}.`}}
  ];
  const bible:Record<string,unknown>={...(w.visual_bible||{})};
  let failure:string|null=null;
  for(const job of jobs){
   try{
    const res=await fetch("/api/generate-image",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({context,entity:job.entity})});
    const p=await res.json().catch(()=>null);
    const src=p?.imageData||p?.imageUrl;
    if(!res.ok||typeof src!=="string"){failure=failure||p?.detail||"génération refusée.";continue;}
    const blob=await (await fetch(src)).blob();
    const path=`${w.id}/world-${job.key}.png`;
    const up=await supabase.storage.from("arthenis-assets").upload(path,blob,{contentType:blob.type||"image/png",upsert:true});
    if(up.error){failure=failure||"enregistrement de l'image impossible.";continue;}
    const signed=await supabase.storage.from("arthenis-assets").createSignedUrl(path,31536000);
    if(signed.data?.signedUrl){
     bible[job.key]=signed.data.signedUrl;
     await supabase.from("generated_assets").insert({world_id:w.id,entity_type:job.entity.type,entity_id:w.id,prompt:JSON.stringify({entity:job.entity}),image_url:signed.data.signedUrl,status:"ready"});
    }
   }catch{failure=failure||"génération interrompue.";}
  }
  if(bible.coverImageUrl||bible.mapImageUrl){
   await supabase.from("worlds").update({visual_bible:bible}).eq("id",w.id);
   setWorld(cur=>cur&&cur.id===w.id?{...cur,visual_bible:bible}:cur);
  }
  return failure;
 }
 async function generateAsset(table:string,data:any,context:any,type:string,n:string,text:string,preGenerated?:string|null):Promise<string|null>{
  try{
   let src:string|undefined|null=preGenerated;
   if(!src){
    const res=await fetch("/api/generate-image",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({context,entity:{type,name:n,description:text},references:[`Le monde : ${(world?.description||"").slice(0,160)}`]})});
    const p=await res.json().catch(()=>null);
    src=p?.imageData||p?.imageUrl;
    if(!res.ok||typeof src!=="string")return p?.detail||"génération refusée par le service d'images.";
   }
   let storedUrl:string|null=null;
   // Remote URLs from the DALL·E engines expire within the hour, so everything
   // is fetched and re-uploaded rather than linked.
   const blob=await (await fetch(src)).blob();
   const path=`${world!.id}/${type}-${data.id}.png`;
   const up=await supabase.storage.from("arthenis-assets").upload(path,blob,{contentType:blob.type||"image/png",upsert:true});
   if(up.error)return "image générée, mais son enregistrement a échoué.";
   const signed=await supabase.storage.from("arthenis-assets").createSignedUrl(path,31536000);
   storedUrl=signed.data?.signedUrl||null;
   if(!storedUrl)return "image enregistrée mais illisible.";
   await supabase.from(table).update({image_url:storedUrl}).eq("id",data.id);
   await supabase.from("generated_assets").insert({world_id:world!.id,entity_type:type,entity_id:data.id,prompt:JSON.stringify({context,entity:{type,name:n,description:text}}),image_url:storedUrl,status:"ready"});
   return null;
  }catch(e){return e instanceof Error?e.message:"génération interrompue.";}
 }

 function tableForKind(k:Kind){return k==="Région"?"regions":k==="Civilisation"||k==="Village"?"civilizations":k==="Personnage"?"characters":k==="Créature"?"creatures":"timeline_events";}
 function studioContext(){return {name:world!.name,theme:world!.theme,fictionEnabled:world!.fiction_enabled,fictionalCreaturesEnabled:world!.fictional_creatures_enabled,magicEnabled:world!.magic_enabled,rules:rules.map(r=>({title:r.title,description:r.description,immutable:r.immutable})),memory:{day},visualBible:world!.visual_bible};}
 // Visual continuity: hand the engine what this world has already established so
 // a second image of the same civilization stays recognisably the same place.
 function studioReferences(target:StudioTarget){
  const refs:string[]=[];
  if(world?.description)refs.push(`Le monde : ${world.description.slice(0,160)}`);
  const related=target.item?items.filter(i=>i.kind===target.item!.kind&&i.id!==target.item!.id):items.filter(i=>i.kind==="Civilisation"||i.kind==="Région");
  for(const i of related.slice(0,3))refs.push(`${i.kind} ${i.name} : ${i.description.slice(0,90)}`);
  return refs;
 }
 async function runDiagnostic(){
  setDiagBusy(true);
  try{
   const r=await fetch("/api/health?deep=1");
   setDiag(await r.json());
  }catch{
   setDiag({openai:{ok:false,detail:"Impossible de contacter le serveur Arthenis."}});
  }finally{setDiagBusy(false);}
 }
 function openStudio(target:StudioTarget){setStudio(target);setStudioResult(null);setStudioError(null);setStudioSaving(false);setStudioOptions({category:categoryForKind(target.entity.type)});}
 async function runStudio(){
  if(!world||!studio||studioBusy)return;
  setStudioBusy(true);setStudioError(null);
  try{
   const res=await fetch("/api/generate-image",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({context:studioContext(),entity:studio.entity,options:studioOptions,references:studioReferences(studio)})});
   const p=await res.json().catch(()=>null);
   const src=p?.imageData||p?.imageUrl;
   if(res.ok&&typeof src==="string")setStudioResult(src);else setStudioError(p?.detail||"raison inconnue.");
  }catch{setStudioError("le serveur n'a pas répondu.");}
  finally{setStudioBusy(false);}
 }
 function applyImageLocally(target:StudioTarget,url:string){
  if(target.scope==="entity"&&target.item){const id=target.item.id;setItems(cur=>cur.map(i=>i.id===id?{...i,imageUrl:url}:i));setSelected(cur=>cur&&cur.id===id?{...cur,imageUrl:url}:cur);}
  else{const key=target.scope==="cover"?"coverImageUrl":"mapImageUrl";setWorld(cur=>cur?{...cur,visual_bible:{...cur.visual_bible,[key]:url}}:cur);}
 }
 async function persistImage(src:string,entityType:string,entityId:string){
  let storedUrl:string|null=src.startsWith("http")?src:null;
  if(src.startsWith("data:")){
   const blob=await (await fetch(src)).blob();
   const path=`${world!.id}/${entityType}-${entityId}-${Date.now()}.png`;
   const up=await supabase.storage.from("arthenis-assets").upload(path,blob,{contentType:blob.type||"image/png",upsert:true});
   if(up.error)throw new Error("Image générée, mais son enregistrement dans le stockage a échoué.");
   const signed=await supabase.storage.from("arthenis-assets").createSignedUrl(path,31536000);
   storedUrl=signed.data?.signedUrl||null;
  }
  if(!storedUrl)throw new Error("Image générée mais inutilisable.");
  await supabase.from("generated_assets").insert({world_id:world!.id,entity_type:entityType,entity_id:entityId,prompt:JSON.stringify({entity:{type:entityType},options:studioOptions}),image_url:storedUrl,status:"ready"});
  return storedUrl;
 }
 async function saveStudio(){
  if(!world||!studio||!studioResult||studioSaving)return;
  const target=studio;
  setStudioSaving(true);setStudioError(null);
  try{
   if(demoMode){
    applyImageLocally(target,studioResult);
    setGallery(g=>[{id:`demo-${Date.now()}`,entity_type:target.entity.type,image_url:studioResult,entity_name:target.entity.name},...g]);
    setNotice("✦ Image ajoutée au monde (mode démo, non sauvegardée).");
   }else{
    const entityId=target.scope==="entity"&&target.item?target.item.id:world.id;
    const url=await persistImage(studioResult,target.entity.type,entityId);
    if(target.scope==="entity"&&target.item){await supabase.from(tableForKind(target.item.kind)).update({image_url:url}).eq("id",target.item.id);}
    else{const vb={...(world.visual_bible||{}),[target.scope==="cover"?"coverImageUrl":"mapImageUrl"]:url};await supabase.from("worlds").update({visual_bible:vb}).eq("id",world.id);}
    applyImageLocally(target,url);
    await loadGallery(world.id);
    setNotice("✦ Image enregistrée dans le monde.");
   }
   setStudio(null);
  }catch(e){setStudioError(e instanceof Error?e.message:"Enregistrement impossible.");}
  finally{setStudioSaving(false);}
 }
 async function loadGallery(id:string){try{const {data}=await supabase.from("generated_assets").select("id,entity_type,image_url").eq("world_id",id).order("created_at",{ascending:false}).limit(60);setGallery((data||[]) as GalleryItem[]);}catch{setGallery([]);}}
 async function advance(){if(!world)return;setBusy(true);try{if(demoMode){const res=await fetch("/api/demo/advance",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({world:{name:world.name,theme:world.theme,fictionEnabled:world.fiction_enabled,fictionalCreaturesEnabled:world.fictional_creatures_enabled,magicEnabled:world.magic_enabled},day})});const p=await res.json().catch(()=>null);if(!res.ok)throw new Error(p?.error||"Impossible de faire évoluer le monde.");const newEvent={id:`demo-e-${Date.now()}`,title:p.event.title,description:p.event.description,world_day:p.day,consequences:p.event.consequences||[]};setEvents(cur=>[newEvent,...cur]);setDay(Number(p.day));setTab("notifications");setNotice(`✦ Jour ${p.day} : le monde a évolué (mode démo, non sauvegardé).`);return;}const token=(await supabase.auth.getSession()).data.session?.access_token||"";const res=await fetch("/api/world-engine",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({worldId:world.id,action:"advance"})});const p=await res.json();if(!res.ok)throw new Error(p?.error||"Impossible de faire évoluer le monde.");setDay(Number(p.day));await selectWorld(world);setTab("notifications");setNotice(`✦ Jour ${p.day} : le monde a évolué.`);}catch(e){setNotice(e instanceof Error?e.message:"Évolution impossible.");}finally{setBusy(false);}}
 async function saveRule(r:Rule){if(r.immutable)return;const d=drafts[r.id];if(!d)return;setBusy(true);try{if(demoMode){setRules(cur=>cur.map(x=>x.id===r.id?{...x,title:d.title,description:d.description}:x));setNotice("✦ Loi mise à jour (mode démo, non sauvegardée).");return;}const token=(await supabase.auth.getSession()).data.session?.access_token||"";const res=await fetch("/api/world-engine",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({worldId:world!.id,action:"rule-update",ruleId:r.id,title:d.title,description:d.description})});const p=await res.json();if(!res.ok)throw new Error(p?.error||"Modification refusée.");await loadRules(world!.id);setNotice("✦ Loi mise à jour.");}catch(e){setNotice(e instanceof Error?e.message:"Impossible de modifier la loi.");}finally{setBusy(false);}}
 async function saveDescription(){if(!world)return;const text=descDraft.trim();setWorld(cur=>cur?{...cur,description:text}:cur);setEditingDescription(false);if(!demoMode){try{await supabase.from("worlds").update({description:text}).eq("id",world.id);}catch{}}setNotice(demoMode?"✦ Description mise à jour (mode démo, non sauvegardée).":"✦ Description mise à jour.");}
 async function toggleWorldSetting(key:"allow_member_creation"|"manual_review"){if(!world)return;const current=Boolean((world.world_memory as any)?.[key]??(key==="allow_member_creation"));const newMemory={...(world.world_memory||{}),[key]:!current};setWorld(cur=>cur?{...cur,world_memory:newMemory}:cur);if(!demoMode){try{await supabase.from("worlds").update({world_memory:newMemory}).eq("id",world.id);}catch{}}}
 async function saveMember(){if(!world||!memberId.trim())return;setBusy(true);try{const token=(await supabase.auth.getSession()).data.session?.access_token||"";const res=await fetch("/api/world-engine",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({worldId:world.id,action:"member-upsert",userId:memberId.trim(),role:memberRole,permissions:{can_create:memberRole!=="viewer",can_edit_rules:memberRole==="admin",can_advance:["admin","creator"].includes(memberRole)}})});const p=await res.json();if(!res.ok)throw new Error(p?.error||"Gestion du membre refusée.");setMemberId("");await loadMembers(world.id);setNotice("✦ Membre ajouté/mis à jour.");}catch(e){setNotice(e instanceof Error?e.message:"Impossible de modifier le membre.");}finally{setBusy(false);}}
 async function removeMember(userId:string){if(!world)return;setBusy(true);try{const token=(await supabase.auth.getSession()).data.session?.access_token||"";const res=await fetch("/api/world-engine",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({worldId:world.id,action:"member-remove",userId})});const p=await res.json();if(!res.ok)throw new Error(p?.error||"Suppression refusée.");await loadMembers(world.id);setNotice("✦ Membre retiré.");}catch(e){setNotice(e instanceof Error?e.message:"Impossible de retirer le membre.");}finally{setBusy(false);}}
 const canManage=!!session&&!!world&&(world.owner_id===session.user.id||members.some(m=>m.user_id===session.user.id&&m.role==="admin"));
 const canEdit=demoMode||(!!session&&!!world&&(world.owner_id===session.user.id||members.some(m=>m.user_id===session.user.id&&["admin","creator","contributor"].includes(m.role))));
 const canAdvance=demoMode||(!!session&&!!world&&(world.owner_id===session.user.id||members.some(m=>m.user_id===session.user.id&&["admin","creator"].includes(m.role))));
 const regionCount=items.filter(i=>i.kind==="Région").length;
 const civCount=items.filter(i=>i.kind==="Civilisation").length;
 const habitantItems=items.filter(i=>i.kind==="Personnage"||i.kind==="Créature");
 const lieuItems=items.filter(i=>i.kind==="Civilisation"||i.kind==="Village"||i.kind==="Influence");
 const coverUrl=(world?.visual_bible as any)?.coverImageUrl as string|undefined;
 const mapImageUrl=(world?.visual_bible as any)?.mapImageUrl as string|undefined;
 const allowMemberCreation=Boolean((world?.world_memory as any)?.allow_member_creation??true);
 const manualReview=Boolean((world?.world_memory as any)?.manual_review??false);
 if(!ready)return <main className="appShell"><div className="loadingState">ARTHENIS · CHARGEMENT</div></main>;
 return <main className="appShell">
  {screen!=="world"&&<header className="topbar"><div><strong>ARTHENIS</strong><span>WHERE WORLDS ARE BORN</span></div>{session&&<div className="topActions"><span>{session.user.email}</span>{worlds.length>0&&<select value={world?.id||""} onChange={e=>{const w=worlds.find(x=>x.id===e.target.value);if(w)selectWorld(w)}}>{worlds.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select>}<button onClick={signOut}>Déconnexion</button></div>}</header>}
  {notice&&<div className="toastNotice">{notice}<button onClick={()=>setNotice("")}>×</button></div>}
  {screen==="home"&&<section className="heroScreen"><div className="heroBackdrop" aria-hidden="true"><img src="/art/hero.jpg" alt=""/><div className="heroFade"/></div><p className="eyebrow">ARTHENIS · WORLD ENGINE</p><h1>Crée un monde.<br/><em>Observe ses conséquences.</em></h1><p>Un univers cohérent, vivant et évolutif. Chaque règle compte. Chaque création laisse une trace.</p><div className="heroActions"><button className="primary" onClick={()=>{if(!session){setAuthOpen(true);return}setScreen("create");setStep(1)}}>Créer un monde</button><button onClick={startDemo}>✦ Essayer la démo (Aerion)</button>{session&&worlds.length>0&&<button onClick={()=>world&&selectWorld(world)}>Ouvrir mon monde</button>}</div></section>}
  {screen==="create"&&<section className="commandPanel createPanel"><div className="panelHeader"><div><p className="panelTag">WORLD CREATION · {step}/3</p><h2>Construis les fondations</h2></div><button onClick={()=>setScreen("home")}>×</button></div>{step===1&&<><label>Nom du monde<input value={worldName} onChange={e=>setWorldName(e.target.value)} placeholder="Ex. Elaria"/></label><label>Thématique<select value={theme} onChange={e=>setTheme(e.target.value)}><option>Fantasy</option><option>Médiéval</option><option>Antique</option><option>Préhistorique</option><option>Science-fiction</option><option>Post-apocalyptique</option><option>Historique réaliste</option></select></label><button className="primary" onClick={()=>worldName.trim()&&setStep(2)}>Continuer</button></>}{step===2&&<><h3>Règles fondamentales</h3><label className="check"><input type="checkbox" checked={fiction} onChange={e=>setFiction(e.target.checked)}/> Fiction autorisée</label><label className="check"><input type="checkbox" checked={fictionalCreatures} disabled={!fiction} onChange={e=>setFictionalCreatures(e.target.checked)}/> Créatures fictives autorisées</label><label className="check"><input type="checkbox" checked={magic} onChange={e=>setMagic(e.target.checked)}/> Magie autorisée</label><label className="check"><input type="checkbox" checked={isPublic} onChange={e=>setIsPublic(e.target.checked)}/> Rendre ce monde visible dans Explorer</label><p className="muted">Sans fiction, Arthenis interdit automatiquement les créatures fictives.</p><div className="row"><button onClick={()=>setStep(1)}>Retour</button><button className="primary" onClick={()=>setStep(3)}>Continuer</button></div></>}{step===3&&<><div className="worldSummary"><b>{worldName}</b><span>{theme}</span><span>{fiction?"Fiction":"Réaliste"}</span><span>{fictionalCreatures?"Créatures fictives":"Créatures réalistes"}</span><span>{magic?"Magie":"Sans magie"}</span></div><div className="row"><button onClick={()=>setStep(2)}>Retour</button><button className="primary" disabled={busy} onClick={createWorld}>{busy?"Création…":"Donner vie au monde"}</button></div></>}</section>}
  {screen==="world"&&world&&<section className="worldConsole">
   <div className="worldHeader"><div><p className="panelTag">WORLD · DAY {day}</p><h2>{world.name}</h2><span>{world.theme} · {world.magic_enabled?"Magie":"Sans magie"} · {world.fiction_enabled?"Fiction":"Réaliste"}</span></div><div className="worldHeaderActions"><button disabled={busy||!canAdvance} className="primary" onClick={advance}>✦ Faire évoluer le monde</button>{demoMode?<button onClick={exitDemo}>Quitter la démo</button>:<button onClick={()=>{setScreen("create");setStep(1)}}>Nouveau monde</button>}</div></div>
   {(["overview","map","habitants","lieux","galerie"] as Tab[]).includes(tab)&&<nav className="subNav"><button className={tab==="overview"?"active":""} onClick={()=>setTab("overview")}>Vue d&apos;ensemble</button><button className={tab==="map"?"active":""} onClick={()=>setTab("map")}>Carte</button><button className={tab==="habitants"?"active":""} onClick={()=>setTab("habitants")}>Habitants</button><button className={tab==="lieux"?"active":""} onClick={()=>setTab("lieux")}>Lieux</button><button className={tab==="galerie"?"active":""} onClick={()=>setTab("galerie")}>Galerie</button></nav>}

   {tab==="overview"&&<div className="overviewPane">
    <div className="coverCard">{coverUrl&&<img src={coverUrl} alt=""/>}<div className="coverScrim"/><button className="coverRegen" title="Générer une image du monde" onClick={()=>openStudio({scope:"cover",entity:{type:"Couverture de monde",name:world.name,description:world.description||`Vue panoramique du monde ${world.name}.`}})}>✦</button><div className="coverContent"><h2>{world.name}</h2><p>{world.theme} · {world.magic_enabled?"Magie":"Sans magie"} · {world.fiction_enabled?"Fiction":"Réaliste"}</p></div></div>
    <div className="statRow"><div className="statTile"><b>{regionCount}</b><span>RÉGIONS</span></div><div className="statTile"><b>{civCount}</b><span>CIVILISATIONS</span></div><div className="statTile"><b>{habitantItems.length}</b><span>PERSONNAGES</span></div><div className="statTile"><b>{lieuItems.length}</b><span>LIEUX</span></div></div>
    <div className="descCard"><div className="descHeader"><p className="panelTag">DESCRIPTION</p>{canEdit&&!editingDescription&&<button onClick={()=>{setDescDraft(world.description||"");setEditingDescription(true)}}>Modifier</button>}</div>{editingDescription?<><textarea value={descDraft} onChange={e=>setDescDraft(e.target.value)} rows={4}/><div className="row"><button onClick={()=>setEditingDescription(false)}>Annuler</button><button className="primary" onClick={saveDescription}>Enregistrer</button></div></>:<p>{world.description||"Aucune description pour l'instant."}</p>}</div>
   </div>}

   {tab==="map"&&<WorldMap items={items} mapImageUrl={mapImageUrl} worldName={world.name} canEdit={canEdit} onSelect={i=>setSelected(i)} onGenerateMap={()=>openStudio({scope:"map",entity:{type:"Carte du monde",name:world.name,description:`Carte illustrée du continent de ${world.name}.`}})}/>}

   {tab==="habitants"&&<div className="contentGrid">{habitantItems.map(i=><article className="entityCard" key={i.id} onClick={()=>setSelected(i)}><EntityVisual item={i}/><p className="panelTag">{i.kind}</p><h3>{i.name}</h3><p>{i.description}</p></article>)}{habitantItems.length===0&&<p className="muted">Aucun habitant pour le moment. Crée un personnage ou une créature.</p>}</div>}

   {tab==="lieux"&&<div className="contentGrid">{lieuItems.map(i=><article className="entityCard" key={i.id} onClick={()=>setSelected(i)}><EntityVisual item={i}/><p className="panelTag">{i.kind}</p><h3>{i.name}</h3><p>{i.description}</p></article>)}{lieuItems.length===0&&<p className="muted">Aucun lieu pour le moment.</p>}</div>}

   {tab==="galerie"&&<div className="galleryPane">
    <p className="muted">Toutes les images générées pour {world.name}, classées par catégorie.{demoMode?" En mode démo, elles ne sont pas sauvegardées.":""}</p>
    {gallery.length===0&&<p className="muted">Aucune image pour l&apos;instant. Ouvre un élément du monde et utilise « Générer une image ».</p>}
    {IMAGE_CATEGORIES.map(cat=>{const inCat=gallery.filter(g=>categoryForKind(g.entity_type)===cat);if(inCat.length===0)return null;return <section key={cat}><p className="panelTag">{cat.toUpperCase()} · {inCat.length}</p><div className="galleryGrid">{inCat.map(g=><figure className="galleryItem" key={g.id}><img src={g.image_url} alt={g.entity_name||g.entity_type}/><figcaption>{g.entity_name||g.entity_type}</figcaption></figure>)}</div></section>;})}
   </div>}

   {tab==="create"&&<div className="commandPanel addPanel"><div className="panelHeader"><div><p className="panelTag">CREATE · COHERENCE ENGINE</p><h2>Ajouter au monde</h2></div></div><div className="kindGrid">{kinds.map(k=><button key={k} className={kind===k?"selected":""} onClick={()=>{setKind(k);setComposerPortrait(null)}}><b>{icon(k)}</b>{k}</button>)}</div>
    {kind==="Personnage"&&<div className="portraitComposer"><div className="portraitCircle">{composerPortrait?<img src={composerPortrait} alt=""/>:"♙"}<button className="portraitBadge" disabled={portraitBusy||!name.trim()} onClick={generatePortrait} title="Générer le portrait">{portraitBusy?"…":"📷"}</button></div><small className="muted">{portraitBusy?"Génération du portrait…":!name.trim()?"Renseigne un nom pour générer un portrait IA.":"Portrait généré par l'IA à partir du nom et de la description."}</small></div>}
    <input value={name} onChange={e=>setName(e.target.value)} placeholder={`Nom de ${kind.toLowerCase()}`}/>
    {kind==="Personnage"&&<div className="advancedFields">
     <div className="selectField"><label>RÔLE</label><input list="roleOptions" value={role} onChange={e=>setRole(e.target.value)} placeholder="Choisir ou écrire un rôle"/><datalist id="roleOptions">{ROLE_OPTIONS.map(o=><option key={o} value={o}/>)}</datalist></div>
     <div className="selectField"><label>PROFESSION</label><input list="professionOptions" value={profession} onChange={e=>setProfession(e.target.value)} placeholder="Choisir ou écrire une profession"/><datalist id="professionOptions">{PROFESSION_OPTIONS.map(o=><option key={o} value={o}/>)}</datalist></div>
     <div className="sliderRow"><div className="sliderTop"><span>Niveau de magie</span><b>{magicLabel(Number(magicLevel))}</b></div><input type="range" min="0" max="100" value={magicLevel} onChange={e=>setMagicLevel(e.target.value)}/></div>
     <div className="switchRow"><span>L&apos;IA peut faire évoluer son histoire</span><label className="switch"><input type="checkbox" checked={aiEvolve} onChange={e=>setAiEvolve(e.target.checked)}/><b/></label></div>
    </div>}
    <textarea value={description} onChange={e=>setDescription(e.target.value)} placeholder="Décris ce qui existe dans le monde…" rows={5}/>
    <button className="primary" disabled={busy||!canEdit} onClick={createItem}>{busy?"Validation…":"Vérifier et créer"}</button>
    <p className="muted">La cohérence est vérifiée avant l&apos;écriture. Une proposition acceptée est historisée et peut recevoir une illustration IA.</p>
   </div>}

   {tab==="notifications"&&<div className="timelineList">{events.map(e=><article className="timelineEvent" key={e.id}><span>JOUR {e.world_day}</span><h3>{e.title}</h3><p>{e.description}</p>{Array.isArray(e.consequences)&&e.consequences.length>0&&<ul>{e.consequences.map((c:string,i:number)=><li key={i}>{c}</li>)}</ul>}</article>)}{events.length===0&&<p className="muted">Aucun événement. Fais évoluer le monde pour commencer son histoire.</p>}</div>}

   {tab==="explore"&&<div className="explorePane">
    <nav className="subNav"><button className={exploreSubTab==="decouvrir"?"active":""} onClick={()=>setExploreSubTab("decouvrir")}>Découvrir</button><button className={exploreSubTab==="mesmondes"?"active":""} onClick={()=>setExploreSubTab("mesmondes")}>Mes mondes</button><button className={exploreSubTab==="suivis"?"active":""} onClick={()=>setExploreSubTab("suivis")}>Suivis</button></nav>
    <div className="searchBar"><span>🔍</span><input value={exploreQuery} onChange={e=>setExploreQuery(e.target.value)} placeholder="Rechercher un monde…"/></div>
    {exploreSubTab==="decouvrir"&&<div className="communityList">
     {communityLoading&&<p className="muted">Chargement…</p>}
     {!communityLoading&&communityCards.filter(c=>(c.name+" "+c.description).toLowerCase().includes(exploreQuery.toLowerCase())).map(c=><article className="communityCard" key={c.id}>
      <div className="communityCover">{c.coverImageUrl?<img src={c.coverImageUrl} alt=""/>:<Tile kind={themeVisual(c.theme,c.description)}/>}</div>
      <div className="communityBody"><h3 onClick={()=>openCommunityWorld(c)}>{c.name}</h3><div className="communityMeta">@{c.creatorHandle} · {c.theme}</div><p>{c.description}</p><div className="communityActions"><button className={`likeButton${c.liked?" liked":""}`} onClick={()=>toggleLike(c)}>{c.liked?"♥":"♡"} {c.likeCount}</button><button className={`followButton${c.following?" following":""}`} onClick={()=>toggleFollow(c)}>{c.following?"Suivi":"Suivre"}</button><button className="openWorldButton" onClick={()=>openCommunityWorld(c)}>Ouvrir</button></div></div>
     </article>)}
     {!communityLoading&&communityCards.length===0&&<p className="muted">{demoMode?"Aucun monde de démonstration.":!session?"Connecte-toi pour découvrir des mondes publics.":"Aucun monde public pour le moment. Sois le premier à en publier un !"}</p>}
    </div>}
    {exploreSubTab==="mesmondes"&&<div className="communityList">
     {demoMode&&<p className="muted">Crée un compte pour sauvegarder et retrouver tes propres mondes ici.</p>}
     {!demoMode&&worlds.filter(w=>(w.name+" "+(w.description||"")).toLowerCase().includes(exploreQuery.toLowerCase())).map(w=><article className="communityCard" key={w.id}>
      <div className="communityCover">{(w.visual_bible as any)?.coverImageUrl?<img src={(w.visual_bible as any).coverImageUrl} alt=""/>:<Tile kind={themeVisual(w.theme,w.description)}/>}</div>
      <div className="communityBody"><h3 onClick={()=>selectWorld(w)}>{w.name}</h3><div className="communityMeta">{w.theme}{w.is_public?" · Public":" · Privé"}</div><p>{w.description}</p><div className="communityActions"><button className="openWorldButton" onClick={()=>selectWorld(w)}>Ouvrir</button></div></div>
     </article>)}
     {!demoMode&&worlds.length===0&&<p className="muted">Tu n&apos;as pas encore créé de monde.</p>}
    </div>}
    {exploreSubTab==="suivis"&&<div className="communityList">
     {followedCards.filter(c=>(c.name+" "+c.description).toLowerCase().includes(exploreQuery.toLowerCase())).map(c=><article className="communityCard" key={c.id}>
      <div className="communityCover">{c.coverImageUrl?<img src={c.coverImageUrl} alt=""/>:<Tile kind={themeVisual(c.theme,c.description)}/>}</div>
      <div className="communityBody"><h3 onClick={()=>openCommunityWorld(c)}>{c.name}</h3><div className="communityMeta">@{c.creatorHandle} · {c.theme}</div><p>{c.description}</p><div className="communityActions"><button className={`likeButton${c.liked?" liked":""}`} onClick={()=>toggleLike(c)}>{c.liked?"♥":"♡"} {c.likeCount}</button><button className="followButton following" onClick={()=>toggleFollow(c)}>Suivi</button><button className="openWorldButton" onClick={()=>openCommunityWorld(c)}>Ouvrir</button></div></div>
     </article>)}
     {followedCards.length===0&&<p className="muted">Tu ne suis aucun monde pour le moment. Suis-en un depuis Découvrir.</p>}
    </div>}
   </div>}

   {tab==="profile"&&<div className="profilePane">
    {session&&<div className="accountCard"><span>{session.user.email}</span><button onClick={signOut}>Déconnexion</button></div>}
    {demoMode&&<div className="accountCard"><span>✦ Mode démo · Aerion</span><button onClick={exitDemo}>Quitter la démo</button></div>}
    <p className="panelTag">RÈGLES FONDAMENTALES</p>
    <div className="settingsBlock">{rules.map(r=><div className={`ruleRow${r.immutable?" locked":""}`} key={r.id}><span className="ruleIcon">{r.immutable?"🔒":"✓"}</span><div className="ruleBody">{editingRuleId===r.id?<><input value={drafts[r.id]?.title||""} onChange={e=>setDrafts(v=>({...v,[r.id]:{...v[r.id],title:e.target.value}}))}/><textarea value={drafts[r.id]?.description||""} onChange={e=>setDrafts(v=>({...v,[r.id]:{...v[r.id],description:e.target.value}}))} rows={3}/><div className="row"><button onClick={()=>setEditingRuleId(null)}>Annuler</button><button className="primary" disabled={busy} onClick={async()=>{await saveRule(r);setEditingRuleId(null)}}>Enregistrer</button></div></>:<><b>{r.title}</b><p>{r.description}</p></>}</div>{!r.immutable&&canEdit&&editingRuleId!==r.id&&<button onClick={()=>setEditingRuleId(r.id)}>✎</button>}</div>)}{rules.length===0&&<p className="muted">Aucune règle définie.</p>}</div>
    <p className="panelTag">PERMISSIONS</p>
    <div className="settingsBlock">
     <div className="switchRow"><div><span>Rendre ce monde visible dans Explorer</span><small>N&apos;importe quel utilisateur pourra le découvrir, le consulter et l&apos;aimer.</small></div><label className="switch"><input type="checkbox" disabled={!canManage||demoMode} checked={!!world.is_public} onChange={toggleWorldPublic}/><b/></label></div>
     <div className="switchRow"><div><span>Autoriser d&apos;autres utilisateurs à créer dans ce monde</span><small>Les contributeurs invités pourront proposer des créations.</small></div><label className="switch"><input type="checkbox" disabled={!canManage} checked={allowMemberCreation} onChange={()=>toggleWorldSetting("allow_member_creation")}/><b/></label></div>
     <div className="switchRow"><div><span>Validation manuelle des ajouts</span><small>Chaque proposition devra être approuvée avant d&apos;être ajoutée.</small></div><label className="switch"><input type="checkbox" disabled={!canManage} checked={manualReview} onChange={()=>toggleWorldSetting("manual_review")}/><b/></label></div>
    </div>
    <p className="panelTag">COLLABORATEURS</p>
    <div className="collabPanel">
     <div className="settingsBlock"><h3>Ajouter un collaborateur</h3>{canManage?<><input value={memberId} onChange={e=>setMemberId(e.target.value)} placeholder="UUID de l'utilisateur"/><select value={memberRole} onChange={e=>setMemberRole(e.target.value)}><option value="viewer">Lecteur</option><option value="contributor">Contributeur</option><option value="creator">Créateur</option><option value="admin">Administrateur</option></select><button className="primary" disabled={busy} onClick={saveMember}>Ajouter / modifier</button></>:<p className="muted">Seul le propriétaire ou un administrateur peut gérer les accès.</p>}</div>
     <div className="membersList"><div className="memberRow"><span>Propriétaire</span><b>{world.owner_id}</b></div>{members.map(m=><div className="memberRow" key={m.id}><span>{m.role}</span><b>{m.user_id}</b>{canManage&&<button onClick={()=>removeMember(m.user_id)}>Retirer</button>}</div>)}</div>
    </div>
    <p className="panelTag">DIAGNOSTIC</p>
    <div className="settingsBlock diagBlock">
     <p className="muted">Vérifie que la génération d&apos;images est bien configurée sur ce déploiement. Ce test ne consomme aucun crédit.</p>
     <button className="primary" disabled={diagBusy} onClick={runDiagnostic}>{diagBusy?"Vérification…":"Vérifier la configuration IA"}</button>
     {diag&&<div className="diagResult">
      <div className={`diagRow${diag.openai?(diag.openai.ok?" ok":" ko"):""}`}><span>{diag.openai?(diag.openai.ok?"✓":"✕"):"•"}</span><p>{diag.openai?.detail||"Aucune information."}</p></div>
      <div className="diagRow"><span>•</span><p>Base de données {diag.features?.supabase?"connectée":"non configurée"}.</p></div>
      {diag.models&&<div className="diagRow"><span>•</span><p>Modèle d&apos;images : {diag.models.image}.</p></div>}
      {diag.build&&<div className="diagRow"><span>•</span><p>Version déployée : {diag.build.commit} ({diag.build.environment}).</p></div>}
     </div>}
    </div>
   </div>}
  </section>}
  {screen==="world"&&world&&!assistantOpen&&<button className="assistantFab" title="Assistant Arthenis" onClick={()=>setAssistantOpen(true)}>✦</button>}
  {selected&&<aside className="inspector"><button onClick={()=>setSelected(null)}>×</button><p className="panelTag">{selected.kind}</p><h3>{selected.name}</h3><EntityVisual item={selected}/><p>{selected.description}</p><small>Jour {selected.day}</small>{canEdit&&<button className="primary wide" style={{marginTop:12}} onClick={()=>openStudio({scope:"entity",entity:{type:selected.kind,name:selected.name,description:selected.description},item:selected})}>✦ Générer une image</button>}</aside>}
  {screen==="world"&&world&&<nav className="bottomNav">
   <button className={(["overview","habitants","lieux"] as Tab[]).includes(tab)?"active":""} onClick={()=>setTab("overview")}><b>⌂</b>Accueil</button>
   <button className={tab==="create"?"active":""} onClick={()=>setTab("create")}><b>✦</b>Créer</button>
   <button className={tab==="explore"?"active":""} onClick={()=>{setTab("explore");loadCommunity()}}><b>🧭</b>Explorer</button>
   <button className={tab==="notifications"?"active":""} onClick={()=>setTab("notifications")}><b>🔔</b>Notifications</button>
   <button className={tab==="profile"?"active":""} onClick={()=>setTab("profile")}><b>◈</b>Profil</button>
  </nav>}
  {assistantOpen&&world&&<div className="assistantOverlay">
   <div className="assistantHeader"><button className="close" onClick={()=>setAssistantOpen(false)} aria-label="Fermer">×</button><div className="assistantOrb">✦</div><h2>Assistant Arthenis</h2><p>Ton co-créateur d&apos;univers pour {world.name}</p></div>
   {chatMessages.length===0&&<div className="assistantChips">
    <button onClick={()=>sendChatMessage("Décris une nouvelle région pour ce monde.")}>Décris une nouvelle région</button>
    <button onClick={()=>sendChatMessage("Imagine une civilisation qui pourrait exister ici.")}>Imagine une civilisation</button>
    <button onClick={()=>sendChatMessage("Suggère un personnage cohérent avec ce monde.")}>Suggère un personnage</button>
    <button onClick={()=>sendChatMessage("Que pourrait-il se passer ensuite dans ce monde ?")}>Que se passe-t-il ensuite ?</button>
   </div>}
   {chatMessages.length===0?<div className="assistantEmpty">Pose une question, propose une idée ou choisis une suggestion ci-dessus — je réponds en tenant compte des règles et de l&apos;état actuel de {world.name}.</div>:
   <div className="assistantMessages">{chatMessages.map((m,i)=><div key={i} className={`chatBubble ${m.role}`}>{m.text}</div>)}{chatBusy&&<div className="chatBubble assistant">…</div>}</div>}
   <div className="assistantInputRow"><input value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")sendChatMessage()}} placeholder="Écris ton message…" disabled={chatBusy}/><button className="primary" disabled={chatBusy||!chatInput.trim()} onClick={()=>sendChatMessage()} aria-label="Envoyer">➤</button></div>
  </div>}
  {studio&&world&&<div className="commandOverlay">
   <section className="commandModal studioModal">
    <div className="panelHeader"><div><p className="panelTag">GÉNÉRATION D&apos;IMAGE</p><h2>{studio.entity.name}</h2></div><button onClick={()=>setStudio(null)} aria-label="Fermer">×</button></div>
    <div className="studioPreview">
     {studioBusy?<div className="studioLoading"><span className="studioSpinner"/>Génération en cours…</div>
      :studioResult?<img src={studioResult} alt=""/>
      :<div className="studioPlaceholder">L&apos;image apparaîtra ici. Elle sera construite à partir du contexte de {world.name} : thème, lois, magie, créatures autorisées et éléments déjà établis.</div>}
    </div>
    {studioError&&<p className="studioError">Génération impossible — {studioError}</p>}
    <div className="studioFields">
     <div className="selectField"><label>TYPE D&apos;IMAGE</label><select value={studioOptions.category??categoryForKind(studio.entity.type)} onChange={e=>setStudioOptions(o=>({...o,category:e.target.value as ImageCategory}))}>{IMAGE_CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
     <div className="selectField"><label>STYLE</label><select value={studioOptions.style??"Peinture numérique"} onChange={e=>setStudioOptions(o=>({...o,style:e.target.value as ImageOptions["style"]}))}>{IMAGE_STYLES.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
     <div className="selectField"><label>CADRAGE</label><select value={studioOptions.framing??"Automatique"} onChange={e=>setStudioOptions(o=>({...o,framing:e.target.value as ImageOptions["framing"]}))}>{IMAGE_FRAMINGS.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
     <div className="selectField"><label>NIVEAU DE DÉTAIL</label><select value={studioOptions.detail??"Détaillé"} onChange={e=>setStudioOptions(o=>({...o,detail:e.target.value as ImageOptions["detail"]}))}>{IMAGE_DETAILS.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
    </div>
    <textarea value={studioOptions.extra??""} onChange={e=>setStudioOptions(o=>({...o,extra:e.target.value}))} placeholder="Précisions facultatives (ambiance, heure du jour, angle…)" rows={2}/>
    <div className="row">
     <button disabled={studioBusy||studioSaving} onClick={runStudio}>{studioResult?"Régénérer":"Générer"}</button>
     {studioResult&&<button className="primary" disabled={studioSaving||studioBusy} onClick={saveStudio}>{studioSaving?"Enregistrement…":"Enregistrer dans le monde"}</button>}
    </div>
   </section>
  </div>}
  {authOpen&&<Auth mode={authMode} email={email} password={password} busy={busy} notice={notice} setEmail={setEmail} setPassword={setPassword} auth={auth} reset={reset} toggle={()=>{setAuthMode(m=>m==="signin"?"signup":"signin");setNotice("")}} close={()=>setAuthOpen(false)}/>}
 </main>;
}
