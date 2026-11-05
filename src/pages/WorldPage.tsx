// 1v1 contre le monde : appariement avec un joueur connecte (partie classee, Elo en ligne).
// Au bout de 30 s sans adversaire, le joueur choisit : un bot de son niveau ou continuer a attendre.
import { useEffect, useRef, useState } from 'react';
import { apiCall } from '../sync/client';
import { useSync } from '../sync/AccountModal';
import { TIME_CONTROLS } from '../game/timeControls';
import { BOTS, isUnlocked, type Bot } from '../bots/roster';
import { BotPortrait } from '../bots/portraits';
import { Avatar, MyAvatar } from '../profile/avatar';
import { online } from '../social/api';
import { sounds } from '../lib/sounds';
import { startBotNext } from './BotPage';
import type { Profile } from '../rating/profile';
import { PROVISIONAL_GAMES, PROVISIONAL_HELP, stakes } from '../rating/elo';
import { StakesTag } from '../components/StakesTag';

// Recherche lancee directement (bouton "Nouvelle partie" en fin de partie en ligne)
let pendingSearch: string | null = null;
export function searchWorldNext(tcId: string) {
  pendingSearch = tcId;
}

const WORLD_TCS = TIME_CONTROLS.filter((t) => ['3+2', '5+0', '10+0', '15+10'].includes(t.id));
const WAIT_S = 30;
/** Apres "continuer a attendre", on repose la question une minute plus tard */
const AGAIN_S = 60;

interface Status {
  waiting?: boolean;
  gameId?: number;
  opponent?: string;
  existing?: boolean;
  online?: number;
  searching?: number;
  byTc?: Record<string, number>;
  me?: { rating: number; games: number; provisional: boolean };
}

/** Bot debloque le plus proche de ton Elo */
function botFor(profile: Profile): Bot {
  const r = profile.bots.rating;
  const ok = BOTS.filter((b) => isUnlocked(b, r, profile.beaten));
  return [...ok].sort((a, b) => Math.abs(a.rating - r) - Math.abs(b.rating - r))[0] ?? BOTS[0];
}

interface Props {
  player: { profile: Profile };
  onPlay: (gameId: number) => void;
  onBot: () => void;
  onAccount: () => void;
}

export function WorldPage({ player, onPlay, onBot, onAccount }: Props) {
  const sync = useSync();
  const logged = !!sync.user && sync.status !== 'offline';
  const [tc, setTc] = useState(() => pendingSearch ?? localStorage.getItem('bettermove.worldTc') ?? '5+0');
  const autoSearch = useRef(pendingSearch !== null);
  pendingSearch = null;
  const [phase, setPhase] = useState<'checking' | 'idle' | 'searching' | 'prompt' | 'found' | 'resume' | 'fallback'>('checking');
  const [current, setCurrent] = useState<{ id: number; opponent: string } | null>(null);
  const askAt = useRef(WAIT_S);
  const [info, setInfo] = useState<Status>({});
  const [elapsed, setElapsed] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const started = useRef(0);
  const done = useRef(false);
  const bot = botFor(player.profile);

  // Une partie en ligne deja en cours : on la reprend au lieu d'en chercher une autre
  const resume = (g: { id: number; opponent: string }) => {
    done.current = true;
    setCurrent(g);
    setPhase('resume');
    window.setTimeout(() => onPlay(g.id), 1400);
  };
  useEffect(() => {
    if (!logged) {
      setPhase('idle');
      return;
    }
    online
      .current()
      .then((r) => {
        if (r.game) return resume(r.game);
        setPhase('idle');
        if (autoSearch.current) {
          autoSearch.current = false;
          void search();
        }
      })
      .catch(() => setPhase('idle'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logged]);

  // Etat de la file (joueurs en ligne, en recherche) quand on ne cherche pas
  useEffect(() => {
    if (!logged || phase !== 'idle') return;
    const load = () =>
      apiCall<Status>('/match/status')
        .then((s) => {
          setInfo(s);
          setErr(null);
        })
        .catch(() => setErr('Serveur injoignable pour le moment. Réessaie dans un instant.'));
    load();
    const id = window.setInterval(load, 5000);
    return () => clearInterval(id);
  }, [logged, phase]);

  const go = (gameId: number, opponent?: string) => {
    if (done.current) return;
    done.current = true;
    setPhase('found');
    setInfo((i) => ({ ...i, opponent }));
    sounds.start();
    window.setTimeout(() => onPlay(gameId), 900);
  };

  const fallback = async () => {
    if (done.current) return;
    try {
      const r = await apiCall<Status>('/match/leave', { method: 'POST' });
      if (r.gameId) return go(r.gameId);
    } catch {
      /* hors ligne : on joue contre le bot */
    }
    done.current = true;
    setPhase('fallback');
    window.setTimeout(() => {
      startBotNext(bot.id, tc);
      onBot();
    }, 900);
  };

  // Recherche : interrogation reguliere + compte a rebours
  const inQueue = phase === 'searching' || phase === 'prompt';
  useEffect(() => {
    if (!inQueue) return;
    const poll = window.setInterval(async () => {
      try {
        const s = await apiCall<Status>('/match/status');
        if (s.gameId) go(s.gameId);
        else setInfo(s);
      } catch {
        /* reessai au prochain tour */
      }
    }, 1500);
    const clock = window.setInterval(() => {
      const e = Math.floor((Date.now() - started.current) / 1000);
      setElapsed(e);
      // Personne : on laisse le joueur choisir (il reste dans la file pendant ce temps)
      if (e >= askAt.current) setPhase((p) => (p === 'searching' ? 'prompt' : p));
    }, 250);
    return () => {
      clearInterval(poll);
      clearInterval(clock);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inQueue]);

  // On quitte la page pendant la recherche : on sort de la file
  useEffect(
    () => () => {
      if (!done.current) apiCall('/match/leave', { method: 'POST' }).catch(() => undefined);
    },
    [],
  );

  const search = async () => {
    setErr(null);
    done.current = false;
    localStorage.setItem('bettermove.worldTc', tc);
    try {
      const r = await apiCall<Status>('/match/join', { method: 'POST', body: JSON.stringify({ tc }) });
      started.current = Date.now();
      askAt.current = WAIT_S;
      setElapsed(0);
      if (r.gameId && r.existing) return resume({ id: r.gameId, opponent: r.opponent ?? 'ton adversaire' });
      if (r.gameId) return go(r.gameId, r.opponent);
      setInfo(r);
      setPhase('searching');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erreur');
    }
  };

  const cancel = async () => {
    done.current = true;
    setPhase('idle');
    try {
      const r = await apiCall<Status>('/match/leave', { method: 'POST' });
      if (r.gameId) {
        done.current = false;
        go(r.gameId);
      }
    } catch {
      /* rien */
    }
  };

  const tcLabel = WORLD_TCS.find((t) => t.id === tc)?.label ?? tc;
  const left = Math.max(0, askAt.current - elapsed);
  const mm = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`;
  const me = info.me;

  if (!logged)
    return (
      <div className="world">
        <section className="card world-card">
          <h1>🌍 Contre le monde</h1>
          <p className="muted">
            Affronte un joueur BetterMove au hasard, de ton niveau. Crée un compte gratuit ou connecte-toi pour jouer en ligne.
          </p>
          <div className="row">
            <button className="btn primary" onClick={onAccount}>
              Se connecter
            </button>
            <button
              className="btn ghost"
              onClick={() => {
                startBotNext(bot.id, tc);
                onBot();
              }}
            >
              Jouer contre {bot.name} à la place
            </button>
          </div>
        </section>
      </div>
    );

  return (
    <div className="world">
      <section className="card world-card">
        <h1>🌍 Contre le monde</h1>
        {phase === 'idle' && (
          <>
            <p className="muted">
              On te trouve un vrai joueur connecté, le plus proche possible de ton niveau. Les parties sont classées : elles font
              bouger ton <b>Elo en ligne</b>. Si personne n’est disponible au bout de {WAIT_S} secondes, tu choisis : jouer contre{' '}
              {bot.name} ou continuer à attendre.
            </p>
            <div className="world-elo">
              <span className="tc-label">Ton Elo en ligne</span>
              <b>
                {me ? me.rating : '…'}
                {me?.provisional && (
                  <span className="muted" title={PROVISIONAL_HELP}>
                    ?
                  </span>
                )}
              </b>
              <span className="muted tiny">
                {me
                  ? me.games
                    ? `${me.games} partie${me.games > 1 ? 's' : ''} classée${me.games > 1 ? 's' : ''}`
                    : 'Aucune partie classée : on part de ton Elo bots'
                  : ''}
              </span>
              {me && (
                <div className="world-stakes">
                  <span className="muted tiny">Contre un adversaire de ton niveau :</span>
                  <StakesTag s={stakes(me.rating, me.rating, me.games)} full />
                </div>
              )}
              {me?.provisional && (
                <p className="muted tiny provisional-note">
                  ? : classement provisoire, définitif après {PROVISIONAL_GAMES} parties classées ({PROVISIONAL_GAMES - me.games} restante
                  {PROVISIONAL_GAMES - me.games > 1 ? 's' : ''}). D’ici là tu gagnes et perds plus de points, puis de moins en moins jusqu’à environ ±8.
                </p>
              )}
            </div>
            <span className="label">Cadence</span>
            <div className="chips">
              {WORLD_TCS.map((t) => (
                <button key={t.id} className={`chip ${tc === t.id ? 'selected' : ''}`} onClick={() => setTc(t.id)}>
                  {t.label}
                  {info.byTc?.[t.id] ? <span className="badge">{info.byTc[t.id]}</span> : null}
                </button>
              ))}
            </div>
            <p className="muted small world-live">
              <i className="presence on" /> {info.online ?? '…'} joueur{(info.online ?? 0) > 1 ? 's' : ''} en ligne
              {info.searching ? ` · ${info.searching} en recherche` : ''}
            </p>
            {err && <p className="error small">{err}</p>}
            <button className="btn primary big" onClick={() => void search()}>
              Chercher un adversaire · {tcLabel}
            </button>
          </>
        )}

        {phase === 'searching' && (
          <div className="world-search">
            <div className="world-vs">
              <MyAvatar size={64} />
              <span className="world-dots">
                <i />
                <i />
                <i />
              </span>
              <span className="world-unknown">?</span>
            </div>
            <strong>Recherche d’un adversaire · {tcLabel}</strong>
            {askAt.current === WAIT_S ? (
              <div className="world-ring" style={{ ['--p' as string]: `${(elapsed / WAIT_S) * 100}%` }}>
                <span>{left}</span>
              </div>
            ) : (
              <div className="world-ring waiting" style={{ ['--p' as string]: '100%' }}>
                <span className="small-time">{mm}</span>
              </div>
            )}
            <p className="muted small">
              {info.online ?? 0} en ligne · {info.searching ?? 1} en recherche
              {me ? ` · ton Elo en ligne : ${me.rating}${me.provisional ? '?' : ''}` : ''}
            </p>
            <div className="row">
              <button className="btn ghost" onClick={() => void cancel()}>
                Annuler
              </button>
              <button className="btn ghost" onClick={() => void fallback()}>
                Jouer contre {bot.name} maintenant
              </button>
            </div>
          </div>
        )}

        {phase === 'prompt' && (
          <div className="world-search">
            <div className="world-vs">
              <MyAvatar size={64} />
              <span className="world-dots">
                <i />
                <i />
                <i />
              </span>
              <span className="world-unknown">?</span>
            </div>
            <strong>Personne de disponible pour l’instant</strong>
            <p className="muted small">
              {info.online ?? 0} joueur{(info.online ?? 0) > 1 ? 's' : ''} en ligne, mais aucun ne cherche une partie en {tcLabel}.
              Tu restes dans la file tant que tu n’as pas choisi.
            </p>
            <div className="world-choice">
              <button className="world-option" onClick={() => void fallback()}>
                <BotPortrait id={bot.id} size={56} />
                <span>
                  <strong>Jouer contre {bot.name}</strong>
                  <span className="muted small">
                    {bot.rating} Elo, le bot le plus proche de ton niveau. Compte pour ton Elo bots.
                  </span>
                </span>
              </button>
              <button
                className="world-option"
                onClick={() => {
                  askAt.current = elapsed + AGAIN_S;
                  setPhase('searching');
                }}
              >
                <span className="world-option-icon">⏳</span>
                <span>
                  <strong>Continuer à attendre</strong>
                  <span className="muted small">Je te reposerai la question dans une minute.</span>
                </span>
              </button>
            </div>
            <button className="btn ghost" onClick={() => void cancel()}>
              Annuler la recherche
            </button>
          </div>
        )}

        {phase === 'checking' && <p className="muted">Vérification de tes parties en cours…</p>}

        {phase === 'resume' && current && (
          <div className="world-search">
            <div className="world-vs">
              <MyAvatar size={64} />
              <span className="world-x">⚔️</span>
              <Avatar name={current.opponent} size={64} />
            </div>
            <strong>Tu as déjà une partie en cours contre {current.opponent}</strong>
            <p className="muted small">Une seule partie en ligne à la fois : on te ramène sur l’échiquier…</p>
            <button className="btn primary" onClick={() => onPlay(current.id)}>
              Reprendre la partie
            </button>
          </div>
        )}

        {phase === 'found' && (
          <div className="world-search">
            <div className="world-vs">
              <MyAvatar size={64} />
              <span className="world-x">⚔️</span>
              <span className="world-unknown found">!</span>
            </div>
            <strong>Adversaire trouvé{info.opponent ? ` : ${info.opponent}` : ''} !</strong>
            <p className="muted small">La partie commence…</p>
          </div>
        )}

        {phase === 'fallback' && (
          <div className="world-search">
            <div className="world-vs">
              <MyAvatar size={64} />
              <span className="world-x">⚔️</span>
              <BotPortrait id={bot.id} size={64} />
            </div>
            <strong>Personne de disponible pour l’instant</strong>
            <p className="muted small">
              Tu affrontes {bot.name} ({bot.rating} Elo), le bot le plus proche de ton niveau. Partie classée pour ton Elo bots.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
