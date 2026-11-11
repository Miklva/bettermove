// Bonus de bienvenue de la boutique : pieces pour la progression faite avant son arrivee (une seule fois).
import { load } from '../lib/storage';
import { ACHIEVEMENTS } from '../achievements/list';
import type { Profile } from '../rating/profile';
import { EARN } from './items';
import { reloadShop, seedCoins } from './store';

export function seedShopFromProgress() {
  reloadShop();
  const p = load<Partial<Profile>>('bettermove.profile.v1', {});
  const unlocked = load<Record<string, string>>('bettermove.achievements.v1', {});
  const fromAch = ACHIEVEMENTS.filter((a) => unlocked[a.id]).reduce((s, a) => s + EARN.tier[a.tier], 0);
  const fromLessons = Object.values(p.lessons ?? {}).reduce((s, l) => s + l.stars * EARN.lessonStar + EARN.lessonFirst, 0);
  const fromGames = (p.history ?? []).reduce((s, g) => s + (g.score === 1 ? EARN.botWin : g.score === 0.5 ? EARN.botDraw : EARN.botLoss), 0);
  seedCoins(fromAch + fromLessons + fromGames + (p.puzzleStats?.solved ?? 0) * EARN.puzzle);
}
