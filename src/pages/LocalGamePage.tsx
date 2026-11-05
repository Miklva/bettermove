import { useEffect, useState } from 'react';
import { useGame } from '../game/useGame';
import { COLOR_NAME } from '../game/rules';
import type { Color } from '../game/types';
import type { ReviewRequest } from '../review/ImportPanel';
import { saveGame } from '../review/store';
import { recordGame } from '../achievements/facts';
import { GameLayout, copyText } from '../components/GameLayout';
import { Modal } from '../components/Modal';
import { NewGameModal } from '../components/NewGameModal';
import { rewardLocal } from '../economy/rewards';

interface Props {
  notify: (msg: string) => void;
  onReview: (r: ReviewRequest) => void;
}

type Dialog = null | 'new' | 'resign' | 'draw' | 'over';

export function LocalGamePage({ notify, onReview }: Props) {
  const g = useGame('bettermove.localGame.v1');
  const [dialog, setDialog] = useState<Dialog>(g.hadSavedGame ? null : 'new');
  const names = { w: g.settings.whiteName, b: g.settings.blackName };

  // Ouvre la fenetre de fin de partie quand le resultat tombe
  useEffect(() => {
    if (!g.result) return;
    setDialog('over');
    // Partie sauvegardee pour la review
    if (g.moves.length >= 2)
      saveGame({
        id: g.settings.gameId ?? `local-${Date.now()}`,
        pgn: g.pgn(),
        white: g.settings.whiteName,
        black: g.settings.blackName,
        result: g.result.winner === 'w' ? '1-0' : g.result.winner === 'b' ? '0-1' : '1/2-1/2',
        date: new Date().toLocaleDateString('fr-FR'),
        source: 'local',
        userColor: 'w',
        playedAt: new Date().toISOString(),
        timeControl: g.settings.timeControl.label,
        reason: g.result.reason,
        moves: Math.ceil(g.moves.length / 2),
      });
    if (g.moves.length >= 2 && g.settings.gameId)
      recordGame({
        id: g.settings.gameId,
        source: 'local',
        userColor: 'w',
        moves: g.moves.map((m) => ({ ...m, after: m.fen })),
        winner: g.result.winner,
        reasonText: g.result.reason,
      });
    if (g.settings.gameId) rewardLocal(g.settings.gameId, g.moves.length);
  }, [g.result]);

  const actions = !g.result ? (
    <>
      <button className="btn" onClick={g.takeback} disabled={g.moves.length === 0}>
        ↶ Annuler le coup
      </button>
      {g.hasClock && (
        <button className="btn" onClick={g.togglePause}>
          {g.paused ? '▶ Reprendre' : '⏸ Pause'}
        </button>
      )}
      <button className="btn" onClick={() => setDialog('draw')} disabled={g.moves.length < 2}>
        ½ Nulle
      </button>
      <button className="btn danger" onClick={() => setDialog('resign')}>
        🏳 Abandon
      </button>
      <button className="btn ghost" onClick={() => setDialog('new')}>
        ＋ Nouvelle partie
      </button>
    </>
  ) : (
    <button className="btn primary wide" onClick={() => setDialog('new')}>
      Nouvelle partie
    </button>
  );

  return (
    <GameLayout g={g} notify={notify} userColor="both" modeLabel="1v1 local" actions={actions}>
      {dialog === 'new' && (
        <NewGameModal
          initial={g.settings}
          onClose={g.hadSavedGame || g.moves.length > 0 ? () => setDialog(null) : undefined}
          onStart={(s) => {
            g.newGame(s);
            setDialog(null);
          }}
        />
      )}

      {dialog === 'resign' && (
        <Modal title="Abandonner ?" onClose={() => setDialog(null)}>
          <p className="muted">Qui abandonne la partie ?</p>
          <div className="row">
            {(['w', 'b'] as Color[]).map((c) => (
              <button
                key={c}
                className="btn danger"
                onClick={() => {
                  g.resign(c);
                  setDialog(null);
                }}
              >
                {names[c]} ({COLOR_NAME[c]})
              </button>
            ))}
          </div>
        </Modal>
      )}

      {dialog === 'draw' && (
        <Modal title="Proposer la nulle" onClose={() => setDialog(null)}>
          <p className="muted">Les deux joueurs sont d'accord pour une partie nulle ?</p>
          <div className="row">
            <button className="btn" onClick={() => setDialog(null)}>
              Non, on continue
            </button>
            <button
              className="btn primary"
              onClick={() => {
                g.agreeDraw();
                setDialog(null);
              }}
            >
              Oui, nulle
            </button>
          </div>
        </Modal>
      )}

      {dialog === 'over' && g.result && (
        <Modal
          title={g.result.winner ? `Victoire de ${names[g.result.winner]}` : 'Partie nulle'}
          onClose={() => setDialog(null)}
        >
          <div className="over-score">
            {g.result.winner === 'w' ? '1 - 0' : g.result.winner === 'b' ? '0 - 1' : '½ - ½'}
          </div>
          <p className="muted center">{g.result.reason}</p>
          <div className="row">
            <button
              className="btn primary"
              onClick={() => {
                // Revanche : on echange les couleurs
                g.newGame({ ...g.settings, whiteName: g.settings.blackName, blackName: g.settings.whiteName });
                setDialog(null);
              }}
            >
              Revanche
            </button>
            <button className="btn" onClick={() => copyText(g.pgn(), notify)}>
              Copier le PGN
            </button>
          </div>
          <button
            className="btn ghost wide"
            disabled={g.moves.length < 2}
            onClick={() => onReview({ id: g.settings.gameId ?? `local-${Date.now()}`, pgn: g.pgn(), userColor: 'w', source: 'local' })}
          >
            🔍 Analyser la partie
          </button>
        </Modal>
      )}
    </GameLayout>
  );
}
