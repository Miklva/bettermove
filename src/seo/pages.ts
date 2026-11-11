// Referencement : titre, description et texte de chaque page publique.
// Sert au build (une page HTML par adresse + sitemap) et a l'app (titre de l'onglet, description).

export interface SeoPage {
  path: string;
  title: string;
  description: string;
  h1: string;
  intro: string;
  /** Priorite dans le sitemap (0 a 1) */
  priority: number;
}

export const SITE_NAME = 'BetterMove';

export const SEO_PAGES: SeoPage[] = [
  {
    path: '/',
    title: 'BetterMove · Apprendre et progresser aux échecs, gratuitement',
    description:
      'Joue aux échecs gratuitement contre des bots qui jouent comme des humains, résous des problèmes, suis des cours et fais analyser tes parties. Sans publicité.',
    h1: 'Apprendre les échecs et progresser, gratuitement',
    intro:
      'BetterMove t’aide à progresser aux échecs à ton rythme : des bots de 400 à 2700 Elo, des milliers de problèmes à ton niveau, des cours pas à pas, un suivi personnalisé de tes erreurs et des parties en ligne. Gratuit, sans publicité, en français.',
    priority: 1,
  },
  {
    path: '/jouer/bot',
    title: 'Jouer aux échecs contre l’ordinateur · BetterMove',
    description:
      'Affronte des bots d’échecs de 400 à 2700 Elo qui jouent et discutent comme des humains. Gratuit, sans inscription, avec analyse de la partie.',
    h1: 'Jouer aux échecs contre l’ordinateur',
    intro:
      'Choisis ton adversaire parmi des bots de 400 à 2700 Elo, chacun avec son style. Ton classement s’ajuste après chaque partie, et chaque partie peut être analysée coup par coup avec Stockfish.',
    priority: 0.9,
  },
  {
    path: '/jouer/monde',
    title: 'Jouer aux échecs en ligne contre de vrais joueurs · BetterMove',
    description: 'Parties d’échecs classées en ligne contre des joueurs de ton niveau, en blitz, rapide ou partie longue. Gratuit.',
    h1: 'Jouer aux échecs en ligne',
    intro: 'Lance une partie classée contre un joueur BetterMove de ton niveau, tiré au hasard, et fais monter ton Elo en ligne.',
    priority: 0.8,
  },
  {
    path: '/jouer/local',
    title: 'Jouer aux échecs à deux sur le même écran · BetterMove',
    description: 'Une partie d’échecs à deux joueurs sur un seul appareil, avec pendule et plateau qui se retourne. Gratuit.',
    h1: 'Jouer aux échecs à deux sur le même écran',
    intro: 'Deux joueurs, un seul appareil : choisis la cadence et joue avec un ami, puis analyse la partie ensemble.',
    priority: 0.6,
  },
  {
    path: '/apprendre/cours',
    title: 'Cours d’échecs gratuits pour débutants et confirmés · BetterMove',
    description:
      'Apprends les échecs pas à pas : règles, tactiques (fourchette, clouage), mats, finales et ouvertures. Cours interactifs gratuits.',
    h1: 'Cours d’échecs interactifs',
    intro:
      'De l’initiation aux finales : le plateau et les pièces, les tactiques essentielles, les mats types, les finales et les grandes ouvertures, avec des exercices à chaque leçon.',
    priority: 0.9,
  },
  {
    path: '/apprendre/problemes',
    title: 'Problèmes d’échecs à ton niveau · BetterMove',
    description:
      'Des milliers de problèmes d’échecs adaptés à ton classement, par thème : mat en 2, fourchette, clouage, finales. Explications en cas d’erreur.',
    h1: 'Problèmes d’échecs',
    intro:
      'Entraîne ta tactique avec des milliers de positions choisies à ton niveau. Ton Elo de problèmes évolue à chaque résolution, et l’app t’explique tes erreurs.',
    priority: 0.9,
  },
  {
    path: '/apprendre/rush',
    title: 'Puzzle Rush : problèmes d’échecs contre la montre · BetterMove',
    description: 'Résous un maximum de problèmes d’échecs contre la montre : trois erreurs et c’est fini. Bats ton record.',
    h1: 'Puzzle Rush',
    intro: 'Un maximum de problèmes d’échecs en un temps limité, de plus en plus difficiles. Trois erreurs et la partie s’arrête.',
    priority: 0.7,
  },
  {
    path: '/apprendre/professeur',
    title: 'Jouer contre un professeur d’échecs qui commente · BetterMove',
    description: 'Une partie d’échecs où chaque coup est expliqué : comprends pourquoi un coup est bon ou mauvais.',
    h1: 'Jouer contre le professeur',
    intro: 'Une vraie partie d’échecs commentée coup par coup, pour comprendre les idées derrière chaque décision.',
    priority: 0.7,
  },
  {
    path: '/apprendre/repertoire',
    title: 'Apprendre ses ouvertures d’échecs · BetterMove',
    description: 'Construis ton répertoire d’ouvertures et révise-le coup par coup jusqu’à le connaître par cœur.',
    h1: 'Répertoire d’ouvertures',
    intro: 'Choisis tes ouvertures et révise-les : l’app joue l’adversaire et te fait répéter les lignes au bon moment.',
    priority: 0.6,
  },
  {
    path: '/progresser/suivi',
    title: 'Analyse de tes parties d’échecs et suivi personnalisé · BetterMove',
    description:
      'Stockfish analyse tes parties (bots, chess.com, Lichess) et trouve tes erreurs récurrentes. Exercices tirés de tes propres parties.',
    h1: 'Suivi personnalisé de tes parties d’échecs',
    intro:
      'Importe tes parties chess.com ou Lichess : BetterMove repère les erreurs qui reviennent (pièces en prise, tactiques ratées, finales) et te propose des exercices tirés de tes propres parties.',
    priority: 0.8,
  },
  {
    path: '/progresser/historique',
    title: 'Historique et analyse de parties d’échecs · BetterMove',
    description: 'Retrouve toutes tes parties d’échecs et analyse-les coup par coup avec Stockfish. Import chess.com et Lichess.',
    h1: 'Historique et analyse de parties',
    intro: 'Toutes tes parties au même endroit, avec statistiques et analyse coup par coup par le moteur Stockfish.',
    priority: 0.6,
  },
  {
    path: '/communaute/classement',
    title: 'Classement des joueurs d’échecs · BetterMove',
    description: 'Le classement des meilleurs joueurs BetterMove en ligne, contre les bots et en problèmes.',
    h1: 'Classement des joueurs',
    intro: 'Les meilleurs joueurs de la communauté BetterMove, en parties en ligne, contre les bots et en problèmes.',
    priority: 0.5,
  },
  {
    path: '/communaute/evenements',
    title: 'Événements · BetterMove',
    description: 'Les événements de la communauté BetterMove et leurs récompenses exclusives.',
    h1: 'Événements',
    intro: 'Des événements limités dans le temps, avec des récompenses exclusives pour les joueurs.',
    priority: 0.4,
  },
  {
    path: '/aide',
    title: 'Aide et contact · BetterMove',
    description: 'Une question, un bug ou une idée ? Contacte l’équipe BetterMove.',
    h1: 'Aide et contact',
    intro: 'Pose ta question, signale un bug ou propose une idée : l’équipe te répond par mail.',
    priority: 0.3,
  },
  {
    path: '/infos/mentions-legales',
    title: 'Mentions légales · BetterMove',
    description: 'Mentions légales du site BetterMove.',
    h1: 'Mentions légales',
    intro: 'Éditeur, hébergeur et informations légales du site BetterMove.',
    priority: 0.1,
  },
  {
    path: '/infos/confidentialite',
    title: 'Politique de confidentialité · BetterMove',
    description: 'Quelles données BetterMove utilise, pourquoi, et comment les exporter ou les supprimer.',
    h1: 'Politique de confidentialité',
    intro: 'Les données utilisées par BetterMove, leur durée de conservation et tes droits.',
    priority: 0.1,
  },
  {
    path: '/infos/conditions',
    title: 'Conditions d’utilisation · BetterMove',
    description: 'Les conditions d’utilisation du site BetterMove.',
    h1: 'Conditions d’utilisation',
    intro: 'Les règles d’utilisation de BetterMove.',
    priority: 0.1,
  },
  {
    path: '/infos/licences',
    title: 'Licences et code source · BetterMove',
    description: 'BetterMove est un logiciel libre (GPL-3.0). Licences des projets utilisés et code source.',
    h1: 'Licences et code source',
    intro: 'BetterMove est un logiciel libre sous licence GPL-3.0, construit avec des projets libres.',
    priority: 0.1,
  },
];
