// Noms francais des familles d'ouvertures et des fins de partie.
import type { EndReason } from '../achievements/facts';
import { lang, tmap } from '../i18n';

export const OPENING_FR: Record<string, string> = {
  'Scandinavian Defense': 'Scandinave',
  'Italian Game': 'Italienne',
  'Ruy Lopez': 'Espagnole',
  'Sicilian Defense': 'Sicilienne',
  'French Defense': 'Française',
  'Caro-Kann Defense': 'Caro-Kann',
  "Queen's Gambit Declined": 'Gambit dame refusé',
  "Queen's Gambit Accepted": 'Gambit dame accepté',
  "Queen's Gambit": 'Gambit dame',
  "King's Gambit": 'Gambit du roi',
  "King's Gambit Accepted": 'Gambit du roi accepté',
  "Bishop's Opening": 'Partie du fou',
  "King's Pawn Game": 'Partie du pion roi',
  "Queen's Pawn Game": 'Partie du pion dame',
  'Four Knights Game': 'Partie des quatre cavaliers',
  'Three Knights Opening': 'Partie des trois cavaliers',
  'Scotch Game': 'Partie écossaise',
  'Vienna Game': 'Partie viennoise',
  "Petrov's Defense": 'Défense Petrov',
  'Philidor Defense': 'Défense Philidor',
  'Pirc Defense': 'Défense Pirc',
  'Modern Defense': 'Défense moderne',
  "Alekhine's Defense": 'Défense Alekhine',
  'Slav Defense': 'Défense slave',
  'English Opening': 'Ouverture anglaise',
  'Indian Defense': 'Défense indienne',
  "King's Indian Defense": 'Est-indienne',
  'Nimzo-Indian Defense': 'Nimzo-indienne',
  'Dutch Defense': 'Défense hollandaise',
};
export const openingFr = (name?: string) => {
  const fam = name?.replace(/^[A-E]\d\d /, '').split(':')[0];
  // Hors francais : le nom anglais d'origine (celui de la base d'ouvertures) est le plus connu
  if (!fam) return undefined;
  return lang() === 'fr' ? (OPENING_FR[fam] ?? fam) : fam;
};


export const END_LABEL: Record<EndReason, string> = tmap({
  mate: 'Mat',
  time: 'Temps',
  resign: 'Abandon',
  stalemate: 'Pat',
  repetition: 'Répétition',
  fifty: '50 coups',
  insufficient: 'Matériel insuffisant',
  agreement: 'Accord',
  other: 'Autre',
});

/** Variante apres la famille, ex. "Main Line" */
export const openingVariant = (name?: string) => name?.split(':').slice(1).join(':').trim() || '';
