// Mes donnees (RGPD) : export, changement de mot de passe, suppression du compte, effacement local.
import { useEffect, useState } from 'react';
import { API_BASE, apiCall, logout } from './client';

import { t } from '../i18n';
/** Efface toutes les donnees BetterMove de ce navigateur */
export function wipeLocalData() {
  for (const k of Object.keys(localStorage)) if (k.startsWith('bettermove')) localStorage.removeItem(k);
}

async function download(path: string, name: string) {
  const r = await fetch(`${API_BASE}${path}`, { credentials: 'include' });
  if (!r.ok) throw new Error(t('Export impossible pour le moment'));
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
      setErr(e instanceof Error ? e.message : t('Erreur'));
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
      <div className="tc-label">{t("Mes données")}</div>
      <div className="tuto-actions">
        {user && (
          <button className="btn" disabled={busy} onClick={() => run(() => download('/auth/export', `bettermove-${user}.json`))}>{t("📦 Télécharger mes données")}</button>
        )}
        {user && (
          <button className="btn ghost" onClick={() => open('email')}>{t("✉️ Mon adresse e-mail")}{mail && !mail.email ? t(" (à ajouter)") : mail && !mail.verified ? t(" (à confirmer)") : ''}
          </button>
        )}
        {user && (
          <button className="btn ghost" onClick={() => open('password')}>{t("🔑 Changer mon mot de passe")}</button>
        )}
        <button className="btn ghost" onClick={() => open('wipe')}>{t("🧹 Effacer les données de ce navigateur")}</button>
        {user && (
          <button className="btn ghost danger-text" onClick={() => open('delete')}>{t("🗑 Supprimer mon compte")}</button>
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
              setMsg(t('Mot de passe changé. Tes autres appareils sont déconnectés.'));
            });
          }}
        >
          <input className="text-input" type="password" autoComplete="current-password" placeholder={t("Mot de passe actuel")} value={cur} onChange={(e) => setCur(e.target.value)} />
          <input className="text-input" type="password" autoComplete="new-password" placeholder={t("Nouveau mot de passe (8 caractères minimum)")} value={next} onChange={(e) => setNext(e.target.value)} />
          <button className="btn primary" type="submit" disabled={busy || !cur || next.length < 8}>{t("Changer")}</button>
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
                  ? t('Adresse retirée du compte.')
                  : r.sent
                    ? t('Lien de confirmation envoyé à {email} (valable 48 h). Pense aux spams.', { email: r.email })
                    : t('Adresse enregistrée, mais le mail de confirmation n’a pas pu partir pour le moment.'),
              );
            });
          }}
        >
          <p className="small">
            {mail?.email ? (
              <>{t("Adresse actuelle :")}{" "}<b>{mail.email}</b> {mail.verified ? t("✅ confirmée") : t("⏳ en attente de confirmation")}
              </>
            ) : (
              t("Aucune adresse : sans elle, un mot de passe oublié ne peut pas être récupéré.")
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
                  setMsg(t('Nouveau lien envoyé à {email}.', { email: mail.email ?? '' }));
                })
              }
            >{t("Renvoyer le lien de confirmation")}</button>
          )}
          <input className="text-input" type="email" autoComplete="email" placeholder={t("Nouvelle adresse (vide pour la retirer)")} value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
          <input className="text-input" type="password" autoComplete="current-password" placeholder={t("Ton mot de passe pour confirmer")} value={cur} onChange={(e) => setCur(e.target.value)} />
          <button className="btn primary" type="submit" disabled={busy || !cur || newEmail.trim() === (mail?.email ?? '')}>{t("Enregistrer")}</button>
          <p className="muted small">{t("Ton adresse sert uniquement à récupérer ton compte. Elle n’est jamais visible des autres joueurs.")}</p>
        </form>
      )}

      {panel === 'wipe' && (
        <div className="danger-box">
          <p className="small">{t("Efface ta progression, tes parties et tes réglages enregistrés dans ce navigateur.")}{user ? t(" Ton compte et ses données sur le serveur ne sont pas touchés : tu les retrouveras en te reconnectant.") : t(" Sans compte, c’est définitif.")}
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
          >{t("Tout effacer sur ce navigateur")}</button>
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
          <p className="small">{t("Suppression immédiate et définitive du compte {user} : progression synchronisée, parties, messages, amis, classements et photo. Pense à télécharger tes données avant.", { user: user ?? '' })}</p>
          <input className="text-input" type="password" autoComplete="current-password" placeholder={t("Ton mot de passe pour confirmer")} value={cur} onChange={(e) => setCur(e.target.value)} />
          <label className="toggle-line small">
            <input type="checkbox" checked={alsoLocal} onChange={(e) => setAlsoLocal(e.target.checked)} />
            <span>{t("Effacer aussi les données de ce navigateur")}</span>
          </label>
          <button className="btn danger" type="submit" disabled={busy || !cur}>{t("Supprimer définitivement mon compte")}</button>
        </form>
      )}
      {msg && <p className="success-text small">{msg}</p>}
      {err && <p className="error">{err}</p>}
    </div>
  );
}
