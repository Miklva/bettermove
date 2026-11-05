// Accueil : coffre de connexion, quetes du jour (+ bonus) et defi de la semaine.
import { useState } from 'react';
import {
  CHEST,
  chestFor,
  claimBonus,
  claimDaily,
  claimWeekly,
  DAILY_BONUS,
  loadQuests,
  openChest,
  progressOf,
  questById,
  useQuestTick,
  type Quest,
} from '../economy/quests';
import { dayId } from '../achievements/events';
import { sounds } from '../lib/sounds';

/** Temps restant avant minuit (nouvelles quetes) */
function untilMidnight() {
  const now = new Date();
  const m = new Date(now);
  m.setHours(24, 0, 0, 0);
  const min = Math.round((m.getTime() - now.getTime()) / 60000);
  return min >= 60 ? `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}` : `${min} min`;
}

export function QuestsCard({ hasAccount, onGo }: { hasAccount: boolean; onGo: (page: string) => void }) {
  useQuestTick();
  const [, force] = useState(0);
  const [chestMsg, setChestMsg] = useState<string | null>(null);
  const s = loadQuests(hasAccount);
  const refresh = () => force((x) => x + 1);
  const chestOpen = s.chestDay === dayId();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const nextStreak = s.chestDay === dayId(yesterday) ? s.streak + 1 : 1;
  const next = chestFor(nextStreak);
  const daily = s.daily.map((id) => questById(id)).filter((q): q is Quest => !!q);
  const allClaimed = daily.length > 0 && daily.every((q) => s.claimed.includes(q.id));
  const weekly = questById(s.weekly);

  const row = (q: Quest, kind: 'day' | 'week') => {
    const p = progressOf(q, kind);
    const claimed = kind === 'day' ? s.claimed.includes(q.id) : s.weekClaimed;
    return (
      <li key={q.id} className={`quest ${claimed ? 'claimed' : p.done ? 'ready' : ''}`}>
        <span className="quest-icon">{q.icon}</span>
        <div className="quest-main">
          <span className="quest-label">{q.label}</span>
          <span className="quest-bar">
            <i style={{ width: `${(p.value / q.target) * 100}%` }} />
          </span>
          <span className="muted tiny">
            {p.value}/{q.target} · +{q.coins} 🪙 · +{q.xp} XP
          </span>
        </div>
        {claimed ? (
          <span className="quest-done">✓</span>
        ) : p.done ? (
          <button
            className="btn primary small-btn"
            onClick={() => {
              if (kind === 'day' ? claimDaily(hasAccount, q.id) : claimWeekly(hasAccount)) sounds.success();
              refresh();
            }}
          >
            Récupérer
          </button>
        ) : (
          <button className="btn small-btn ghost" onClick={() => onGo(q.go)}>
            Y aller
          </button>
        )}
      </li>
    );
  };

  return (
    <section className="card quests-card">
      <div className="quests-head">
        <div>
          <div className="tc-label">🎯 Quêtes du jour</div>
          <span className="muted tiny">Nouvelles quêtes dans {untilMidnight()}</span>
        </div>
        <button
          className={`chest ${chestOpen ? 'open' : 'ready'}`}
          disabled={chestOpen}
          title={`Série : jour 1 = ${CHEST[0]} 🪙, jusqu’à ${CHEST[CHEST.length - 1]} 🪙 au 7e jour d’affilée`}
          onClick={() => {
            const r = openChest(hasAccount);
            if (r) {
              sounds.success();
              setChestMsg(`+${r.coins} 🪙 · +${r.xp} XP · série de ${r.streak} jour${r.streak > 1 ? 's' : ''}`);
            }
            refresh();
          }}
        >
          <span className="chest-icon">{chestOpen ? '📭' : '🎁'}</span>
          <span>
            <b>{chestOpen ? 'Coffre ouvert' : 'Coffre du jour'}</b>
            <small>
              {chestOpen
                ? chestMsg ?? `Série : ${s.streak} jour${s.streak > 1 ? 's' : ''} · reviens demain`
                : `+${next.coins} 🪙 · série jour ${nextStreak}`}
            </small>
          </span>
        </button>
      </div>
      <ul className="quest-list">{daily.map((q) => row(q, 'day'))}</ul>
      <div className={`quest-bonus ${s.bonus ? 'claimed' : allClaimed ? 'ready' : ''}`}>
        <span>
          🏆 Les 3 quêtes terminées : <b>+{DAILY_BONUS.coins} 🪙 · +{DAILY_BONUS.xp} XP</b>
        </span>
        {s.bonus ? (
          <span className="quest-done">✓</span>
        ) : (
          <button
            className="btn primary small-btn"
            disabled={!allClaimed}
            onClick={() => {
              if (claimBonus(hasAccount)) sounds.success();
              refresh();
            }}
          >
            Récupérer
          </button>
        )}
      </div>
      {weekly && (
        <>
          <div className="tc-label quests-week">🗓️ Défi de la semaine</div>
          <ul className="quest-list">{row(weekly, 'week')}</ul>
        </>
      )}
    </section>
  );
}
