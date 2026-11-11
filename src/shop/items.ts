// Catalogue de la boutique : skins de pieces, plateaux, packs de sons et emojis de chat.
// Les objets "exclusive" ne s'achetent pas : ce sont des recompenses de niveau (src/rewards/levels.ts).
export type ItemType = 'pieces' | 'board' | 'sounds' | 'emotes';

export interface ShopItem {
  id: string;
  type: ItemType;
  name: string;
  desc: string;
  price: number;
  /** Plateau : couleurs des cases */
  light?: string;
  dark?: string;
  /** Plateau : texture dessinee par-dessus les cases (bois, marbre, etoiles...) */
  texture?: 'grain' | 'marble' | 'linen' | 'stone' | 'stars' | 'grid' | 'glass' | 'aurora' | 'gold' | 'velvet' | 'frost' | 'sand' | 'nebula' | 'bronze' | 'silver' | 'platinum' | 'gem' | 'diamond' | 'eternal' | 'referral';
  /** Badge affiche dans la boutique */
  tag?: 'Nouveau' | 'Animé' | 'Lisibilité';
  /** Recompense de niveau : ne s'achete pas */
  exclusive?: boolean;
  /** Exclusif d'un evenement (ex. 'launch' : parrainage du lancement) */
  event?: string;
}

export const ITEMS: ShopItem[] = [
  // Pieces (filtres appliques aux pieces classiques)
  { id: 'pieces-classic', type: 'pieces', name: 'Classique', desc: 'Les pièces d’origine.', price: 0 },
  { id: 'pieces-gold', type: 'pieces', name: 'Or et bronze', desc: 'Blancs dorés, Noirs en bronze patiné.', price: 250 },
  { id: 'pieces-emerald', type: 'pieces', name: 'Émeraude', desc: 'Des pièces taillées dans la pierre verte.', price: 200 },
  { id: 'pieces-ruby', type: 'pieces', name: 'Rubis', desc: 'Rouge profond contre ivoire.', price: 200 },
  { id: 'pieces-ice', type: 'pieces', name: 'Glace', desc: 'Bleu glacier, reflets givrés.', price: 300 },
  { id: 'pieces-neon', type: 'pieces', name: 'Néon', desc: 'Des pièces qui brillent dans le noir.', price: 400 },
  { id: 'pieces-shadow', type: 'pieces', name: 'Ombres', desc: 'Silhouettes contrastées, style minimaliste.', price: 150 },
  { id: 'pieces-sapphire', type: 'pieces', name: 'Saphir', desc: 'Ivoire contre bleu profond.', price: 200 },
  { id: 'pieces-amethyst', type: 'pieces', name: 'Améthyste', desc: 'Lilas contre violet sombre.', price: 250 },
  { id: 'pieces-amber', type: 'pieces', name: 'Ambre', desc: 'Miel doré contre ambre brûlé.', price: 200 },
  { id: 'pieces-jade', type: 'pieces', name: 'Jade et onyx', desc: 'Jade pâle contre onyx au reflet vert.', price: 250 },
  { id: 'pieces-silver', type: 'pieces', name: 'Argent', desc: 'Argent poli contre acier sombre.', price: 300 },
  { id: 'pieces-fireice', type: 'pieces', name: 'Feu et glace', desc: 'Blancs givrés, Noirs entourés de braises.', price: 400 },
  { id: 'pieces-team', type: 'pieces', name: 'Bleu contre rouge', desc: 'Deux équipes bien distinctes, comme sur un terrain.', price: 200 },
  { id: 'pieces-pastel', type: 'pieces', name: 'Pastel', desc: 'Rose poudré contre menthe.', price: 200 },
  { id: 'pieces-sepia', type: 'pieces', name: 'Rétro', desc: 'Une vieille photo de tournoi, tout en sépia.', price: 150 },
  { id: 'pieces-ghost', type: 'pieces', name: 'Fantômes', desc: 'Pièces translucides, pour un plateau épuré.', price: 300 },
  { id: 'pieces-outline', type: 'pieces', name: 'Contour renforcé', desc: 'Les pièces d’origine avec un contour marqué : idéal sur petit écran.', price: 80, tag: 'Lisibilité' },
  { id: 'pieces-copper', type: 'pieces', name: 'Cuivre', desc: 'Cuivre neuf contre cuivre bruni.', price: 220, tag: 'Nouveau' },
  { id: 'pieces-verdigris', type: 'pieces', name: 'Patine', desc: 'Le vert-de-gris des vieilles statues de bronze.', price: 240, tag: 'Nouveau' },
  { id: 'pieces-pearl', type: 'pieces', name: 'Perle et charbon', desc: 'Nacre lumineuse contre charbon mat.', price: 260, tag: 'Nouveau' },
  { id: 'pieces-coral', type: 'pieces', name: 'Corail et lagon', desc: 'Corail chaud contre bleu-vert des lagons.', price: 220, tag: 'Nouveau' },
  { id: 'pieces-lava', type: 'pieces', name: 'Lave', desc: 'Roche en fusion contre basalte rougeoyant.', price: 380, tag: 'Nouveau' },
  { id: 'pieces-ocean', type: 'pieces', name: 'Océan', desc: 'Écume claire contre bleu des profondeurs.', price: 220, tag: 'Nouveau' },
  { id: 'pieces-forest', type: 'pieces', name: 'Forêt', desc: 'Mousse claire contre sous-bois sombre.', price: 200, tag: 'Nouveau' },
  { id: 'pieces-candy', type: 'pieces', name: 'Bonbons', desc: 'Guimauve rose contre réglisse violette.', price: 200, tag: 'Nouveau' },
  { id: 'pieces-mint', type: 'pieces', name: 'Menthe chocolat', desc: 'Menthe fraîche contre chocolat noir.', price: 220, tag: 'Nouveau' },
  { id: 'pieces-sunmoon', type: 'pieces', name: 'Soleil et lune', desc: 'Blancs solaires, Noirs au halo lunaire.', price: 420, tag: 'Nouveau' },
  { id: 'pieces-cyber', type: 'pieces', name: 'Cyber', desc: 'Contours lumineux cyan contre magenta.', price: 400, tag: 'Nouveau' },
  { id: 'pieces-aurora', type: 'pieces', name: 'Aurore boréale', desc: 'Vert polaire contre violet de nuit, avec un léger halo.', price: 380, tag: 'Nouveau' },
  { id: 'pieces-ink', type: 'pieces', name: 'Encre', desc: 'Papier blanc contre encre bleu nuit.', price: 180, tag: 'Nouveau' },
  { id: 'pieces-paper', type: 'pieces', name: 'Papier découpé', desc: 'Des pièces en carton, avec leur ombre portée.', price: 180, tag: 'Nouveau' },
  { id: 'pieces-rosegold', type: 'pieces', name: 'Or rose', desc: 'Or rose poli contre bronze profond.', price: 320, tag: 'Nouveau' },
  { id: 'pieces-toxic', type: 'pieces', name: 'Toxique', desc: 'Vert radioactif contre violet sombre.', price: 350, tag: 'Nouveau' },
  { id: 'pieces-dusk', type: 'pieces', name: 'Crépuscule', desc: 'Orange du couchant contre bleu de la nuit qui tombe.', price: 220, tag: 'Nouveau' },
  { id: 'pieces-marble', type: 'pieces', name: 'Marbre', desc: 'Marbre blanc veiné contre marbre gris.', price: 240, tag: 'Nouveau' },
  { id: 'pieces-wood', type: 'pieces', name: 'Bois sculpté', desc: 'Buis clair contre noyer foncé, comme un vieux jeu de famille.', price: 200, tag: 'Nouveau' },
  { id: 'pieces-royal', type: 'pieces', name: 'Royal', desc: 'Or contre bleu roi, pour les grandes occasions.', price: 450, tag: 'Nouveau' },
  { id: 'pieces-sakura', type: 'pieces', name: 'Sakura', desc: 'Fleur de cerisier contre bois sombre.', price: 260, tag: 'Nouveau' },
  { id: 'pieces-rainbow', type: 'pieces', name: 'Arc-en-ciel', desc: 'Les couleurs défilent doucement sur les deux camps.', price: 600, tag: 'Animé' },
  { id: 'pieces-holo', type: 'pieces', name: 'Holographique', desc: 'Blancs aux reflets changeants contre Noirs chromés.', price: 550, tag: 'Animé' },
  // Plateaux premium (les plateaux de base restent gratuits)
  { id: 'board-marbre', type: 'board', name: 'Marbre', desc: 'Élégant et lumineux.', price: 150, light: '#f3f1ec', dark: '#b9ad99', texture: 'marble' },
  { id: 'board-glace', type: 'board', name: 'Glace', desc: 'Frais comme une partie en hiver.', price: 150, light: '#f2fbfe', dark: '#5aaec9', texture: 'frost' },
  { id: 'board-emeraude', type: 'board', name: 'Émeraude', desc: 'Vert profond de tournoi.', price: 150, light: '#d9efe1', dark: '#3f8f6b' },
  { id: 'board-sable', type: 'board', name: 'Sable', desc: 'Dunes chaudes du désert.', price: 120, light: '#fbeed2', dark: '#dd9a5e', texture: 'sand' },
  { id: 'board-bonbon', type: 'board', name: 'Bonbon', desc: 'Rose sucré.', price: 120, light: '#ffe4ef', dark: '#e58fb1' },
  { id: 'board-minuit', type: 'board', name: 'Minuit', desc: 'Violet nuit, pour jouer tard.', price: 200, light: '#a99fc9', dark: '#4b3f78' },
  { id: 'board-tournoi', type: 'board', name: 'Tournoi', desc: 'Le vert et crème des salles de tournoi.', price: 80, light: '#f1f1dc', dark: '#2f6b4f', tag: 'Nouveau' },
  { id: 'board-ciel', type: 'board', name: 'Ciel', desc: 'Bleu clair et reposant.', price: 100, light: '#eaf6ff', dark: '#7fb7e6', tag: 'Nouveau' },
  { id: 'board-menthe', type: 'board', name: 'Menthe', desc: 'Frais et doux pour les yeux.', price: 100, light: '#e9f7ef', dark: '#6dbf9a', tag: 'Nouveau' },
  { id: 'board-pastel', type: 'board', name: 'Pastel', desc: 'Crème et bleu poudré.', price: 100, light: '#fdf2d8', dark: '#9ec7d3', tag: 'Nouveau' },
  { id: 'board-cerise', type: 'board', name: 'Cerise', desc: 'Rouge cerise sur fond rosé.', price: 140, light: '#ffe9e9', dark: '#c2484e', tag: 'Nouveau' },
  { id: 'board-automne', type: 'board', name: 'Automne', desc: 'Feuilles rousses et lumière dorée.', price: 140, light: '#f6deb8', dark: '#c46b2f', tag: 'Nouveau' },
  { id: 'board-volcan', type: 'board', name: 'Volcan', desc: 'Roche brûlante et cendres orangées.', price: 180, light: '#f2b880', dark: '#8c2f1b', tag: 'Nouveau' },
  { id: 'board-charbon', type: 'board', name: 'Charbon', desc: 'Gris profond et sobre.', price: 140, light: '#8f8f8f', dark: '#353535', tag: 'Nouveau' },
  { id: 'board-noyer', type: 'board', name: 'Noyer', desc: 'Bois de noyer, avec son veinage.', price: 200, light: '#d8b989', dark: '#8a5a34', texture: 'grain', tag: 'Nouveau' },
  { id: 'board-erable', type: 'board', name: 'Érable', desc: 'Bois blond d’érable, veiné.', price: 200, light: '#f6e3c0', dark: '#c99a5b', texture: 'grain', tag: 'Nouveau' },
  { id: 'board-ebene', type: 'board', name: 'Ébène', desc: 'Bois précieux : ébène et buis.', price: 280, light: '#d7c3a0', dark: '#3b2a20', texture: 'grain', tag: 'Nouveau' },
  { id: 'board-marbrenoir', type: 'board', name: 'Marbre noir', desc: 'Marbre blanc et noir veiné.', price: 280, light: '#e2e2e2', dark: '#3a3a3a', texture: 'marble', tag: 'Nouveau' },
  { id: 'board-marbrerose', type: 'board', name: 'Marbre rose', desc: 'Marbre rose poudré.', price: 240, light: '#f3e1e1', dark: '#c08f94', texture: 'marble', tag: 'Nouveau' },
  { id: 'board-ardoise', type: 'board', name: 'Ardoise', desc: 'Pierre grise au grain fin.', price: 200, light: '#c9d0d6', dark: '#36404b', texture: 'stone', tag: 'Nouveau' },
  { id: 'board-feutre', type: 'board', name: 'Feutre de club', desc: 'Le tapis vert des clubs d’échecs.', price: 180, light: '#e8e6d9', dark: '#4f7a4a', texture: 'linen', tag: 'Nouveau' },
  { id: 'board-journal', type: 'board', name: 'Papier journal', desc: 'Comme les diagrammes de la rubrique échecs.', price: 150, light: '#f1eee4', dark: '#6f6f68', texture: 'linen', tag: 'Nouveau' },
  { id: 'board-galaxie', type: 'board', name: 'Galaxie', desc: 'Jouer au milieu des étoiles.', price: 350, light: '#7a71b8', dark: '#241c4d', texture: 'stars', tag: 'Nouveau' },
  { id: 'board-abysses', type: 'board', name: 'Abysses', desc: 'Le bleu des grands fonds, et ses lueurs.', price: 300, light: '#5d9db5', dark: '#123a52', texture: 'stars', tag: 'Nouveau' },
  { id: 'board-neon', type: 'board', name: 'Néon', desc: 'Grille lumineuse façon salle d’arcade.', price: 320, light: '#34344a', dark: '#16161f', texture: 'grid', tag: 'Nouveau' },
  { id: 'board-or', type: 'board', name: 'Or', desc: 'Plateau doré aux reflets brillants.', price: 400, light: '#fbefc7', dark: '#c9a227', texture: 'glass', tag: 'Nouveau' },
  // Packs de sons : prises selon la valeur de la piece prise + sons de review
  { id: 'sounds-classic', type: 'sounds', name: 'Classique', desc: 'Les sons d’origine.', price: 0 },
  { id: 'sounds-impact', type: 'sounds', name: 'Impact', desc: 'Plus la pièce prise vaut cher, plus le choc est lourd. Review : gaffes dramatiques, beaux coups éclatants.', price: 200 },
  { id: 'sounds-arcade', type: 'sounds', name: 'Arcade', desc: 'Bips 8 bits : une note par pion, un arpège pour la dame. Review en mode jeu vidéo.', price: 250 },
  { id: 'sounds-crystal', type: 'sounds', name: 'Cristal', desc: 'Carillons dont la hauteur suit la valeur de la prise. Review tout en douceur.', price: 300 },
  { id: 'sounds-bois', type: 'sounds', name: 'Bois noble', desc: 'Uniquement des sons de bois : plus la prise est grosse, plus les coups s’enchaînent.', price: 150, tag: 'Nouveau' },
  { id: 'sounds-piano', type: 'sounds', name: 'Piano', desc: 'Des notes de piano qui montent avec la valeur de la prise, et redescendent quand tu perds une pièce.', price: 250, tag: 'Nouveau' },
  { id: 'sounds-harpe', type: 'sounds', name: 'Harpe', desc: 'Glissandos de harpe, légers et rapides.', price: 260, tag: 'Nouveau' },
  { id: 'sounds-cloches', type: 'sounds', name: 'Cloches', desc: 'Cloches graves qui résonnent longtemps : une prise de dame sonne comme un mariage.', price: 300, tag: 'Nouveau' },
  { id: 'sounds-zen', type: 'sounds', name: 'Zen', desc: 'Notes douces et lentes, gamme pentatonique. Pour jouer au calme.', price: 220, tag: 'Nouveau' },
  { id: 'sounds-retro', type: 'sounds', name: 'Console 16 bits', desc: 'Petites mélodies rapides de vieille console.', price: 250, tag: 'Nouveau' },
  { id: 'sounds-robot', type: 'sounds', name: 'Robot', desc: 'Bips électroniques aux intervalles étranges.', price: 220, tag: 'Nouveau' },
  { id: 'sounds-cosmos', type: 'sounds', name: 'Cosmique', desc: 'Notes qui glissent comme des signaux venus de l’espace.', price: 320, tag: 'Nouveau' },
  { id: 'sounds-percu', type: 'sounds', name: 'Percussions', desc: 'Toms et grosse caisse : une prise de dame, c’est un roulement de tambour.', price: 280, tag: 'Nouveau' },
  { id: 'sounds-sombre', type: 'sounds', name: 'Sombre', desc: 'Gamme mineure et timbre grinçant, pour une ambiance dramatique.', price: 260, tag: 'Nouveau' },

  // Emojis de chat (parties contre les bots et en ligne)
  { id: 'emotes-base', type: 'emotes', name: 'Essentiels', desc: 'Les réactions de base, offertes à tout le monde.', price: 0 },
  { id: 'emotes-tilt', type: 'emotes', name: 'Tilt', desc: 'Pour les gaffes, les pendules qui tombent et les mats ratés.', price: 100 },
  { id: 'emotes-animaux', type: 'emotes', name: 'Ménagerie', desc: 'Cavalier, hibou, tortue (pour l’adversaire qui prend son temps).', price: 120 },
  { id: 'emotes-fete', type: 'emotes', name: 'Fête', desc: 'Pour célébrer une victoire ou un joli coup.', price: 120 },
  { id: 'emotes-classe', type: 'emotes', name: 'Classe', desc: 'Lunettes noires, monocle et petit café : le grand maître détendu.', price: 150 },

  // Exclusifs : recompenses de niveau
  { id: 'emotes-pions', type: 'emotes', name: 'Pions vivants', desc: 'Des pions dessinés pour BetterMove, avec leurs humeurs.', price: 0, exclusive: true },
  { id: 'board-velours', type: 'board', name: 'Velours', desc: 'Velours bordeaux et crème, comme une salle de club.', price: 0, exclusive: true, light: '#f3e6d8', dark: '#8c2f3c', texture: 'velvet' },
  { id: 'pieces-laurel', type: 'pieces', name: 'Lauréat', desc: 'Or brillant et ébène, avec un halo doré.', price: 0, exclusive: true, tag: 'Animé' },
  { id: 'emotes-rois', type: 'emotes', name: 'Rois dorés', desc: 'Des rois couronnés qui brillent, dessinés pour BetterMove.', price: 0, exclusive: true },
  { id: 'sounds-fanfare', type: 'sounds', name: 'Fanfare', desc: 'Cuivres éclatants : chaque grosse prise sonne comme une victoire.', price: 0, exclusive: true },
  { id: 'board-aurore', type: 'board', name: 'Aurore boréale', desc: 'Des voiles verts et violets dansent sur le plateau.', price: 0, exclusive: true, light: '#dff3ec', dark: '#3d6f80', texture: 'aurora' },
  { id: 'pieces-borealis', type: 'pieces', name: 'Aurore vivante', desc: 'Pièces aux reflets verts et violets qui ondulent.', price: 0, exclusive: true, tag: 'Animé' },
  { id: 'emotes-cosmos', type: 'emotes', name: 'Cosmos', desc: 'Planètes et comètes holographiques qui flottent.', price: 0, exclusive: true },
  { id: 'sounds-orgue', type: 'sounds', name: 'Grand orgue', desc: 'Accords d’orgue qui résonnent comme dans une cathédrale.', price: 0, exclusive: true },
  { id: 'board-nebuleuse', type: 'board', name: 'Nébuleuse', desc: 'Nuages roses et magenta, semés d’étoiles.', price: 0, exclusive: true, light: '#e6c6ea', dark: '#5a1f5c', texture: 'nebula' },
  { id: 'pieces-obsidian', type: 'pieces', name: 'Obsidienne', desc: 'Verre volcanique noir contre nacre, avec un liseré de lave.', price: 0, exclusive: true },
  { id: 'emotes-legende', type: 'emotes', name: 'Légende', desc: 'Les rois holographiques, réservés aux plus assidus.', price: 0, exclusive: true },
  { id: 'board-ormassif', type: 'board', name: 'Or massif', desc: 'Cases d’or et de bronze polis.', price: 0, exclusive: true, light: '#ffe08a', dark: '#8a5a12', texture: 'gold' },
  { id: 'sounds-galaxie', type: 'sounds', name: 'Galaxie', desc: 'Nappes et glissandos venus du fond de l’espace.', price: 0, exclusive: true },
  { id: 'pieces-celestial', type: 'pieces', name: 'Céleste', desc: 'Blanc d’étoile contre bleu nuit, scintillement continu.', price: 0, exclusive: true, tag: 'Animé' },
  { id: 'pieces-legend', type: 'pieces', name: 'Légendaire', desc: 'Prisme vivant : les Blancs passent par toutes les couleurs, les Noirs brillent d’un halo arc-en-ciel.', price: 0, exclusive: true, tag: 'Animé' },
  { id: 'board-legende', type: 'board', name: 'Légende', desc: 'Le plateau des légendes : or blanc et jade noir, reflets de verre.', price: 0, exclusive: true, light: '#fff4d6', dark: '#0f3b3a', texture: 'glass' },
  // Nouveaux paliers de la route des niveaux
  { id: 'emotes-annot', type: 'emotes', name: 'Annotations', desc: 'Les pastilles de la review : !!, !, ★, livre, ?!, ?, ??.', price: 0, exclusive: true },
  { id: 'emotes-tactique', type: 'emotes', name: 'Tactiques', desc: 'Fourchette, clouage, enfilade, sacrifice, mat, pat, roque, promotion.', price: 0, exclusive: true },
  { id: 'emotes-annotor', type: 'emotes', name: 'Annotations dorées', desc: 'Les annotations en or qui brillent, plus GG, 1-0, 0-1 et ½-½.', price: 0, exclusive: true },
  { id: 'emotes-eternite', type: 'emotes', name: 'Éternité', desc: 'Étoiles, couronne et diamant qui scintillent sans fin.', price: 0, exclusive: true, tag: 'Animé' },
  { id: 'board-bronze', type: 'board', name: 'Bronze', desc: 'Métal brossé couleur bronze, avec un reflet chaud.', price: 0, exclusive: true, light: '#ecc89a', dark: '#7a4a22', texture: 'bronze' },
  { id: 'board-argent', type: 'board', name: 'Argent', desc: 'Argent brossé et miroir : froid, net, brillant.', price: 0, exclusive: true, light: '#f4f6f8', dark: '#8c96a2', texture: 'silver' },
  { id: 'board-platine', type: 'board', name: 'Platine', desc: 'Acier bleuté et reflet qui passe lentement sur le plateau.', price: 0, exclusive: true, light: '#eef2f8', dark: '#5d6f8a', texture: 'platinum', tag: 'Animé' },
  { id: 'board-rubis', type: 'board', name: 'Rubis royal', desc: 'Cases taillées comme des pierres précieuses, rouge profond.', price: 0, exclusive: true, light: '#fde6ea', dark: '#9b111e', texture: 'gem' },
  { id: 'board-diamant', type: 'board', name: 'Diamant', desc: 'Facettes de cristal et éclats de lumière qui scintillent.', price: 0, exclusive: true, light: '#f6fcff', dark: '#86b4d6', texture: 'diamond', tag: 'Animé' },
  { id: 'board-eternite', type: 'board', name: 'Éternité', desc: 'Or et nuit étoilée, traversés de particules dorées. La récompense ultime.', price: 0, exclusive: true, light: '#fdf3d7', dark: '#1d1440', texture: 'eternal', tag: 'Animé' },
  { id: 'pieces-argentpur', type: 'pieces', name: 'Argent pur', desc: 'Argent miroir contre acier sombre, reflet qui passe.', price: 0, exclusive: true, tag: 'Animé' },
  { id: 'pieces-platine', type: 'pieces', name: 'Platine', desc: 'Platine bleuté contre graphite, liseré lumineux.', price: 0, exclusive: true },
  { id: 'pieces-diamant', type: 'pieces', name: 'Diamant', desc: 'Pièces de cristal transparentes, éclats scintillants.', price: 0, exclusive: true, tag: 'Animé' },
  { id: 'pieces-parrainage', type: 'pieces', name: 'Parrainage', desc: 'Émeraude et or, liés par un ruban lumineux. Offert pendant l’événement de lancement à ceux qui invitent un ami.', price: 0, exclusive: true, event: 'launch', tag: 'Animé' },
  { id: 'board-parrainage', type: 'board', name: 'Parrainage', desc: 'Ivoire et émeraude, maillons dorés entrelacés. Exclusif à l’événement de lancement.', price: 0, exclusive: true, event: 'launch', light: '#f6eed6', dark: '#2a7a67', texture: 'referral' },
  { id: 'pieces-eternite', type: 'pieces', name: 'Éternité', desc: 'Or vivant entouré de particules brillantes. La récompense ultime.', price: 0, exclusive: true, tag: 'Animé' },
];

export const itemById = (id: string) => ITEMS.find((i) => i.id === id);

/** Comment gagner des pieces (affiche dans la boutique) */
export const EARN = {
  botWin: 15,
  botDraw: 8,
  botLoss: 3,
  /** Victoire contre un bot mieux classe que toi */
  upsetBonus: 10,
  lessonStar: 5,
  lessonFirst: 5,
  puzzle: 1,
  coachPosition: 3,
  coachSession: 10,
  tier: { 1: 10, 2: 25, 3: 60 } as Record<1 | 2 | 3, number>,
};
