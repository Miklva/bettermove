// Recompenses de niveau : un cadeau a chaque niveau au debut, puis de plus en plus rares.
// Les objets "exclusive" du catalogue ne s'obtiennent qu'ici.
import { useEffect, useState } from 'react';
import { load, save } from '../lib/storage';
import { earn, grant } from '../shop/store';
import { itemById } from '../shop/items';
import { track } from '../achievements/events';
import { t, tmap } from '../i18n';

export type Reward = { kind: 'coins'; amount: number } | { kind: 'item'; id: string } | { kind: 'ach'; id: string };

const c = (amount: number): Reward => ({ kind: 'coins', amount });
const i = (id: string): Reward => ({ kind: 'item', id });
const a = (id: string): Reward => ({ kind: 'ach', id });

export const LEVEL_REWARDS: Record<number, Reward[]> = {
  2: [c(50)],
  3: [i('emotes-pions'), c(30)],
  4: [c(60)],
  5: [i('board-velours'), a('lvl-5')],
  6: [i('emotes-annot')],
  7: [c(100)],
  8: [c(120)],
  9: [c(140)],
  10: [i('pieces-laurel'), c(150), a('lvl-10')],
  11: [i('board-bronze')],
  12: [i('emotes-rois')],
  13: [i('emotes-tactique')],
  14: [i('sounds-fanfare'), c(150)],
  15: [c(200), a('lvl-15')],
  16: [i('board-aurore')],
  17: [i('board-argent')],
  18: [c(300)],
  20: [i('pieces-borealis'), c(200), a('lvl-20')],
  22: [i('emotes-cosmos')],
  24: [i('pieces-argentpur')],
  25: [i('sounds-orgue'), c(300)],
  27: [c(400)],
  28: [i('board-nebuleuse')],
  30: [i('pieces-obsidian'), c(400), a('lvl-30')],
  33: [i('emotes-annotor')],
  35: [c(600)],
  38: [i('board-platine')],
  40: [i('emotes-legende'), c(500), a('lvl-40')],
  42: [i('pieces-platine')],
  45: [i('board-ormassif')],
  48: [c(800)],
  50: [i('pieces-celestial'), i('sounds-galaxie'), c(1000), a('lvl-50')],
  55: [i('board-rubis')],
  60: [c(1500)],
  65: [i('board-diamant')],
  70: [i('pieces-diamant')],
  75: [i('pieces-legend')],
  80: [c(2500)],
  85: [i('board-legende')],
  90: [i('emotes-eternite')],
  100: [i('board-eternite'), i('pieces-eternite'), c(5000), a('lvl-100')],
};

export const REWARD_LEVELS = Object.keys(LEVEL_REWARDS)
  .map(Number)
  .sort((x, y) => x - y);

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic';
export function rarityOf(level: number): Rarity {
  return level <= 10 ? 'common' : level <= 20 ? 'rare' : level <= 40 ? 'epic' : level < 100 ? 'legendary' : 'mythic';
}
export const RARITY_LABEL: Record<Rarity, string> = tmap({ common: 'Commun', rare: 'Rare', epic: 'Épique', legendary: 'Légendaire', mythic: 'Mythique' });

/** Niveau qui offre un objet exclusif */
export function rewardLevelOf(itemId: string): number | null {
  return REWARD_LEVELS.find((l) => LEVEL_REWARDS[l].some((r) => r.kind === 'item' && r.id === itemId)) ?? null;
}

/** Un palier n'a rien a recuperer s'il ne contient que des succes (ils se debloquent tout seuls) */
const claimable = (level: number) => LEVEL_REWARDS[level].some((r) => r.kind !== 'ach');

const KEY = 'bettermove.levelRewards.v1';
const EVENT = 'bettermove-level-rewards';

export function claimedLevels(): number[] {
  return load<number[]>(KEY, []);
}

/** Paliers atteints mais pas encore recuperes */
export function pendingLevels(level: number): number[] {
  const done = new Set(claimedLevels());
  return REWARD_LEVELS.filter((l) => l <= level && claimable(l) && !done.has(l));
}

/** Recupere les cadeaux d'un palier atteint. Renvoie false s'il est deja pris ou pas atteint. */
export function claimLevel(level: number, current: number): boolean {
  if (level > current || !LEVEL_REWARDS[level]) return false;
  const done = claimedLevels();
  if (done.includes(level)) return false;
  save(KEY, [...done, level]);
  for (const r of LEVEL_REWARDS[level]) {
    if (r.kind === 'coins') earn(r.amount, t('Récompense du niveau {n}', { n: level }), true);
    if (r.kind === 'item' && itemById(r.id)) grant(r.id);
  }
  track('level-claim');
  window.dispatchEvent(new Event(EVENT));
  return true;
}

/** Suit les paliers recuperes (pour les badges et la page) */
export function useClaimed(): number[] {
  const [v, setV] = useState(claimedLevels);
  useEffect(() => {
    const on = () => setV(claimedLevels());
    window.addEventListener(EVENT, on);
    window.addEventListener('storage', on);
    return () => {
      window.removeEventListener(EVENT, on);
      window.removeEventListener('storage', on);
    };
  }, []);
  return v;
}
