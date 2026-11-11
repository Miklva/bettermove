// Historique des parties (bots, 1v1, importees) et statistiques.
import { useEffect, useMemo, useState } from 'react';
import { deleteGame, listGames, type SavedGame } from '../review/store';
import { ImportPanel, type ReviewRequest } from '../review/ImportPanel';
import { enrichGames } from './enrich';
import { LinkedAccounts } from './LinkedAccounts';
import { autoImport, getLinked, setLinked } from './linked';
import { END_LABEL, openingFr, openingVariant } from './names';
import { listReviewFacts, type EndReason } from '../achievements/facts';
import type { PlayerProfile } from '../rating/profile';

import { t, tn } from '../i18n';
type View = 'games' | 'stats' | 'import';
/** Filtre d'origine : BetterMove (bots + 1v1) ou site d'import */
type Scope = 'all' | 'bettermove' | 'bot' | 'local' | 'chess.com' | 'lichess' | 'pgn';
type Res = 'win' | 'draw' | 'loss' | 'none';

/** Origine de la partie : site + mode */
const ORIGIN: Record<SavedGame['source'], { site: string; mode?: string; cls: string }> = {
  bot: { site: 'BetterMove', get mode() { return t('contre un bot'); }, cls: 'bm' },
  local: { site: 'BetterMove', mode: '1v1', cls: 'bm' },
  online: { site: 'BetterMove', get mode() { return t('contre un ami'); }, cls: 'bm' },
  'chess.com': { site: 'chess.com', cls: 'cc' },
  lichess: { site: 'Lichess', cls: 'li' },
  pgn: { get site() { return t('PGN importé'); }, cls: 'pgn' },
};

function OriginBadge({ g }: { g: SavedGame }) {
  const o = ORIGIN[g.source];
  return (
    <span className={`origin ${o.cls}`}>
      {o.site}
      {o.mode && <small> · {o.mode}</small>}
      {g.observer && <small>{" "}{t("· spectateur")}</small>}
    </span>
  );
}

const inScope = (g: SavedGame, s: Scope) =>
  s === 'all' ||
  (s === 'bettermove' && (g.source === 'bot' || g.source === 'local' || g.source === 'online')) ||
  g.source === s;

export function resultOf(g: SavedGame): Res {
  if (g.result === '1/2-1/2') return 'draw';
  if (g.result === '1-0') return g.userColor === 'w' ? 'win' : 'loss';
  if (g.result === '0-1') return g.userColor === 'b' ? 'win' : 'loss';
  return 'none';
}

/** Nom sans l'Elo ajoute par l'app, ex. "Pip (400)" */
const clean = (n: string) => n.replace(/\s*\(\d+\)$/, '');
const oppName = (g: SavedGame) => clean(g.userColor === 'w' ? g.black : g.white);

function when(g: SavedGame) {
  if (!g.playedAt) return g.date;
  const d = new Date(g.playedAt);
  return `${d.toLocaleDateString('fr-FR')} ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
}

const sortKey = (g: SavedGame) => g.playedAt ?? '';

interface Props {
  player: PlayerProfile;
  onOpen: (r: ReviewRequest) => void;
}

export function HistoryPage({ player, onOpen }: Props) {
  const [view, setView] = useState<View>('games');
  const [games, setGames] = useState<SavedGame[]>(() => listGames());
  const [enriching, setEnriching] = useState(false);

  const [notice, setNotice] = useState<string | null>(null);
  const [suggest, setSuggest] = useState(() => {
    const l = getLinked();
    return !l.chesscom && !l.lichess && !l.dismissed;
  });

  // Recharge la liste puis complete les parties (ouverture, fin, Elo) qui ne le sont pas encore
  const refresh = () => {
    const list = listGames();
    setGames(list);
    if (!list.some((g) => !g.end || g.opening === undefined || g.moves === undefined)) return;
    setEnriching(true);
    enrichGames()
      .then(() => setGames(listGames()))
      .finally(() => setEnriching(false));
  };

  useEffect(() => {
    refresh();
    // Nouvelles parties des comptes lies
    autoImport().then((n) => {
      if (!n) return;
      setNotice(tn(n, '{n} nouvelle partie importée depuis tes comptes en ligne.', '{n} nouvelles parties importées depuis tes comptes en ligne.'));
      refresh();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const open = (g: SavedGame) => onOpen({ id: g.id, pgn: g.pgn, userColor: g.userColor, source: g.source });
  const remove = (g: SavedGame) => {
    if (!window.confirm(t('Supprimer la partie contre {name} de l’historique ?', { name: oppName(g) }))) return;
    deleteGame(g.id);
    setGames(listGames());
  };

  return (
    <div className="history">
      <div className="card history-head">
        <div>
          <h2>{t("Historique des parties")}</h2>
          <p className="muted small">
            {tn(games.length, '{n} partie : bots, 1v1 et parties importées. Clique sur une partie pour la revoir avec Stockfish.', '{n} parties : bots, 1v1 et parties importées. Clique sur une partie pour la revoir avec Stockfish.')}</p>
        </div>
        <div className="chips">
          {(
            [
              ['games', t("📜 Parties")],
              ['stats', t("📊 Statistiques")],
              ['import', t("📥 Importer")],
            ] as [View, string][]
          ).map(([v, l]) => (
            <button key={v} className={`chip ${view === v ? 'selected' : ''}`} onClick={() => setView(v)}>
              {l}
            </button>
          ))}
        </div>
      </div>
      {enriching && <p className="muted small center">{t("Analyse des ouvertures de tes parties…")}</p>}
      {notice && <p className="card success-text">{notice}</p>}
      {suggest && view === 'games' && (
        <div className="card suggest">
          <span className="suggest-icon">📥</span>
          <div>
            <strong>{t("Tu joues aussi sur chess.com ou Lichess ?")}</strong>
            <p className="muted small">{t("Importe toutes tes parties pour avoir un historique et des statistiques complets.")}</p>
          </div>
          <button className="btn primary" onClick={() => setView('import')}>{t("Importer mes parties")}</button>
          <button
            className="icon-btn"
            aria-label={t("Plus tard")}
            title={t("Plus tard")}
            onClick={() => {
              setLinked({ ...getLinked(), dismissed: true });
              setSuggest(false);
            }}
          >
            ×
          </button>
        </div>
      )}
      {view === 'games' && <GameList games={games} onOpen={open} onDelete={remove} />}
      {view === 'stats' && <Stats games={games} player={player} />}
      {view === 'import' && (
        <>
          <LinkedAccounts
            onImported={() => {
              setSuggest(false);
              refresh();
            }}
          />
          <ImportPanel onOpen={onOpen} />
        </>
      )}
    </div>
  );
}

/* ---------------- Liste ---------------- */

function ScopeChips({ scope, setScope, games }: { scope: Scope; setScope: (s: Scope) => void; games: SavedGame[] }) {
  const count = (s: Scope) => games.filter((g) => inScope(g, s)).length;
  const main: [Scope, string][] = [
    ['all', t('Toutes')],
    ['bettermove', '♞ BetterMove'],
    ['chess.com', '♟️ chess.com'],
    ['lichess', '🐴 Lichess'],
    ['pgn', t('📋 PGN importé')],
  ];
  const inBm = scope === 'bettermove' || scope === 'bot' || scope === 'local';
  return (
    <>
      <span className="label inline-label">{t("Origine")}</span>
      {main
        .filter(([s]) => s === 'all' || s === 'bettermove' || count(s) > 0)
        .map(([s, l]) => (
          <button
            key={s}
            className={`chip ${scope === s || (s === 'bettermove' && inBm) ? 'selected' : ''}`}
            onClick={() => setScope(s)}
          >
            {l} <small className="muted">{count(s)}</small>
          </button>
        ))}
      {inBm && (
        <span className="sub-chips">
          {(
            [
              ['bettermove', t("Tout")],
              ['bot', t("🤖 Bots")],
              ['local', '👥 1v1'],
            ] as [Scope, string][]
          ).map(([s, l]) => (
            <button key={s} className={`chip small-chip ${scope === s ? 'selected' : ''}`} onClick={() => setScope(s)}>
              {l} <small className="muted">{count(s)}</small>
            </button>
          ))}
        </span>
      )}
    </>
  );
}

function GameList({ games, onOpen, onDelete }: { games: SavedGame[]; onOpen: (g: SavedGame) => void; onDelete: (g: SavedGame) => void }) {
  const [scope, setScope] = useState<Scope>('all');
  const [res, setRes] = useState<Res | 'all'>('all');
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(40);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return games
      .filter((g) => inScope(g, scope))
      .filter((g) => res === 'all' || resultOf(g) === res)
      .filter(
        (g) =>
          !needle ||
          [g.white, g.black, g.opening, openingFr(g.opening)].some((x) => x?.toLowerCase().includes(needle)),
      );
  }, [games, scope, res, q]);

  return (
    <>
      <div className="card history-filters">
        <div className="chips">
          <ScopeChips scope={scope} setScope={setScope} games={games} />
        </div>
        <div className="chips">
          {(
            [
              ['all', t("Tous résultats")],
              ['win', t("Victoires")],
              ['draw', t("Nulles")],
              ['loss', t("Défaites")],
            ] as [Res | 'all', string][]
          ).map(([r, l]) => (
            <button key={r} className={`chip ${res === r ? 'selected' : ''}`} onClick={() => setRes(r)}>
              {l}
            </button>
          ))}
          <input
            className="text-input history-search"
            placeholder={t("Rechercher un adversaire, une ouverture…")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      <div className="card history-list">
        {list.length === 0 && (
          <p className="muted center">
            {games.length === 0
              ? t("Aucune partie pour l’instant. Joue contre un bot, en 1v1, ou importe une partie.")
              : t("Aucune partie ne correspond à ces filtres.")}
          </p>
        )}
        {list.slice(0, limit).map((g) => {
          const r = resultOf(g);
          return (
            <div key={g.id} className="h-row" role="button" tabIndex={0} onClick={() => onOpen(g)} onKeyDown={(e) => e.key === 'Enter' && onOpen(g)}>
              <span className={`h-res ${g.observer ? 'none' : r}`}>
                {g.observer ? '👀' : r === 'win' ? 'V' : r === 'loss' ? 'D' : r === 'draw' ? 'N' : '?'}
              </span>
              <div className="h-main">
                <div className="h-players">
                  {g.source === 'local' || g.observer ? (
                    <>
                      {clean(g.white)} <span className="muted">{t("contre")}</span> {clean(g.black)}
                    </>
                  ) : (
                    <>
                      <span className="muted">{t("contre")}</span> <strong>{oppName(g)}</strong>
                      {g.oppRating ? <span className="muted"> ({g.oppRating})</span> : null}
                      <span className={`h-color ${g.userColor}`} title={g.userColor === 'w' ? t("Tu avais les Blancs") : t("Tu avais les Noirs")} />
                    </>
                  )}
                </div>
                <div className="muted small h-meta">
                  <OriginBadge g={g} />
                  {g.opening ? (
                    <span title={g.opening}>
                      📖 {openingFr(g.opening)}
                      {openingVariant(g.opening) ? ` · ${openingVariant(g.opening)}` : ''}
                    </span>
                  ) : (
                    g.opening === '' && <span>{t("📖 Hors théorie")}</span>
                  )}
                </div>
              </div>
              <div className="h-side small">
                <span className="muted">
                  {g.end ? END_LABEL[g.end as EndReason] : ''}
                  {g.moves ? ' · ' + t('{n} coups', { n: g.moves }) : ''}
                  {g.timeControl ? ` · ${g.timeControl}` : ''}
                </span>
                <span className="muted">{when(g)}</span>
              </div>
              <button
                className="icon-btn h-del"
                title={t("Supprimer de l’historique")}
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(g);
                }}
              >
                🗑
              </button>
            </div>
          );
        })}
        {list.length > limit && (
          <button className="btn ghost" onClick={() => setLimit(limit + 40)}>{t('Afficher plus ({n} restantes)', { n: list.length - limit })}</button>
        )}
      </div>
    </>
  );
}

/* ---------------- Statistiques ---------------- */

interface WDL {
  w: number;
  d: number;
  l: number;
}
const wdl = (list: SavedGame[]): WDL => {
  const o = { w: 0, d: 0, l: 0 };
  for (const g of list) {
    const r = resultOf(g);
    if (r === 'win') o.w++;
    else if (r === 'draw') o.d++;
    else if (r === 'loss') o.l++;
  }
  return o;
};
const total = (x: WDL) => x.w + x.d + x.l;
const pct = (n: number, t: number) => (t ? Math.round((n / t) * 100) : 0);
const scorePct = (x: WDL) => (total(x) ? Math.round(((x.w + x.d / 2) / total(x)) * 100) : 0);

function WdlBar({ x, big = false }: { x: WDL; big?: boolean }) {
  const t = total(x) || 1;
  return (
    <div className={`wdl ${big ? 'big' : ''}`} title={`${x.w} V · ${x.d} N · ${x.l} D`}>
      <span className="w" style={{ width: `${(x.w / t) * 100}%` }} />
      <span className="d" style={{ width: `${(x.d / t) * 100}%` }} />
      <span className="l" style={{ width: `${(x.l / t) * 100}%` }} />
    </div>
  );
}

function Stats({ games: all, player }: { games: SavedGame[]; player: PlayerProfile }) {
  const [scope, setScope] = useState<Scope>('all');
  // Parties en spectateur : jamais comptees dans tes statistiques
  const games = all.filter((g) => inScope(g, scope) && !g.observer);
  // Les parties 1v1 n'ont pas d'adversaire au sens propre : exclues des stats de resultat sauf si demandees
  const rated = scope === 'local' ? games : games.filter((g) => g.source !== 'local');
  const res = wdl(rated);
  const n = total(res);

  const withElo = rated.filter((g) => g.oppRating);
  const avgOpp = withElo.length ? Math.round(withElo.reduce((s, g) => s + g.oppRating!, 0) / withElo.length) : null;
  const beaten = withElo.filter((g) => resultOf(g) === 'win');
  const avgBeaten = beaten.length ? Math.round(beaten.reduce((s, g) => s + g.oppRating!, 0) / beaten.length) : null;
  const strongest = beaten.slice().sort((a, b) => b.oppRating! - a.oppRating!)[0];
  const toughest = withElo.filter((g) => resultOf(g) === 'loss').sort((a, b) => a.oppRating! - b.oppRating!)[0];

  // Series : de la plus ancienne a la plus recente
  const chrono = rated.slice().sort((a, b) => (sortKey(a) < sortKey(b) ? -1 : 1));
  let best = 0;
  let cur = 0;
  for (const g of chrono) {
    cur = resultOf(g) === 'win' ? cur + 1 : 0;
    best = Math.max(best, cur);
  }
  const currentStreak = (() => {
    let k = 0;
    for (const g of chrono.slice().reverse()) {
      if (resultOf(g) !== 'win') break;
      k++;
    }
    return k;
  })();

  const lengths = games.filter((g) => g.moves);
  const avgLen = lengths.length ? Math.round(lengths.reduce((s, g) => s + (g.moves ?? 0), 0) / lengths.length) : null;

  const reviews = listReviewFacts();
  const ids = new Set(games.map((g) => g.id));
  const myReviews = reviews.filter((r) => ids.has(r.id));
  const avgAcc = myReviews.length ? myReviews.reduce((s, r) => s + r.accuracy, 0) / myReviews.length : null;

  const byColor = (c: 'w' | 'b') => wdl(rated.filter((g) => g.userColor === c));

  const tallyEnd = (r: Res) => {
    const m = new Map<string, number>();
    for (const g of rated) if (resultOf(g) === r && g.end) m.set(g.end, (m.get(g.end) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };

  // Ouvertures par famille et par couleur
  const openings = (() => {
    const m = new Map<string, { name: string; color: 'w' | 'b'; list: SavedGame[] }>();
    for (const g of games) {
      const fam = openingFr(g.opening);
      if (!fam) continue;
      const k = `${g.userColor}|${fam}`;
      if (!m.has(k)) m.set(k, { name: fam, color: g.userColor, list: [] });
      m.get(k)!.list.push(g);
    }
    return [...m.values()].sort((a, b) => b.list.length - a.list.length).slice(0, 16);
  })();

  const opponents = (() => {
    const m = new Map<string, SavedGame[]>();
    for (const g of rated) {
      const k = oppName(g);
      m.set(k, [...(m.get(k) ?? []), g]);
    }
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 8);
  })();

  const cadences = (() => {
    const m = new Map<string, SavedGame[]>();
    for (const g of rated) {
      const k = g.timeControl ?? 'Inconnue';
      m.set(k, [...(m.get(k) ?? []), g]);
    }
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 6);
  })();

  const eloHistory = player.profile.history.slice().reverse();

  return (
    <>
      <div className="card history-filters">
        <div className="chips">
          <ScopeChips scope={scope} setScope={setScope} games={all} />
        </div>
        {(scope === 'all' || scope === 'bettermove') && (
          <p className="muted small">{t("Les parties 1v1 comptent pour les ouvertures, pas pour les résultats.")}</p>
        )}
      </div>

      {games.length === 0 ? (
        <p className="card muted center">{t("Pas encore de parties ici.")}</p>
      ) : (
        <>
          <div className="stat-grid">
            <div className="card stat-big">
              <span className="tc-label">{t("Résultats")}</span>
              <strong>{n}{" "}{t("parties")}</strong>
              <WdlBar x={res} big />
              <div className="wdl-legend small">
                <span className="w">{t('{n} victoires ({p} %)', { n: res.w, p: pct(res.w, n) })}</span>
                <span className="d">{t('{n} nulles ({p} %)', { n: res.d, p: pct(res.d, n) })}</span>
                <span className="l">{t('{n} défaites ({p} %)', { n: res.l, p: pct(res.l, n) })}</span>
              </div>
            </div>
            <StatTile label={t("Elo moyen des adversaires")} value={avgOpp ?? '–'} />
            <StatTile label={t("Elo moyen des adversaires battus")} value={avgBeaten ?? '–'} />
            <StatTile
              label={t("Plus fort adversaire battu")}
              value={strongest ? strongest.oppRating! : '–'}
              sub={strongest ? `${oppName(strongest)} · ${when(strongest)}` : t("Pas encore de victoire")}
              accent
            />
            <StatTile
              label={t("Défaite la plus rageante")}
              value={toughest ? toughest.oppRating! : '–'}
              sub={toughest ? t('contre {name}, le plus faible qui t’a battu', { name: oppName(toughest) }) : t("Aucune")}
            />
            <StatTile label={t("Meilleure série de victoires")} value={best} sub={currentStreak ? t('Série en cours : {n}', { n: currentStreak }) : undefined} />
            <StatTile label={t("Durée moyenne")} value={avgLen ? t('{n} coups', { n: avgLen }) : '–'} />
            <StatTile
              label={t("Précision moyenne (review)")}
              value={avgAcc !== null ? `${avgAcc.toFixed(1)} %` : '–'}
              sub={myReviews.length ? tn(myReviews.length, 'sur {n} partie analysée', 'sur {n} parties analysées') : t("Analyse une partie pour la calculer")}
            />
          </div>

          <div className="stat-cols">
            <div className="card">
              <h3>{t("Par couleur")}</h3>
              {(['w', 'b'] as const).map((c) => {
                const x = byColor(c);
                return (
                  <div key={c} className="stat-line">
                    <span>
                      <span className={`h-color ${c}`} /> {c === 'w' ? t("Blancs") : t("Noirs")} <small className="muted">{total(x)}</small>
                    </span>
                    <WdlBar x={x} />
                    <b>{scorePct(x)} %</b>
                  </div>
                );
              })}
              <h3>{t("Comment tu gagnes")}</h3>
              <EndList items={tallyEnd('win')} />
              <h3>{t("Comment tu perds")}</h3>
              <EndList items={tallyEnd('loss')} />
            </div>

            <div className="card">
              <h3>{t("Ouvertures jouées")}</h3>
              {openings.length === 0 && <p className="muted small">{t("Aucune ouverture reconnue pour l’instant.")}</p>}
              {(['w', 'b'] as const).map((c) => {
                const list = openings.filter((o) => o.color === c);
                if (!list.length) return null;
                return (
                  <div key={c}>
                    <div className="tc-label opening-side">
                      <span className={`h-color ${c}`} />{" "}{c === 'w' ? t('Avec les Blancs') : t('Avec les Noirs')}
                    </div>
                    {list.map((o) => {
                      const x = wdl(o.list.filter((g) => g.source !== 'local'));
                      return (
                        <div key={`${o.color}${o.name}`} className="stat-line">
                          <span className="stat-name" title={o.name}>
                            {o.name} <small className="muted">{o.list.length}</small>
                          </span>
                          <WdlBar x={x} />
                          <b>{total(x) ? `${scorePct(x)} %` : '–'}</b>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="stat-cols">
            <div className="card">
              <h3>{t("Adversaires les plus affrontés")}</h3>
              {opponents.map(([name, list]) => {
                const x = wdl(list);
                return (
                  <div key={name} className="stat-line">
                    <span className="stat-name">
                      {name} <small className="muted">{list.length}</small>
                    </span>
                    <WdlBar x={x} />
                    <b>
                      {x.w}-{x.d}-{x.l}
                    </b>
                  </div>
                );
              })}
            </div>
            <div className="card">
              <h3>{t("Par cadence")}</h3>
              {cadences.map(([name, list]) => {
                const x = wdl(list);
                return (
                  <div key={name} className="stat-line">
                    <span className="stat-name">
                      {name} <small className="muted">{list.length}</small>
                    </span>
                    <WdlBar x={x} />
                    <b>{scorePct(x)} %</b>
                  </div>
                );
              })}
            </div>
          </div>

          {(scope === 'all' || scope === 'bot') && eloHistory.length >= 2 && (
            <div className="card">
              <h3>{t("Ton Elo contre les bots")}</h3>
              <EloChart points={eloHistory.map((h) => h.after)} />
            </div>
          )}
        </>
      )}
    </>
  );
}

function StatTile({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: boolean }) {
  return (
    <div className={`card stat-tile ${accent ? 'accent' : ''}`}>
      <span className="tc-label">{label}</span>
      <strong>{value}</strong>
      {sub && <span className="muted small">{sub}</span>}
    </div>
  );
}

function EndList({ items }: { items: [string, number][] }) {
  const total = items.reduce((s, x) => s + x[1], 0);
  if (!total) return <p className="muted small">{t("Pas encore de données.")}</p>;
  return (
    <div className="end-list">
      {items.map(([k, v]) => (
        <div key={k} className="end-item">
          <span>{END_LABEL[k as EndReason] ?? k}</span>
          <div className="end-bar">
            <span style={{ width: `${(v / total) * 100}%` }} />
          </div>
          <b>{v}</b>
        </div>
      ))}
    </div>
  );
}

function EloChart({ points }: { points: number[] }) {
  const W = 600;
  const H = 140;
  const min = Math.min(...points) - 20;
  const max = Math.max(...points) + 20;
  const x = (i: number) => (i / (points.length - 1)) * W;
  const y = (v: number) => H - ((v - min) / (max - min)) * H;
  const d = points.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return (
    <div className="elo-chart">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <path d={`${d} L${W},${H} L0,${H} Z`} className="area" />
        <path d={d} className="line" />
      </svg>
      <div className="elo-axis small muted">
        <span>{Math.round(points[0])}</span>
        <span>{t('Max {max} · Actuel', { max: Math.round(Math.max(...points)) })}{' '}<b>{Math.round(points[points.length - 1])}</b>
        </span>
      </div>
    </div>
  );
}
