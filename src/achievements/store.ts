// Suivi des succes debloques : evaluation a chaque changement du profil ou du journal.
import { useEffect, useMemo, useRef, useState } from 'react';
import { load, save } from '../lib/storage';
import type { PlayerProfile } from '../rating/profile';
import { FACTS_EVENT, listFacts, listReviewFacts, seedFromSavedGames } from './facts';
import { ACHIEVEMENTS, TIER_XP, type Achievement, type Ctx } from './list';
import { earn } from '../shop/store';
import { EARN } from '../shop/items';
import { loadEvents } from './events';
import { COINS_EVENT, getShop } from '../shop/store';
import { loadRush } from '../rush/store';
import { loadRep, subscribeRep } from '../repertoire/store';
import { loadTips } from '../tips/store';

const UNLOCKED_KEY = 'bettermove.achievements.v1';

export type Unlocked = Record<string, string>;

export function progressOf(a: Achievement, ctx: Ctx) {
  const target = a.target ?? 1;
  let value = 0;
  try {
    value = a.value(ctx);
  } catch {
    value = 0;
  }
  return { value: Math.min(value, target), target, done: value >= target };
}

export function useAchievements(player: PlayerProfile, onUnlock: (list: Achievement[]) => void) {
  const [tick, setTick] = useState(0);
  const [unlocked, setUnlocked] = useState<Unlocked>(() => load<Unlocked>(UNLOCKED_KEY, {}));

  useEffect(() => {
    const on = () => setTick((t) => t + 1);
    window.addEventListener(FACTS_EVENT, on);
    window.addEventListener(COINS_EVENT, on);
    const offRep = subscribeRep(on);
    seedFromSavedGames();
    return () => {
      window.removeEventListener(FACTS_EVENT, on);
      window.removeEventListener(COINS_EVENT, on);
      offRep();
    };
  }, []);

  const ctx: Ctx = useMemo(() => {
    const facts = listFacts();
    return {
      games: facts.filter((f) => f.source === 'bot'),
      local: facts.filter((f) => f.source === 'local'),
      online: facts.filter((f) => f.source === 'online'),
      reviews: listReviewFacts(),
      profile: player.profile,
      ev: loadEvents(),
      shop: getShop(),
      rush: loadRush(),
      rep: loadRep(),
      tips: loadTips(),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player.profile, tick]);

  const grant = useRef(player.grantXp);
  grant.current = player.grantXp;
  const notify = useRef(onUnlock);
  notify.current = onUnlock;

  useEffect(() => {
    const known = load<Unlocked>(UNLOCKED_KEY, {});
    const fresh = ACHIEVEMENTS.filter((a) => !known[a.id] && progressOf(a, ctx).done);
    if (!fresh.length) return;
    const now = new Date().toISOString();
    const next = { ...known };
    for (const a of fresh) next[a.id] = now;
    save(UNLOCKED_KEY, next);
    setUnlocked(next);
    grant.current(fresh.reduce((s, a) => s + TIER_XP[a.tier], 0));
    earn(
      fresh.reduce((s, a) => s + EARN.tier[a.tier], 0),
      fresh.length > 1 ? `${fresh.length} succès débloqués` : `Succès : ${fresh[0].title}`,
    );
    notify.current(fresh);
  }, [ctx]);

  return { ctx, unlocked };
}
