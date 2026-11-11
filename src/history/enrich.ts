// Complete les parties sauvegardees (ouverture, fin de partie, Elo, nombre de coups) une seule fois,
// pour que l'historique et les statistiques restent instantanes.
import { Chess } from 'chess.js';
import { loadBook, lookup } from '../review/openings';
import { listGames, updateGames, type SavedGame } from '../review/store';
import { BOTS } from '../bots/roster';
import type { EndReason } from '../achievements/facts';

const START_BOARD = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';

/** Termination : textes de l'app, de chess.com et de Lichess */
export function endFromText(text: string, c: Chess, decisive: boolean): EndReason {
  const t = text.toLowerCase();
  if (t.includes('checkmate') || (t.includes('chec') && t.includes('mat'))) return 'mate';
  if (t.includes('insufficient') || t.includes('insuffisant')) return t.includes('time') || t.includes('temps') ? 'time' : 'insufficient';
  if (t.includes('time') || t.includes('temps')) return 'time';
  if (t.includes('resign') || t.includes('abandon')) return 'resign';
  if (t.includes('stalemate') || t.startsWith('pat')) return 'stalemate';
  if (t.includes('repetition') || t.includes('répétition')) return 'repetition';
  if (t.includes('50')) return 'fifty';
  if (t.includes('agreement') || t.includes('accord')) return 'agreement';
  // Lichess "Normal" ou texte absent : on regarde la position finale
  if (c.isCheckmate()) return 'mate';
  if (c.isStalemate()) return 'stalemate';
  if (c.isThreefoldRepetition()) return 'repetition';
  if (c.isInsufficientMaterial()) return 'insufficient';
  return decisive ? 'resign' : 'agreement';
}

const needs = (g: SavedGame) => !g.end || g.moves === undefined || g.opening === undefined;

let running: Promise<number> | null = null;

/** Renvoie le nombre de parties completees */
export function enrichGames(): Promise<number> {
  if (running) return running;
  running = (async () => {
    const todo = listGames().filter(needs);
    if (!todo.length) return 0;
    const book = await loadBook();
    const patch: Record<string, Partial<SavedGame>> = {};
    let n = 0;
    for (const g of todo) {
      // Laisse respirer l'interface sur les gros imports
      if (++n % 40 === 0) await new Promise((r) => setTimeout(r, 0));
      const c = new Chess();
      try {
        c.loadPgn(g.pgn);
      } catch {
        patch[g.id] = { end: 'other', moves: 0, opening: '' };
        continue;
      }
      const h = c.getHeaders();
      const hist = c.history({ verbose: true });
      let opening = '';
      if (!h.FEN || h.FEN.split(' ')[0] === START_BOARD) {
        for (const m of hist.slice(0, 40)) {
          const n = lookup(book, m.after);
          if (n === undefined) break;
          if (n) opening = n;
        }
      }
      const decisive = g.result === '1-0' || g.result === '0-1';
      const p: Partial<SavedGame> = {
        opening: g.opening ?? opening,
        end: endFromText(g.reason ?? h.Termination ?? '', c, decisive),
        moves: Math.ceil(hist.length / 2),
      };
      // Elo : en-tetes PGN (chess.com, Lichess) ou bot connu
      const we = Number(h.WhiteElo);
      const be = Number(h.BlackElo);
      const mine = g.userColor === 'w' ? we : be;
      const theirs = g.userColor === 'w' ? be : we;
      if (g.oppRating === undefined) {
        if (theirs) p.oppRating = theirs;
        else if (g.source === 'bot') {
          const name = g.userColor === 'w' ? g.black : g.white;
          const bot = BOTS.find((b) => name.startsWith(b.name));
          if (bot) p.oppRating = bot.rating;
        }
      }
      if (g.userRating === undefined && mine) p.userRating = mine;
      if (!g.playedAt) {
        const d = (h.UTCDate ?? h.Date ?? '').replace(/\./g, '-');
        if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
          if (h.UTCTime) p.playedAt = `${d}T${h.UTCTime}Z`;
          else p.date = d.split('-').reverse().join('/');
        }
      }
      if (!g.timeControl && h.TimeControl && h.TimeControl !== '-') {
        const [base, inc] = h.TimeControl.split('+').map(Number);
        if (base) p.timeControl = `${Math.round(base / 60)} min${inc ? ` | ${inc}` : ''}`;
      }
      patch[g.id] = p;
    }
    updateGames(patch);
    return todo.length;
  })().finally(() => {
    running = null;
  });
  return running;
}
