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
import { PROVISIONAL_GAMES, provisionalHelp } from '../rating/elo';

import { locale, t, tmap, tn } from '../i18n';
const SOURCE: Record<string, string> = tmap({
  bot: '🤖 Bots',
  local: '👥 Sur écran',
  online: '🌍 En ligne',
  'chess.com': '♟️ chess.com',
  lichess: '🐴 Lichess',
  pgn: '📄 PGN',
  autre: 'Autre',
});
const TIER = { 1: 'bronze', 2: 'argent', 3: 'or' } as const;

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);
const total = (r: WDL) => r.win + r.draw + r.loss;

function ago(iso?: string | null) {
  if (!iso) return t('jamais vu');
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (m < 60) return t('vu il y a {n} min', { n: Math.max(1, m) });
  const h = Math.round(m / 60);
  if (h < 48) return t('vu il y a {n} h', { n: h });
  return t('vu il y a {n} jours', { n: Math.round(h / 24) });
}

/** Barre victoires / nulles / defaites */
function WdlBar({ r, label }: { r: WDL; label?: string }) {
  const tot = total(r);
  return (
    <div className="pwdl">
      {label && <span className="pwdl-label">{label}</span>}
      <div className="pwdl-bar" title={t('{w} victoires, {d} nulles, {l} défaites', { w: r.win, d: r.draw, l: r.loss })}>
        {tot === 0 ? (
          <i className="p-none" style={{ width: '100%' }} />
        ) : (
          <>
            <i className="p-w" style={{ width: `${(r.win / tot) * 100}%` }} />
            <i className="p-d" style={{ width: `${(r.draw / tot) * 100}%` }} />
            <i className="p-l" style={{ width: `${(r.loss / tot) * 100}%` }} />
          </>
        )}
      </div>
      <span className="pwdl-nums">
        <b className="p-w">{r.win}</b> / <b className="p-d">{r.draw}</b> / <b className="p-l">{r.loss}</b>
        {tot > 0 && <span className="muted"> · {pct(r.win, tot)} %</span>}
      </span>
    </div>
  );
}

/** Petite courbe d'Elo */
function Spark({ values }: { values: number[] }) {
  if (values.length < 2) return <div className="spark empty muted tiny">{t("Pas encore assez de parties pour une courbe")}</div>;
  const w = 220;
  const h = 46;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - 4 - ((v - min) / span) * (h - 8)}`).join(' ');
  const up = values[values.length - 1] >= values[0];
  return (
    <svg className={`spark ${up ? 'up' : 'down'}`} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label={t('De {a} à {b}', { a: values[0], b: values[values.length - 1] })}>
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
        else setErr(e instanceof HttpError && e.status === 404 ? t('Joueur introuvable.') : t('Serveur injoignable : impossible de charger ce profil.'));
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
    title: t('Voir le détail : {title}', { title: STATS[s].title }),
    onClick: () => openStat(s),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openStat(s);
      }
    },
  });

  if (err) return <div className="profile-page"><div className="card"><p className="error">{err}</p></div></div>;
  if (!data) return <div className="profile-page"><p className="muted center">{t("Chargement du profil…")}</p></div>;

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
          {data.online && <i className="presence on" title={t("En ligne")} />}
        </div>
        <div className="prof-id">
          <h1>{data.username}</h1>
          <p className="muted small">
            {data.createdAt && t('Membre depuis le {date}', { date: new Date(data.createdAt).toLocaleDateString(locale(), { day: 'numeric', month: 'long', year: 'numeric' }) })}
            {!mine && ` · ${data.online ? t('en ligne') : ago(data.lastSeen)}`}
            {data.local && t("Profil local : connecte-toi pour le partager et apparaître dans les classements.")}
          </p>
          <div className="prof-level">
            <span className="prof-lv">{t("Niv.")}{" "}{lv.level}</span>
            <span className="xp-track">
              <i style={{ width: `${Math.round(lv.progress * 100)}%` }} />
            </span>
            <span className="muted tiny">
              {t('{xp} XP · {left} XP avant le niveau {next}', { xp: p?.xp ?? 0, left: lv.needed - lv.into, next: lv.level + 1 })}
            </span>
          </div>
          <div className="prof-chips">
            <span className="home-chip">🏆 {t('{n}/{total} succès', { n: ach.length, total: ACHIEVEMENTS.length })}</span>
            <span className="home-chip">⭐ {t('{n} étoiles de cours', { n: stars })}</span>
            <span className="home-chip">🧩 {tn(ps?.solved ?? 0, '{n} problème résolu', '{n} problèmes résolus')}</span>
            <span className="home-chip">♟️ {tn(g.total, '{n} partie', '{n} parties')}</span>
            {data.owned > 2 && <span className="home-chip">🛒 {t('{n} objets', { n: data.owned })}</span>}
          </div>
        </div>
        {mine && (
          <button className="btn ghost prof-edit" onClick={onAccount}>{t("📷 Modifier ma photo")}</button>
        )}
      </section>

      <section className="prof-grid three">
        <div {...statCard('en-ligne')} className={`card prof-elo stat-link`}>
          <div className="prof-elo-head">
            <span className="tc-label">{t("🌍 Elo en ligne")}</span>
            <RankTag rank={data.ranks.online} />
          </div>
          <b className="prof-big">
            {data.onlineElo ? data.onlineElo.rating : '–'}
            {data.onlineElo && data.onlineElo.games < PROVISIONAL_GAMES && (
              <span className="muted" title={provisionalHelp()}>
                ?
              </span>
            )}
          </b>
          <span className="muted tiny">{data.onlineElo && data.onlineElo.games > 0 ? tn(data.onlineElo.games, '{n} partie classée', '{n} parties classées') : t("Elo de départ : pas encore de partie classée")}</span>
          <WdlBar r={data.onlineRecord} />
        </div>
        <div {...statCard('bots')} className={`card prof-elo stat-link`}>
          <div className="prof-elo-head">
            <span className="tc-label">{t("🤖 Elo bots")}</span>
            <RankTag rank={data.ranks.bots} />
          </div>
          <b className="prof-big">
            {p ? Math.round(p.bots.rating) : '–'}
          </b>
          <Spark values={p?.botCurve ?? []} />
          <span className="muted tiny">
            {t('{n}/{total} bots battus · voir la galerie plus bas', { n: p?.beaten.length ?? 0, total: BOTS.length })}</span>
        </div>
        <div {...statCard('problemes')} className={`card prof-elo stat-link`}>
          <div className="prof-elo-head">
            <span className="tc-label">{t("🧩 Elo problèmes")}</span>
            <RankTag rank={data.ranks.puzzles} />
          </div>
          <b className="prof-big">
            {p ? Math.round(p.puzzles.rating) : '–'}
            {p && puzzleProv && (
              <span className="muted" title={provisionalHelp()}>
                ?
              </span>
            )}
          </b>
          <Spark values={p?.puzzleCurve ?? []} />
          <span className="muted tiny">
            {ps ? t('{n} réussis · {p} % de réussite · meilleure série {s}', { n: ps.solved, p: pct(ps.solved, ps.solved + ps.failed), s: ps.bestStreak }) : '–'}
          </span>
        </div>
      </section>

      {((data.onlineElo && data.onlineElo.games < PROVISIONAL_GAMES) || (p && puzzleProv)) && <p className="muted tiny prof-prov">{provisionalHelp()}</p>}

      <section className="prof-grid four">
        <div {...statCard('rush')} className={`card prof-mini stat-link`}>
          <span className="tc-label">{t("⚡ Puzzle Rush")}</span>
          <div className="prof-rush">
            {[
              ['3', t("3 min")],
              ['5', t("5 min")],
              ['survival', t("Survie")],
            ].map(([m, l]) => (
              <div key={m}>
                <b>{data.rush[m]?.best ?? '–'}</b>
                <span className="muted tiny">{l}</span>
              </div>
            ))}
          </div>
        </div>
        <div {...statCard('probleme-du-jour')} className={`card prof-mini stat-link`}>
          <span className="tc-label">{t("📅 Problème du jour")}</span>
          <b className="prof-mid">{data.daily.solved}</b>
          <span className="muted tiny">{t('jours réussis · {first} du premier coup · meilleure série {best}', { first: data.daily.firstTry, best: data.daily.bestStreak })} 🔥
          </span>
        </div>
        <div {...statCard('cours')} className={`card prof-mini stat-link`}>
          <span className="tc-label">{t("📚 Cours")}</span>
          <b className="prof-mid">
            {stars}
            <small className="muted">/{allLessons.length * 3} ⭐</small>
          </b>
          <span className="muted tiny">
            {t('{n}/{total} leçons terminées', { n: lessonsDone, total: allLessons.length })}</span>
        </div>
        <div {...statCard('succes')} className={`card prof-mini stat-link`}>
          <span className="tc-label">{t("🏆 Succès")}</span>
          <b className="prof-mid">
            {ach.length}
            <small className="muted">/{ACHIEVEMENTS.length}</small>
          </b>
          <span className="muted tiny">
            🥇 {tiers[3]}{" "}{t("or · 🥈")}{" "}{tiers[2]}{" "}{t("argent · 🥉")}{" "}{tiers[1]}{" "}{t("bronze")}</span>
        </div>
      </section>

      <section className="prof-grid two">
        <div {...statCard('parties')} className={`card stat-link`}>
          <div className="tc-label">{t('♟️ Parties enregistrées ({n})', { n: g.total })}</div>
          <WdlBar r={g.results} label={t("Toutes")} />
          <WdlBar r={g.asWhite} label={t("Avec les Blancs")} />
          <WdlBar r={g.asBlack} label={t("Avec les Noirs")} />
          {g.recent.length > 0 && (
            <div className="prof-form">
              <span className="muted tiny">{t("Forme (dernières parties, de la plus récente à la plus ancienne)")}</span>
              <div>
                {g.recent.map((r, i) => (
                  <i key={i} className={r} title={r === 'win' ? t("Victoire") : r === 'draw' ? t("Nulle") : t("Défaite")}>
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
          <div className="tc-label">{t("📖 Ouvertures les plus jouées")}</div>
          {g.openings.length === 0 && <p className="muted small">{t("Pas encore assez de parties.")}</p>}
          {g.openings.map((o) => (
            <WdlBar key={o.name} r={o} label={`${openingFr(o.name)} (${o.n})`} />
          ))}
          {data.repertoire.length > 0 && (
            <>
              <div className="tc-label prof-sub">{t("Répertoire")}</div>
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
          <div className="tc-label">{t("🤖 Galerie des bots")}</div>
          <span className="muted small">
            {t('{n}/{total} battus · en couleur : déjà battu, en noir et blanc : pas encore', { n: p?.beaten.length ?? 0, total: BOTS.length })}</span>
        </div>
        <div className="bot-gallery">
          {BOTS.map((b) => {
            const won = !!p?.beaten.includes(b.id);
            return (
              <button
                key={b.id}
                type="button"
                className={`bot-tile ${won ? 'won' : 'todo'}`}
                title={`${b.name} (${b.rating}) : ${won ? t('battu') : t('pas encore battu')}${mine ? t(" · jouer contre lui") : ''}`}
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
          <div className="tc-label">{t("🏅 Derniers succès")}</div>
          {ach.length === 0 && <p className="muted small">{t("Aucun succès pour l’instant.")}</p>}
          <div className="prof-ach">
            {ach.slice(0, 8).map(({ a, at }) => (
              <div key={a!.id} className={`prof-ach-item tier-${TIER[a!.tier]}`} title={a!.desc}>
                <span className="prof-ach-icon">{a!.icon}</span>
                <span>
                  <strong>{a!.title}</strong>
                  <span className="muted tiny">{at ? new Date(at).toLocaleDateString(locale()) : ''}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="tc-label">{t("⚔️ Dernières parties en ligne")}</div>
          {data.recentOnline.length === 0 && (
            <p className="muted small">{data.local ? t("Connecte-toi pour jouer contre les autres membres.") : t("Aucune partie en ligne pour l’instant.")}</p>
          )}
          <ul className="prof-online">
            {data.recentOnline.map((o, i) => (
              <li key={i}>
                <i className={`res ${o.result}`}>{o.result === 'win' ? 'V' : o.result === 'draw' ? 'N' : 'D'}</i>
                <button className="link inline" onClick={() => onOpen(o.opponent)}>
                  <Avatar name={o.opponent} size={22} /> {o.opponent}
                </button>
                {o.delta !== null && <b className={o.delta >= 0 ? 'up' : 'down'}>{o.delta >= 0 ? `+${o.delta}` : o.delta}</b>}
                <span className="muted tiny">{new Date(o.at).toLocaleDateString(locale())}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
