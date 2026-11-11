// Ecran de choix de la partie a analyser : parties de l'app, PGN colle, chess.com, Lichess.
import { useState } from 'react';
import { Chess } from 'chess.js';
import { saveGame, type SavedGame } from './store';
import { fetchChessCom, fetchLichess, type RemoteGame } from './importers';
import { load, save } from '../lib/storage';
import { QUICK_USERS } from '../history/LinkedAccounts';
import { getLinked } from '../history/linked';

import { t } from '../i18n';
export interface ReviewRequest {
  id: string;
  pgn: string;
  userColor: 'w' | 'b';
  source: SavedGame['source'];
}

type Tab = 'pgn' | 'chesscom' | 'lichess';

export function ImportPanel({ onOpen }: { onOpen: (r: ReviewRequest) => void }) {
  const [tab, setTab] = useState<Tab>('pgn');
  const [pgn, setPgn] = useState('');
  /** Qui est l'utilisateur dans le PGN colle : un camp, ou aucun (spectateur) */
  const [color, setColor] = useState<'w' | 'b' | 'none' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState(() => load('bettermove.importUser', { chesscom: '', lichess: '' }));
  const [remote, setRemote] = useState<RemoteGame[] | null>(null);
  const [loading, setLoading] = useState(false);

  // Noms lus dans le PGN colle (pour la question "Qui es-tu ?")
  const pgnHeader = (k: string) => pgn.match(new RegExp(`\\[${k} "([^"]*)"\\]`))?.[1] ?? '';
  const known = [user.chesscom, user.lichess, getLinked().chesscom?.username, getLinked().lichess?.username]
    .filter(Boolean)
    .map((n) => n!.toLowerCase());
  const guess: 'w' | 'b' | null = known.includes(pgnHeader('White').toLowerCase())
    ? 'w'
    : known.includes(pgnHeader('Black').toLowerCase())
      ? 'b'
      : null;
  const who = color ?? guess;

  const openPgn = () => {
    setError(null);
    const c = new Chess();
    try {
      c.loadPgn(pgn.trim());
    } catch {
      setError(t('PGN illisible. Copie-le depuis chess.com (Partager > PGN) ou Lichess (Partager & exporter).'));
      return;
    }
    if (c.history().length < 2) {
      setError(t('La partie contient moins de 2 coups.'));
      return;
    }
    const h = c.getHeaders();
    if (!who) {
      setError(t('Indique d’abord qui tu es dans cette partie.'));
      return;
    }
    const r: ReviewRequest = { id: `pgn-${Date.now()}`, pgn: pgn.trim(), userColor: who === 'b' ? 'b' : 'w', source: 'pgn' };
    // Les parties importees rejoignent l'historique
    saveGame({
      id: r.id,
      pgn: r.pgn,
      white: h.White ?? 'Blancs',
      black: h.Black ?? 'Noirs',
      result: h.Result ?? '*',
      date: h.Date ?? new Date().toLocaleDateString('fr-FR'),
      source: 'pgn',
      userColor: r.userColor,
      // Partie d'un autre joueur : analysee, mais sans toucher au suivi ni aux stats
      observer: who === 'none' || undefined,
    });
    onOpen(r);
  };

  const fetchRemote = async (site: 'chesscom' | 'lichess', override?: string) => {
    const name = (override ?? user[site]).trim();
    if (!name) return;
    save('bettermove.importUser', { ...user, [site]: name });
    setLoading(true);
    setError(null);
    setRemote(null);
    try {
      setRemote(site === 'chesscom' ? await fetchChessCom(name) : await fetchLichess(name));
    } catch (e) {
      setError(
        e instanceof Error && e.message !== 'Failed to fetch'
          ? e.message
          : t('Impossible de joindre le site. Vérifie ta connexion, ou colle le PGN directement.'),
      );
    } finally {
      setLoading(false);
    }
  };

  const openRemote = (g: RemoteGame) => {
    const source = tab === 'chesscom' ? 'chess.com' : 'lichess';
    saveGame({
      id: g.id,
      pgn: g.pgn,
      white: g.white,
      black: g.black,
      result: g.result,
      date: g.date,
      source,
      userColor: g.userColor,
      timeControl: g.timeControl,
    });
    onOpen({ id: g.id, pgn: g.pgn, userColor: g.userColor, source });
  };

  const resultFor = (r: string, c: 'w' | 'b') =>
    r === '1/2-1/2' ? t('nulle') : (r === '1-0') === (c === 'w') ? t('victoire') : r === '*' ? t('en cours') : t('défaite');

  return (
    <div className="review-import">
      <div className="card">
        <h2>{t("Analyser une seule partie")}</h2>
        <p className="muted">{t("Colle un PGN ou choisis une partie récente : elle rejoint ton historique et Stockfish la passe au crible.")}</p>
        <div className="chips">
          {(
            [
              ['pgn', t("Coller un PGN")],
              ['chesscom', 'chess.com'],
              ['lichess', t("Lichess")],
            ] as [Tab, string][]
          ).map(([t, l]) => (
            <button
              key={t}
              className={`chip ${tab === t ? 'selected' : ''}`}
              onClick={() => {
                setTab(t);
                setRemote(null);
                setError(null);
              }}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {tab === 'pgn' && (
        <div className="card">
          <textarea
            className="pgn-input"
            placeholder={t("[Event \"Live Chess\"]\n[White \"...\"]\n\n1. e4 d5 2. e5 Nc6 ...")}
            value={pgn}
            onChange={(e) => setPgn(e.target.value)}
          />
          <span className="label">{t("Qui es-tu dans cette partie ?")}</span>
          <div className="chips">
            {(
              [
                ['w', `${pgnHeader("White") || t("Joueur")} (${t('Blancs')})`],
                ['b', `${pgnHeader("Black") || t("Joueur")} (${t('Noirs')})`],
                ['none', t("Aucun des deux")],
              ] as const
            ).map(([c, l]) => (
              <button key={c} className={`chip ${who === c ? 'selected' : ''}`} onClick={() => setColor(c)}>
                {l}
              </button>
            ))}
          </div>
          <p className="muted small">
            {who === 'none'
              ? t("La partie sera analysée en spectateur : ton suivi et tes statistiques ne bougent pas.")
              : who
                ? t("Tes erreurs seront analysées et ton suivi personnalisé mis à jour.")
                : t("On analyse tes erreurs à toi, pour te proposer des exercices adaptés.")}
          </p>
          <button className="btn primary big" onClick={openPgn} disabled={!pgn.trim() || !who}>{t("Analyser")}</button>
        </div>
      )}

      {(tab === 'chesscom' || tab === 'lichess') && (
        <div className="card">
          <span className="label">{t("Ton pseudo")}{" "}{tab === 'chesscom' ? 'chess.com' : t("Lichess")}</span>
          <div className="row tight-row">
            <input
              className="text-input"
              value={user[tab]}
              placeholder={tab === 'chesscom' ? t("Ton pseudo chess.com") : t("Ton pseudo Lichess")}
              onChange={(e) => setUser({ ...user, [tab]: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && fetchRemote(tab)}
            />
            <button className="btn primary" onClick={() => fetchRemote(tab)} disabled={loading || !user[tab].trim()}>
              {loading ? t("Chargement…") : t("Voir mes parties")}
            </button>
          </div>
          {QUICK_USERS[tab].length > 0 && (
            <div className="chips">
              {QUICK_USERS[tab].map((u) => (
                <button
                  key={u}
                  className="chip"
                  onClick={() => {
                    setUser({ ...user, [tab]: u });
                    fetchRemote(tab, u);
                  }}
                >
                  ⚡ {u}
                </button>
              ))}
            </div>
          )}
          {remote && remote.length === 0 && <p className="muted">{t("Aucune partie trouvée ces derniers mois.")}</p>}
          {remote && remote.length > 0 && (
            <div className="game-list">
              {remote.map((g) => (
                <button key={g.id} className="game-row" onClick={() => openRemote(g)}>
                  <span className={`result-dot ${resultFor(g.result, g.userColor)}`} />
                  <span className="game-players">
                    {g.white} <span className="muted">{t("contre")}</span> {g.black}
                  </span>
                  <span className="muted small">
                    {g.timeControl} · {g.date}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {error && <p className="error card">{error}</p>}
    </div>
  );
}
