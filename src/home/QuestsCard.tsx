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

import { t, tn } from '../i18n';
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
  // Repliees par defaut (accueil plus lisible), ouvertes d'office s'il y a quelque chose a recuperer
  const doneCount = daily.filter((q) => progressOf(q, 'day').done).length;
  const toClaim =
    daily.some((q) => progressOf(q, 'day').done && !s.claimed.includes(q.id)) ||
    (allClaimed && !s.bonus) ||
    (!!weekly && progressOf(weekly, 'week').done && !s.weekClaimed);
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem('bettermove.questsOpen') === '1';
    } catch {
      return false;
    }
  });
  const toggle = () => {
    try {
      localStorage.setItem('bettermove.questsOpen', open ? '0' : '1');
    } catch {
      /* rien */
    }
    setOpen(!open);
  };
  const shown = open || toClaim;

  const row = (q: Quest, kind: 'day' | 'week') => {
    const p = progressOf(q, kind);
    const claimed = kind === 'day' ? s.claimed.includes(q.id) : s.weekClaimed;
    return (
      <li key={q.id} className={`quest ${claimed ? 'claimed' : p.done ? 'ready' : ''}`}>
        <span className="quest-icon">{q.icon}</span>
        <div className="quest-main">
          <span className="quest-label">{t(q.label)}</span>
          <span className="quest-bar">
            <i style={{ width: `${(p.value / q.target) * 100}%` }} />
          </span>
          <span className="muted tiny">
            {p.value}/{q.target} · +{q.coins} 🪙 · +{q.xp}{" "}{t("XP")}</span>
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
          >{t("Récupérer")}</button>
        ) : (
          <button className="btn small-btn ghost" onClick={() => onGo(q.go)}>{t("Y aller")}</button>
        )}
      </li>
    );
  };

  return (
    <section className="card quests-card">
      <div className="quests-head">
        <button className="quests-toggle" onClick={toggle} aria-expanded={shown}>
          <span className="tc-label">{t("🎯 Quêtes du jour")}</span>
          <span className="muted tiny">
            {t("{done}/{total} terminées", { done: doneCount, total: daily.length })}
            {weekly ? ` · ${t("défi de la semaine {v}/{n}", { v: progressOf(weekly, 'week').value, n: weekly.target })}` : ''} · {t("nouvelles dans {time}", { time: untilMidnight() })}
          </span>
          <span className="quests-more small">{shown ? t("Masquer ▴") : t("Voir les quêtes ▾")}</span>
        </button>
        <button
          className={`chest ${chestOpen ? 'open' : 'ready'}`}
          disabled={chestOpen}
          title={t('Série : jour 1 = {a} 🪙, jusqu’à {b} 🪙 au 7e jour d’affilée', { a: CHEST[0], b: CHEST[CHEST.length - 1] })}
          onClick={() => {
            const r = openChest(hasAccount);
            if (r) {
              sounds.success();
              setChestMsg(`+${r.coins} 🪙 · +${r.xp} XP · ${tn(r.streak, 'série de {n} jour', 'série de {n} jours')}`);
            }
            refresh();
          }}
        >
          <span className="chest-icon">{chestOpen ? '📭' : '🎁'}</span>
          <span>
            <b>{chestOpen ? t("Coffre ouvert") : t("Coffre du jour")}</b>
            <small>
              {chestOpen
                ? chestMsg ?? `${tn(s.streak, 'Série : {n} jour', 'Série : {n} jours')} · ${t('reviens demain')}`
                : `+${next.coins} 🪙 · ${t('série jour {n}', { n: nextStreak })}`}
            </small>
          </span>
        </button>
      </div>
      {shown && (
        <>
      <ul className="quest-list">{daily.map((q) => row(q, 'day'))}</ul>
      <div className={`quest-bonus ${s.bonus ? 'claimed' : allClaimed ? 'ready' : ''}`}>
        <span>{t("🏆 Les 3 quêtes terminées :")}{" "}<b>+{DAILY_BONUS.coins} 🪙 · +{DAILY_BONUS.xp}{" "}{t("XP")}</b>
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
          >{t("Récupérer")}</button>
        )}
      </div>
      {weekly && (
        <>
          <div className="tc-label quests-week">{t("🗓️ Défi de la semaine")}</div>
          <ul className="quest-list">{row(weekly, 'week')}</ul>
        </>
      )}
        </>
      )}
    </section>
  );
}
