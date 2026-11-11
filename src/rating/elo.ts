import { t } from '../i18n';
// Elo simple, le meme partout (bots, problemes, en ligne : voir aussi server/src/rating.js).
// Classement provisoire ("?") pendant les 5 premieres parties : les gains et pertes sont plus forts
// pour atteindre vite le bon niveau, puis diminuent jusqu'a environ 8 points contre un adversaire de meme niveau.
export const PROVISIONAL_GAMES = 5;
/** K des 5 premieres parties, puis K stable (16 : +8 / -8 contre un adversaire de meme niveau) */
export const K_SCHEDULE = [80, 64, 48, 40, 32];
export const K_STABLE = 16;

export const kFor = (games: number) => K_SCHEDULE[games] ?? K_STABLE;
export const expected = (rating: number, opp: number) => 1 / (1 + 10 ** ((opp - rating) / 400));

/** Variation d'Elo apres une partie (score : 1 victoire, 0.5 nulle, 0 defaite) */
export function eloDelta(rating: number, opp: number, score: number, games = Infinity) {
  return Math.round(kFor(games) * (score - expected(rating, opp)));
}

/** Ce que rapporte ou coute la prochaine partie */
export function stakes(rating: number, opp: number, games = Infinity) {
  return { win: eloDelta(rating, opp, 1, games), draw: eloDelta(rating, opp, 0.5, games), loss: eloDelta(rating, opp, 0, games) };
}

export const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '±0');

/** Texte d'aide sur le "?" */
/** Explication du classement provisoire (traduite a l'affichage) */
export const provisionalHelp = () =>
  t('? = classement provisoire : il devient définitif après {n} parties classées. Pendant ces {n} parties, tu gagnes et perds beaucoup plus de points (jusqu’à ±40 contre un adversaire de ton niveau), puis de moins en moins pour arriver à environ ±8 par partie.', { n: PROVISIONAL_GAMES });
