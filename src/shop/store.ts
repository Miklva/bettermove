// Porte-monnaie et inventaire : pieces gagnees, objets achetes et equipes.
import { useSyncExternalStore } from 'react';
import { t } from '../i18n';
import { load, save } from '../lib/storage';
import { itemById } from './items';
import { setSoundPack } from '../lib/sounds';
import { track, trackMax } from '../achievements/events';

export interface ShopState {
  coins: number;
  owned: string[];
  equipped: { pieces: string; sounds: string };
  /** Derniers gains et achats */
  ledger: { at: string; amount: number; reason: string }[];
  /** Bonus de bienvenue calcule sur la progression existante */
  seeded?: boolean;
  /** Date d'achat de chaque objet paye (pour le remboursement sous 24 h) */
  purchases?: Record<string, { at: string; price: number }>;
  /** Objets deja rembourses une fois (pas de second remboursement) */
  refunded?: string[];
}

/** Delai pendant lequel un achat peut etre rembourse */
export const REFUND_MS = 24 * 3600_000;

const KEY = 'bettermove.shop.v1';
export const COINS_EVENT = 'bettermove-coins';

const DEFAULT: ShopState = {
  coins: 0,
  owned: ['pieces-classic', 'sounds-classic'],
  equipped: { pieces: 'pieces-classic', sounds: 'sounds-classic' },
  ledger: [],
};

/** Anciennes collections par piece (retirees) : remboursees automatiquement */
const OLD_PIECE_PRICE: Record<string, number> = { k: 120, q: 100, r: 80, b: 80, n: 80, p: 60 };
const OLD_BUNDLE: Record<string, number> = { espace: 400, fantasy: 400, foot: 350, ocean: 350, savane: 300, gourmand: 300 };
function migrate(s: ShopState): ShopState {
  const old = s.owned.filter((id) => id.startsWith('col-'));
  const eq = s.equipped as ShopState['equipped'] & { pieceMap?: unknown };
  if (!old.length && !eq.pieceMap) return s;
  let refund = 0;
  for (const col of Object.keys(OLD_BUNDLE)) {
    const pieces = old.filter((id) => id.startsWith(`col-${col}-`) && !id.endsWith('-all'));
    const paidPieces = pieces.reduce((t, id) => t + OLD_PIECE_PRICE[id.slice(-1)], 0);
    // Le lot coutait son prix moins les pieces deja achetees : total paye = max(prix du lot, pieces)
    refund += old.includes(`col-${col}-all`) ? Math.max(OLD_BUNDLE[col], paidPieces) : paidPieces;
  }
  const equipped = { pieces: eq.pieces, sounds: eq.sounds };
  const next: ShopState = {
    ...s,
    coins: s.coins + refund,
    owned: s.owned.filter((id) => !id.startsWith('col-')),
    equipped,
    ledger: refund > 0 ? [{ at: new Date().toISOString(), amount: refund, reason: t('Remboursement : collections retirées') }, ...s.ledger] : s.ledger,
  };
  save(KEY, next);
  return next;
}

let state: ShopState = migrate({ ...DEFAULT, ...load<Partial<ShopState>>(KEY, {}) });
const listeners = new Set<() => void>();
setSoundPack(state.equipped.sounds);

function commit(next: ShopState) {
  state = next;
  save(KEY, next);
  setSoundPack(next.equipped.sounds);
  listeners.forEach((l) => l());
  trackMax('coins-max', next.coins);
}

/** Relit le stockage (apres une synchronisation par exemple) */
export function reloadShop() {
  state = migrate({ ...DEFAULT, ...load<Partial<ShopState>>(KEY, {}) });
  setSoundPack(state.equipped.sounds);
  listeners.forEach((l) => l());
}

export const getShop = () => state;

export function useShop() {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => state,
  );
}

export function earn(amount: number, reason: string, silent = false) {
  if (amount <= 0) return;
  commit({
    ...state,
    coins: state.coins + amount,
    ledger: [{ at: new Date().toISOString(), amount, reason }, ...state.ledger].slice(0, 60),
  });
  if (!silent) window.dispatchEvent(new CustomEvent(COINS_EVENT, { detail: { amount, reason } }));
}

export function owns(id: string) {
  const it = itemById(id);
  return !!it && ((it.price === 0 && !it.exclusive) || state.owned.includes(id));
}

/** Achete un objet. Renvoie un message d'erreur, ou null si tout va bien. */
export function buy(id: string): string | null {
  const it = itemById(id);
  if (!it) return t('Objet inconnu');
  if (owns(id)) return null;
  if (it.event) return t('Objet exclusif : il s’obtient pendant l’événement (onglet Communauté › Événements).');
  if (it.exclusive) return t('Objet exclusif : il se gagne en montant de niveau.');
  if (state.coins < it.price) return t('Il te manque {n} pièces.', { n: it.price - state.coins });
  commit({
    ...state,
    coins: state.coins - it.price,
    owned: [...state.owned, id],
    purchases: { ...(state.purchases ?? {}), [id]: { at: new Date().toISOString(), price: it.price } },
    ledger: [{ at: new Date().toISOString(), amount: -it.price, reason: t('Achat : {name}', { name: it.name }) }, ...state.ledger].slice(0, 60),
  });
  track('buy');
  track('spent', it.price);
  trackMax('price-max', it.price);
  if (it.type === 'sounds') track('buy-sounds');
  if (it.type === 'emotes') track('buy-emotes');
  return null;
}

/** Remboursement possible ? Renvoie le temps restant (ms) et le montant, ou null */
export function refundInfo(id: string): { msLeft: number; amount: number } | null {
  const p = state.purchases?.[id];
  if (!p || !state.owned.includes(id) || state.refunded?.includes(id)) return null;
  const msLeft = Date.parse(p.at) + REFUND_MS - Date.now();
  return msLeft > 0 ? { msLeft, amount: p.price } : null;
}

/** Rembourse un achat de moins de 24 h : l'objet est retire (et desequipe), les pieces sont rendues */
export function refund(id: string): string | null {
  const info = refundInfo(id);
  const it = itemById(id);
  if (!info || !it) return t('Ce remboursement n’est plus possible (plus de 24 h après l’achat, ou déjà remboursé une fois).');
  const purchases = { ...(state.purchases ?? {}) };
  delete purchases[id];
  const equipped = { ...state.equipped };
  if (equipped.pieces === id) equipped.pieces = 'pieces-classic';
  if (equipped.sounds === id) equipped.sounds = 'sounds-classic';
  commit({
    ...state,
    coins: state.coins + info.amount,
    owned: state.owned.filter((o) => o !== id),
    equipped,
    purchases,
    refunded: [...(state.refunded ?? []), id],
    ledger: [{ at: new Date().toISOString(), amount: info.amount, reason: t('Remboursement : {name}', { name: it.name }) }, ...state.ledger].slice(0, 60),
  });
  track('refund');
  return null;
}

export function equip(type: 'pieces' | 'sounds', id: string) {
  if (!owns(id)) return;
  commit({ ...state, equipped: { ...state.equipped, [type]: id } });
  track('equip');
}

/** Recompense : objet offert (sans le payer) */
export function grant(id: string) {
  if (!itemById(id) || state.owned.includes(id)) return;
  commit({ ...state, owned: [...state.owned, id] });
}

/** Une seule fois : pieces pour la progression deja accomplie avant la boutique */
export function seedCoins(amount: number) {
  if (state.seeded) return;
  commit({
    ...state,
    seeded: true,
    coins: state.coins + amount,
    ledger: amount
      ? [{ at: new Date().toISOString(), amount, reason: t('Bonus : ta progression avant la boutique') }, ...state.ledger]
      : state.ledger,
  });
}
