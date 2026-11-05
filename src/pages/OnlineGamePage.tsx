// Partie en ligne contre un ami : l'etat vient du serveur (sondage), le plateau joue en optimiste.
import { useEffect, useMemo, useRef, useState } from 'react';
import { recordGame } from '../achievements/facts';
import { Chess, type Square } from 'chess.js';
import { Board } from '../components/Board';
import { online, type OnlineGame } from '../social/api';
import { sounds } from '../lib/sounds';
import { saveGame } from '../review/store';
import type { ReviewRequest } from '../review/ImportPanel';
import { useSettings } from '../settings/settings';
import { formatSan } from '../lib/notation';
import { Avatar } from '../profile/avatar';
import { CapturedPieces } from '../components/CapturedPieces';
import { OnlineChat } from '../social/OnlineChat';
import { materialFromFen } from '../game/rules';
import { StakesTag } from '../components/StakesTag';
import { FocusButton } from '../components/FocusMode';
import { Modal } from '../components/Modal';
import { useShop } from '../shop/store';
import { conquestFor } from '../game/conquest';
import { rewardOnlineGame } from '../economy/rewards';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

interface Props {
  gameId: number;
  onExit: () => void;
  onReview: (r: ReviewRequest) => void;
  /** Ouvre une autre partie en ligne (revanche acceptee) */
  onPlay: (gameId: number) => void;
  /** Nouvelle partie contre un adversaire aleatoire, a la meme cadence */
  onNewGame: (tcId: string) => void;
}

const fmtClock = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  if (s < 20 && ms < 20000) return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}.${Math.floor((ms % 1000) / 100)}`;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

function pgnOf(g: OnlineGame) {
  const c = new Chess();
  for (const u of g.moves) c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
  c.setHeader('Event', 'Partie en ligne BetterMove');
  c.setHeader('White', g.white);
  c.setHeader('Black', g.black);
  c.setHeader('Result', g.result ?? '*');
  if (g.reason) c.setHeader('Termination', g.reason);
  if (g.initial) c.setHeader('TimeControl', `${g.initial / 1000}+${g.increment / 1000}`);
  return c.pgn();
}

export function OnlineGamePage({ gameId, onExit, onReview, onPlay, onNewGame }: Props) {
  const { settings, theme } = useSettings();
  const shop = useShop();
  const [game, setGame] = useState<OnlineGame | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [resetToken, setResetToken] = useState(0);
  const [confirmResign, setConfirmResign] = useState(false);
  const offset = useRef(0);
  const warned = useRef<number | null>(null);
  const pending = useRef(false);
  const savedRef = useRef(false);
  const [earned, setEarned] = useState<{ coins: number; xp: number; note?: string } | null>(null);

  const apply = (g: OnlineGame) => {
    offset.current = Date.now() - g.serverNow;
    setGame((prev) => {
      // Sons pour les nouveaux coups de l'adversaire
      if (prev && g.moves.length > prev.moves.length) {
        const c = new Chess();
        let last;
        for (const u of g.moves) last = c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
        const mine = g.you && last && last.color === g.you;
        if (!mine && last) {
          if (c.inCheck()) sounds.check();
          else if (last.captured) sounds.capture(last.captured, true);
          else sounds.move();
        }
      }
      if (prev?.status === 'active' && g.status === 'over') {
        const meWon = g.you && g.result === (g.you === 'w' ? '1-0' : '0-1');
        sounds.end(g.result === '1/2-1/2' || g.result === '*' ? 'draw' : !g.you || meWon ? 'win' : 'loss');
      }
      return g;
    });
  };

  // Sondage de l'etat : rapide pendant la partie
  useEffect(() => {
    let stop = false;
    const tick = async () => {
      if (pending.current) return;
      try {
        const g = await online.get(gameId);
        if (!stop && !pending.current) apply(g);
        setError(null);
      } catch (e) {
        if (!stop) setError(e instanceof Error ? e.message : 'Connexion perdue');
      }
    };
    tick();
    const id = window.setInterval(tick, 900);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  // Pendules affichees en continu
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(id);
  }, []);

  // Fin de partie : sauvegarde dans l'historique
  useEffect(() => {
    if (!game || game.status !== 'over' || savedRef.current || !game.you || game.moves.length < 2) return;
    savedRef.current = true;
    saveGame({
      id: `online-${game.id}`,
      pgn: pgnOf(game),
      white: game.white,
      black: game.black,
      result: game.result ?? '*',
      date: new Date().toLocaleDateString('fr-FR'),
      playedAt: new Date().toISOString(),
      source: 'online',
      userColor: game.you,
      reason: game.reason ?? undefined,
      moves: Math.ceil(game.moves.length / 2),
      timeControl: game.initial ? `${game.initial / 60000} min${game.increment ? ` | ${game.increment / 1000}` : ''}` : undefined,
    });
    // Recompenses (pieces + XP), une seule fois par partie
    if (game.result && game.result !== '*') {
      const opp = game.you === 'w' ? 'b' : 'w';
      const res = game.result === '1/2-1/2' ? 'draw' : game.result === (game.you === 'w' ? '1-0' : '0-1') ? 'win' : 'loss';
      const r = rewardOnlineGame({
        id: game.id,
        rated: !!game.rated,
        result: res,
        plies: game.moves.length,
        myRating: game.ratings?.[game.you],
        oppRating: game.ratings?.[opp],
      });
      if (r) setEarned(r);
    }
    // Journal des succes (ignore si la partie y est deja)
    if (game.result && game.result !== '*') {
      const c = new Chess();
      const moves = game.moves.map((u) => {
        const m = c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
        return { ...m, after: c.fen() };
      });
      void recordGame({
        id: `online-${game.id}`,
        source: 'online',
        rated: !!game.rated,
        userColor: game.you,
        moves,
        winner: game.result === '1-0' ? 'w' : game.result === '0-1' ? 'b' : null,
        reasonText: game.reason ?? '',
        userRating: game.ratings?.[game.you],
      });
    }
  }, [game]);

  const chess = useMemo(() => (game ? new Chess(game.fen) : null), [game]);
  // Materiel capture d'apres la position affichee
  const material = useMemo(() => materialFromFen(game?.fen ?? START_FEN), [game?.fen]);
  const myTurn = !!game && !!chess && game.status === 'active' && game.you === chess.turn();
  const dests = useMemo(() => {
    const map = new Map<string, string[]>();
    // Pendant le tour adverse, l'echiquier gere lui-meme les coups en avance
    if (!chess || !myTurn) return map;
    for (const m of chess.moves({ verbose: true })) map.set(m.from, [...(map.get(m.from) ?? []), m.to]);
    return map;
  }, [chess, myTurn]);

  // Revanche acceptee par les deux joueurs : on passe a la nouvelle partie
  const rematchId = game?.rematch?.gameId ?? null;
  // Revanche deja jouee quand on ouvre la page (lien vers une ancienne partie) : pas de redirection
  const rematchAtLoad = useRef<number | null | undefined>(undefined);
  if (game && rematchAtLoad.current === undefined) rematchAtLoad.current = rematchId;
  useEffect(() => {
    if (!rematchId || rematchId === rematchAtLoad.current) return;
    sounds.start();
    const t = window.setTimeout(() => onPlay(rematchId), 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rematchId]);
  // L'adversaire propose une revanche : petit son
  const oppWants = !!game?.you && !!game.rematch?.[game.you === 'w' ? 'b' : 'w'];
  useEffect(() => {
    if (oppWants) sounds.success();
  }, [oppWants]);

  // Alerte : il me reste 1/10 du temps de depart (avant tout retour anticipe : regle des hooks)
  const myMs = (() => {
    if (!game?.clocks || !game.you) return null;
    let v = game.clocks[game.you];
    if (game.status === 'active' && game.moves.length >= 2 && game.clocks.turn === game.you) v -= now - offset.current - game.serverNow;
    return Math.max(0, v);
  })();
  useEffect(() => {
    if (!game || myMs === null || !game.initial || game.initial < 30_000 || game.status !== 'active') return;
    if (myMs < game.initial * 0.1 && warned.current !== game.id) {
      warned.current = game.id;
      sounds.dong();
    }
  }, [myMs, game]);

  // Fin de partie : les skins du gagnant (les siens, ou ceux de l'adversaire) envahissent le plateau
  const winColor = game?.status === 'over' ? (game.result === '1-0' ? 'w' : game.result === '0-1' ? 'b' : null) : null;
  const [conquering, setConquering] = useState(false);
  useEffect(() => {
    setConquering(false);
    if (!winColor) return;
    const t = window.setTimeout(() => setConquering(true), 600);
    return () => clearTimeout(t);
  }, [winColor, gameId]);
  const conquest =
    conquering && winColor && game
      ? conquestFor(
          winColor,
          winColor === game.you ? { pieces: shop.equipped.pieces, board: theme.id } : (game.skins?.[winColor] ?? {}),
        )
      : null;

  // Pop-up quand l'adversaire propose une revanche (une seule fois par proposition)
  const [offerClosed, setOfferClosed] = useState(false);
  const r0 = game?.rematch;
  const meColor = game?.you ?? null;
  const offerFromOpp =
    !!game && game.status === 'over' && !!r0 && !!meColor && !r0.gameId && r0[meColor === 'w' ? 'b' : 'w'] && !r0[meColor];
  useEffect(() => {
    if (!offerFromOpp) setOfferClosed(false);
  }, [offerFromOpp]);

  if (!game || !chess)
    return (
      <div className="online-wait card center">
        {error ? <p className="error">{error}</p> : <p className="muted">Chargement de la partie…</p>}
        <button className="btn" onClick={onExit}>
          ← Retour
        </button>
      </div>
    );

  const you = game.you ?? 'w';
  const opp = you === 'w' ? 'b' : 'w';
  const names = { w: game.white, b: game.black };
  const lastUci = game.moves[game.moves.length - 1] ?? '';
  const clockOf = (c: 'w' | 'b') => {
    if (!game.clocks) return null;
    let v = game.clocks[c];
    if (game.status === 'active' && game.moves.length >= 2 && game.clocks.turn === c) v -= now - offset.current - game.serverNow;
    return Math.max(0, v);
  };

  const onMove = async (from: string, to: string) => {
    if (!myTurn) return;
    const piece = chess.get(from as Square);
    const promo = piece?.type === 'p' && (to[1] === '8' || to[1] === '1') ? 'q' : '';
    const optimistic = new Chess(game.fen);
    let m;
    try {
      m = optimistic.move({ from, to, promotion: promo || undefined });
    } catch {
      setResetToken((x) => x + 1);
      return;
    }
    if (optimistic.inCheck()) sounds.check();
    else if (m.captured) sounds.capture(m.captured);
    else sounds.move();
    pending.current = true;
    setGame({ ...game, fen: optimistic.fen(), moves: [...game.moves, m.lan], drawOffer: game.drawOffer === opp ? null : game.drawOffer });
    try {
      apply(await online.move(game.id, from + to + promo));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Coup refusé');
      setResetToken((x) => x + 1);
    } finally {
      pending.current = false;
    }
  };

  const act = async (fn: () => Promise<OnlineGame>) => {
    try {
      apply(await fn());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action impossible');
    }
  };

  const sans = (() => {
    const c = new Chess();
    return game.moves.map((u) => formatSan(c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }).san, settings.notation));
  })();
  const won = game.result === (you === 'w' ? '1-0' : '0-1');
  const draw = game.result === '1/2-1/2';

  const Bar = ({ c }: { c: 'w' | 'b' }) => {
    const ms = clockOf(c);
    const running = game.status === 'active' && chess.turn() === c && game.moves.length >= 2;
    return (
      <div className="player-bar">
        <span className="player-avatar">
          <Avatar name={names[c]} size={34} />
          <span className={`color-dot ${c === 'w' ? 'white' : 'black'}`} />
        </span>
        <strong>{names[c]}</strong>
        {game.ratings && (
          <span className="bar-rating">
            ({game.ratings[c]}
            {game.deltas && (
              <b className={game.deltas[c] >= 0 ? 'up' : 'down'}>
                {' '}
                {game.deltas[c] >= 0 ? '+' : ''}
                {game.deltas[c]}
              </b>
            )}
            )
          </span>
        )}
        {c === you && <span className="tag">toi</span>}
        <CapturedPieces pieces={material.captured[c]} color={c} diff={material.diff[c]} />
        {ms !== null && <span className={`clock ${running ? 'running' : ''} ${ms < 20000 ? 'low' : ''}`}>{fmtClock(ms)}</span>}
      </div>
    );
  };

  return (
    <div className="play">
      <section className="board-col">
        <Bar c={opp} />
        <div className="board-stage">
          <Board
            fen={game.fen}
            orientation={you === 'w' ? 'white' : 'black'}
            turnColor={chess.turn() === 'w' ? 'white' : 'black'}
            movableColor={game.status === 'active' && game.you ? (game.you === 'w' ? 'white' : 'black') : undefined}
            dests={dests}
            lastMove={lastUci.slice(0, 4)}
            inCheck={chess.inCheck()}
            premovable={settings.premoves}
            resetToken={resetToken}
            onMove={onMove}
            conquest={conquest}
          />
        </div>
        <Bar c={you} />
      </section>
      <aside className="side">
        <div className="card">
          <div className="tc-label">
            {game.rated ? '🌍 Partie classée' : 'Partie amicale'}{game.initial ? ` · ${game.initial / 60000} min${game.increment ? ` | ${game.increment / 1000}` : ''}` : ' · sans pendule'}
          </div>
          {game.status === 'active' && game.stakes && (
            <div className="game-stakes">
              <span className="muted tiny">
                Elo en jeu pour toi{game.stakes[you].provisional ? ' (classement provisoire : écarts plus forts)' : ''}
              </span>
              <StakesTag s={game.stakes[you]} full />
            </div>
          )}
          <div className="status">
            {game.status === 'over'
              ? `${won ? 'Victoire !' : draw ? 'Partie nulle' : game.result === '*' ? 'Partie annulée' : 'Défaite'} (${game.reason})`
              : myTurn
                ? 'À toi de jouer'
                : `${names[opp]} réfléchit…`}
          </div>
          {game.status === 'over' && game.deltas && you && (
            <p className={`rating-change ${game.deltas[you] >= 0 ? 'up' : 'down'}`}>
              Elo en ligne : {game.ratings![you]} → {game.ratings![you] + game.deltas[you]} ({game.deltas[you] >= 0 ? '+' : ''}
              {game.deltas[you]})
            </p>
          )}
          {game.status === 'over' && earned && (
            <p className="earned-line">
              {earned.coins || earned.xp ? (
                <>
                  +{earned.coins} 🪙 · +{earned.xp} XP{earned.note ? <span className="muted"> ({earned.note})</span> : null}
                </>
              ) : (
                <span className="muted">{earned.note}</span>
              )}
            </p>
          )}
          {game.status === 'active' && game.drawOffer === opp && (
            <div className="draw-offer">
              <span>{names[opp]} propose la nulle.</span>
              <button className="btn primary small-btn" onClick={() => act(() => online.draw(game.id))}>
                Accepter
              </button>
              <button className="btn small-btn" onClick={() => act(() => online.declineDraw(game.id))}>
                Refuser
              </button>
            </div>
          )}
          {error && <p className="error small">{error}</p>}
        </div>
        {game.rated && <OnlineChat gameId={game.id} opponent={names[opp]} />}
        <div className="card online-moves">
          {sans.length === 0 ? (
            <p className="muted">Les coups apparaîtront ici. Les pendules démarrent après le premier coup de chaque camp.</p>
          ) : (
            <ol>
              {sans
                .filter((_, i) => i % 2 === 0)
                .map((w, i) => (
                  <li key={i}>
                    <span>{w}</span>
                    <span>{sans[i * 2 + 1] ?? ''}</span>
                  </li>
                ))}
            </ol>
          )}
        </div>
        <div className={`card actions ${game.status === 'active' ? 'game-tools' : ''}`}>
          {game.status === 'active' ? (
            <>
              <button
                className="btn"
                disabled={game.drawOffer === you || game.moves.length < 2}
                onClick={() => act(() => online.draw(game.id))}
              >
                {game.drawOffer === you ? '½ Nulle proposée' : '½ Nulle'}
              </button>
              {confirmResign ? (
                <button className="btn danger" onClick={() => act(() => online.resign(game.id))}>
                  {game.moves.length < 2 ? 'Confirmer' : 'Confirmer l’abandon'}
                </button>
              ) : (
                <button className="btn" onClick={() => setConfirmResign(true)}>
                  {game.moves.length < 2 ? '✕ Annuler' : '🏳 Abandon'}
                </button>
              )}
              <button className="btn ghost" onClick={onExit} title="Retour à la Communauté : la partie continue">
                ← Retour
              </button>
            </>
          ) : (
            <>
              {game.you && (
                <RematchBox
                  old={rematchAtLoad.current}
                  onOpen={onPlay}
                  game={game}
                  you={you}
                  oppName={names[opp]}
                  act={act}
                  onNewGame={() => onNewGame(tcIdOf(game.initial, game.increment))}
                />
              )}
              {game.you && game.moves.length >= 2 && (
                <button
                  className="btn"
                  onClick={() => onReview({ id: `online-${game.id}`, pgn: pgnOf(game), userColor: game.you!, source: 'online' })}
                >
                  🔬 Analyser la partie
                </button>
              )}
              <button className="btn" onClick={onExit}>
                ← Retour à la communauté
              </button>
            </>
          )}
          <FocusButton />
        </div>
      </aside>
      {offerFromOpp && !offerClosed && (
        <Modal title="🔁 Revanche ?" onClose={() => setOfferClosed(true)}>
          <p>
            <b>{names[opp]}</b> te propose une revanche : même cadence, couleurs inversées.
          </p>
          <div className="row">
            <button
              className="btn"
              onClick={() => {
                setOfferClosed(true);
                act(() => online.declineRematch(game.id));
              }}
            >
              Refuser
            </button>
            <button
              className="btn primary"
              onClick={() => {
                setOfferClosed(true);
                act(() => online.rematch(game.id));
              }}
            >
              Accepter la revanche
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/** Cadence de "Contre le monde" la plus proche de celle de la partie */
function tcIdOf(initial: number | null, increment: number): string {
  if (!initial) return '10+0';
  const ids: [string, number, number][] = [
    ['3+2', 180_000, 2000],
    ['5+0', 300_000, 0],
    ['10+0', 600_000, 0],
    ['15+10', 900_000, 10_000],
  ];
  const exact = ids.find(([, i, inc]) => i === initial && inc === increment);
  if (exact) return exact[0];
  return ids.reduce((best, cur) => (Math.abs(cur[1] - initial) < Math.abs(best[1] - initial) ? cur : best))[0];
}

/** Fin de partie : revanche (les deux doivent accepter) ou nouvelle partie contre un inconnu */
function RematchBox({
  game,
  you,
  oppName,
  act,
  onNewGame,
  old,
  onOpen,
}: {
  game: OnlineGame;
  you: 'w' | 'b';
  oppName: string;
  act: (fn: () => Promise<OnlineGame>) => void;
  onNewGame: () => void;
  old: number | null | undefined;
  onOpen: (id: number) => void;
}) {
  const opp = you === 'w' ? 'b' : 'w';
  const r = game.rematch ?? { w: false, b: false, declinedBy: null, gameId: null };
  const mine = r[you];
  const theirs = r[opp];
  return (
    <div className="rematch-box">
      {r.gameId && r.gameId === old ? (
        <button className="btn" onClick={() => onOpen(r.gameId!)}>
          🔁 Voir la revanche
        </button>
      ) : r.gameId ? (
        <p className="rematch-note ok">Revanche acceptée ! La partie commence…</p>
      ) : theirs && !mine ? (
        <>
          <p className="rematch-note">🔁 {oppName} te propose une revanche.</p>
          <div className="row">
            <button className="btn primary" onClick={() => act(() => online.rematch(game.id))}>
              Accepter la revanche
            </button>
            <button className="btn ghost" onClick={() => act(() => online.declineRematch(game.id))}>
              Refuser
            </button>
          </div>
        </>
      ) : mine ? (
        <>
          <p className="rematch-note">⏳ Revanche proposée. En attente de {oppName}…</p>
          <button className="btn ghost" onClick={() => act(() => online.declineRematch(game.id))}>
            Annuler ma proposition
          </button>
        </>
      ) : (
        <>
          {r.declinedBy === opp && <p className="rematch-note muted">{oppName} a refusé la revanche.</p>}
          <button className="btn primary" onClick={() => act(() => online.rematch(game.id))}>
            🔁 Rejouer contre {oppName}
          </button>
        </>
      )}
      <button className="btn" onClick={onNewGame}>
        🌍 Nouvelle partie (adversaire au hasard)
      </button>
    </div>
  );
}
