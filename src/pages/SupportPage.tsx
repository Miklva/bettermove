// Support : formulaire enregistre par le serveur (lu dans la page Admin, et envoye par mail si le SMTP est configure).
// Aucune adresse mail n'apparait cote client.
import { useEffect, useState } from 'react';
import { apiCall, HttpError } from '../sync/client';
import { useSync } from '../sync/AccountModal';
import { track } from '../achievements/events';

const CATEGORIES = ['Bug', 'Suggestion', 'Compte et sauvegarde', 'Boutique', 'Contenu (cours, problèmes)', 'Autre'];

export function SupportPage() {
  const sync = useSync();
  const [name, setName] = useState(sync.user ?? '');
  const [email, setEmail] = useState('');
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  // Joueur connecte : pseudo du compte (non modifiable) et adresse du compte pre-remplie
  useEffect(() => {
    if (!sync.user) return;
    setName(sync.user);
    let stop = false;
    apiCall<{ email: string | null }>('/auth/email')
      .then((r) => {
        if (stop || !r.email) return;
        setAccountEmail(r.email);
        setEmail((cur) => cur || r.email!);
      })
      .catch(() => undefined);
    return () => {
      stop = true;
    };
  }, [sync.user]);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [withContext, setWithContext] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<null | { id: number }>(null);
  const online = sync.status !== 'offline' && sync.status !== 'checking';

  const context = () => ({
    page: location.href,
    navigateur: navigator.userAgent,
    ecran: `${window.innerWidth}x${window.innerHeight}`,
    compte: sync.user ?? null,
    date: new Date().toISOString(),
  });

  const valid = subject.trim().length > 0 && message.trim().length >= 10 && (!email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));

  const submit = async () => {
    if (!valid || sending) return;
    setError(null);
    if (!online) {
      setError('Le support est injoignable pour le moment (pas de connexion au serveur). Réessaie dans un instant.');
      return;
    }
    setSending(true);
    try {
      const r = await apiCall<{ id: number; mailed: boolean }>('/support', {
        method: 'POST',
        body: JSON.stringify({ name, email, category, subject, message, context: withContext ? context() : {} }),
      });
      setDone({ id: r.id });
      track('support');
    } catch (e) {
      setError(e instanceof HttpError && e.status === 404 ? 'Le support est injoignable pour le moment. Réessaie plus tard.' : e instanceof Error ? e.message : 'Envoi impossible');
    } finally {
      setSending(false);
    }
  };

  if (done)
    return (
      <div className="support">
        <div className="card support-done">
          <div className="big-check">✅</div>
          <h2>Message envoyé !</h2>
          <p>
            Ta demande n°{done.id} est bien arrivée au support.{' '}
            {email ? `La réponse arrivera sur ${email}.` : 'Ajoute ton e-mail la prochaine fois pour recevoir une réponse.'}
          </p>
          <button
            className="btn ghost"
            onClick={() => {
              setDone(null);
              setSubject('');
              setMessage('');
            }}
          >
            Écrire un autre message
          </button>
        </div>
      </div>
    );

  return (
    <div className="support">
      <div className="card">
        <h2>🛟 Support</h2>
        <p className="muted">
          Un bug, une idée, un souci de compte ? Écris-nous : chaque message est lu par l’équipe BetterMove.
        </p>
        {!online && <p className="muted small">Hors ligne : le support sera joignable dès que la connexion reviendra.</p>}
      </div>

      <form
        className="card support-form"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className="form-row">
          <label>
            <span className="label">{sync.user ? 'Ton pseudo' : 'Ton nom ou pseudo'}</span>
            <input
              className="text-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              readOnly={!!sync.user}
              title={sync.user ? 'Pseudo de ton compte' : undefined}
            />
          </label>
          <label>
            <span className="label">
              Ton e-mail (pour la réponse){accountEmail && email === accountEmail ? ' · celui de ton compte' : ''}
            </span>
            <input className="text-input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value.trim())} placeholder="toi@exemple.fr" />
          </label>
        </div>
        <span className="label">Catégorie</span>
        <div className="chips">
          {CATEGORIES.map((c) => (
            <button type="button" key={c} className={`chip ${category === c ? 'selected' : ''}`} onClick={() => setCategory(c)}>
              {c}
            </button>
          ))}
        </div>
        <label>
          <span className="label">Sujet</span>
          <input className="text-input" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={150} placeholder="En une phrase" />
        </label>
        <label>
          <span className="label">Message</span>
          <textarea
            className="notes-input"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={5000}
            placeholder={category === 'Bug' ? 'Ce que tu faisais, ce qui s’est passé, ce que tu attendais…' : 'Ton message'}
          />
        </label>
        <label className="toggle-line small">
          <input type="checkbox" checked={withContext} onChange={(e) => setWithContext(e.target.checked)} />
          <span>Joindre les infos techniques (page, navigateur, taille d’écran, pseudo) pour aider à corriger un bug. Ton e-mail sert uniquement à te répondre.</span>
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn primary big" type="submit" disabled={!valid || sending}>
          {sending ? 'Envoi…' : 'Envoyer au support'}
        </button>
        {!valid && message.length > 0 && message.trim().length < 10 && <p className="muted small">Message de 10 caractères minimum.</p>}
      </form>
    </div>
  );
}
