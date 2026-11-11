// Classement public des joueurs BetterMove
import { useEffect, useState } from 'react';
import { apiCall } from '../sync/client';
import { useSync } from '../sync/AccountModal';
import { Avatar } from '../profile/avatar';
import { DailyBoard } from '../home/DailyBoard';
import { todayKey } from '../puzzles/db';
import { useRouteTab } from '../router';
import { provisionalHelp } from '../rating/elo';

import { locale, t, tmap, tn } from '../i18n';
type Board = 'daily' | 'online' | 'bots' | 'puzzles' | 'rush3' | 'rush5' | 'survival' | 'stars' | 'xp';
interface Row {
  rank: number;
  username: string;
  value: number;
  provisional: boolean;
}
interface Res {
  top: Row[];
  total: number;
  me: Row | null;
}

type BoardCfg = { id: Board; label: string; icon: string; unit: string; hint: string };
const BOARDS: BoardCfg[] = ([
  { id: 'daily', label: 'Problème du jour', icon: '🧩', unit: '', hint: 'Le moins de fautes d’abord, puis le plus rapide.' },
  { id: 'online', label: 'Elo en ligne', icon: '🌍', unit: 'Elo', hint: 'Parties classées contre de vrais joueurs (Contre le monde).' },
  { id: 'bots', label: 'Elo bots', icon: '🤖', unit: 'Elo', hint: 'Classement contre les bots (Glicko-2).' },
  { id: 'puzzles', label: 'Elo problèmes', icon: '🧩', unit: 'Elo', hint: 'Classement en problèmes.' },
  { id: 'rush3', label: 'Rush 3 min', icon: '⚡', unit: 'pts', hint: 'Meilleur score en Puzzle Rush 3 minutes.' },
  { id: 'rush5', label: 'Rush 5 min', icon: '⏱️', unit: 'pts', hint: 'Meilleur score en Puzzle Rush 5 minutes.' },
  { id: 'survival', label: 'Survie', icon: '🛡️', unit: 'pts', hint: 'Meilleur score en Puzzle Rush Survie.' },
  { id: 'stars', label: 'Étoiles de cours', icon: '🎓', unit: '★', hint: 'Étoiles gagnées dans les leçons (3 au maximum par leçon).' },
  { id: 'xp', label: 'XP', icon: '⭐', unit: 'XP', hint: 'Expérience totale : parties, problèmes, cours.' },
] as BoardCfg[]).map((b) => tmap(b));

export function LeaderboardPage({ onOpen }: { onOpen: (name: string) => void }) {
  const sync = useSync();
  const [board, setBoard] = useState<Board>('online');
  useRouteTab(2, board, setBoard, {
    daily: 'du-jour',
    online: 'en-ligne',
    bots: 'bots',
    puzzles: 'problemes',
    rush3: 'rush-3',
    rush5: 'rush-5',
    survival: 'survie',
    stars: 'etoiles',
    xp: 'xp',
  });
  const [data, setData] = useState<Res | null>(null);
  const [err, setErr] = useState(false);
  const cfg = BOARDS.find((b) => b.id === board)!;

  const [dayOffset, setDayOffset] = useState(0);
  useEffect(() => {
    if (board === 'daily') return;
    setData(null);
    setErr(false);
    apiCall<Res>(`/leaderboard?type=${board}`)
      .then(setData)
      .catch(() => setErr(true));
  }, [board, sync.user]);

  const row = (r: Row, me = false) => (
    <li key={`${r.rank}-${r.username}`} className={`lb-row ${me ? 'me' : ''} ${r.rank <= 3 ? `podium p${r.rank}` : ''}`}>
      <span className="lb-rank">{r.rank <= 3 ? ['🥇', '🥈', '🥉'][r.rank - 1] : r.rank}</span>
      <Avatar name={r.username} size={32} />
      <button className="lb-name link-like" onClick={() => onOpen(r.username)} title={t("Voir le profil")}>
        {r.username}
      </button>
      <b className="lb-value">
        {r.value.toLocaleString(locale())}
        {r.provisional && (
          <span className="muted" title={provisionalHelp()}>
            ?
          </span>
        )}
        <span className="muted tiny"> {cfg.unit}</span>
      </b>
    </li>
  );

  const meInTop = data?.me && data.top.some((r) => r.username === data.me!.username);

  return (
    <div className="lb">
      <section className="card lb-hero">
        <h1>{t("🏆 Classement")}</h1>
        <p className="muted">{t("Les meilleurs joueurs BetterMove. Crée un compte pour y apparaître : ta progression est envoyée automatiquement.")}</p>
      </section>
      <div className="chips lb-tabs">
        {BOARDS.map((b) => (
          <button key={b.id} className={`chip ${board === b.id ? 'selected' : ''}`} onClick={() => setBoard(b.id)}>
            {b.icon} {b.label}
          </button>
        ))}
      </div>
      <section className="card">
        <div className="lb-head">
          <span className="tc-label">
            {cfg.icon} {cfg.label}
          </span>
          <span className="muted small">
            {cfg.hint}
            {data && board !== 'daily' ? ' ' + tn(data.total, '{n} joueur classé.', '{n} joueurs classés.') : ''}
          </span>
        </div>
        {board === 'daily' && (
          <>
            <div className="chips small db-days">
              {[t("Aujourd’hui"), t("Hier"), t("Avant-hier")].map((l, i) => (
                <button key={l} className={`chip ${dayOffset === i ? 'selected' : ''}`} onClick={() => setDayOffset(i)}>
                  {l}
                </button>
              ))}
            </div>
            <DailyBoard day={todayKey(new Date(Date.now() - dayOffset * 86400_000))} />
          </>
        )}
        {board !== 'daily' && err && <p className="muted">{t("Serveur injoignable : le classement revient dès que la connexion est rétablie.")}</p>}
        {board !== 'daily' && !data && !err && <p className="muted">{t("Chargement…")}</p>}
        {board !== 'daily' && data && data.top.length === 0 && <p className="muted">{t("Personne pour l’instant. Sois le premier !")}</p>}
        {board !== 'daily' && data && data.top.length > 0 && (
          <ol className="lb-list">
            {data.top.map((r) => row(r, !!sync.user && r.username.toLowerCase() === sync.user.toLowerCase()))}
          </ol>
        )}
        {board !== 'daily' && data?.me && !meInTop && (
          <>
            <div className="lb-sep muted tiny">…</div>
            <ol className="lb-list">{row(data.me, true)}</ol>
          </>
        )}
        {board !== 'daily' && data && !data.me && sync.user && <p className="muted small">{t("Tu n’es pas encore classé ici. Joue un peu et reviens !")}</p>}
        {(board === 'online' || board === 'puzzles') && <p className="muted tiny">{provisionalHelp()}</p>}
      </section>
    </div>
  );
}
