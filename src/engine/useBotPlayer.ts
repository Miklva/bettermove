import { useCallback, useEffect, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import type { Game } from '../game/useGame';
import type { Bot } from '../bots/roster';
import { engine } from './stockfish';
import { chooseMove, newMind, paramsFor, thinkTime, updateMind, type Mind } from './humanBot';
import { t } from '../i18n';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Fait jouer le bot quand c'est son tour, avec un temps de reflexion humain */
export function useBotPlayer(g: Game, bot: Bot | null) {
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Evaluations successives (point de vue du bot) pour decider d'abandonner ou d'accepter la nulle */
  const evals = useRef<number[]>([]);
  /** Etat d'esprit du bot (crispation, confiance, stress du temps) */
  const mind = useRef<Mind>(newMind());
  const gRef = useRef(g);
  gRef.current = g;

  const botColor = g.settings.bot?.color;
  const shouldPlay = !!bot && !!botColor && !g.result && !g.paused && g.turn === botColor;

  // Remise a zero des evaluations a chaque nouvelle partie
  useEffect(() => {
    evals.current = [];
    mind.current = newMind();
  }, [g.settings.gameId]);

  useEffect(() => {
    if (!shouldPlay || !bot || !botColor) return;
    let cancelled = false;
    const fen = g.liveFen;
    const ply = g.moves.length;
    const start = Date.now();
    setThinking(true);

    (async () => {
      try {
        const p = paramsFor(bot.rating);
        const lines = await engine.analyse(fen, { depth: p.depth, multipv: p.multipv });
        if (cancelled) return;
        evals.current.push(lines[0]?.cp ?? 0);

        // Abandon quand la position est desesperee depuis plusieurs coups (pas pour les debutants)
        const last = evals.current.slice(-3);
        if (bot.rating >= 1000 && ply > 20 && last.length === 3 && last.every((cp) => cp <= -900)) {
          gRef.current.resign(botColor);
          return;
        }

        const cur = gRef.current;
        const remainingMs = cur.hasClock ? cur.remaining(botColor) : null;
        const initial = cur.settings.timeControl.initial;
        mind.current = updateMind(mind.current, bot, lines[0]?.cp ?? 0, { remainingMs, initialMs: initial ? initial * 1000 : null });
        const uci = (m?: { from: string; to: string }) => (m ? m.from + m.to : undefined);
        const lastOpp = uci(cur.moves[cur.moves.length - 1]);
        const lastOwn = uci(cur.moves[cur.moves.length - 2]);
        const lastOppCapture = !!cur.moves[cur.moves.length - 1]?.captured;
        const { move } = chooseMove(fen, bot, lines, { ply, mind: mind.current, lastOpp, lastOwn, lastOppCapture });
        const wait = thinkTime({
          remainingMs,
          incrementMs: cur.settings.timeControl.increment * 1000,
          ply,
          legalCount: new Chess(fen).moves().length,
          lines,
          bot,
          mind: mind.current,
          recapture: !!lastOpp && move.slice(2, 4) === lastOpp.slice(2, 4),
        });
        await sleep(Math.max(0, wait - (Date.now() - start)));
        if (cancelled) return;
        gRef.current.makeMove(move.slice(0, 2), move.slice(2, 4), move[4]);
      } catch (e) {
        console.error(e);
        if (!cancelled) setError(t('Le moteur Stockfish n’a pas pu démarrer.'));
      } finally {
        if (!cancelled) setThinking(false);
      }
    })();

    return () => {
      cancelled = true;
      engine.stop();
      setThinking(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldPlay, g.moves.length, g.settings.gameId]);

  /** Le bot accepte la nulle si la position est equilibree en fin de partie, ou s'il est moins bien */
  const offerDraw = useCallback((): boolean => {
    const cur = gRef.current;
    const last = evals.current[evals.current.length - 1] ?? 0;
    const accept = (cur.moves.length >= 40 && Math.abs(last) <= 60) || last <= -250;
    if (accept) cur.agreeDraw();
    return accept;
  }, []);

  return { thinking, error, offerDraw };
}
