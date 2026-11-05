// Mes donnees (RGPD) : export, changement de mot de passe, suppression du compte, effacement local.
import { useEffect, useState } from 'react';
import { API_BASE, apiCall, logout } from './client';

/** Efface toutes les donnees BetterMove de ce navigateur */
export function wipeLocalData() {
  for (const k of Object.keys(localStorage)) if (k.startsWith('bettermove')) localStorage.removeItem(k);
}

async function download(path: string, name: string) {
  const r = await fetch(`${API_BASE}${path}`, { credentials: 'include' });
  if (!r.ok) throw new Error('Export impossible pour le moment');
  const blob = await r.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

export function PrivacyTools({ user }: { user: string | null }) {
  const [panel, setPanel] = useState<null | 'password' | 'delete' | 'wipe' | 'email'>(null);
  const [mail, setMail] = useState<{ email: string | null; verified: boolean; mail: boolean } | null>(null);
  const [newEmail, setNewEmail] = useState('');
  useEffect(() => {
    // Changement de compte ou deconnexion : on referme les panneaux du compte precedent
    setPanel((p) => (p === 'wipe' ? p : null));
    if (!user) return setMail(null);
    apiCall<{ email: string | null; verified: boolean; mail: boolean }>('/auth/email')
      .then(setMail)
      .catch(() => setMail(null));
  }, [user]);
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [alsoLocal, setAlsoLocal] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (f: () => Promise<void>) => {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      await f();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  };
  const open = (p: typeof panel) => {
    setPanel(panel === p ? null : p);
    setCur('');
    setNext('');
    setNewEmail(mail?.email ?? '');
    setErr(null);
    setMsg(null);
  };

  return (
    <div className="privacy-tools">
      <div className="tc-label">Mes données</div>
      <div className="tuto-actions">
        {user && (
          <button className="btn" disabled={busy} onClick={() => run(() => download('/auth/export', `bettermove-${user}.json`))}>
            📦 Télécharger mes données
          </button>
        )}
        {user && (
          <button className="btn ghost" onClick={() => open('email')}>
            ✉️ Mon adresse e-mail{mail && !mail.email ? ' (à ajouter)' : mail && !mail.verified ? ' (à confirmer)' : ''}
          </button>
        )}
        {user && (
          <button className="btn ghost" onClick={() => open('password')}>
            🔑 Changer mon mot de passe
          </button>
        )}
        <button className="btn ghost" onClick={() => open('wipe')}>
          🧹 Effacer les données de ce navigateur
        </button>
        {user && (
          <button className="btn ghost danger-text" onClick={() => open('delete')}>
            🗑 Supprimer mon compte
          </button>
        )}
      </div>

      {panel === 'password' && (
        <form
          className="account-form"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              await apiCall('/auth/password', { method: 'PUT', body: JSON.stringify({ current: cur, next }) });
              setPanel(null);
              setMsg('Mot de passe changé. Tes autres appareils sont déconnectés.');
            });
          }}
        >
          <input className="text-input" type="password" autoComplete="current-password" placeholder="Mot de passe actuel" value={cur} onChange={(e) => setCur(e.target.value)} />
          <input className="text-input" type="password" autoComplete="new-password" placeholder="Nouveau mot de passe (8 caractères minimum)" value={next} onChange={(e) => setNext(e.target.value)} />
          <button className="btn primary" type="submit" disabled={busy || !cur || next.length < 8}>
            Changer
          </button>
        </form>
      )}

      {panel === 'email' && (
        <form
          className="account-form"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              const r = await apiCall<{ email: string | null; sent: boolean }>('/auth/email', {
                method: 'PUT',
                body: JSON.stringify({ email: newEmail.trim(), password: cur }),
              });
              setMail({ email: r.email, verified: false, mail: mail?.mail ?? false });
              setPanel(null);
              setMsg(
                !r.email
                  ? 'Adresse retirée du compte.'
                  : r.sent
                    ? `Lien de confirmation envoyé à ${r.email} (valable 48 h). Pense aux spams.`
                    : 'Adresse enregistrée, mais le mail de confirmation n’a pas pu partir pour le moment.',
              );
            });
          }}
        >
          <p className="small">
            {mail?.email ? (
              <>
                Adresse actuelle : <b>{mail.email}</b> {mail.verified ? '✅ confirmée' : '⏳ en attente de confirmation'}
              </>
            ) : (
              'Aucune adresse : sans elle, un mot de passe oublié ne peut pas être récupéré.'
            )}
          </p>
          {mail?.email && !mail.verified && (
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await apiCall('/auth/email/resend', { method: 'POST' });
                  setMsg(`Nouveau lien envoyé à ${mail.email}.`);
                })
              }
            >
              Renvoyer le lien de confirmation
            </button>
          )}
          <input className="text-input" type="email" autoComplete="email" placeholder="Nouvelle adresse (vide pour la retirer)" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
          <input className="text-input" type="password" autoComplete="current-password" placeholder="Ton mot de passe pour confirmer" value={cur} onChange={(e) => setCur(e.target.value)} />
          <button className="btn primary" type="submit" disabled={busy || !cur || newEmail.trim() === (mail?.email ?? '')}>
            Enregistrer
          </button>
          <p className="muted small">Ton adresse sert uniquement à récupérer ton compte. Elle n’est jamais visible des autres joueurs.</p>
        </form>
      )}

      {panel === 'wipe' && (
        <div className="danger-box">
          <p className="small">
            Efface ta progression, tes parties et tes réglages enregistrés dans ce navigateur.
            {user ? ' Ton compte et ses données sur le serveur ne sont pas touchés : tu les retrouveras en te reconnectant.' : ' Sans compte, c’est définitif.'}
          </p>
          <button
            className="btn danger"
            disabled={busy}
            onClick={() =>
              run(async () => {
                if (user) await logout();
                wipeLocalData();
                window.location.href = '/';
              })
            }
          >
            Tout effacer sur ce navigateur
          </button>
        </div>
      )}

      {panel === 'delete' && (
        <form
          className="danger-box account-form"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              await apiCall('/auth/account', { method: 'DELETE', body: JSON.stringify({ password: cur }) });
              await logout();
              if (alsoLocal) wipeLocalData();
              window.location.href = '/';
            });
          }}
        >
          <p className="small">
            Suppression <b>immédiate et définitive</b> du compte <b>{user}</b> : progression synchronisée, parties, messages, amis,
            classements et photo. Pense à télécharger tes données avant.
          </p>
          <input className="text-input" type="password" autoComplete="current-password" placeholder="Ton mot de passe pour confirmer" value={cur} onChange={(e) => setCur(e.target.value)} />
          <label className="toggle-line small">
            <input type="checkbox" checked={alsoLocal} onChange={(e) => setAlsoLocal(e.target.checked)} />
            <span>Effacer aussi les données de ce navigateur</span>
          </label>
          <button className="btn danger" type="submit" disabled={busy || !cur}>
            Supprimer définitivement mon compte
          </button>
        </form>
      )}
      {msg && <p className="success-text small">{msg}</p>}
      {err && <p className="error">{err}</p>}
    </div>
  );
}
