import type { ReactNode } from 'react';
import type { Color } from '../game/types';
import { formatClock } from '../game/timeControls';
import { CapturedPieces } from './CapturedPieces';

import { t } from '../i18n';
interface Props {
  name: string;
  avatar?: ReactNode;
  color: Color;
  extra?: ReactNode;
  captured: string[];
  diff: number;
  clockMs: number | null;
  active: boolean;
  running: boolean;
  isWinner: boolean;
  /** Pastille "A toi de jouer" / "X reflechit..." sur le camp qui a le trait */
  turn?: string | null;
  /** Camp joue par l'utilisateur (pastille verte) */
  mine?: boolean;
}

export function PlayerBar({ name, avatar, color, extra, captured, diff, clockMs, active, running, isWinner, turn, mine }: Props) {
  const low = clockMs !== null && clockMs < 20_000;
  return (
    <div className={`player-bar ${active ? 'is-active' : ''}`}>
      <div className="player-id">
        {avatar ? (
          <span className="player-avatar">
            {avatar}
            <span className={`color-dot ${color === 'w' ? 'white' : 'black'}`} aria-hidden />
          </span>
        ) : (
          <span className={`color-dot ${color === 'w' ? 'white' : 'black'}`} aria-hidden />
        )}
        <span className="player-name">{name}</span>
        {extra}
        {isWinner && <span className="winner-badge">{t("Victoire")}</span>}
      </div>
      <CapturedPieces pieces={captured} color={color} diff={diff} />
      {turn && <span className={`turn-pill ${mine ? 'mine' : ''}`}>{turn}</span>}
      {clockMs !== null && (
        <div className={`clock ${active ? 'active' : ''} ${active && running ? 'running' : ''} ${low ? 'low' : ''}`}>
          {formatClock(clockMs)}
        </div>
      )}
    </div>
  );
}
