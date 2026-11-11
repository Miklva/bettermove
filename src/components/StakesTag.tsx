// Elo en jeu : ce que la partie rapporte ou coute (victoire / nulle / defaite)
import { signed } from '../rating/elo';

import { t } from '../i18n';
/** Ce que la partie rapporte ou coute : victoire / nulle / defaite */
export function StakesTag({ s, full = false }: { s: { win: number; draw: number; loss: number }; full?: boolean }) {
  const title = t('Elo en jeu : victoire {win}, nulle {draw}, défaite {loss}', { win: signed(s.win), draw: signed(s.draw), loss: signed(s.loss) });
  return full ? (
    <div className="stakes full" title={title}>
      <span className="up">{t("Victoire")}{" "}{signed(s.win)}</span>
      <span className="muted">{t("Nulle")}{" "}{signed(s.draw)}</span>
      <span className="down">{t("Défaite")}{" "}{signed(s.loss)}</span>
    </div>
  ) : (
    <span className="stakes" title={title}>
      <b className="up">{signed(s.win)}</b>/<b className="down">{signed(s.loss)}</b>
    </span>
  );
}

