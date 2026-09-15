// Static seed data for the "Aerion" demo world. Loaded entirely client-side
// so a visitor can explore and try Arthenis without an account or Supabase —
// nothing here is persisted; it only lives in the browser's React state.

export type DemoWorld = {
  id: string;
  owner_id: string;
  name: string;
  description: string;
  theme: string;
  magic_enabled: boolean;
  fiction_enabled: boolean;
  fictional_creatures_enabled: boolean;
  visual_bible?: Record<string, unknown>;
  world_memory?: Record<string, unknown>;
};

export type DemoItem = {
  id: string;
  kind: "Région" | "Civilisation" | "Village" | "Personnage" | "Créature" | "Influence";
  name: string;
  description: string;
  day: number;
  x: number;
  y: number;
  imageUrl?: string | null;
};

export type DemoRule = { id: string; category: string; title: string; description: string; immutable: boolean };
export type DemoEvent = { id: string; title: string; description: string; world_day: number; consequences: string[] };

export const AERION_WORLD: DemoWorld = {
  id: "demo-aerion",
  owner_id: "demo",
  name: "Aerion",
  description: "Un continent médiéval-fantastique où la magie est rare et coûteuse, et où une ancienne créature vient de s'éveiller sous les Pics de Givre.",
  theme: "Fantasy",
  magic_enabled: true,
  fiction_enabled: true,
  fictional_creatures_enabled: true,
  visual_bible: { theme: "Fantasy", magic: true, fiction: true, fictionalCreatures: true },
  world_memory: { day: 14, map_version: 1 }
};

export const AERION_ITEMS: DemoItem[] = [
  { id: "demo-r1", kind: "Région", name: "Hautes-Terres de Sylvenoire", description: "Une forêt ancienne et dense qui couvre le centre du continent, réputée pour ses druides et son bois noir imputrescible.", day: 1, x: 28, y: 55 },
  { id: "demo-r2", kind: "Région", name: "Pics de Givre", description: "Une chaîne de montagnes glacées au nord, dont les sommets abritent des grottes que plus personne n'ose explorer depuis l'Éveil.", day: 1, x: 10, y: 8 },
  { id: "demo-r3", kind: "Région", name: "Cité-Dune d'Or", description: "Un désert méridional traversé par des routes caravanières reliant les royaumes du sud.", day: 1, x: 55, y: 85 },
  { id: "demo-c1", kind: "Civilisation", name: "Royaume de Valcendre", description: "Le plus grand royaume humain d'Aerion, gouverné par une monarchie héréditaire et une petite caste de mages autorisés.", day: 1, x: 44, y: 32 },
  { id: "demo-v1", kind: "Village", name: "Port-Maréah", description: "Un village de pêcheurs sur la côte est, connu pour son marché aux poissons et ses contrebandiers.", day: 3, x: 88, y: 18 },
  { id: "demo-p1", kind: "Personnage", name: "Elarion Duskblade", description: "Chevalier-mage de Valcendre, l'un des rares autorisés à pratiquer la magie de combat. Envoyé enquêter sur les Pics de Givre.", day: 5, x: 10, y: 34 },
  { id: "demo-p2", kind: "Personnage", name: "Maître Bram", description: "Forgeron de Port-Maréah ayant récemment découvert un minerai inconnu dans les grottes côtières.", day: 8, x: 92, y: 44 },
  { id: "demo-cr1", kind: "Créature", name: "Sylvurus", description: "Un dragon ancien endormi depuis des siècles sous les Pics de Givre, récemment réveillé par des tremblements de terre inexpliqués.", day: 12, x: 8, y: 60 },
  { id: "demo-i1", kind: "Influence", name: "Minerai de Bram", description: "Un métal bleuté aux propriétés inconnues, découvert par Maître Bram — sa nature exacte reste à déterminer.", day: 8, x: 70, y: 62 }
];

export const AERION_EVENTS: DemoEvent[] = [
  { id: "demo-e1", title: "Fondation du Royaume de Valcendre", description: "Les tribus humaines des Hautes-Terres s'unissent sous une même couronne pour repousser les raids venus du désert.", world_day: 1, consequences: ["Naissance de la monarchie de Valcendre.", "Établissement des premières routes commerciales."] },
  { id: "demo-e2", title: "Découverte du minerai bleuté", description: "Maître Bram met au jour un minerai inconnu dans une grotte côtière près de Port-Maréah.", world_day: 8, consequences: ["Intérêt croissant des marchands pour Port-Maréah.", "Premières rumeurs à la cour de Valcendre."] },
  { id: "demo-e3", title: "L'Éveil de Sylvurus", description: "Des tremblements de terre secouent les Pics de Givre. Les rares survivants d'une expédition rapportent avoir vu un dragon endormi depuis des siècles ouvrir les yeux.", world_day: 12, consequences: ["Valcendre envoie Elarion Duskblade enquêter.", "Les villages du nord commencent à évacuer les vallées proches."] }
];

export const AERION_RULES: DemoRule[] = [
  { id: "demo-rule1", category: "Époque", title: "Médiéval-fantastique", description: "Aerion se situe à une époque médiévale. Aucune technologie moderne, industrielle ou futuriste n'est autorisée.", immutable: true },
  { id: "demo-rule2", category: "Magie", title: "Magie rare et encadrée", description: "La magie existe mais reste rare : elle nécessite un apprentissage long et est encadrée par les royaumes qui l'autorisent.", immutable: true },
  { id: "demo-rule3", category: "Créatures", title: "Créatures fantastiques anciennes", description: "Les créatures fantastiques (dragons, etc.) existent mais sont rares et généralement endormies ou disparues depuis des siècles.", immutable: false },
  { id: "demo-rule4", category: "Société", title: "Monarchies régionales", description: "Aerion est divisé en royaumes et cités-états indépendants, sans autorité centrale unique.", immutable: false }
];

export const AERION_DAY = Number(AERION_WORLD.world_memory?.day ?? 1);
