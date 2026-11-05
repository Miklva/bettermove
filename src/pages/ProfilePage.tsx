// Page profil : toutes les statistiques d'un joueur (le sien ou celui d'un autre membre)
import { useEffect, useState } from 'react';
import { apiCall, HttpError } from '../sync/client';
import { useSync } from '../sync/AccountModal';
import { Avatar, MyAvatar } from '../profile/avatar';
import { localProfile, type ProfileData, type WDL } from '../profile/stats';
import type { Profile } from '../rating/profile';
import { levelFromXp } from '../rating/xp';
import { BOTS } from '../bots/roster';
import { BotPortrait } from '../bots/portraits';
import { ACHIEVEMENTS } from '../achievements/list';
import { CHAPTERS } from '../lessons/courses';
import { REP_OPENINGS } from '../repertoire/lines';
import { openingFr } from '../history/names';
import { navigate, pathOf, useSegments } from '../router';
import { PERIODS, StatDetail, STATS, type Period, type StatId } from '../profile/StatDetail';
import { PROVISIONAL_GAMES, PROVISIONAL_HELP } from '../rating/elo';

const SOURCE: Record<string, string> = {
  bot: '🤖 Bots',
  local: '👥 Sur écran',
  online: '🌍 En ligne',
  'chess.com': '♟️ chess.com',
  lichess: '🐴 Lichess',
  pgn: '📄 PGN',
  autre: 'Autre',
};
const TIER = { 1: 'bronze', 2: 'argent', 3: 'or' } as const;

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);
const total = (r: WDL) => r.win + r.draw + r.loss;

function ago(iso?: string | null) {
  if (!iso) return 'jamais vu';
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (m < 60) return `vu il y a ${Math.max(1, m)} min`;
  const h = Math.round(m / 60);
  if (h < 48) return `vu il y a ${h} h`;
  return `vu il y a ${Math.round(h / 24)} jours`;
}

/** Barre victoires / nulles / defaites */
function WdlBar({ r, label }: { r: WDL; label?: string }) {
  const t = total(r);
  return (
    <div className="pwdl">
      {label && <span className="pwdl-label">{label}</span>}
      <div className="pwdl-bar" title={`${r.win} victoires, ${r.draw} nulles, ${r.loss} défaites`}>
        {t === 0 ? (
          <i className="p-none" style={{ width: '100%' }} />
        ) : (
          <>
            <i className="p-w" style={{ width: `${(r.win / t) * 100}%` }} />
            <i className="p-d" style={{ width: `${(r.draw / t) * 100}%` }} />
            <i className="p-l" style={{ width: `${(r.loss / t) * 100}%` }} />
          </>
        )}
      </div>
      <span className="pwdl-nums">
        <b className="p-w">{r.win}</b> / <b className="p-d">{r.draw}</b> / <b className="p-l">{r.loss}</b>
        {t > 0 && <span className="muted"> · {pct(r.win, t)} %</span>}
      </span>
    </div>
  );
}

/** Petite courbe d'Elo */
function Spark({ values }: { values: number[] }) {
  if (values.length < 2) return <div className="spark empty muted tiny">Pas encore assez de parties pour une courbe</div>;
  const w = 220;
  const h = 46;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - 4 - ((v - min) / span) * (h - 8)}`).join(' ');
  const up = values[values.length - 1] >= values[0];
  return (
    <svg className={`spark ${up ? 'up' : 'down'}`} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label={`De ${values[0]} à ${values[values.length - 1]}`}>
      <polyline points={pts} fill="none" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

const RankTag = ({ rank }: { rank: number | null }) =>
  rank ? <span className={`rank-tag ${rank <= 3 ? 'top' : ''}`}>{rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : `#${rank}`}</span> : null;

interface Props {
  /** null = mon profil */
  username: string | null;
  player: { profile: Profile };
  onAccount: () => void;
  onOpen: (name: string) => void;
}

export function ProfilePage({ username, player, onAccount, onOpen }: Props) {
  const sync = useSync();
  const logged = !!sync.user && sync.status !== 'offline';
  const mine = username === null || (!!sync.user && username.toLowerCase() === sync.user.toLowerCase());
  const [data, setData] = useState<ProfileData | null>(() => (mine ? localProfile(sync.user ?? 'Toi', player.profile) : null));
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setErr(null);
    const name = username ?? sync.user;
    if (mine && !logged) {
      setData(localProfile(sync.user ?? 'Toi', player.profile));
      return;
    }
    if (!name) return;
    if (!mine) setData(null);
    apiCall<ProfileData>(`/profile/${encodeURIComponent(name)}`)
      .then((d) => {
        if (!mine) return setData(d);
        // Mon profil : les donnees de ce navigateur sont les plus fraiches, le serveur ajoute le reste
        const local = localProfile(sync.user ?? name, player.profile);
        const timeline =
          d.timeline && local.timeline
            ? { ...local.timeline, online: d.timeline.online, daily: d.timeline.daily, rush: d.timeline.rush }
            : (d.timeline ?? local.timeline);
        setData({ ...d, profile: local.profile, achievements: local.achievements, games: local.games, repertoire: local.repertoire, owned: local.owned, self: true, timeline });
      })
      .catch((e) => {
        if (mine) setData(localProfile(sync.user ?? name, player.profile));
        else setErr(e instanceof HttpError && e.status === 404 ? 'Joueur introuvable.' : 'Serveur injoignable : impossible de charger ce profil.');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username, sync.user, logged]);

  // Detail d'une stat : .../stat/<stat>/<periode>
  const segs = useSegments();
  const si = segs.indexOf('stat');
  const statId = si > 0 && segs[si + 1] in STATS ? (segs[si + 1] as StatId) : null;
  const period: Period = PERIODS.some(([id]) => id === segs[si + 2]) ? (segs[si + 2] as Period) : '1m';
  const base = username ? ['profil', username] : ['profil'];
  const openStat = (s: StatId, per: Period = period, replace = false) => {
    navigate(pathOf([...base, 'stat', s, per]), replace);
    if (!replace) window.scrollTo(0, 0);
  };
  const statCard = (s: StatId) => ({
    role: 'button',
    tabIndex: 0,
    className: 'stat-link',
    title: `Voir le détail : ${STATS[s].title}`,
    onClick: () => openStat(s),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openStat(s);
      }
    },
  });

  if (err) return <div className="profile-page"><div className="card"><p className="error">{err}</p></div></div>;
  if (!data) return <div className="profile-page"><p className="muted center">Chargement du profil…</p></div>;

  const p = data.profile;
  const lv = levelFromXp(p?.xp ?? 0);
  const stars = p ? Object.values(p.lessons).reduce((s, l) => s + (l.stars ?? 0), 0) : 0;
  const allLessons = CHAPTERS.flatMap((c) => [...c.lessons, ...(c.advanced ?? [])]);
  const lessonsDone = p ? Object.keys(p.lessons).length : 0;
  const ach = Object.entries(data.achievements)
    .map(([id, at]) => ({ a: ACHIEVEMENTS.find((x) => x.id === id), at }))
    .filter((x) => x.a)
    .sort((x, y) => String(y.at).localeCompare(String(x.at)));
  const tiers = { 1: 0, 2: 0, 3: 0 } as Record<1 | 2 | 3, number>;
  ach.forEach((x) => tiers[x.a!.tier]++);
  const ps = p?.puzzleStats;
  const g = data.games;
  const puzzleProv = !!ps && ps.solved + ps.failed < PROVISIONAL_GAMES;

  if (statId)
    return (
      <div className="profile-page">
        <StatDetail
          stat={statId}
          period={period}
          data={data}
          onPeriod={(per) => openStat(statId, per, true)}
          onStat={(st) => openStat(st, period, true)}
          onBack={() => navigate(pathOf(base))}
        />
      </div>
    );

  return (
    <div className="profile-page">
      <section className="card prof-head">
        <div className="prof-avatar">
          {mine ? <MyAvatar size={104} /> : <Avatar name={data.username} size={104} />}
          {data.online && <i className="presence on" title="En ligne" />}
        </div>
        <div className="prof-id">
          <h1>{data.username}</h1>
          <p className="muted small">
            {data.createdAt && `Membre depuis le ${new Date(data.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`}
            {!mine && ` · ${data.online ? 'en ligne' : ago(data.lastSeen)}`}
            {data.local && 'Profil local : connecte-toi pour le partager et apparaître dans les classements.'}
          </p>
          <div className="prof-level">
            <span className="prof-lv">Niv. {lv.level}</span>
            <span className="xp-track">
              <i style={{ width: `${Math.round(lv.progress * 100)}%` }} />
            </span>
            <span className="muted tiny">
              {p?.xp ?? 0} XP · {lv.needed - lv.into} XP avant le niveau {lv.level + 1}
            </span>
          </div>
          <div className="prof-chips">
            <span className="home-chip">🏆 {ach.length}/{ACHIEVEMENTS.length} succès</span>
            <span className="home-chip">⭐ {stars} étoiles de cours</span>
            <span className="home-chip">🧩 {ps?.solved ?? 0} problème{(ps?.solved ?? 0) > 1 ? 's' : ''} résolu{(ps?.solved ?? 0) > 1 ? 's' : ''}</span>
            <span className="home-chip">♟️ {g.total} partie{g.total > 1 ? 's' : ''}</span>
            {data.owned > 2 && <span className="home-chip">🛒 {data.owned} objets</span>}
          </div>
        </div>
        {mine && (
          <button className="btn ghost prof-edit" onClick={onAccount}>
            📷 Modifier ma photo
          </button>
        )}
      </section>

      <section className="prof-grid three">
        <div {...statCard('en-ligne')} className={`card prof-elo stat-link`}>
          <div className="prof-elo-head">
            <span className="tc-label">🌍 Elo en ligne</span>
            <RankTag rank={data.ranks.online} />
          </div>
          <b className="prof-big">
            {data.onlineElo ? data.onlineElo.rating : '–'}
            {data.onlineElo && data.onlineElo.games < PROVISIONAL_GAMES && (
              <span className="muted" title={PROVISIONAL_HELP}>
                ?
              </span>
            )}
          </b>
          <span className="muted tiny">{data.onlineElo && data.onlineElo.games > 0 ? `${data.onlineElo.games} partie${data.onlineElo.games > 1 ? 's' : ''} classée${data.onlineElo.games > 1 ? 's' : ''}` : 'Elo de départ : pas encore de partie classée'}</span>
          <WdlBar r={data.onlineRecord} />
        </div>
        <div {...statCard('bots')} className={`card prof-elo stat-link`}>
          <div className="prof-elo-head">
            <span className="tc-label">🤖 Elo bots</span>
            <RankTag rank={data.ranks.bots} />
          </div>
          <b className="prof-big">
            {p ? Math.round(p.bots.rating) : '–'}
          </b>
          <Spark values={p?.botCurve ?? []} />
          <span className="muted tiny">
            {p?.beaten.length ?? 0}/{BOTS.length} bots battus · voir la galerie plus bas
          </span>
        </div>
        <div {...statCard('problemes')} className={`card prof-elo stat-link`}>
          <div className="prof-elo-head">
            <span className="tc-label">🧩 Elo problèmes</span>
            <RankTag rank={data.ranks.puzzles} />
          </div>
          <b className="prof-big">
            {p ? Math.round(p.puzzles.rating) : '–'}
            {p && puzzleProv && (
              <span className="muted" title={PROVISIONAL_HELP}>
                ?
              </span>
            )}
          </b>
          <Spark values={p?.puzzleCurve ?? []} />
          <span className="muted tiny">
            {ps ? `${ps.solved} réussis · ${pct(ps.solved, ps.solved + ps.failed)} % de réussite · meilleure série ${ps.bestStreak}` : '–'}
          </span>
        </div>
      </section>

      {((data.onlineElo && data.onlineElo.games < PROVISIONAL_GAMES) || (p && puzzleProv)) && <p className="muted tiny prof-prov">{PROVISIONAL_HELP}</p>}

      <section className="prof-grid four">
        <div {...statCard('rush')} className={`card prof-mini stat-link`}>
          <span className="tc-label">⚡ Puzzle Rush</span>
          <div className="prof-rush">
            {[
              ['3', '3 min'],
              ['5', '5 min'],
              ['survival', 'Survie'],
            ].map(([m, l]) => (
              <div key={m}>
                <b>{data.rush[m]?.best ?? '–'}</b>
                <span className="muted tiny">{l}</span>
              </div>
            ))}
          </div>
        </div>
        <div {...statCard('probleme-du-jour')} className={`card prof-mini stat-link`}>
          <span className="tc-label">📅 Problème du jour</span>
          <b className="prof-mid">{data.daily.solved}</b>
          <span className="muted tiny">
            jours réussis · {data.daily.firstTry} du premier coup · meilleure série {data.daily.bestStreak} 🔥
          </span>
        </div>
        <div {...statCard('cours')} className={`card prof-mini stat-link`}>
          <span className="tc-label">📚 Cours</span>
          <b className="prof-mid">
            {stars}
            <small className="muted">/{allLessons.length * 3} ⭐</small>
          </b>
          <span className="muted tiny">
            {lessonsDone}/{allLessons.length} leçons terminées
          </span>
        </div>
        <div {...statCard('succes')} className={`card prof-mini stat-link`}>
          <span className="tc-label">🏆 Succès</span>
          <b className="prof-mid">
            {ach.length}
            <small className="muted">/{ACHIEVEMENTS.length}</small>
          </b>
          <span className="muted tiny">
            🥇 {tiers[3]} or · 🥈 {tiers[2]} argent · 🥉 {tiers[1]} bronze
          </span>
        </div>
      </section>

      <section className="prof-grid two">
        <div {...statCard('parties')} className={`card stat-link`}>
          <div className="tc-label">♟️ Parties enregistrées ({g.total})</div>
          <WdlBar r={g.results} label="Toutes" />
          <WdlBar r={g.asWhite} label="Avec les Blancs" />
          <WdlBar r={g.asBlack} label="Avec les Noirs" />
          {g.recent.length > 0 && (
            <div className="prof-form">
              <span className="muted tiny">Forme (dernières parties, de la plus récente à la plus ancienne)</span>
              <div>
                {g.recent.map((r, i) => (
                  <i key={i} className={r} title={r === 'win' ? 'Victoire' : r === 'draw' ? 'Nulle' : 'Défaite'}>
                    {r === 'win' ? 'V' : r === 'draw' ? 'N' : 'D'}
                  </i>
                ))}
              </div>
            </div>
          )}
          <div className="prof-sources">
            {Object.entries(g.bySource)
              .sort((a, b) => b[1] - a[1])
              .map(([s, n]) => (
                <span key={s} className="chip static">
                  {SOURCE[s] ?? s} · {n}
                </span>
              ))}
          </div>
        </div>
        <div className="card">
          <div className="tc-label">📖 Ouvertures les plus jouées</div>
          {g.openings.length === 0 && <p className="muted small">Pas encore assez de parties.</p>}
          {g.openings.map((o) => (
            <WdlBar key={o.name} r={o} label={`${openingFr(o.name)} (${o.n})`} />
          ))}
          {data.repertoire.length > 0 && (
            <>
              <div className="tc-label prof-sub">Répertoire</div>
              <div className="prof-sources">
                {data.repertoire.map((id) => {
                  const o = REP_OPENINGS.find((x) => x.id === id);
                  return o ? (
                    <span key={id} className="chip static">
                      {o.color === 'w' ? '♔' : '♚'} {o.name}
                    </span>
                  ) : null;
                })}
              </div>
            </>
          )}
        </div>
      </section>

      <section className="card prof-gallery">
        <div className="prof-gallery-head">
          <div className="tc-label">🤖 Galerie des bots</div>
          <span className="muted small">
            <b>{p?.beaten.length ?? 0}</b>/{BOTS.length} battus · en couleur : déjà battu, en noir et blanc : pas encore
          </span>
        </div>
        <div className="bot-gallery">
          {BOTS.map((b) => {
            const won = !!p?.beaten.includes(b.id);
            return (
              <button
                key={b.id}
                type="button"
                className={`bot-tile ${won ? 'won' : 'todo'}`}
                title={`${b.name} (${b.rating}) : ${won ? 'battu' : 'pas encore battu'}${mine ? ' · jouer contre lui' : ''}`}
                onClick={mine ? () => navigate(pathOf(['jouer', 'bot', b.id])) : undefined}
                disabled={!mine}
              >
                <span className="bot-tile-img">
                  <BotPortrait id={b.id} size={72} />
                  {won && <i className="bot-tile-check">✔</i>}
                </span>
                <strong>{b.name}</strong>
                <span className="muted tiny">{b.rating}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="prof-grid two">
        <div className="card">
          <div className="tc-label">🏅 Derniers succès</div>
          {ach.length === 0 && <p className="muted small">Aucun succès pour l’instant.</p>}
          <div className="prof-ach">
            {ach.slice(0, 8).map(({ a, at }) => (
              <div key={a!.id} className={`prof-ach-item tier-${TIER[a!.tier]}`} title={a!.desc}>
                <span className="prof-ach-icon">{a!.icon}</span>
                <span>
                  <strong>{a!.title}</strong>
                  <span className="muted tiny">{at ? new Date(at).toLocaleDateString('fr-FR') : ''}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="tc-label">⚔️ Dernières parties en ligne</div>
          {data.recentOnline.length === 0 && (
            <p className="muted small">{data.local ? 'Connecte-toi pour jouer contre les autres membres.' : 'Aucune partie en ligne pour l’instant.'}</p>
          )}
          <ul className="prof-online">
            {data.recentOnline.map((o, i) => (
              <li key={i}>
                <i className={`res ${o.result}`}>{o.result === 'win' ? 'V' : o.result === 'draw' ? 'N' : 'D'}</i>
                <button className="link inline" onClick={() => onOpen(o.opponent)}>
                  <Avatar name={o.opponent} size={22} /> {o.opponent}
                </button>
                {o.delta !== null && <b className={o.delta >= 0 ? 'up' : 'down'}>{o.delta >= 0 ? `+${o.delta}` : o.delta}</b>}
                <span className="muted tiny">{new Date(o.at).toLocaleDateString('fr-FR')}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
