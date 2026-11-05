// Elo en jeu : ce que la partie rapporte ou coute (victoire / nulle / defaite)
import { signed } from '../rating/elo';

/** Ce que la partie rapporte ou coute : victoire / nulle / defaite */
export function StakesTag({ s, full = false }: { s: { win: number; draw: number; loss: number }; full?: boolean }) {
  const title = `Elo en jeu : victoire ${signed(s.win)}, nulle ${signed(s.draw)}, défaite ${signed(s.loss)}`;
  return full ? (
    <div className="stakes full" title={title}>
      <span className="up">Victoire {signed(s.win)}</span>
      <span className="muted">Nulle {signed(s.draw)}</span>
      <span className="down">Défaite {signed(s.loss)}</span>
    </div>
  ) : (
    <span className="stakes" title={title}>
      <b className="up">{signed(s.win)}</b>/<b className="down">{signed(s.loss)}</b>
    </span>
  );
}

