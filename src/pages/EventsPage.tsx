// Communaute > Evenements. Premier evenement : le lancement (30 jours), avec parrainage.
import { useEffect, useState, type CSSProperties } from 'react';
import { apiCall } from '../sync/client';
import { useSync } from '../sync/AccountModal';
import { itemById } from '../shop/items';
import { SkinPreview } from '../shop/SkinPreview';
import { Avatar } from '../profile/avatar';

import { locale, t, tn } from '../i18n';
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
  if (ms <= 0) return t('terminé');
  const d = Math.floor(ms / 86400_000);
  const h = Math.floor((ms % 86400_000) / 3600_000);
  return d > 0 ? t('{d} j {h} h', { d, h }) : t('{h} h {m} min', { h, m: Math.floor((ms % 3600_000) / 60000) });
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
      setRefMsg(e instanceof Error ? e.message : t('Impossible pour le moment'));
    } finally {
      setRefBusy(false);
    }
  };

  useEffect(() => {
    let stop = false;
    const load = () =>
      apiCall<EventsData>('/events')
        .then((d) => !stop && (setData(d), setErr(null)))
        .catch(() => !stop && setErr(t('Les événements sont indisponibles pour le moment (serveur injoignable).')));
    load();
    const id = window.setInterval(load, 30_000);
    const tick = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      stop = true;
      clearInterval(id);
      clearInterval(tick);
    };
  }, [sync.user, reload]);

  if (err && !data) return <div className="events"><p className="card muted">{err}</p></div>;
  if (!data) return <div className="events"><p className="muted center">{t("Chargement des événements…")}</p></div>;

  const ev = data.events.find((e) => e.id === 'launch')!;
  const offset = data.now - Date.now();
  const remaining = Date.parse(ev.end) - (now + offset);
  const total = Date.parse(ev.end) - Date.parse(ev.start);
  const code = data.me?.inviteCode ?? null;
  const link = sync.user && code ? inviteLink(code) : null;
  const mine = data.me?.referrals ?? [];
  const shareText = t('Rejoins-moi sur BetterMove pour progresser aux échecs ! En créant ton compte avec mon lien, on reçoit tous les deux {coins} pièces et des skins exclusifs.', { coins: ev.coins });

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
        <div className="event-badge">{ev.active ? t("🚀 En cours") : ev.status === 'upcoming' ? t("⏳ Bientôt") : t("Terminé")}</div>
        <h1>{t("Événement de lancement")}</h1>
        <p>{t("BetterMove vient de sortir : aide-nous à faire grandir la communauté ! Invite tes amis avec ton lien personnel. Quand un ami crée son compte grâce à lui,")}{' '}{t('vous recevez tous les deux {coins} 🪙 et deux skins exclusifs, disponibles uniquement pendant l’événement.', { coins: ev.coins })}</p>
        <div className="event-time">
          <span>
            {ev.active ? (
              <>{t("⏳ Plus que")}{" "}<b>{left(remaining)}</b>
              </>
            ) : ev.status === 'upcoming' ? (
              <>{t("🗓️ Commence le")}{" "}<b>{new Date(ev.start).toLocaleDateString(locale(), { day: 'numeric', month: 'long' })}</b>
              </>
            ) : (
              t("L’événement est terminé. Merci à tous les parrains !")
            )}
          </span>
          <span className="event-progress">
            <i style={{ width: `${Math.min(100, Math.max(0, ((total - remaining) / total) * 100))}%` }} />
          </span>
          <span className="muted tiny">{t('Du {a} au {b}', { a: new Date(ev.start).toLocaleDateString(locale()), b: new Date(ev.end).toLocaleDateString(locale()) })} ·{' '}
            {tn(ev.totalReferrals, '{n} ami parrainé au total', '{n} amis parrainés au total')}</span>
        </div>
      </section>

      <div className="events-grid">
        <section className="card event-share">
          <div className="tc-label">{t("🔗 Ton lien d’invitation")}</div>
          {!sync.user ? (
            <>
              <p className="muted small">{t("Crée un compte (gratuit) pour obtenir ton lien et commencer à parrainer.")}</p>
              <button className="btn primary" onClick={onAccount}>{t("👤 Créer mon compte")}</button>
            </>
          ) : ev.active && !link ? (
            <p className="muted small">{t("Préparation de ton lien…")}</p>
          ) : !ev.active ? (
            <p className="muted small">
              {ev.status === 'upcoming' ? t("Ton lien sera disponible au début de l’événement.") : t("Le parrainage est fermé : l’événement est terminé.")}
            </p>
          ) : (
            <>
              <div className="invite-link">
                <input className="text-input" readOnly value={link!} onFocus={(e) => e.target.select()} />
                <button className="btn primary" onClick={copy}>
                  {copied ? t("✓ Copié") : t("Copier")}
                </button>
              </div>
              <p className="muted tiny">{t("Ton code d’invitation :")}{" "}<b className="invite-code">{code}</b>{" "}{t("(ton ami peut aussi le saisir dans Communauté › Événements après son inscription)")}</p>
              <div className="share-row">
                <button className="btn" onClick={share}>{t("📤 Partager")}</button>
                <a className="btn" href={`https://wa.me/?text=${enc(`${shareText} ${link}`)}`} target="_blank" rel="noopener noreferrer">{t("WhatsApp")}</a>
                <a className="btn" href={`mailto:?subject=${enc(t('Viens jouer aux échecs avec moi sur BetterMove'))}&body=${enc(`${shareText}\n\n${link}`)}`}>{t("E-mail")}</a>
                <a className="btn" href={`sms:?&body=${enc(`${shareText} ${link}`)}`}>{t("SMS")}</a>
              </div>
              <p className="muted tiny">{t('Récompense pour toi : {coins} 🪙 par ami (jusqu’à {max} amis), et les deux skins dès le premier.', { coins: ev.coins, max: ev.maxRewarded })}</p>
            </>
          )}
          {data.me?.referredBy && <p className="small">{t('🤝 Tu as été parrainé par {name}. Bienvenue !', { name: data.me.referredBy })}</p>}
          {data.me?.canSetReferrer && (
            <form
              className="late-referrer"
              onSubmit={(e) => {
                e.preventDefault();
                void submitReferrer();
              }}
            >
              <span className="small">
                <b>{t("Un ami t’a invité ?")}</b>{" "}{t("Entre le code d’invitation qu’il t’a envoyé (8 caractères, à la fin de son lien) pour recevoir vos récompenses. Possible pendant 7 jours après ton inscription.")}</span>
              <div className="invite-link">
                <input className="text-input invite-code-input" placeholder={t("Ex. : K7M2QX9P")} value={refName} maxLength={12} autoCapitalize="characters" onChange={(e) => setRefName(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} />
                <button className="btn primary" type="submit" disabled={refBusy || refName.trim().length < 6}>{t("Valider")}</button>
              </div>
              {refMsg && <p className="error small">{refMsg}</p>}
            </form>
          )}
        </section>

        <section className="card event-rewards">
          <div className="tc-label">{t("🎁 Les récompenses")}</div>
          <div className="event-items">
            {ev.items.map((id) => {
              const it = itemById(id);
              if (!it) return null;
              return (
                <button key={id} className="event-item" onClick={() => setPreview(id)} title={t("Voir sur un plateau")}>
                  {it.type === 'board' ? (
                    <span className="board-preview tex-referral" style={{ '--sq-light': it.light, '--sq-dark': it.dark } as CSSProperties} />
                  ) : (
                    <span className="event-pieces-icon">♚♛♞</span>
                  )}
                  <b>
                    {it.type === 'board' ? t("Plateau") : t("Pièces")} « {it.name} »
                  </b>
                  <span className="muted tiny">{t("👁 Visualiser")}</span>
                </button>
              );
            })}
            <div className="event-item coins">
              <span className="event-coins">🪙 {ev.coins}</span>
              <b>{t("Pour toi et ton ami")}</b>
              <span className="muted tiny">{t("à chaque inscription")}</span>
            </div>
          </div>
        </section>
      </div>

      <div className="events-grid">
        {sync.user && (
          <section className="card">
            <div className="tc-label">{t('🤝 Tes filleuls ({n})', { n: mine.length })}</div>
            {mine.length ? (
              <ul className="event-list">
                {mine.map((r) => (
                  <li key={r.username}>
                    <button className="link-like" onClick={() => onProfile(r.username)}>
                      <Avatar name={r.username} size={22} /> {r.username}
                    </button>
                    <span className="muted tiny">{new Date(r.at).toLocaleDateString(locale())}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted small">{t("Personne pour l’instant. Partage ton lien : ton premier ami débloque les deux skins !")}</p>
            )}
          </section>
        )}
        <section className="card">
          <div className="tc-label">{t("🏆 Meilleurs parrains")}</div>
          {ev.top.length ? (
            <ol className="event-list">
              {ev.top.map((x) => (
                <li key={x.username}>
                  <button className="link-like" onClick={() => onProfile(x.username)}>
                    <Avatar name={x.username} size={22} /> {x.username}
                  </button>
                  <b>
                    {tn(x.n, '{n} ami', '{n} amis')}
                  </b>
                </li>
              ))}
            </ol>
          ) : (
            <p className="muted small">{t("La première place est libre !")}</p>
          )}
        </section>
      </div>

      <section className="card event-rules">
        <div className="tc-label">{t("📜 Règles")}</div>
        <ul className="small">
          <li>{t("Ton ami doit créer un nouveau compte en ouvrant ton lien, pendant l’événement.")}</li>
          <li>{t("Les récompenses arrivent automatiquement dans l’app, pour vous deux (connecte-toi pour les recevoir).")}</li>
          <li>{t('Un compte ne peut être parrainé qu’une fois. Pièces limitées à {n} amis par parrain.', { n: ev.maxRewarded })}</li>
          <li>{t("Les comptes créés uniquement pour gagner des récompenses peuvent être supprimés.")}</li>
          <li>{t("D’autres événements arrivent bientôt sur cette page !")}</li>
        </ul>
      </section>

      {preview && itemById(preview) && <SkinPreview item={itemById(preview)!} onClose={() => setPreview(null)} action={<span className="muted small">{t("🚀 Offert pendant l’événement")}</span>} />}
    </div>
  );
}
