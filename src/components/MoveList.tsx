import { useEffect, useRef } from 'react';
import type { PlayedMove } from '../game/types';
import { formatSan } from '../lib/notation';
import { useSettings } from '../settings/settings';

import { t } from '../i18n';
interface Props {
  moves: PlayedMove[];
  viewPly: number;
  onSelect: (ply: number) => void;
}

export function MoveList({ moves, viewPly, onSelect }: Props) {
  const listRef = useRef<HTMLDivElement>(null);
  const { settings } = useSettings();
  const fmt = (san: string) => formatSan(san, settings.notation);

  useEffect(() => {
    // Defilement de la liste seulement (scrollIntoView ferait bouger toute la page sur mobile)
    const list = listRef.current;
    const el = list?.querySelector<HTMLElement>('.mv.current');
    if (list && el) {
      list.scrollTop = el.offsetTop - list.clientHeight / 2;
      // Telephone : liste horizontale sous le plateau
      list.scrollLeft = el.offsetLeft - list.clientWidth / 2;
    }
  }, [viewPly, moves.length]);

  const rows = [];
  for (let i = 0; i < moves.length; i += 2) {
    rows.push(
      <div className="mv-row" key={i}>
        <span className="mv-num">{i / 2 + 1}.</span>
        <button className={`mv ${viewPly === i + 1 ? 'current' : ''}`} onClick={() => onSelect(i + 1)}>
          {fmt(moves[i].san)}
        </button>
        {moves[i + 1] ? (
          <button className={`mv ${viewPly === i + 2 ? 'current' : ''}`} onClick={() => onSelect(i + 2)}>
            {fmt(moves[i + 1].san)}
          </button>
        ) : (
          <span />
        )}
      </div>,
    );
  }

  return (
    <div className="move-list" ref={listRef}>
      {moves.length === 0 ? <p className="muted empty">{t("Les coups apparaîtront ici.")}</p> : rows}
    </div>
  );
}
