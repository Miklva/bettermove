import { useState, useSyncExternalStore } from 'react';
import { Modal } from '../components/Modal';
import { MyAvatar } from '../profile/avatar';
import { ProfilePhoto } from '../profile/ProfilePhoto';
import { PrivacyTools } from './PrivacyTools';
import { hrefOf } from '../router';
import { apiCall, getSyncState, login, logout, subscribe, syncNow, type SyncStatus } from './client';

import { locale, t } from '../i18n';
let snapshot = getSyncState();
const sub = (fn: () => void) => {
  // L'etat a pu changer avant l'abonnement : React compare juste apres
  snapshot = getSyncState();
  return subscribe(() => {
    snapshot = getSyncState();
    fn();
  });
};

export function useSync() {
  return useSyncExternalStore(sub, () => snapshot);
}

const STATUS_TEXT: Record<SyncStatus, string> = {
  checking: 'Connexion au serveur…',
  offline: 'Serveur injoignable : sauvegarde sur ce navigateur pour l’instant',
  anon: 'Non connecté',
  syncing: 'Synchronisation…',
  synced: 'Tout est sauvegardé sur le serveur',
  error: 'Serveur injoignable, nouvel essai automatique',
};

export function AccountButton({ onClick }: { onClick: () => void }) {
  const s = useSync();
  return (
    <button className={`icon-btn account-btn sync-${s.status}`} onClick={onClick} title={s.user ? `${s.user} · ${t(STATUS_TEXT[s.status])}` : t(STATUS_TEXT[s.status])}>
      <MyAvatar size={30} />
      <i />
    </button>
  );
}

export function AccountModal({
  onClose,
  onInitiation,
  onTour,
  onProfile,
  initialMode = 'login',
}: {
  /** Ouvre directement l'onglet "Creer un compte" (invitation de parrainage) */
  initialMode?: 'login' | 'register' | 'forgot';
  onProfile: () => void;
  onClose: () => void;
  onInitiation: () => void;
  onTour: () => void;
}) {
  const s = useSync();
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>(initialMode);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (mode === 'forgot') {
        await apiCall('/auth/forgot', { method: 'POST', body: JSON.stringify({ login: username.trim() }) });
        setSent(true);
        return;
      }
      const changed = await login(username.trim(), password, mode === 'register', email.trim() || undefined);
      // Des donnees plus recentes sont arrivees du serveur : on recharge l'app
      if (changed) window.location.reload();
      else onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Erreur'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={t("Compte et sauvegarde")} onClose={onClose}>
      <div className="account">
        <ProfilePhoto />
        <button className="btn wide" onClick={onProfile}>{t("👤 Voir mon profil et mes statistiques")}</button>
        <div className="tuto-box">
          <div className="tc-label">{t("Tutoriel")}</div>
          <div className="tuto-actions">
            <button className="btn" onClick={onInitiation}>{t("🌱 Parcours d’initiation")}</button>
            <button className="btn" onClick={onTour}>{t("🧭 Visite de l’application")}</button>
          </div>
        </div>
        <div className="tc-label">{t("Sauvegarde")}</div>
        <p className={`sync-line sync-${s.status}`}>
          <i /> {t(STATUS_TEXT[s.status])}
        </p>

        {s.status === 'offline' && (
          <div className="muted small">
            <p>{t("Le serveur est injoignable pour le moment. Tes données restent enregistrées dans ce navigateur et seront synchronisées dès qu’il sera de nouveau accessible.")}</p>
          </div>
        )}

        {s.user && s.status !== 'offline' && (
          <>
            <p>{t("Connecté en tant que {user}.", { user: s.user ?? "" })}
            </p>
            {s.lastSync && (
              <p className="muted small">{t("Dernière synchronisation : {date}", { date: new Date(s.lastSync).toLocaleString(locale()) })}</p>
            )}
            {s.error && <p className="error">{s.error}</p>}
            <div className="row">
              <button
                className="btn"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    if (await syncNow()) window.location.reload();
                  } catch (e) {
                    setError(e instanceof Error ? e.message : t('Erreur'));
                  } finally {
                    setBusy(false);
                  }
                }}
              >{t("🔄 Synchroniser maintenant")}</button>
              <button className="btn ghost" onClick={() => logout()}>{t("Se déconnecter")}</button>
            </div>
            <p className="muted small">{t("En te déconnectant, les données restent aussi sur ce navigateur.")}</p>
          </>
        )}

        {!s.user && s.status !== 'offline' && s.status !== 'checking' && (
          <form
            className="account-form"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <div className="chips">
              <button type="button" className={`chip ${mode === 'login' ? 'selected' : ''}`} onClick={() => setMode('login')}>{t("Se connecter")}</button>
              <button type="button" className={`chip ${mode === 'register' ? 'selected' : ''}`} onClick={() => setMode('register')}>{t("Créer un compte")}</button>
            </div>
            {mode === 'forgot' ? (
              <>
                <p className="muted small">{t("Indique ton pseudo ou ton adresse e-mail : si une adresse confirmée est liée au compte, tu recevras un lien pour choisir un nouveau mot de passe.")}</p>
                <input
                  className="text-input"
                  placeholder={t("Pseudo ou adresse e-mail")}
                  autoComplete="username"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setSent(false);
                  }}
                />
                {sent && (
                  <p className="success-text small">{t("Si un compte correspond, un e-mail vient de partir (lien valable 1 heure). Pense à regarder dans les spams.")}</p>
                )}
                {error && <p className="error">{error}</p>}
                <button className="btn primary" type="submit" disabled={busy || !username.trim()}>
                  {busy ? '…' : t("Recevoir le lien")}
                </button>
                <button type="button" className="link-btn small" onClick={() => setMode('login')}>{t("← Retour à la connexion")}</button>
                <p className="muted small">{t("Pas d’adresse sur ton compte ? Écris au")}{' '}
                  <a href={hrefOf('/aide')} target="_blank" rel="noopener">{t("support")}</a>{' '}{t("depuis la page Aide.")}</p>
              </>
            ) : (
              <>
                <input
                  className="text-input"
                  placeholder={t("Pseudo")}
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
                <input
                  className="text-input"
                  type="password"
                  placeholder={mode === 'register' ? t("Mot de passe (8 caractères min.)") : t("Mot de passe")}
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                {mode === 'register' && (
                  <input
                    className="text-input"
                    type="email"
                    placeholder={t("E-mail (facultatif, pour récupérer ton compte)")}
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                )}
                {(error || s.error) && <p className="error">{error ?? s.error}</p>}
                <button className="btn primary" type="submit" disabled={busy || !username.trim() || !password}>
                  {busy ? '…' : mode === 'register' ? t("Créer mon compte") : t("Connexion")}
                </button>
                {mode === 'login' && (
                  <button
                    type="button"
                    className="link-btn small"
                    onClick={() => {
                      setMode('forgot');
                      setError(null);
                      setSent(false);
                    }}
                  >{t("Mot de passe oublié ?")}</button>
                )}
              </>
            )}
            {mode === 'register' && (
              <p className="muted small">{t("Ta progression actuelle (Elo, XP, parties, succès) est envoyée sur ton nouveau compte. Sans adresse e-mail, un mot de passe oublié ne pourra pas être récupéré. En créant un compte, tu acceptes les")}{' '}
                <a href={hrefOf('/infos/conditions')} target="_blank" rel="noopener">{t("conditions d’utilisation")}</a>{' '}{t("et la")}{' '}
                <a href={hrefOf('/infos/confidentialite')} target="_blank" rel="noopener">{t("politique de confidentialité")}</a>
                .
              </p>
            )}
          </form>
        )}
        <PrivacyTools user={s.status !== 'offline' ? s.user : null} />
      </div>
    </Modal>
  );
}
