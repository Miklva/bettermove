// Recompenses (pieces + XP) accessibles de partout : l'XP passe par un evenement que l'App applique au profil.
import { earn } from '../shop/store';
import { load, save } from '../lib/storage';
import { periodCounts, track } from '../achievements/events';

export const XP_EVENT = 'bettermove-xp';

/** Donne des pieces et de l'XP. silent : pas de notification de pieces (une autre s'affiche deja). */
export function reward(coins: number, xp: number, reason: string, silent = false) {
  if (coins > 0) earn(coins, reason, silent);
  if (xp > 0) window.dispatchEvent(new CustomEvent(XP_EVENT, { detail: xp }));
}

/* ---------------- Parties en ligne ---------------- */

export const ONLINE_EARN = {
  rated: { win: { coins: 25, xp: 50 }, draw: { coins: 12, xp: 25 }, loss: { coins: 5, xp: 10 } },
  friendly: { win: { coins: 10, xp: 25 }, draw: { coins: 6, xp: 15 }, loss: { coins: 3, xp: 5 } },
  /** Victoire contre un joueur classe au moins 100 points au-dessus */
  upset: 10,
  /** Premiere victoire en ligne de la journee */
  firstWin: { coins: 30, xp: 50 },
  /** Parties amicales recompensees par jour (evite les parties arrangees entre amis) */
  friendlyPerDay: 5,
  /** Coups minimum (des deux joueurs) pour qu'une partie rapporte */
  minPlies: 10,
};

const DONE_KEY = 'bettermove.onlineRewarded.v1';

/** Recompense une partie en ligne terminee, une seule fois par partie. Renvoie le detail pour l'affichage. */
export function rewardOnlineGame(g: {
  id: number;
  rated: boolean;
  result: 'win' | 'draw' | 'loss';
  plies: number;
  myRating?: number;
  oppRating?: number;
}): { coins: number; xp: number; note?: string } | null {
  const done = load<number[]>(DONE_KEY, []);
  if (done.includes(g.id)) return null;
  save(DONE_KEY, [g.id, ...done].slice(0, 400));
  if (g.plies < ONLINE_EARN.minPlies) return { coins: 0, xp: 0, note: 'Partie trop courte : pas de récompense.' };
  const today = periodCounts('day');
  if (!g.rated && (today['online-friendly-paid'] ?? 0) >= ONLINE_EARN.friendlyPerDay)
    return { coins: 0, xp: 0, note: `Récompenses des parties amicales atteintes pour aujourd’hui (${ONLINE_EARN.friendlyPerDay}).` };
  const base = (g.rated ? ONLINE_EARN.rated : ONLINE_EARN.friendly)[g.result];
  let coins = base.coins;
  let xp = base.xp;
  const notes: string[] = [];
  if (g.result === 'win' && g.rated && (g.oppRating ?? 0) - (g.myRating ?? 9999) >= 100) {
    coins += ONLINE_EARN.upset;
    notes.push(`+${ONLINE_EARN.upset} 🪙 contre plus fort`);
  }
  if (g.result === 'win' && !(today['online-win'] ?? 0)) {
    coins += ONLINE_EARN.firstWin.coins;
    xp += ONLINE_EARN.firstWin.xp;
    notes.push('bonus 1re victoire du jour');
  }
  if (!g.rated) track('online-friendly-paid');
  track('online-game');
  if (g.result === 'win') {
    track('online-win');
    track('win-any');
  }
  reward(coins, xp, `Partie en ligne ${g.result === 'win' ? 'gagnée' : g.result === 'draw' ? 'nulle' : 'perdue'}`);
  return { coins, xp, note: notes.length ? notes.join(' · ') : undefined };
}

/* ---------------- Autres modes ---------------- */

/** Contre le professeur : partie terminee, bonus si gagnee */
export function rewardTeacher(won: boolean) {
  const today = periodCounts('day')['teacher-paid'] ?? 0;
  if (today >= 5) return;
  track('teacher-paid');
  reward(won ? 20 : 5, won ? 50 : 20, won ? 'Victoire contre le professeur' : 'Partie contre le professeur');
}

/** Review d'une partie (une fois par partie, 10 par jour) */
export function rewardReview(id: string) {
  const done = load<string[]>('bettermove.reviewRewarded.v1', []);
  if (done.includes(id)) return;
  save('bettermove.reviewRewarded.v1', [id, ...done].slice(0, 500));
  if ((periodCounts('day')['review-paid'] ?? 0) >= 10) return;
  track('review-paid');
  reward(3, 15, 'Partie analysée', true);
}

/** 1v1 sur le meme ecran : un peu d'XP pour une vraie partie (pas de pieces, 5 par jour) */
export function rewardLocal(id: string, plies: number) {
  const done = load<string[]>('bettermove.localRewarded.v1', []);
  if (done.includes(id)) return;
  save('bettermove.localRewarded.v1', [id, ...done].slice(0, 200));
  if (plies < 20 || (periodCounts('day')['local-paid'] ?? 0) >= 5) return;
  track('local-paid');
  reward(0, 10, 'Partie 1v1');
}
