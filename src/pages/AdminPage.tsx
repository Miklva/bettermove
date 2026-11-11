// Tableau de bord administrateur (reserve aux pseudos de ADMIN_USERS).
// Chaque chiffre est cliquable : la liste des comptes qui le composent, puis la fiche complete d'un joueur.
// Les visiteurs non connectes ont leur onglet : audience anonyme (appareils, pages, provenance...).
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { apiCall, HttpError } from '../sync/client';
import { Avatar } from '../profile/avatar';
import { Modal } from '../components/Modal';

interface Stats {
  users: number;
  new30: number;
  new7: number;
  avatars: number;
  active30: number;
  active1: number;
  games: number;
  games30: number;
  emails: number;
  emailsOk: number;
  inactive: number;
  referrals: number;
  online: string[];
  queue: { total: number; byTc: Record<string, number> };
  signups: { day: string; n: number }[];
  gamesByDay: { day: string; n: number; players: number }[];
  onlineGames30: number;
  onlineLive: number;
  elo: { online: number | null; onlinePlayers: number; bestOnline: number | null; bots: number | null; puzzles: number | null; xp: number | null; profiles: number; bestBots: number | null; bestPuzzles: number | null };
  eloBuckets: { bucket: number; n: number }[];
  recent: { username: string; createdAt: string; lastSeen: string | null }[];
  rush: { runs: number; players: number; best: number | null };
  daily: { n: number; players: number; firstTry: number };
  chat: { n: number; authors: number };
  support: number;
  sources: { source: string; n: number }[];
  visits: { day: string; n: number; anon: number }[];
}

/** Demande de liste : /admin/list?kind=...&... */
type ListReq = { kind: string; params?: Record<string, string> };
type Col = { key: string; label: string; type: 'user' | 'num' | 'date' | 'day' | 'text' | 'bool' };
interface ListRes {
  title: string;
  cols: Col[];
  rows: Record<string, string | number | boolean | null>[];
}

interface UserDetail {
  username: string;
  createdAt: string;
  lastSeen: string | null;
  lastSync: string | null;
  email: string | null;
  emailVerified: boolean;
  photo: boolean;
  inviteCode: string | null;
  synced: boolean;
  keys: number;
  settings: { lang: string | null; notation: string | null };
  ratings: { bots: number | null; puzzles: number | null; online: number | null; onlineGames: number | null };
  xp: number | null;
  lessons: { done: number; stars: number };
  beaten: string[];
  puzzleStats: { solved?: number; failed?: number; streak?: number; bestStreak?: number } | null;
  coins: number | null;
  owned: number | null;
  achievements: number | null;
  games: { total: number; d30: number; d7: number; first: string | null; last: string | null };
  sources: { source: string; n: number }[];
  lastGames: { at: string | null; source: string | null; result: string | null; white: string | null; black: string | null; tc: string | null }[];
  online: { n: number; won: number; drawn: number; lost: number; live: number };
  rush: { mode: string; runs: number; best: number }[];
  daily: { n: number; solved: number; first: number; last: string | null };
  chat: { n: number; censored: number; last: string | null };
  dms: { sent: number; received: number };
  friends: { n: number; pending: number };
  referrer: { username: string; at: string } | null;
  referees: { username: string; at: string }[];
  support: { id: number; subject: string; category: string | null; handled: boolean; at: string }[];
  rewards: { coins: number; items: string[]; reason: string; at: string; claimed: string | null }[];
}

interface Share {
  label: string;
  n: number;
}
interface Audience {
  days: number;
  who: 'anon' | 'logged' | 'all';
  visitors: number;
  hits: number;
  measured: number;
  bounce: number | null;
  pagesPerVisitor: number | null;
  avgSeconds: number | null;
  devices: Share[];
  browsers: Share[];
  oses: Share[];
  langs: Share[];
  referrers: Share[];
  entries: Share[];
  pages: { label: string; views: number; visitors: number }[];
  hours: { h: number; n: number }[];
  weekdays: { d: number; n: number }[];
  depth: Share[];
}

const SOURCE_LABEL: Record<string, string> = {
  bot: 'Contre les bots',
  local: '1v1 sur écran',
  online: 'En ligne',
  'chess.com': 'Import chess.com',
  lichess: 'Import Lichess',
  pgn: 'Import PGN',
  autre: 'Autre',
};
const RUSH_LABEL: Record<string, string> = { '3': '3 min', '5': '5 min', survival: 'Survie' };
/** Pages internes (adresses francaises) : nom lisible */
const PAGE_LABEL: Record<string, string> = {
  '/': 'Accueil',
  '/jouer/bot': 'Jouer · bots',
  '/jouer/monde': 'Jouer · contre le monde',
  '/jouer/local': 'Jouer · 1v1 écran',
  '/partie': 'Partie en ligne',
  '/apprendre/cours': 'Apprendre · cours',
  '/apprendre/professeur': 'Apprendre · professeur',
  '/apprendre/problemes': 'Apprendre · problèmes',
  '/apprendre/rush': 'Apprendre · Puzzle Rush',
  '/apprendre/repertoire': 'Apprendre · répertoire',
  '/progresser/historique': 'Progresser · historique',
  '/progresser/suivi': 'Progresser · suivi',
  '/progresser/astuces': 'Progresser · astuces',
  '/progresser/succes': 'Progresser · succès',
  '/progresser/niveaux': 'Progresser · niveaux',
  '/communaute/salon': 'Communauté · salon',
  '/communaute/classement': 'Communauté · classement',
  '/communaute/evenements': 'Communauté · événements',
  '/boutique': 'Boutique',
  '/profil': 'Profil',
  '/aide': 'Aide / support',
  '/infos': 'Infos légales',
  '/guides': 'Guides',
  '/invite': 'Lien de parrainage',
  '/admin': 'Admin',
};
const pageName = (p: string) => PAGE_LABEL[p] ?? p;
const WEEKDAYS = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'];

const n0 = (v: number | null | undefined) => (v === null || v === undefined ? '–' : Math.round(v).toLocaleString('fr-FR'));
const pct = (v: number | null | undefined) => (v === null || v === undefined ? '–' : `${Math.round(v * 100)} %`);
const shortDay = (d: string) => {
  const [, m, j] = d.split('-');
  return `${Number(j)}/${Number(m)}`;
};
const dateTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '–';
const ago = (iso: string | null) => {
  if (!iso) return 'jamais';
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (m < 3) return 'en ligne';
  if (m < 60) return `il y a ${m} min`;
  const h = Math.round(m / 60);
  if (h < 48) return `il y a ${h} h`;
  return `il y a ${Math.round(h / 24)} j`;
};
const duration = (s: number | null) => {
  if (s === null) return '–';
  if (s < 60) return `${Math.round(s)} s`;
  const m = Math.round(s / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
};

/** Ouvre une liste ou une fiche joueur depuis n'importe ou dans la page */
interface Drill {
  list: (r: ListReq) => void;
  user: (name: string) => void;
}

/* ---------------- Graphiques ---------------- */

/** Histogramme en barres verticales, une barre par jour (cliquable) */
function DayBars({ data, label, unit, onDay }: { data: { day: string; n: number }[]; label: string; unit: string; onDay?: (day: string) => void }) {
  const max = Math.max(1, ...data.map((d) => d.n));
  const total = data.reduce((s, d) => s + d.n, 0);
  return (
    <div className="card admin-chart">
      <div className="admin-chart-head">
        <div className="tc-label">{label}</div>
        <b>
          {total.toLocaleString('fr-FR')} <span className="muted small">{unit} sur 30 jours</span>
        </b>
      </div>
      <div className="day-bars" role="img" aria-label={`${label} : ${total} ${unit} sur 30 jours`}>
        {data.map((d) =>
          onDay && d.n > 0 ? (
            <button key={d.day} className="day-bar clickable" title={`${shortDay(d.day)} : ${d.n} ${unit} · voir le détail`} onClick={() => onDay(d.day)}>
              <i style={{ height: `${(d.n / max) * 100}%` }} />
            </button>
          ) : (
            <div key={d.day} className="day-bar" title={`${shortDay(d.day)} : ${d.n} ${unit}`}>
              <i style={{ height: `${(d.n / max) * 100}%` }} className={d.n ? '' : 'zero'} />
            </div>
          ),
        )}
      </div>
      <div className="day-axis muted tiny">
        <span>{data[0] && shortDay(data[0].day)}</span>
        <span>{data[Math.floor(data.length / 2)] && shortDay(data[Math.floor(data.length / 2)].day)}</span>
        <span>aujourd’hui</span>
      </div>
    </div>
  );
}

/** Barres horizontales ; une ligne cliquable si onRow est donne */
function HBars({ rows, label, onRow, total, extra }: { rows: { label: string; n: number; id?: string }[]; label: string; onRow?: (id: string) => void; total?: number; extra?: ReactNode }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  const sum = total ?? rows.reduce((s, r) => s + r.n, 0);
  return (
    <div className="card">
      <div className="tc-label">{label}</div>
      {rows.length === 0 && <p className="muted small">Pas encore de données.</p>}
      <div className="hbars">
        {rows.map((r) => {
          const inner = (
            <>
              <span className="hbar-label" title={r.label}>
                {r.label}
              </span>
              <span className="hbar-track">
                <i style={{ width: `${(r.n / max) * 100}%` }} />
              </span>
              <b>
                {r.n.toLocaleString('fr-FR')}
                {sum > 0 && <span className="muted tiny"> {Math.round((r.n / sum) * 100)} %</span>}
              </b>
            </>
          );
          return onRow ? (
            <button key={r.label} className="hbar clickable" onClick={() => onRow(r.id ?? r.label)} title="Voir le détail">
              {inner}
            </button>
          ) : (
            <div key={r.label} className="hbar">
              {inner}
            </div>
          );
        })}
      </div>
      {extra}
    </div>
  );
}

/** Petites colonnes (heures, jours de la semaine) */
function Columns({ data, label }: { data: { label: string; n: number }[]; label: string }) {
  const max = Math.max(1, ...data.map((d) => d.n));
  return (
    <div className="card admin-chart">
      <div className="tc-label">{label}</div>
      <div className="day-bars small">
        {data.map((d) => (
          <div key={d.label} className="day-bar" title={`${d.label} : ${d.n}`}>
            <i style={{ height: `${(d.n / max) * 100}%` }} className={d.n ? '' : 'zero'} />
          </div>
        ))}
      </div>
      <div className="day-axis muted tiny">
        {data.length === 24 ? (
          <>
            <span>0 h</span>
            <span>6 h</span>
            <span>12 h</span>
            <span>18 h</span>
            <span>23 h</span>
          </>
        ) : (
          data.map((d) => <span key={d.label}>{d.label}</span>)
        )}
      </div>
    </div>
  );
}

/* ---------------- Liste de comptes (tri, recherche, export) ---------------- */

function cellText(c: Col, v: string | number | boolean | null): string {
  if (v === null || v === undefined || v === '') return '–';
  if (c.type === 'bool') return v ? 'oui' : 'non';
  if (c.type === 'num') return n0(Number(v));
  if (c.type === 'date') return dateTime(String(v));
  return String(v);
}

function ListModal({ req, drill, onClose }: { req: ListReq; drill: Drill; onClose: () => void }) {
  const [res, setRes] = useState<ListRes | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  useEffect(() => {
    const qs = new URLSearchParams({ kind: req.kind, ...(req.params ?? {}) });
    apiCall<ListRes>(`/admin/list?${qs}`)
      .then(setRes)
      .catch((e) => setErr(e instanceof Error ? e.message : 'Chargement impossible'));
  }, [req]);
  const rows = useMemo(() => {
    if (!res) return [];
    const ql = query.trim().toLowerCase();
    let r = ql ? res.rows.filter((row) => Object.values(row).some((v) => v !== null && String(v).toLowerCase().includes(ql))) : res.rows;
    if (sort) {
      const col = res.cols.find((c) => c.key === sort.key);
      r = [...r].sort((a, b) => {
        const x = a[sort.key];
        const y = b[sort.key];
        if (x === null || x === undefined) return 1;
        if (y === null || y === undefined) return -1;
        if (col?.type === 'num' || col?.type === 'bool') return (Number(x) - Number(y)) * sort.dir;
        return String(x).localeCompare(String(y), 'fr') * sort.dir;
      });
    }
    return r;
  }, [res, query, sort]);
  const csv = () => {
    if (!res) return;
    const esc = (v: string) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const lines = [res.cols.map((c) => esc(c.label)).join(';'), ...rows.map((r) => res.cols.map((c) => esc(r[c.key] === null ? '' : String(r[c.key]))).join(';'))];
    const url = URL.createObjectURL(new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `bettermove-${req.kind}${req.params ? '-' + Object.values(req.params).join('-') : ''}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <Modal title={res?.title ?? 'Détail'} onClose={onClose}>
      <div className="admin-modal">
        {err && <p className="error">{err}</p>}
        {!res && !err && <p className="muted">Chargement…</p>}
        {res && (
          <>
            <div className="admin-list-tools">
              <input className="text-input" placeholder="Rechercher…" value={query} onChange={(e) => setQuery(e.target.value)} />
              <span className="muted small">
                {rows.length.toLocaleString('fr-FR')} ligne{rows.length > 1 ? 's' : ''}
                {rows.length !== res.rows.length && ` sur ${res.rows.length}`}
              </span>
              <button className="btn small" onClick={csv} disabled={!rows.length}>
                ⬇ CSV
              </button>
            </div>
            {rows.length === 0 ? (
              <p className="muted small">Aucun compte ici.</p>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table sortable">
                  <thead>
                    <tr>
                      {res.cols.map((c) => (
                        <th key={c.key} className={c.type === 'num' ? 'num' : ''}>
                          <button
                            className="link-like"
                            onClick={() => setSort((s) => ({ key: c.key, dir: s?.key === c.key && s.dir === -1 ? 1 : -1 }))}
                          >
                            {c.label}
                            {sort?.key === c.key ? (sort.dir === -1 ? ' ▾' : ' ▴') : ''}
                          </button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i}>
                        {res.cols.map((c) => (
                          <td key={c.key} className={c.type === 'num' ? 'num' : ''}>
                            {c.type === 'user' && r[c.key] ? (
                              <button className="admin-user link-like" onClick={() => drill.user(String(r[c.key]))}>
                                <Avatar name={String(r[c.key])} size={20} /> {String(r[c.key])}
                              </button>
                            ) : c.key === 'last_seen' && r[c.key] ? (
                              <span className={ago(String(r[c.key])) === 'en ligne' ? 'live-text' : ''} title={dateTime(String(r[c.key]))}>
                                {ago(String(r[c.key]))}
                              </span>
                            ) : (
                              cellText(c, r[c.key])
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

/* ---------------- Fiche d'un joueur ---------------- */

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="admin-fact">
      <span className="muted tiny">{label}</span>
      <b>{children}</b>
    </div>
  );
}

function UserModal({ name, drill, onOpen, onClose }: { name: string; drill: Drill; onOpen: (name: string) => void; onClose: () => void }) {
  const [u, setU] = useState<UserDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    setU(null);
    apiCall<UserDetail>(`/admin/user/${encodeURIComponent(name)}`)
      .then(setU)
      .catch((e) => setErr(e instanceof Error ? e.message : 'Chargement impossible'));
  }, [name]);
  const ps = u?.puzzleStats ?? {};
  const link = (n: string) => (
    <button key={n} className="admin-user link-like" onClick={() => drill.user(n)}>
      <Avatar name={n} size={20} /> {n}
    </button>
  );
  return (
    <Modal title={`Joueur : ${name}`} onClose={onClose}>
      <div className="admin-modal">
        {err && <p className="error">{err}</p>}
        {!u && !err && <p className="muted">Chargement…</p>}
        {u && (
          <div className="admin-user-sheet">
            <div className="admin-user-top">
              <Avatar name={u.username} size={56} />
              <div>
                <h3>{u.username}</h3>
                <p className="muted small">
                  Inscrit le {dateTime(u.createdAt)} · dernière visite{' '}
                  <span className={ago(u.lastSeen) === 'en ligne' ? 'live-text' : ''}>{ago(u.lastSeen)}</span>
                  {u.lastSync && <> · dernière synchro {dateTime(u.lastSync)}</>}
                </p>
              </div>
              <button
                className="btn small"
                onClick={() => {
                  onClose();
                  onOpen(u.username);
                }}
              >
                👤 Profil public
              </button>
            </div>

            <div className="tc-label">Compte</div>
            <div className="admin-facts">
              <Fact label="E-mail">{u.email ? `${u.email} ${u.emailVerified ? '✔' : '(non vérifié)'}` : 'aucun'}</Fact>
              <Fact label="Photo">{u.photo ? 'oui' : 'non'}</Fact>
              <Fact label="Progression synchronisée">{u.synced ? `oui (${u.keys} clés)` : 'non'}</Fact>
              <Fact label="Langue · notation">
                {u.settings.lang ?? '–'} · {u.settings.notation ?? '–'}
              </Fact>
              <Fact label="Amis">
                {u.friends.n}
                {u.friends.pending ? ` (+${u.friends.pending} en attente)` : ''}
              </Fact>
              <Fact label="Messages privés">
                {u.dms.sent} envoyés · {u.dms.received} reçus
              </Fact>
              <Fact label="Parrain">{u.referrer ? link(u.referrer.username) : 'aucun'}</Fact>
              <Fact label="Filleuls">{u.referees.length ? u.referees.map((r) => link(r.username)) : 'aucun'}</Fact>
            </div>

            <div className="tc-label">Niveau et progression</div>
            <div className="admin-facts">
              <Fact label="Elo en ligne">
                {n0(u.ratings.online)} <span className="muted tiny">({u.ratings.onlineGames ?? 0} parties)</span>
              </Fact>
              <Fact label="Elo bots">{n0(u.ratings.bots)}</Fact>
              <Fact label="Elo problèmes">{n0(u.ratings.puzzles)}</Fact>
              <Fact label="XP">{n0(u.xp)}</Fact>
              <Fact label="Cours">
                {u.lessons.done} leçons · {u.lessons.stars} ★
              </Fact>
              <Fact label="Problèmes">
                {n0(ps.solved)} réussis · {n0(ps.failed)} ratés · série max {n0(ps.bestStreak)}
              </Fact>
              <Fact label="Bots battus">{u.beaten.length ? u.beaten.join(', ') : 'aucun'}</Fact>
              <Fact label="Pièces · objets · succès">
                {n0(u.coins)} 🪙 · {n0(u.owned)} · {n0(u.achievements)}
              </Fact>
            </div>

            <div className="tc-label">Activité</div>
            <div className="admin-facts">
              <Fact label="Parties enregistrées">
                {u.games.total} <span className="muted tiny">({u.games.d7} sur 7 j · {u.games.d30} sur 30 j)</span>
              </Fact>
              <Fact label="Origine">{u.sources.length ? u.sources.map((x) => `${SOURCE_LABEL[x.source] ?? x.source} ${x.n}`).join(' · ') : '–'}</Fact>
              <Fact label="En ligne">
                {u.online.n} parties · {u.online.won} V / {u.online.drawn} N / {u.online.lost} D{u.online.live ? ` · ${u.online.live} en cours` : ''}
              </Fact>
              <Fact label="Puzzle Rush">{u.rush.length ? u.rush.map((r) => `${RUSH_LABEL[r.mode] ?? r.mode} : ${r.runs} (record ${r.best})`).join(' · ') : 'jamais'}</Fact>
              <Fact label="Problème du jour">
                {u.daily.n} jours · {u.daily.solved} résolus · {u.daily.first} du 1er coup{u.daily.last ? ` · dernier ${u.daily.last}` : ''}
              </Fact>
              <Fact label="Salon">
                {u.chat.n} messages{u.chat.censored ? ` (${u.chat.censored} censurés)` : ''}
                {u.chat.last ? ` · dernier ${ago(u.chat.last)}` : ''}
              </Fact>
            </div>

            {u.lastGames.length > 0 && (
              <>
                <div className="tc-label">Dernières parties</div>
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Blancs</th>
                        <th>Noirs</th>
                        <th>Cadence</th>
                        <th>Résultat</th>
                      </tr>
                    </thead>
                    <tbody>
                      {u.lastGames.map((g, i) => (
                        <tr key={i}>
                          <td>{dateTime(g.at)}</td>
                          <td>{SOURCE_LABEL[g.source ?? 'autre'] ?? g.source}</td>
                          <td>{g.white ?? '–'}</td>
                          <td>{g.black ?? '–'}</td>
                          <td>{g.tc ?? '–'}</td>
                          <td>{g.result ?? '–'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {u.support.length > 0 && (
              <>
                <div className="tc-label">Demandes au support</div>
                <ul className="admin-plain">
                  {u.support.map((m) => (
                    <li key={m.id}>
                      #{m.id} · {m.category ?? 'Autre'} · {m.subject} <span className="muted small">· {dateTime(m.at)} · {m.handled ? 'traitée' : 'à traiter'}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {u.rewards.length > 0 && (
              <>
                <div className="tc-label">Récompenses envoyées par le serveur</div>
                <ul className="admin-plain">
                  {u.rewards.map((r, i) => (
                    <li key={i}>
                      {r.coins} 🪙{r.items?.length ? ` + ${r.items.join(', ')}` : ''} · {r.reason}{' '}
                      <span className="muted small">
                        · {dateTime(r.at)} · {r.claimed ? 'récupérée' : 'en attente'}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

/* ---------------- Audience (visiteurs connectes ou non) ---------------- */

function AudienceTab({ visits }: { visits: Stats['visits'] }) {
  const [who, setWho] = useState<'anon' | 'logged' | 'all'>('anon');
  const [days, setDays] = useState(30);
  const [a, setA] = useState<Audience | null>(null);
  useEffect(() => {
    setA(null);
    apiCall<Audience>(`/admin/audience?days=${days}&who=${who}`)
      .then(setA)
      .catch(() => setA(null));
  }, [who, days]);
  const series = visits.map((d) => ({ day: d.day, n: who === 'anon' ? d.anon : who === 'logged' ? d.n - d.anon : d.n }));
  return (
    <>
      <div className="admin-filters">
        <div className="chips">
          {(
            [
              ['anon', 'Non connectés'],
              ['logged', 'Connectés'],
              ['all', 'Tous'],
            ] as const
          ).map(([k, l]) => (
            <button key={k} className={`chip ${who === k ? 'selected' : ''}`} onClick={() => setWho(k)}>
              {l}
            </button>
          ))}
        </div>
        <div className="chips">
          {[1, 7, 30, 90].map((d) => (
            <button key={d} className={`chip ${days === d ? 'selected' : ''}`} onClick={() => setDays(d)}>
              {d === 1 ? 'Aujourd’hui' : `${d} jours`}
            </button>
          ))}
        </div>
      </div>
      <DayBars data={series} label="Visiteurs par jour" unit="visiteurs" />
      {!a ? (
        <p className="muted">Chargement…</p>
      ) : (
        <>
          <section className="admin-kpis">
            <div className="card admin-kpi">
              <span className="tc-label">Visiteurs (somme des jours)</span>
              <b>{n0(a.visitors)}</b>
              <span className="muted tiny">{n0(a.measured)} mesurés en détail</span>
            </div>
            <div className="card admin-kpi">
              <span className="tc-label">Pages vues</span>
              <b>{n0(a.hits)}</b>
              <span className="muted tiny">{a.pagesPerVisitor === null ? '–' : a.pagesPerVisitor.toFixed(1).replace('.', ',')} par visiteur</span>
            </div>
            <div className="card admin-kpi">
              <span className="tc-label">Partis après 1 page</span>
              <b>{pct(a.bounce)}</b>
              <span className="muted tiny">temps moyen sur le site : {duration(a.avgSeconds)}</span>
            </div>
          </section>
          <section className="admin-grid three">
            <HBars label="Appareil" rows={a.devices} />
            <HBars label="Système" rows={a.oses} />
            <HBars label="Navigateur" rows={a.browsers} />
          </section>
          <section className="admin-grid three">
            <HBars label="Langue du navigateur" rows={a.langs} />
            <HBars label="Arrivés depuis" rows={a.referrers} />
            <HBars label="Page d’arrivée" rows={a.entries.map((e) => ({ ...e, label: pageName(e.label) }))} />
          </section>
          <section className="admin-grid">
            <HBars
              label="Pages les plus visitées (visiteurs uniques)"
              rows={a.pages.map((p) => ({ label: `${pageName(p.label)} · ${p.views} vues`, n: p.visitors }))}
              total={a.measured}
            />
            <div className="admin-stack">
              <HBars label="Pages vues par visiteur" rows={a.depth.map((d) => ({ label: `${d.label} page${d.label === '1' ? '' : 's'}`, n: d.n }))} />
              <Columns label="Heure d’arrivée (Paris)" data={a.hours.map((h) => ({ label: `${h.h} h`, n: h.n }))} />
              <Columns label="Jour de la semaine" data={a.weekdays.map((w) => ({ label: WEEKDAYS[w.d - 1], n: w.n }))} />
            </div>
          </section>
          <p className="muted tiny">
            Mesure anonyme, sans cookie : un visiteur = une empreinte du jour (IP + navigateur + sel aléatoire oublié le lendemain). On ne peut
            donc pas savoir si un visiteur revient d’un jour à l’autre, ni qui il est. Le détail (pages, appareil, provenance) existe depuis
            cette mise à jour ; les visites plus anciennes n’ont que le compte.
          </p>
        </>
      )}
    </>
  );
}
interface SupportMsg {
  id: number;
  name: string | null;
  email: string | null;
  category: string | null;
  subject: string;
  message: string;
  context: Record<string, unknown> | null;
  handled: boolean;
  account: string | null;
  createdAt: string;
  replies: { message: string; mailed: boolean; createdAt: string }[];
}

/** Demandes envoyees via la page Support : lues ici, marquees comme traitees ou supprimees */
function SupportInbox() {
  const [list, setList] = useState<SupportMsg[] | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [mailOn, setMailOn] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const reload = useCallback(() => {
    apiCall<{ messages: SupportMsg[]; mail: boolean }>('/admin/support')
      .then((r) => {
        setList(r.messages);
        setMailOn(r.mail);
      })
      .catch(() => setList([]));
  }, []);
  const send = async (id: number) => {
    setSending(true);
    setNote(null);
    try {
      await apiCall(`/admin/support/${id}/reply`, { method: 'POST', body: JSON.stringify({ message: draft }) });
      setDraft('');
      setNote({ ok: true, text: 'Réponse envoyée au joueur ✔' });
      reload();
    } catch (e) {
      setNote({ ok: false, text: e instanceof Error ? e.message : 'Envoi impossible' });
    } finally {
      setSending(false);
    }
  };
  useEffect(reload, [reload]);
  const act = async (id: number, kind: 'done' | 'undo' | 'delete') => {
    if (kind === 'delete' && !window.confirm('Supprimer définitivement cette demande ?')) return;
    await apiCall(`/admin/support/${id}`, kind === 'delete' ? { method: 'DELETE' } : { method: 'PUT', body: JSON.stringify({ handled: kind === 'done' }) });
    reload();
  };
  if (!list) return null;
  const todo = list.filter((m) => !m.handled).length;
  return (
    <section className="card admin-support">
      <h2>
        ✉️ Demandes au support <span className="muted small">{todo} à traiter · {list.length} au total</span>
      </h2>
      {!list.length && <p className="muted small">Aucune demande pour l’instant.</p>}
      <ul className="admin-support-list">
        {list.map((m) => (
          <li key={m.id} className={m.handled ? 'handled' : ''}>
            <button
              className="admin-support-head link-like"
              onClick={() => {
                setOpen(open === m.id ? null : m.id);
                setDraft('');
                setNote(null);
              }}
            >
              <b>#{m.id}</b> <span className="chip small">{m.category ?? 'Autre'}</span> {m.subject}
              {m.replies.length > 0 && <span className="chip small">↩ {m.replies.length}</span>}
              <span className="muted small"> · {m.account ?? m.name ?? 'Anonyme'} · {new Date(m.createdAt).toLocaleString('fr-FR')}</span>
            </button>
            {open === m.id && (
              <div className="admin-support-body">
                <p className="pre">{m.message}</p>
                <p className="muted small">{m.email ? <>E-mail du joueur : {m.email}</> : 'Pas d’e-mail laissé : réponse par mail impossible.'}</p>
                {m.replies.map((r, i) => (
                  <div key={i} className="admin-support-reply">
                    <span className="muted small">↩ Réponse du {new Date(r.createdAt).toLocaleString('fr-FR')}</span>
                    <p className="pre">{r.message}</p>
                  </div>
                ))}
                {m.email && (
                  <form
                    className="admin-support-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void send(m.id);
                    }}
                  >
                    <textarea
                      className="text-input"
                      rows={5}
                      maxLength={5000}
                      placeholder={`Ta réponse à ${m.account ?? m.name ?? 'ce joueur'} (envoyée par mail, signée « L’équipe BetterMove »)`}
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                    />
                    {!mailOn && <p className="error small">Envoi de mails non configuré sur le serveur (SMTP dans .env).</p>}
                    {note && <p className={note.ok ? 'success-text small' : 'error small'}>{note.text}</p>}
                    <button className="btn primary small" type="submit" disabled={sending || !mailOn || draft.trim().length < 2}>
                      {sending ? 'Envoi…' : '✉️ Envoyer la réponse'}
                    </button>
                  </form>
                )}
                {m.context && Object.keys(m.context).length > 0 && <pre className="admin-support-ctx">{JSON.stringify(m.context, null, 2)}</pre>}
                <div className="row">
                  <button className="btn small" onClick={() => act(m.id, m.handled ? 'undo' : 'done')}>
                    {m.handled ? '↩ Remettre à traiter' : '✔ Marquer comme traitée'}
                  </button>
                  <button className="btn small danger" onClick={() => act(m.id, 'delete')}>
                    🗑 Supprimer
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}


/* ---------------- Page ---------------- */

type Tab = 'overview' | 'audience' | 'support';

/** Carte chiffre cliquable */
function Kpi({ label, value, sub, tone, onClick }: { label: string; value: string; sub?: string; tone?: string; onClick?: () => void }) {
  const body = (
    <>
      <span className="tc-label">{label}</span>
      <b>{value}</b>
      {sub && <span className="muted tiny">{sub}</span>}
    </>
  );
  return onClick ? (
    <button className={`card admin-kpi clickable ${tone ?? ''}`} onClick={onClick} title="Voir le détail">
      {body}
      <span className="admin-kpi-more" aria-hidden>
        ›
      </span>
    </button>
  ) : (
    <div className={`card admin-kpi ${tone ?? ''}`}>{body}</div>
  );
}

/** Ligne d'activite cliquable */
function Activity({ icon, label, value, onClick }: { icon: string; label: string; value: ReactNode; onClick?: () => void }) {
  const inner = (
    <>
      <span>
        {icon} {label}
      </span>
      <b>{value}</b>
    </>
  );
  return <li>{onClick ? <button className="admin-activity clickable" onClick={onClick}>{inner}</button> : <div className="admin-activity">{inner}</div>}</li>;
}

export function AdminPage({ onOpen }: { onOpen: (name: string) => void }) {
  const [s, setS] = useState<Stats | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [at, setAt] = useState<Date | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  // Fenetres ouvertes, empilees : une liste puis la fiche d'un joueur de cette liste...
  const [stack, setStack] = useState<({ t: 'list'; req: ListReq } | { t: 'user'; name: string })[]>([]);
  const drill: Drill = useMemo(
    () => ({
      list: (req) => setStack((x) => [...x, { t: 'list', req }]),
      user: (name) => setStack((x) => [...x, { t: 'user', name }]),
    }),
    [],
  );
  const pop = () => setStack((x) => x.slice(0, -1));

  const load = useCallback(() => {
    apiCall<Stats>('/admin/stats')
      .then((x) => {
        setS(x);
        setErr(null);
        setAt(new Date());
      })
      .catch((e) =>
        setErr(
          e instanceof HttpError && e.status === 403
            ? 'Réservé aux administrateurs.'
            : e instanceof HttpError && e.status === 404
              ? 'Page indisponible pour le moment.'
              : 'Serveur injoignable.',
        ),
      );
  }, []);

  useEffect(() => {
    load();
    const id = window.setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

  if (err && !s)
    return (
      <div className="admin">
        <div className="card">
          <h1>🛠️ Administration</h1>
          <p className="error">{err}</p>
        </div>
      </div>
    );
  if (!s)
    return (
      <div className="admin">
        <p className="muted center">Chargement des statistiques…</p>
      </div>
    );

  const L = (kind: string, params?: Record<string, string>) => () => drill.list({ kind, params });
  const vToday = s.visits.at(-1) ?? { n: 0, anon: 0 };
  const anon30 = s.visits.reduce((t, d) => t + d.anon, 0);
  // Inscriptions comptees seulement les jours ou l'audience etait mesuree
  const measured = new Set(s.visits.filter((d) => d.n > 0).map((d) => d.day));
  const signupsMeasured = s.signups.filter((d) => measured.has(d.day)).reduce((t, d) => t + d.n, 0);
  const rate = anon30 ? Math.min(100, Math.round((signupsMeasured / anon30) * 1000) / 10) : 0;
  const top = stack.at(-1);

  return (
    <div className="admin">
      <div className="admin-head">
        <h1>🛠️ Administration</h1>
        <span className="muted small">
          {at && `Mis à jour à ${at.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} · actualisation toutes les 30 s`}
          <button className="btn ghost small-btn" onClick={load} aria-label="Actualiser">
            🔄
          </button>
        </span>
      </div>
      {err && <p className="error small">{err}</p>}

      <div className="chips admin-tabs">
        <button className={`chip ${tab === 'overview' ? 'selected' : ''}`} onClick={() => setTab('overview')}>
          📊 Vue d’ensemble
        </button>
        <button className={`chip ${tab === 'audience' ? 'selected' : ''}`} onClick={() => setTab('audience')}>
          👀 Audience et non connectés
        </button>
        <button className={`chip ${tab === 'support' ? 'selected' : ''}`} onClick={() => setTab('support')}>
          ✉️ Support
        </button>
        <button className="chip" onClick={L('users')}>
          👥 Tous les comptes ({n0(s.users)})
        </button>
      </div>

      {tab === 'audience' && <AudienceTab visits={s.visits} />}
      {tab === 'support' && <SupportInbox />}

      {tab === 'overview' && (
        <>
          <section className="admin-kpis">
            <Kpi
              label="Visiteurs aujourd’hui"
              value={n0(vToday.n)}
              sub={`${n0(vToday.anon)} non connecté${vToday.anon > 1 ? 's' : ''} · ${n0(vToday.n - vToday.anon)} connecté${vToday.n - vToday.anon > 1 ? 's' : ''}`}
              onClick={() => setTab('audience')}
            />
            <Kpi
              label="Visiteurs non connectés"
              value={n0(anon30)}
              sub={`30 jours (somme des jours) · ${signupsMeasured} inscription${signupsMeasured > 1 ? 's' : ''}, soit environ ${rate} %`}
              onClick={() => setTab('audience')}
            />
            <Kpi
              label="En ligne maintenant"
              value={n0(s.online.length)}
              sub={s.queue.total ? `${s.queue.total} cherche(nt) un adversaire` : 'actifs ces 3 dernières minutes'}
              tone="live"
              onClick={L('online')}
            />
            <Kpi label="Comptes au total" value={n0(s.users)} sub={`${n0(s.avatars)} avec photo`} onClick={L('users')} />
            <Kpi label="Nouveaux comptes" value={n0(s.new30)} sub={`30 jours · ${n0(s.new7)} sur 7 jours`} onClick={L('new30')} />
            <Kpi label="Joueurs actifs" value={n0(s.active30)} sub={`30 jours · ${n0(s.active1)} sur 24 h`} onClick={L('active30')} />
            <Kpi label="Actifs sur 24 h" value={n0(s.active1)} sub="visite ou synchronisation" onClick={L('active1')} />
            <Kpi label="Comptes endormis" value={n0(s.inactive)} sub="pas de visite depuis 30 jours" onClick={L('inactive')} />
            <Kpi label="Adresses e-mail" value={n0(s.emails)} sub={`${n0(s.emailsOk)} vérifiées`} onClick={L('emails')} />
            <Kpi label="Parties enregistrées" value={n0(s.games30)} sub={`30 jours · ${n0(s.games)} au total`} onClick={L('games30')} />
            <Kpi label="Photos de profil" value={n0(s.avatars)} sub="comptes avec une photo" onClick={L('avatars')} />
            <Kpi label="Parrainages" value={n0(s.referrals)} sub="amis invités qui ont créé un compte" onClick={L('referrals')} />
            <Kpi
              label="Elo en ligne moyen"
              value={n0(s.elo.online)}
              sub={`${n0(s.elo.onlinePlayers)} joueurs classés · meilleur : ${n0(s.elo.bestOnline)}`}
              onClick={L('eloOnline')}
            />
            <Kpi label="Elo bots moyen" value={n0(s.elo.bots)} sub={`meilleur : ${n0(s.elo.bestBots)}`} onClick={L('eloBots')} />
            <Kpi label="Elo problèmes moyen" value={n0(s.elo.puzzles)} sub={`meilleur : ${n0(s.elo.bestPuzzles)}`} onClick={L('eloPuzzles')} />
            <Kpi label="XP moyenne" value={n0(s.elo.xp)} sub={`${n0(s.elo.profiles)} profils synchronisés · étoiles de cours`} onClick={L('xp')} />
          </section>

          <section className="admin-grid">
            <DayBars data={s.signups} label="Créations de comptes par jour" unit="comptes" onDay={(day) => drill.list({ kind: 'signups', params: { day } })} />
            <DayBars
              data={s.gamesByDay}
              label="Parties jouées par jour (bots, écran, en ligne)"
              unit="parties"
              onDay={(day) => drill.list({ kind: 'gamesDay', params: { day } })}
            />
          </section>

          <section className="admin-grid three">
            <div className="card">
              <div className="tc-label">🟢 En ligne ({s.online.length})</div>
              {s.online.length === 0 && <p className="muted small">Personne en ce moment.</p>}
              <div className="admin-online">
                {s.online.map((u) => (
                  <button key={u} className="admin-user link-like" onClick={() => drill.user(u)}>
                    <Avatar name={u} size={22} /> {u}
                  </button>
                ))}
              </div>
              {s.queue.total > 0 && (
                <p className="muted small">
                  File « Contre le monde » :{' '}
                  {Object.entries(s.queue.byTc)
                    .map(([tc, n]) => `${tc} (${n})`)
                    .join(', ')}
                </p>
              )}
            </div>
            <HBars
              label="Répartition de l’Elo bots"
              rows={s.eloBuckets.map((b) => ({ label: `${b.bucket}–${b.bucket + 199}`, n: b.n, id: String(b.bucket) }))}
              onRow={(b) => drill.list({ kind: 'eloBucket', params: { b } })}
            />
            <HBars
              label="Origine des parties (30 jours)"
              rows={s.sources.map((x) => ({ label: SOURCE_LABEL[x.source] ?? x.source, n: x.n, id: x.source }))}
              onRow={(src) => drill.list({ kind: 'source', params: { src } })}
            />
          </section>

          <section className="admin-grid three">
            <div className="card admin-list">
              <div className="tc-label">Activité sur 30 jours</div>
              <ul>
                <Activity
                  icon="⚔️"
                  label="Parties en ligne"
                  value={`${n0(s.onlineGames30)}${s.onlineLive ? ` (${s.onlineLive} en cours)` : ''}`}
                  onClick={L('onlineGames')}
                />
                <Activity icon="⚡" label="Puzzle Rush" value={`${n0(s.rush.runs)} parties · ${n0(s.rush.players)} joueurs · record ${n0(s.rush.best)}`} onClick={L('rush')} />
                <Activity
                  icon="🧩"
                  label="Problème du jour"
                  value={`${n0(s.daily.n)} essais · ${n0(s.daily.players)} joueurs${s.daily.n ? ` · ${Math.round((s.daily.firstTry / s.daily.n) * 100)} % du 1er coup` : ''}`}
                  onClick={L('daily')}
                />
                <Activity icon="💬" label="Messages du salon" value={`${n0(s.chat.n)} · ${n0(s.chat.authors)} auteurs`} onClick={L('chat')} />
                <Activity icon="✉️" label="Demandes au support" value={n0(s.support)} onClick={() => setTab('support')} />
              </ul>
            </div>
            <div className="card admin-list span2">
              <div className="admin-chart-head">
                <div className="tc-label">Derniers inscrits</div>
                <button className="link-like small" onClick={L('new30')}>
                  Voir tout ›
                </button>
              </div>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Joueur</th>
                    <th>Inscrit le</th>
                    <th>Dernière visite</th>
                  </tr>
                </thead>
                <tbody>
                  {s.recent.map((r) => (
                    <tr key={r.username}>
                      <td>
                        <button className="admin-user link-like" onClick={() => drill.user(r.username)}>
                          <Avatar name={r.username} size={22} /> {r.username}
                        </button>
                      </td>
                      <td>{new Date(r.createdAt).toLocaleDateString('fr-FR')}</td>
                      <td className={ago(r.lastSeen) === 'en ligne' ? 'live-text' : ''}>{ago(r.lastSeen)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <p className="muted tiny">
            Clique sur un chiffre, une barre ou un pseudo pour voir le détail. Les Elo moyens et l’XP portent sur les comptes dont la progression
            est synchronisée. « Joueurs actifs » = visite, partie ou synchronisation dans la période.
          </p>
        </>
      )}

      {top?.t === 'list' && <ListModal key={stack.length} req={top.req} drill={drill} onClose={pop} />}
      {top?.t === 'user' && <UserModal key={stack.length} name={top.name} drill={drill} onOpen={onOpen} onClose={pop} />}
    </div>
  );
}
