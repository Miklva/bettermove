// Communaute > Evenements. Premier evenement : le lancement (30 jours), avec parrainage.
import { useEffect, useState, type CSSProperties } from 'react';
import { apiCall } from '../sync/client';
import { useSync } from '../sync/AccountModal';
import { itemById } from '../shop/items';
import { SkinPreview } from '../shop/SkinPreview';
import { Avatar } from '../profile/avatar';

interface LaunchEvent {
  id: 'launch';
  start: string;
  end: string;
  active: boolean;
  status?: 'upcoming' | 'active' | 'ended';
  coins: number;
  items: string[];
  maxRewarded: number;
  totalReferrals: number;
  top: { username: string; n: number }[];
}
interface EventsData {
  now: number;
  events: LaunchEvent[];
  me: { username: string; inviteCode?: string | null; referrals: { username: string; at: string }[]; referredBy: string | null; canSetReferrer?: boolean } | null;
}

/** Lien d'invitation d'un joueur */
export const inviteLink = (code: string) => `${window.location.origin}/invite/${code}`;

function left(ms: number) {
  if (ms <= 0) return 'terminé';
  const d = Math.floor(ms / 86400_000);
  const h = Math.floor((ms % 86400_000) / 3600_000);
  return d > 0 ? `${d} j ${h} h` : `${h} h ${Math.floor((ms % 3600_000) / 60000)} min`;
}

export function EventsPage({ onAccount, onProfile }: { onAccount: () => void; onProfile: (name: string) => void }) {
  const sync = useSync();
  const [data, setData] = useState<EventsData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [reload, setReload] = useState(0);
  const [refName, setRefName] = useState(() => {
    try {
      return (JSON.parse(localStorage.getItem('bettermove.ref') ?? 'null') as { code: string } | null)?.code ?? '';
    } catch {
      return '';
    }
  });
  const [refMsg, setRefMsg] = useState<string | null>(null);
  const [refBusy, setRefBusy] = useState(false);
  const submitReferrer = async () => {
    setRefBusy(true);
    setRefMsg(null);
    try {
      await apiCall('/events/referrer', { method: 'POST', body: JSON.stringify({ code: refName.trim().toUpperCase() }) });
      localStorage.removeItem('bettermove.ref');
      // Recompenses recuperees tout de suite
      window.dispatchEvent(new Event('bettermove-claim'));
      setReload((r) => r + 1);
    } catch (e) {
      setRefMsg(e instanceof Error ? e.message : 'Impossible pour le moment');
    } finally {
      setRefBusy(false);
    }
  };

  useEffect(() => {
    let stop = false;
    const load = () =>
      apiCall<EventsData>('/events')
        .then((d) => !stop && (setData(d), setErr(null)))
        .catch(() => !stop && setErr('Les événements sont indisponibles pour le moment (serveur injoignable).'));
    load();
    const id = window.setInterval(load, 30_000);
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      stop = true;
      clearInterval(id);
      clearInterval(t);
    };
  }, [sync.user, reload]);

  if (err && !data) return <div className="events"><p className="card muted">{err}</p></div>;
  if (!data) return <div className="events"><p className="muted center">Chargement des événements…</p></div>;

  const ev = data.events.find((e) => e.id === 'launch')!;
  const offset = data.now - Date.now();
  const remaining = Date.parse(ev.end) - (now + offset);
  const total = Date.parse(ev.end) - Date.parse(ev.start);
  const code = data.me?.inviteCode ?? null;
  const link = sync.user && code ? inviteLink(code) : null;
  const mine = data.me?.referrals ?? [];
  const shareText = `Rejoins-moi sur BetterMove pour progresser aux échecs ! En créant ton compte avec mon lien, on reçoit tous les deux ${ev.coins} pièces et des skins exclusifs.`;

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      /* presse-papiers refuse : le lien reste selectionnable */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const share = async () => {
    if (!link) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'BetterMove', text: shareText, url: link });
        return;
      } catch {
        /* partage annule */
      }
    }
    void copy();
  };
  const enc = encodeURIComponent;

  return (
    <div className="events">
      <section className={`card event-hero ${ev.active ? '' : 'ended'}`}>
        <div className="event-badge">{ev.active ? '🚀 En cours' : ev.status === 'upcoming' ? '⏳ Bientôt' : 'Terminé'}</div>
        <h1>Événement de lancement</h1>
        <p>
          BetterMove vient de sortir : aide-nous à faire grandir la communauté ! Invite tes amis avec ton lien personnel. Quand un
          ami crée son compte grâce à lui, <b>vous recevez tous les deux {ev.coins} 🪙</b> et <b>deux skins exclusifs</b>, disponibles
          uniquement pendant l’événement.
        </p>
        <div className="event-time">
          <span>
            {ev.active ? (
              <>
                ⏳ Plus que <b>{left(remaining)}</b>
              </>
            ) : ev.status === 'upcoming' ? (
              <>
                🗓️ Commence le <b>{new Date(ev.start).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}</b>
              </>
            ) : (
              'L’événement est terminé. Merci à tous les parrains !'
            )}
          </span>
          <span className="event-progress">
            <i style={{ width: `${Math.min(100, Math.max(0, ((total - remaining) / total) * 100))}%` }} />
          </span>
          <span className="muted tiny">
            Du {new Date(ev.start).toLocaleDateString('fr-FR')} au {new Date(ev.end).toLocaleDateString('fr-FR')} ·{' '}
            {ev.totalReferrals} ami{ev.totalReferrals > 1 ? 's' : ''} parrainé{ev.totalReferrals > 1 ? 's' : ''} au total
          </span>
        </div>
      </section>

      <div className="events-grid">
        <section className="card event-share">
          <div className="tc-label">🔗 Ton lien d’invitation</div>
          {!sync.user ? (
            <>
              <p className="muted small">Crée un compte (gratuit) pour obtenir ton lien et commencer à parrainer.</p>
              <button className="btn primary" onClick={onAccount}>
                👤 Créer mon compte
              </button>
            </>
          ) : ev.active && !link ? (
            <p className="muted small">Préparation de ton lien…</p>
          ) : !ev.active ? (
            <p className="muted small">
              {ev.status === 'upcoming' ? 'Ton lien sera disponible au début de l’événement.' : 'Le parrainage est fermé : l’événement est terminé.'}
            </p>
          ) : (
            <>
              <div className="invite-link">
                <input className="text-input" readOnly value={link!} onFocus={(e) => e.target.select()} />
                <button className="btn primary" onClick={copy}>
                  {copied ? '✓ Copié' : 'Copier'}
                </button>
              </div>
              <p className="muted tiny">
                Ton code d’invitation : <b className="invite-code">{code}</b> (ton ami peut aussi le saisir dans Communauté ›
                Événements après son inscription)
              </p>
              <div className="share-row">
                <button className="btn" onClick={share}>
                  📤 Partager
                </button>
                <a className="btn" href={`https://wa.me/?text=${enc(`${shareText} ${link}`)}`} target="_blank" rel="noopener noreferrer">
                  WhatsApp
                </a>
                <a className="btn" href={`mailto:?subject=${enc('Viens jouer aux échecs avec moi sur BetterMove')}&body=${enc(`${shareText}\n\n${link}`)}`}>
                  E-mail
                </a>
                <a className="btn" href={`sms:?&body=${enc(`${shareText} ${link}`)}`}>
                  SMS
                </a>
              </div>
              <p className="muted tiny">
                Récompense pour toi : {ev.coins} 🪙 par ami (jusqu’à {ev.maxRewarded} amis), et les deux skins dès le premier.
              </p>
            </>
          )}
          {data.me?.referredBy && <p className="small">🤝 Tu as été parrainé par <b>{data.me.referredBy}</b>. Bienvenue !</p>}
          {data.me?.canSetReferrer && (
            <form
              className="late-referrer"
              onSubmit={(e) => {
                e.preventDefault();
                void submitReferrer();
              }}
            >
              <span className="small">
                <b>Un ami t’a invité ?</b> Entre le code d’invitation qu’il t’a envoyé (8 caractères, à la fin de son lien) pour
                recevoir vos récompenses. Possible pendant 7 jours après ton inscription.
              </span>
              <div className="invite-link">
                <input className="text-input invite-code-input" placeholder="Ex. : K7M2QX9P" value={refName} maxLength={12} autoCapitalize="characters" onChange={(e) => setRefName(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} />
                <button className="btn primary" type="submit" disabled={refBusy || refName.trim().length < 6}>
                  Valider
                </button>
              </div>
              {refMsg && <p className="error small">{refMsg}</p>}
            </form>
          )}
        </section>

        <section className="card event-rewards">
          <div className="tc-label">🎁 Les récompenses</div>
          <div className="event-items">
            {ev.items.map((id) => {
              const it = itemById(id);
              if (!it) return null;
              return (
                <button key={id} className="event-item" onClick={() => setPreview(id)} title="Voir sur un plateau">
                  {it.type === 'board' ? (
                    <span className="board-preview tex-referral" style={{ '--sq-light': it.light, '--sq-dark': it.dark } as CSSProperties} />
                  ) : (
                    <span className="event-pieces-icon">♚♛♞</span>
                  )}
                  <b>
                    {it.type === 'board' ? 'Plateau' : 'Pièces'} « {it.name} »
                  </b>
                  <span className="muted tiny">👁 Visualiser</span>
                </button>
              );
            })}
            <div className="event-item coins">
              <span className="event-coins">🪙 {ev.coins}</span>
              <b>Pour toi et ton ami</b>
              <span className="muted tiny">à chaque inscription</span>
            </div>
          </div>
        </section>
      </div>

      <div className="events-grid">
        {sync.user && (
          <section className="card">
            <div className="tc-label">🤝 Tes filleuls ({mine.length})</div>
            {mine.length ? (
              <ul className="event-list">
                {mine.map((r) => (
                  <li key={r.username}>
                    <button className="link-like" onClick={() => onProfile(r.username)}>
                      <Avatar name={r.username} size={22} /> {r.username}
                    </button>
                    <span className="muted tiny">{new Date(r.at).toLocaleDateString('fr-FR')}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted small">Personne pour l’instant. Partage ton lien : ton premier ami débloque les deux skins !</p>
            )}
          </section>
        )}
        <section className="card">
          <div className="tc-label">🏆 Meilleurs parrains</div>
          {ev.top.length ? (
            <ol className="event-list">
              {ev.top.map((t) => (
                <li key={t.username}>
                  <button className="link-like" onClick={() => onProfile(t.username)}>
                    <Avatar name={t.username} size={22} /> {t.username}
                  </button>
                  <b>
                    {t.n} ami{t.n > 1 ? 's' : ''}
                  </b>
                </li>
              ))}
            </ol>
          ) : (
            <p className="muted small">La première place est libre !</p>
          )}
        </section>
      </div>

      <section className="card event-rules">
        <div className="tc-label">📜 Règles</div>
        <ul className="small">
          <li>Ton ami doit créer un nouveau compte en ouvrant ton lien, pendant l’événement.</li>
          <li>Les récompenses arrivent automatiquement dans l’app, pour vous deux (connecte-toi pour les recevoir).</li>
          <li>Un compte ne peut être parrainé qu’une fois. Pièces limitées à {ev.maxRewarded} amis par parrain.</li>
          <li>Les comptes créés uniquement pour gagner des récompenses peuvent être supprimés.</li>
          <li>D’autres événements arrivent bientôt sur cette page !</li>
        </ul>
      </section>

      {preview && itemById(preview) && <SkinPreview item={itemById(preview)!} onClose={() => setPreview(null)} action={<span className="muted small">🚀 Offert pendant l’événement</span>} />}
    </div>
  );
}
