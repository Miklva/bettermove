// Accueil : rappel de l'evenement en cours (parrainage du lancement)
import { useEffect, useState } from 'react';
import { apiCall } from '../sync/client';

import { t, tn } from '../i18n';
export function EventPromo({ onOpen }: { onOpen: () => void }) {
  const [ev, setEv] = useState<{ end: string; coins: number } | null>(null);
  useEffect(() => {
    apiCall<{ events: { id: string; active: boolean; end: string; coins: number }[] }>('/events')
      .then((d) => {
        const l = d.events.find((e) => e.id === 'launch' && e.active);
        setEv(l ? { end: l.end, coins: l.coins } : null);
      })
      .catch(() => setEv(null));
  }, []);
  if (!ev) return null;
  const days = Math.max(0, Math.ceil((Date.parse(ev.end) - Date.now()) / 86400_000));
  return (
    <button className="card event-promo" onClick={onOpen}>
      <span className="event-promo-icon">🚀</span>
      <span>
        <span>
          <b>{t("Événement de lancement")}</b> · {tn(days, "encore {n} jour", "encore {n} jours")}
        </span>
        <small>{t("Invite un ami : vous recevez tous les deux {coins} 🪙 et des skins Parrainage exclusifs.", { coins: ev.coins })}</small>
      </span>
      <span className="btn primary">{t("Inviter")}</span>
    </button>
  );
}
