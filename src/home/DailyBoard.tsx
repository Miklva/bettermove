// Classement du probleme du jour : resolu, puis le moins de fautes, puis le plus rapide
import { useEffect, useState } from 'react';
import { apiCall } from '../sync/client';
import { useSync } from '../sync/AccountModal';
import { Avatar } from '../profile/avatar';

export interface DailyRow {
  rank: number;
  username: string;
  mistakes: number;
  hints: number;
  seconds: number | null;
}
interface Res {
  top: DailyRow[];
  solved: number;
  failed: number;
  me: DailyRow | null;
}

export const triesLabel = (r: { mistakes: number }) =>
  r.mistakes === 0 ? '1er essai' : `${r.mistakes + 1} essais`;

export function timeLabel(s: number | null) {
  if (s === null) return '–';
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  return `${m} min ${String(s % 60).padStart(2, '0')}`;
}

export function DailyBoard({ day, limit = 50, refreshKey = 0, compact = false }: { day: string; limit?: number; refreshKey?: number; compact?: boolean }) {
  const sync = useSync();
  const [data, setData] = useState<Res | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    setErr(false);
    apiCall<Res>(`/daily/${day}/leaderboard`)
      .then(setData)
      .catch(() => setErr(true));
  }, [day, refreshKey, sync.user]);

  if (err) return <p className="muted small">Classement indisponible sans le serveur.</p>;
  if (!data) return <p className="muted small">Chargement…</p>;
  const list = data.top.slice(0, limit);
  const meShown = data.me && list.some((r) => r.username === data.me!.username);
  const isMe = (r: DailyRow) => !!sync.user && r.username.toLowerCase() === sync.user.toLowerCase();

  const row = (r: DailyRow) => (
    <li key={r.username} className={`db-row ${isMe(r) ? 'me' : ''}`}>
      <span className="db-rank">{r.rank <= 3 ? ['🥇', '🥈', '🥉'][r.rank - 1] : r.rank}</span>
      <Avatar name={r.username} size={compact ? 24 : 30} />
      <span className="db-name">{r.username}</span>
      <span className={`db-tries ${r.mistakes === 0 ? 'perfect' : ''}`}>{triesLabel(r)}</span>
      {r.hints > 0 && (
        <span className="db-hint" title={`${r.hints} indice${r.hints > 1 ? 's' : ''} (compte comme une faute)`}>
          💡{r.hints}
        </span>
      )}
      <span className="db-time">{timeLabel(r.seconds)}</span>
    </li>
  );

  return (
    <div className="daily-board-rank">
      {list.length === 0 ? (
        <p className="muted small">Personne ne l’a encore résolu. La première place est libre !</p>
      ) : (
        <ol className="db-list">{list.map(row)}</ol>
      )}
      {data.me && !meShown && (
        <>
          <div className="lb-sep muted tiny">…</div>
          <ol className="db-list">{row(data.me)}</ol>
        </>
      )}
      <p className="muted tiny">
        {data.solved} réussite{data.solved > 1 ? 's' : ''}
        {data.failed ? ` · ${data.failed} solution${data.failed > 1 ? 's' : ''} affichée${data.failed > 1 ? 's' : ''}` : ''} · classement :
        le moins de fautes d’abord (un indice compte comme une faute), puis le temps.
      </p>
    </div>
  );
}
