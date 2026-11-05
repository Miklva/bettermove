// Communaute : salon de discussion commun a tous les membres (necessite le serveur).
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiCall, HttpError, isAdmin } from '../sync/client';
import { useSync } from '../sync/AccountModal';
import { Avatar } from '../profile/avatar';
import { social, type Challenges, type Conversation, type Dm, type Friends, type UserInfo } from '../social/api';
import { Modal } from '../components/Modal';
import { TIME_CONTROLS } from '../game/timeControls';
import { useRouteSync, useRouteTab } from '../router';

interface ChatMessage {
  id: number;
  user: string;
  text: string | null;
  censored: boolean;
  deleted: boolean;
  at: string;
}

const MAX = 400;

/** Couleur stable par pseudo */
function hue(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

function when(at: string) {
  const d = new Date(at);
  const today = new Date().toDateString() === d.toDateString();
  return today
    ? d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : `${d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
}

interface Props {
  onAccount: () => void;
  onPlay: (gameId: number) => void;
  onProfile: (name: string) => void;
}

export function CommunityPage({ onAccount, onPlay, onProfile }: Props) {
  const sync = useSync();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const lastId = useRef(0);
  const stick = useRef(true);
  const online = sync.status !== 'offline' && sync.status !== 'checking';
  const logged = online && !!sync.user;
  const [view, setView] = useState<'room' | 'dm'>('room');
  const [dmWith, setDmWith] = useState<string | null>(null);
  // /communaute/salon, /communaute/messages, /communaute/messages/<pseudo>
  useRouteTab(1, view, setView, { room: 'salon', dm: 'messages' });
  useRouteSync(2, dmWith, setDmWith, (n) => n, (s) => s, view === 'dm', { value: null });
  const [menu, setMenu] = useState<{ name: string; x: number; y: number } | null>(null);
  const [challengeTo, setChallengeTo] = useState<string | null>(null);
  const [muted, setMuted] = useState<Set<string>>(new Set());
  const [friends, setFriends] = useState<Friends | null>(null);
  const [challenges, setChallenges] = useState<Challenges | null>(null);
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  // Amis, sourdines, defis et conversations (rafraichis toutes les 5 s)
  const refreshSocial = useCallback(async () => {
    if (!logged) return;
    try {
      const [f, m, c, d] = await Promise.all([social.friends(), social.mutes(), social.challenges(), social.conversations()]);
      setFriends(f);
      setMuted(new Set(m.muted.map((x) => x.toLowerCase())));
      setChallenges(c);
      setConvs(d.conversations);
    } catch {
      /* serveur ancien ou deconnecte : panneau masque */
    }
  }, [logged]);
  useEffect(() => {
    refreshSocial();
    const id = window.setInterval(refreshSocial, 5000);
    return () => window.clearInterval(id);
  }, [refreshSocial]);

  const say = (t: string) => {
    setNotice(t);
    window.setTimeout(() => setNotice((n) => (n === t ? null : n)), 3500);
  };
  const openDm = (name: string) => {
    setDmWith(name);
    setView('dm');
    setMenu(null);
  };

  // Chargement puis rafraichissement toutes les 3 secondes
  useEffect(() => {
    if (!online) return;
    let stop = false;
    const tick = async () => {
      try {
        const r = await apiCall<{ messages: ChatMessage[]; deleted: number[] }>(`/chat${lastId.current ? `?after=${lastId.current}` : ''}`);
        if (stop) return;
        const gone = new Set(r.deleted);
        setMessages((m) => {
          const known = new Set(m.map((x) => x.id));
          const next = [...m, ...r.messages.filter((x) => !known.has(x.id))].filter((x) => !gone.has(x.id) && !x.deleted);
          return next.slice(-300);
        });
        if (r.messages.length) lastId.current = r.messages[r.messages.length - 1].id;
        setLoaded(true);
        setError(null);
      } catch (e) {
        if (stop) return;
        // 404 : l'API tourne mais avec une ancienne image (sans la communaute)
        setError(
          e instanceof HttpError && e.status === 404
            ? 'Cette fonction est momentanément indisponible. Réessaie un peu plus tard.'
            : 'Impossible de joindre le serveur. Nouvel essai…',
        );
      }
    };
    tick();
    const id = window.setInterval(tick, 3000);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, [online]);

  // Defile vers le bas a l'arrivee de messages, sauf si on lit plus haut
  useEffect(() => {
    const el = listRef.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const send = async () => {
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    setError(null);
    try {
      const r = await apiCall<{ message: ChatMessage; warning: string | null }>('/chat', {
        method: 'POST',
        body: JSON.stringify({ text: t }),
      });
      setMessages((m) => (m.some((x) => x.id === r.message.id) ? m : [...m, r.message]));
      lastId.current = Math.max(lastId.current, r.message.id);
      setWarning(r.warning);
      setText('');
      stick.current = true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Envoi impossible');
    } finally {
      setSending(false);
    }
  };

  const remove = async (m: ChatMessage) => {
    if (!window.confirm('Supprimer ce message ?')) return;
    try {
      await apiCall(`/chat/${m.id}`, { method: 'DELETE' });
      setMessages((l) => l.filter((x) => x.id !== m.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Suppression impossible');
    }
  };

  if (!online)
    return (
      <div className="community">
        <div className="card center">
          <h2>💬 Communauté</h2>
          <p className="muted">
            {sync.status === 'checking'
              ? 'Connexion au serveur…'
              : 'La communauté est momentanément injoignable. Réessaie dans un instant.'}
          </p>
        </div>
      </div>
    );

  return (
    <div className="community">
      <div className="card community-head">
        <div>
          <h2>💬 Communauté</h2>
          <p className="muted small">Le salon de tous les joueurs BetterMove : partage tes parties, pose tes questions, trouve des conseils.</p>
        </div>
        <details className="rules">
          <summary className="small">Règles du salon</summary>
          <ul className="small">
            <li>Respecte les autres joueurs : pas d’insultes, de moqueries ni de propos haineux.</li>
            <li>Les mots interdits sont masqués automatiquement. Trois avertissements en 30 minutes = 10 minutes de sourdine.</li>
            <li>Pas de spam ni de publicité. Un message toutes les 2 secondes au maximum.</li>
            <li>Ne partage pas d’informations personnelles (adresse, téléphone…).</li>
          </ul>
        </details>
      </div>

      {notice && <p className="card success-text small">{notice}</p>}

      <div className={`community-grid ${logged ? '' : 'solo'}`}>
      <div className="community-main">
      {logged && (
        <div className="chips">
          <button className={`chip ${view === 'room' ? 'selected' : ''}`} onClick={() => setView('room')}>
            💬 Salon
          </button>
          <button className={`chip ${view === 'dm' ? 'selected' : ''}`} onClick={() => setView('dm')}>
            ✉️ Messages privés
            {convs.reduce((n, c) => n + c.unread, 0) > 0 && <span className="badge">{convs.reduce((n, c) => n + c.unread, 0)}</span>}
          </button>
        </div>
      )}
      {view === 'dm' && logged ? (
        <DmView
          convs={convs}
          current={dmWith}
          onSelect={setDmWith}
          muted={muted}
          onRefresh={refreshSocial}
        />
      ) : (
      <>
      <div
        className="card chat-list"
        ref={listRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
        }}
      >
        {!loaded && <p className="muted center">Chargement…</p>}
        {loaded && messages.length === 0 && <p className="muted center">Aucun message pour l’instant. Lance la discussion !</p>}
        {messages.filter((m) => !muted.has(m.user.toLowerCase())).map((m, i, list) => {
          const mine = sync.user?.toLowerCase() === m.user.toLowerCase();
          const grouped = i > 0 && list[i - 1].user === m.user;
          return (
            <div key={m.id} className={`chat-msg ${mine ? 'mine' : ''} ${grouped ? 'grouped' : ''}`}>
              {!grouped && (
                <div className="chat-meta">
                  <button
                    className="chat-author"
                    disabled={mine || !logged}
                    title={mine ? undefined : 'Actions : ami, message privé, défi, sourdine'}
                    onClick={(e) => {
                      const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      setMenu({ name: m.user, x: r.left, y: r.bottom + 4 });
                    }}
                  >
                    <Avatar name={m.user} size={28} />
                    <strong style={{ color: `hsl(${hue(m.user)} 70% 65%)` }}>{m.user}</strong>
                  </button>
                  <span className="muted tiny">{when(m.at)}</span>
                </div>
              )}
              <div className="chat-bubble">
                <span>{m.text}</span>
                {m.censored && (
                  <span className="muted tiny" title="Des mots interdits ont été masqués">
                    {' '}
                    🛡️
                  </span>
                )}
                {(mine || isAdmin()) && (
                  <button className="chat-del" onClick={() => remove(m)} title="Supprimer" aria-label="Supprimer">
                    🗑
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {warning && <p className="card warn-text small">⚠️ {warning}</p>}
      {error && <p className="error card small">{error}</p>}

      {sync.user ? (
        <form
          className="card chat-input"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <input
            className="text-input"
            placeholder={`Écris un message en tant que ${sync.user}…`}
            value={text}
            maxLength={MAX}
            onChange={(e) => setText(e.target.value)}
          />
          <span className={`tiny ${text.length > MAX - 40 ? 'warn-text' : 'muted'}`}>
            {text.length}/{MAX}
          </span>
          <button className="btn primary" type="submit" disabled={!text.trim() || sending}>
            Envoyer
          </button>
        </form>
      ) : (
        <div className="card chat-input">
          <span className="muted">Connecte-toi pour participer à la discussion.</span>
          <button className="btn primary" onClick={onAccount}>
            👤 Se connecter
          </button>
        </div>
      )}
      </>
      )}
      </div>
      {logged && (
        <SocialSidebar
          friends={friends}
          challenges={challenges}
          onDm={openDm}
          onChallenge={setChallengeTo}
          onPlay={onPlay}
          onChanged={refreshSocial}
          say={say}
        />
      )}
      </div>

      {menu && (
        <UserMenu
          name={menu.name}
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          onProfile={() => onProfile(menu.name)}
          onDm={() => openDm(menu.name)}
          onChallenge={() => {
            setChallengeTo(menu.name);
            setMenu(null);
          }}
          onChanged={() => {
            refreshSocial();
          }}
          say={say}
        />
      )}
      {challengeTo && (
        <ChallengeModal
          to={challengeTo}
          onClose={() => setChallengeTo(null)}
          onSent={() => {
            say(`Défi envoyé à ${challengeTo} : la partie s’ouvrira dès qu’il acceptera.`);
            setChallengeTo(null);
            refreshSocial();
          }}
        />
      )}
    </div>
  );
}

/* ---------------- Menu d'un joueur ---------------- */

function UserMenu({
  name,
  x,
  y,
  onClose,
  onProfile,
  onDm,
  onChallenge,
  onChanged,
  say,
}: {
  onProfile: () => void;
  name: string;
  x: number;
  y: number;
  onClose: () => void;
  onDm: () => void;
  onChallenge: () => void;
  onChanged: () => void;
  say: (t: string) => void;
}) {
  const [info, setInfo] = useState<UserInfo | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    social.user(name).then(setInfo).catch((e) => setErr(e instanceof Error ? e.message : 'Erreur'));
  }, [name]);

  const run = async (fn: () => Promise<unknown>, msg: string) => {
    try {
      await fn();
      say(msg);
      onChanged();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Action impossible');
    }
  };

  return (
    <div className="menu-backdrop" onClick={onClose}>
      <div
        className="user-menu card"
        style={{ left: Math.min(x, window.innerWidth - 250), top: Math.min(y, window.innerHeight - 260) }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="user-menu-head">
          <Avatar name={name} size={40} />
          <strong>{name}</strong>
        </div>
        <button className="menu-item" onClick={onProfile}>
          👤 Voir le profil
        </button>
        {!info && !err && <p className="muted small">…</p>}
        {err && <p className="error small">{err}</p>}
        {info && (
          <>
            {info.friend === 'none' && (
              <button className="menu-item" onClick={() => run(() => social.addFriend(name), `Demande d’ami envoyée à ${name}.`)}>
                ➕ Ajouter en ami
              </button>
            )}
            {info.friend === 'sent' && <span className="menu-item muted">⏳ Demande d’ami envoyée</span>}
            {info.friend === 'received' && (
              <button className="menu-item" onClick={() => run(() => social.acceptFriend(name), `${name} est maintenant ton ami.`)}>
                ✅ Accepter sa demande d’ami
              </button>
            )}
            <button className="menu-item" onClick={onDm} disabled={info.muted}>
              ✉️ Message privé
            </button>
            <button
              className="menu-item"
              onClick={onChallenge}
              disabled={info.friend !== 'friends'}
              title={info.friend !== 'friends' ? 'Ajoute-le en ami pour le défier' : undefined}
            >
              ⚔️ Défier en 1v1{info.friend !== 'friends' ? ' (amis seulement)' : ''}
            </button>
            {info.friend === 'friends' && (
              <button
                className="menu-item"
                onClick={() => window.confirm(`Retirer ${name} de tes amis ?`) && run(() => social.removeFriend(name), `${name} a été retiré de tes amis.`)}
              >
                👋 Retirer des amis
              </button>
            )}
            {info.muted ? (
              <button className="menu-item" onClick={() => run(() => social.unmute(name), `${name} n’est plus en sourdine.`)}>
                🔊 Retirer la sourdine
              </button>
            ) : (
              <button
                className="menu-item danger-text"
                onClick={() => run(() => social.mute(name), `${name} est en sourdine : tu ne verras plus ses messages.`)}
              >
                🔇 Mettre en sourdine
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ---------------- Defi ---------------- */

function ChallengeModal({ to, onClose, onSent }: { to: string; onClose: () => void; onSent: () => void }) {
  const [tc, setTc] = useState('10+0');
  const [color, setColor] = useState<'w' | 'b' | 'random'>('random');
  const [err, setErr] = useState<string | null>(null);
  const t = TIME_CONTROLS.find((x) => x.id === tc)!;
  const send = async () => {
    try {
      await social.challenge(to, t.initial === null ? null : t.initial * 1000, t.increment * 1000, color);
      onSent();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Envoi impossible');
    }
  };
  return (
    <Modal title={`⚔️ Défier ${to}`} onClose={onClose}>
      <div className="challenge-form">
        <span className="label">Cadence</span>
        <div className="chips">
          {TIME_CONTROLS.map((x) => (
            <button key={x.id} className={`chip ${tc === x.id ? 'selected' : ''}`} onClick={() => setTc(x.id)}>
              {x.label}
            </button>
          ))}
        </div>
        <span className="label">Tu joues</span>
        <div className="chips">
          {(
            [
              ['w', 'Blancs'],
              ['random', 'Aléatoire'],
              ['b', 'Noirs'],
            ] as const
          ).map(([c, l]) => (
            <button key={c} className={`chip ${color === c ? 'selected' : ''}`} onClick={() => setColor(c)}>
              {l}
            </button>
          ))}
        </div>
        {err && <p className="error">{err}</p>}
        <button className="btn primary big wide" onClick={send}>
          Envoyer le défi
        </button>
      </div>
    </Modal>
  );
}

const tcLabel = (initial: number | null, inc: number) =>
  initial === null ? 'sans pendule' : `${initial / 60000} min${inc ? ` | ${inc / 1000}` : ''}`;

/* ---------------- Panneau amis ---------------- */

function SocialSidebar({
  friends,
  challenges,
  onDm,
  onChallenge,
  onPlay,
  onChanged,
  say,
}: {
  friends: Friends | null;
  challenges: Challenges | null;
  onDm: (n: string) => void;
  onChallenge: (n: string) => void;
  onPlay: (id: number) => void;
  onChanged: () => void;
  say: (t: string) => void;
}) {
  const [add, setAdd] = useState('');
  const run = async (fn: () => Promise<unknown>, msg?: string) => {
    try {
      await fn();
      if (msg) say(msg);
      onChanged();
    } catch (e) {
      say(e instanceof Error ? e.message : 'Action impossible');
    }
  };
  if (!friends || !challenges) return <aside className="community-side card muted small">Chargement des amis…</aside>;
  return (
    <aside className="community-side">
      {challenges.games.length > 0 && (
        <div className="card side-block highlight">
          <div className="tc-label">Parties en cours</div>
          {challenges.games.map((g) => (
            <div key={g.id} className="side-row">
              <span>contre {g.opponent}</span>
              <button className="btn primary small-btn" onClick={() => onPlay(g.id)}>
                Rejoindre
              </button>
            </div>
          ))}
        </div>
      )}
      {challenges.incoming.length > 0 && (
        <div className="card side-block highlight">
          <div className="tc-label">Défis reçus</div>
          {challenges.incoming.map((c) => (
            <div key={c.id} className="side-row">
              <span>
                <b>{c.from}</b> <span className="muted tiny">{tcLabel(c.initial, c.increment)}</span>
              </span>
              <span className="side-actions">
                <button
                  className="btn primary small-btn"
                  onClick={() =>
                    run(async () => {
                      const r = await social.acceptChallenge(c.id);
                      onPlay(r.gameId);
                    })
                  }
                >
                  Jouer
                </button>
                <button className="btn small-btn" onClick={() => run(() => social.dropChallenge(c.id), 'Défi refusé.')}>
                  ✕
                </button>
              </span>
            </div>
          ))}
        </div>
      )}
      {challenges.outgoing.length > 0 && (
        <div className="card side-block">
          <div className="tc-label">Défis envoyés</div>
          {challenges.outgoing.map((c) => (
            <div key={c.id} className="side-row">
              <span>
                {c.to} <span className="muted tiny">{tcLabel(c.initial, c.increment)} · en attente</span>
              </span>
              <button className="btn small-btn" onClick={() => run(() => social.dropChallenge(c.id), 'Défi annulé.')}>
                Annuler
              </button>
            </div>
          ))}
        </div>
      )}
      {friends.incoming.length > 0 && (
        <div className="card side-block highlight">
          <div className="tc-label">Demandes d’ami</div>
          {friends.incoming.map((n) => (
            <div key={n} className="side-row">
              <b>{n}</b>
              <span className="side-actions">
                <button className="btn primary small-btn" onClick={() => run(() => social.acceptFriend(n), `${n} est maintenant ton ami.`)}>
                  Accepter
                </button>
                <button className="btn small-btn" onClick={() => run(() => social.removeFriend(n))}>
                  ✕
                </button>
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="card side-block">
        <div className="tc-label">Amis ({friends.friends.length})</div>
        {friends.friends.length === 0 && (
          <p className="muted small">Clique sur le pseudo d’un joueur dans le salon pour l’ajouter en ami, ou cherche-le ici.</p>
        )}
        {friends.friends.map((f) => (
          <div key={f.username} className="side-row">
            <span>
              <span className="avatar-presence">
                <Avatar name={f.username} size={24} />
                <i className={`presence ${f.online ? 'on' : ''}`} title={f.online ? 'En ligne' : 'Hors ligne'} />
              </span>{' '}
              {f.username}
            </span>
            <span className="side-actions">
              <button className="icon-btn" title="Message privé" onClick={() => onDm(f.username)}>
                ✉️
              </button>
              <button className="icon-btn" title="Défier" onClick={() => onChallenge(f.username)}>
                ⚔️
              </button>
            </span>
          </div>
        ))}
        {friends.outgoing.length > 0 && <p className="muted tiny">En attente : {friends.outgoing.join(', ')}</p>}
        <form
          className="add-friend"
          onSubmit={(e) => {
            e.preventDefault();
            const n = add.trim();
            if (n) run(() => social.addFriend(n), `Demande d’ami envoyée à ${n}.`).then(() => setAdd(''));
          }}
        >
          <input className="text-input" placeholder="Ajouter un pseudo" value={add} onChange={(e) => setAdd(e.target.value)} />
          <button className="btn small-btn" type="submit" disabled={!add.trim()}>
            ➕
          </button>
        </form>
      </div>
    </aside>
  );
}

/* ---------------- Messages prives ---------------- */

function DmView({
  convs,
  current,
  onSelect,
  muted,
  onRefresh,
}: {
  convs: Conversation[];
  current: string | null;
  onSelect: (n: string | null) => void;
  muted: Set<string>;
  onRefresh: () => void;
}) {
  const [msgs, setMsgs] = useState<Dm[]>([]);
  const [text, setText] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const last = useRef(0);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMsgs([]);
    last.current = 0;
    if (!current) return;
    let stop = false;
    const tick = async () => {
      try {
        const r = await social.dms(current, last.current);
        if (stop || !r.messages.length) return;
        last.current = r.messages[r.messages.length - 1].id;
        setMsgs((m) => [...m, ...r.messages.filter((x) => !m.some((y) => y.id === x.id))]);
        onRefresh();
      } catch {
        /* reessai au prochain tour */
      }
    };
    tick();
    const id = window.setInterval(tick, 2500);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  useEffect(() => {
    if (box.current) box.current.scrollTop = box.current.scrollHeight;
  }, [msgs]);

  const send = async () => {
    if (!current || !text.trim()) return;
    setErr(null);
    try {
      const r = await social.sendDm(current, text.trim());
      setMsgs((m) => [...m, r.message]);
      last.current = Math.max(last.current, r.message.id);
      setText('');
      onRefresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Envoi impossible');
    }
  };

  const list = convs.filter((c) => !muted.has(c.username.toLowerCase()));
  const inList = current && !list.some((c) => c.username === current);
  return (
    <div className="dm-layout">
      <div className="card dm-list">
        {list.length === 0 && !current && <p className="muted small">Aucune conversation. Clique sur un joueur du salon ou sur ✉️ à côté d’un ami.</p>}
        {inList && (
          <button className="dm-conv selected">
            <b>{current}</b>
            <span className="muted tiny">Nouvelle conversation</span>
          </button>
        )}
        {list.map((c) => (
          <button key={c.username} className={`dm-conv ${current === c.username ? 'selected' : ''}`} onClick={() => onSelect(c.username)}>
            <span className="dm-conv-top">
              <b>
                <span className="avatar-presence">
                  <Avatar name={c.username} size={22} />
                  <i className={`presence ${c.online ? 'on' : ''}`} />
                </span>{' '}
                {c.username}
              </b>
              {c.unread > 0 && <span className="badge">{c.unread}</span>}
            </span>
            <span className="muted tiny dm-preview">
              {c.lastFromMe ? 'Toi : ' : ''}
              {c.last}
            </span>
          </button>
        ))}
      </div>
      <div className="card dm-thread">
        {!current ? (
          <p className="muted center">Choisis une conversation.</p>
        ) : (
          <>
            <div className="dm-head">
              <b>{current}</b>
            </div>
            <div className="dm-msgs" ref={box}>
              {msgs.length === 0 && <p className="muted small center">Démarre la conversation avec {current}.</p>}
              {msgs.map((m) => (
                <div key={m.id} className={`dm-msg ${m.mine ? 'mine' : ''}`}>
                  <span>{m.text}</span>
                  <span className="tiny muted">{when(m.at)}</span>
                </div>
              ))}
            </div>
            {err && <p className="error small">{err}</p>}
            <form
              className="chat-input flat"
              onSubmit={(e) => {
                e.preventDefault();
                void send();
              }}
            >
              <input className="text-input" placeholder={`Message à ${current}…`} value={text} maxLength={1000} onChange={(e) => setText(e.target.value)} />
              <button className="btn primary" type="submit" disabled={!text.trim()}>
                Envoyer
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
