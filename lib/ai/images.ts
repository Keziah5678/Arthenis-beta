import type { WorldContext } from "../arthenis";

// Image engine, kept separate from the route that calls it so the provider can
// be swapped without touching the API surface or the UI.

export const IMAGE_CATEGORIES = ["Monde", "Carte", "Région", "Civilisation", "Ville", "Personnage", "Créature", "Objet", "Événement", "Autre"] as const;
export type ImageCategory = (typeof IMAGE_CATEGORIES)[number];

export const IMAGE_STYLES = ["Peinture numérique", "Cinématique", "Aquarelle", "Encre et parchemin", "Réaliste"] as const;
export type ImageStyle = (typeof IMAGE_STYLES)[number];

export const IMAGE_FRAMINGS = ["Automatique", "Vue large", "Paysage", "Portrait", "Scène", "Plan rapproché"] as const;
export type ImageFraming = (typeof IMAGE_FRAMINGS)[number];

export const IMAGE_DETAILS = ["Esquisse", "Détaillé", "Très détaillé"] as const;
export type ImageDetail = (typeof IMAGE_DETAILS)[number];

export type ImageOptions = {
  category?: ImageCategory;
  style?: ImageStyle;
  framing?: ImageFraming;
  detail?: ImageDetail;
  extra?: string;
};

export type ImageEntity = { type: string; name: string; description: string };

/** Entity kinds as used by the app, mapped to a gallery category. */
export function categoryForKind(kind: string): ImageCategory {
  const k = kind.toLowerCase();
  if (k.includes("carte")) return "Carte";
  if (k.includes("couverture") || k.includes("monde")) return "Monde";
  if (k.includes("région") || k.includes("region")) return "Région";
  if (k.includes("civilisation")) return "Civilisation";
  if (k.includes("village") || k.includes("ville")) return "Ville";
  if (k.includes("personnage") || k.includes("portrait")) return "Personnage";
  if (k.includes("créature") || k.includes("creature")) return "Créature";
  if (k.includes("objet") || k.includes("ressource") || k.includes("influence")) return "Objet";
  if (k.includes("événement") || k.includes("evenement")) return "Événement";
  return "Autre";
}

/** Default framing per category so the user never has to choose one. */
function defaultFraming(category: ImageCategory): string {
  switch (category) {
    case "Personnage": return "portrait en buste, sujet centré, regard vers l'objectif";
    case "Créature": return "plan entier de la créature dans son habitat";
    case "Carte": return "carte vue du dessus de l'ensemble du territoire, à plat";
    case "Objet": return "objet isolé en gros plan, fond sobre";
    case "Ville":
    case "Civilisation": return "vue d'ensemble de l'établissement dans son paysage";
    case "Événement": return "scène narrative montrant l'action en cours";
    default: return "vue large et panoramique du paysage";
  }
}

function framingText(framing: ImageFraming | undefined, category: ImageCategory): string {
  switch (framing) {
    case "Vue large": return "vue large et panoramique";
    case "Paysage": return "plan paysage horizontal";
    case "Portrait": return "portrait rapproché, sujet centré";
    case "Scène": return "scène narrative avec plusieurs éléments en action";
    case "Plan rapproché": return "gros plan très rapproché sur le sujet";
    default: return defaultFraming(category);
  }
}

function styleText(style: ImageStyle | undefined): string {
  switch (style) {
    case "Cinématique": return "illustration cinématique, éclairage dramatique, profondeur de champ";
    case "Aquarelle": return "aquarelle peinte à la main, bords doux, pigments visibles";
    case "Encre et parchemin": return "encre sur parchemin vieilli, hachures, palette sépia";
    case "Réaliste": return "rendu photoréaliste, lumière naturelle";
    default: return "peinture numérique de concept art, qualité professionnelle, éclairage soigné";
  }
}

function detailText(detail: ImageDetail | undefined): string {
  switch (detail) {
    case "Esquisse": return "composition simple et lisible, peu de détails secondaires";
    case "Très détaillé": return "très haut niveau de détail, textures riches, arrière-plan travaillé";
    default: return "niveau de détail élevé mais lisible";
  }
}

/**
 * Hard constraints derived from the world's own rules. The images API has no
 * negative-prompt parameter, so these are stated as explicit prohibitions in
 * the prompt itself — this is what keeps a "no magic, no fictional creatures"
 * world from silently getting dragons.
 */
export function coherenceConstraints(context: WorldContext): string[] {
  const out: string[] = [];
  const theme = (context.theme || "").toLowerCase();
  const preModern = /médiéval|medieval|antique|préhist|prehist|tribal|âge de bronze|age de bronze/.test(theme);

  if (!context.fictionEnabled) {
    out.push("Aucun élément fictif, surnaturel ou imaginaire : le rendu doit rester plausible et réaliste.");
  }
  if (!context.fictionalCreaturesEnabled) {
    out.push("Aucune créature fantastique (ni dragon, troll, ogre, géant, licorne, gobelin, monstre) : uniquement des animaux réels.");
  }
  if (!context.magicEnabled) {
    out.push("Aucune magie visible : pas de sortilège, d'aura lumineuse, de runes brillantes ni d'effet arcanique.");
  }
  if (preModern) {
    out.push("Aucune technologie moderne : ni voiture, ni électricité, ni arme à feu, ni béton, ni verre industriel, ni plastique.");
  }
  out.push("Aucun texte, lettrage, légende, logo ou filigrane dans l'image.");
  out.push("Aucun élément d'interface, cadre ou bordure ajoutée.");
  return out;
}

/**
 * Visual-continuity anchors. Anything already established for this world (its
 * visual bible) or for related entities is restated so repeated generations of
 * the same city or character stay recognisable.
 */
function continuityLines(context: WorldContext, references: string[] | undefined): string[] {
  const out: string[] = [];
  const bible = context.visualBible ?? {};
  const palette = typeof bible.palette === "string" ? bible.palette : "";
  const architecture = typeof bible.architecture === "string" ? bible.architecture : "";
  const identity = typeof bible.identity === "string" ? bible.identity : "";
  if (palette) out.push(`Palette de couleurs du monde : ${palette}.`);
  if (architecture) out.push(`Architecture caractéristique : ${architecture}.`);
  if (identity) out.push(`Identité visuelle établie : ${identity}.`);
  for (const ref of (references ?? []).slice(0, 6)) {
    const clean = ref.trim();
    if (clean) out.push(`Élément déjà établi dans ce monde, à respecter : ${clean}.`);
  }
  return out;
}

/**
 * Builds the natural-language prompt sent to the image model. Image models
 * follow prose far better than a serialised object, so the world context is
 * flattened into sentences rather than JSON.
 */
export function buildImagePrompt(context: WorldContext, entity: ImageEntity, options: ImageOptions = {}, references?: string[]) {
  const category = options.category ?? categoryForKind(entity.type);
  const rules = (context.rules ?? []).filter(r => r?.title).slice(0, 8).map(r => `${r.title} : ${r.description}`);
  const constraints = coherenceConstraints(context);
  const continuity = continuityLines(context, references);

  const sections = [
    `${framingText(options.framing, category)} — ${entity.type} « ${entity.name} » du monde ${context.name}.`,
    entity.description ? `Sujet : ${entity.description}` : "",
    `Univers : monde de type ${context.theme}. Magie ${context.magicEnabled ? "autorisée et présente" : "absente"}, fiction ${context.fictionEnabled ? "autorisée" : "interdite"}, créatures fantastiques ${context.fictionalCreaturesEnabled ? "autorisées" : "interdites"}.`,
    rules.length ? `Lois du monde à respecter — ${rules.join(" ; ")}.` : "",
    continuity.length ? `Continuité visuelle — ${continuity.join(" ")}` : "",
    options.extra?.trim() ? `Précisions du créateur : ${options.extra.trim()}` : "",
    `Style : ${styleText(options.style)}, ${detailText(options.detail)}.`,
    `Contraintes strictes — ${constraints.join(" ")}`
  ].filter(Boolean);

  const prompt = sections.join("\n");

  return {
    category,
    prompt,
    // Kept alongside the image so a future regeneration can reuse the exact context.
    spec: {
      category,
      entity,
      world: {
        name: context.name,
        theme: context.theme,
        fictionEnabled: context.fictionEnabled,
        fictionalCreaturesEnabled: context.fictionalCreaturesEnabled,
        magicEnabled: context.magicEnabled,
        visualBible: context.visualBible ?? {}
      },
      options,
      references: references ?? [],
      constraints
    }
  };
}
