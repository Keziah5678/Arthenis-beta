# Arthenis — carte du code

Application Next.js 16 (App Router) + React 19 + TypeScript, adossée à Supabase
pour l'authentification, la base et le stockage, et à OpenAI pour la génération
de texte et d'images. Tout le rendu client tient dans `app/`, toute la logique
réutilisable dans `lib/`.

## Le chemin le plus court pour comprendre

```
lib/world/identity.ts   →  ce qu'est un monde, visuellement
lib/world/terrain.ts    →  à quoi ressemble son sol
app/TerrainCanvas.tsx   →  comment ce sol est dessiné
app/WorldMap.tsx        →  la carte, ses cinq niveaux, les gestes
app/placeholder.ts      →  l'image d'un élément qui n'en a pas encore
lib/ai/images.ts        →  le prompt envoyé au moteur d'images
app/ArthenisApp.tsx     →  l'application elle-même
```

## Principe central : identité, canon, environnement

Trois notions séparées, et le reste en découle.

**L'identité visuelle** est dérivée une fois à la création du monde, puis
stockée dans `worlds.visual_bible.identity`. Elle contient l'époque, le climat,
la palette, l'architecture, les matériaux, la végétation, le relief,
l'atmosphère, la lumière, le niveau technologique, et la liste de ce que les
règles du monde interdisent. Le terrain, les placeholders et les prompts de
génération lisent tous cette même structure. C'est ce qui empêche un monde
médiéval froid de produire soudain des néons.

**Le canon** est ce que le créateur a réellement écrit : régions, civilisations,
villages, personnages, créatures, ressources. Il vit dans les tables Supabase et
s'affiche sous forme de marqueurs sur la carte.

**L'environnement** est le décor généré pour que le monde ne soit jamais vide :
relief, forêts, rivières, biomes. Il est purement procédural. Il ne crée jamais
de village, de peuple ni d'histoire, et n'est jamais présenté comme un fait du
monde.

## Le terrain

`lib/world/terrain.ts` est un ensemble de fonctions pures. Altitude, humidité,
rivières et biome se déduisent de la graine du monde et d'une coordonnée. Rien
n'est stocké, rien n'est aléatoire : le même monde au même endroit donne
toujours le même sol, après un rechargement comme après un aller-retour de zoom.

`app/TerrainCanvas.tsx` le dessine en deux couches. Le sol est un champ de
couleur échantillonné à une fraction de la résolution écran, assez léger pour
être redessiné pendant un déplacement. Le décor par-dessus est vectoriel, tracé
à pleine résolution, donc net à n'importe quel grossissement.

Un détail qui a demandé du soin : le terrain est défini en unités de monde, donc
ses octaves fines disparaissent à l'écran quand on descend, et le sol vire au
gris uniforme. Un terme de détail supplémentaire corrige cela, mais seulement si
sa longueur d'onde reste large de plusieurs échantillons. Indexé sur le zoom, il
se replie en neige de télévision. Il est donc indexé sur l'espacement réel de la
grille d'échantillonnage, et la pente est normalisée par ce même pas.

## Les cinq niveaux

`Monde`, `Continent`, `Région`, `Local`, `Exploration`. Chaque type de création
apparaît au niveau où il devient lisible, et quand trop d'éléments tombent dans
le cadre, ils sont classés par sélection, puis importance, puis distance à l'œil.

## Les images

`app/api/generate-image/route.ts` construit le prompt à partir de l'identité du
monde et des champs remplis par le créateur, puis essaie `gpt-image-1` et, si la
clé n'y a pas accès, `dall-e-3`. Une clé invalide ou un solde vide arrête tout de
suite, puisque cela vaut pour tous les modèles. Les images distantes sont
téléchargées et réhébergées, car les adresses renvoyées expirent en une heure.

La clé n'existe que côté serveur, sous `process.env.OPENAI_API_KEY`. Elle n'est
jamais envoyée au navigateur, jamais journalisée, jamais commitée.

Un élément sans image générée reçoit un placeholder dessiné depuis la palette et
le terrain de son propre monde, unique par identifiant. Ce n'est pas une photo
générique : une image de banque est hors sujet dans la plupart des mondes.

## Vérifier

```
npm run lint        # ESLint, configuration plate
npx tsc --noEmit    # types
npm run build       # build de production
npm run dev         # développement sur le port 3000
```

## Base de données

Les migrations sont dans `supabase/migrations/`, à appliquer dans l'ordre
alphabétique. La sécurité au niveau des lignes s'appuie sur trois fonctions
`SECURITY DEFINER` : `is_world_member`, `is_world_editor` et
`can_manage_world_members`. Le stockage des images utilise le bucket privé
`arthenis-assets`, lu par URL signée.

## Variables d'environnement

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
OPENAI_API_KEY                 # serveur uniquement
OPENAI_TEXT_MODEL              # optionnel, défaut gpt-4o
OPENAI_IMAGE_MODEL             # optionnel, défaut gpt-image-1
OPENAI_IMAGE_SIZE              # optionnel, défaut 1024x1024
```

L'écran Profil contient un bouton « Vérifier la configuration IA » qui teste la
clé et l'accès aux modèles sans consommer de crédit.
