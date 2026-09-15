// Static seed data for the Explorer/Community screen in demo mode, since there
// is no real multi-user backend to browse without an account. Likes here are
// local-only, exactly like the rest of demo mode.
export type DemoCommunityWorld = {
  id: string;
  name: string;
  description: string;
  theme: string;
  creatorHandle: string;
  likeCount: number;
};

export const DEMO_COMMUNITY_WORLDS: DemoCommunityWorld[] = [
  { id: "demo-nexoria", name: "Nexoria", description: "Une civilisation futuriste au bord de l'effondrement, où les dernières tours-cités s'éteignent une à une.", theme: "Science-fiction", creatorHandle: "ThomS", likeCount: 856 },
  { id: "demo-sylvaen", name: "Sylvaen", description: "Un monde naturel et mystique où les esprits de la forêt négocient encore avec les derniers humains.", theme: "Fantasy", creatorHandle: "Kaori", likeCount: 921 },
  { id: "demo-valdrim", name: "Valdrim", description: "Un univers sombre où la lumière n'existe plus depuis la disparition du dernier soleil.", theme: "Post-apocalyptique", creatorHandle: "Elyna", likeCount: 674 }
];
