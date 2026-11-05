import { useState, useSyncExternalStore } from 'react';
import { Modal } from '../components/Modal';
import { MyAvatar } from '../profile/avatar';
import { ProfilePhoto } from '../profile/ProfilePhoto';
import { PrivacyTools } from './PrivacyTools';
import { apiCall, getSyncState, login, logout, subscribe, syncNow, type SyncStatus } from './client';

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
    <button className={`icon-btn account-btn sync-${s.status}`} onClick={onClick} title={s.user ? `${s.user} · ${STATUS_TEXT[s.status]}` : STATUS_TEXT[s.status]}>
      <MyAvatar size={30} />
      <i />
    </button>
  );
}

export function AccountModal({
  onClose,
  onInitiation,
  onTour,
  onLevel,
  onProfile,
  initialMode = 'login',
}: {
  /** Ouvre directement l'onglet "Creer un compte" (invitation de parrainage) */
  initialMode?: 'login' | 'register' | 'forgot';
  onProfile: () => void;
  onClose: () => void;
  onInitiation: () => void;
  onTour: () => void;
  onLevel: () => void;
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
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Compte et sauvegarde" onClose={onClose}>
      <div className="account">
        <ProfilePhoto />
        <button className="btn wide" onClick={onProfile}>
          👤 Voir mon profil et mes statistiques
        </button>
        <div className="tuto-box">
          <div className="tc-label">Tutoriel</div>
          <div className="tuto-actions">
            <button className="btn" onClick={onInitiation}>
              🌱 Parcours d’initiation
            </button>
            <button className="btn" onClick={onTour}>
              🧭 Visite de l’application
            </button>
            <button className="btn ghost" onClick={onLevel}>
              🎚️ Changer mon niveau
            </button>
          </div>
        </div>
        <div className="tc-label">Sauvegarde</div>
        <p className={`sync-line sync-${s.status}`}>
          <i /> {STATUS_TEXT[s.status]}
        </p>

        {s.status === 'offline' && (
          <div className="muted small">
            <p>
              Le serveur est injoignable pour le moment. Tes données restent enregistrées dans ce navigateur et seront
              synchronisées dès qu’il sera de nouveau accessible.
            </p>
          </div>
        )}

        {s.user && s.status !== 'offline' && (
          <>
            <p>
              Connecté en tant que <strong>{s.user}</strong>.
            </p>
            {s.lastSync && (
              <p className="muted small">Dernière synchronisation : {new Date(s.lastSync).toLocaleString('fr-FR')}</p>
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
                    setError(e instanceof Error ? e.message : 'Erreur');
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                🔄 Synchroniser maintenant
              </button>
              <button className="btn ghost" onClick={() => logout()}>
                Se déconnecter
              </button>
            </div>
            <p className="muted small">En te déconnectant, les données restent aussi sur ce navigateur.</p>
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
              <button type="button" className={`chip ${mode === 'login' ? 'selected' : ''}`} onClick={() => setMode('login')}>
                Se connecter
              </button>
              <button type="button" className={`chip ${mode === 'register' ? 'selected' : ''}`} onClick={() => setMode('register')}>
                Créer un compte
              </button>
            </div>
            {mode === 'forgot' ? (
              <>
                <p className="muted small">
                  Indique ton pseudo ou ton adresse e-mail : si une adresse confirmée est liée au compte, tu recevras un lien pour
                  choisir un nouveau mot de passe.
                </p>
                <input
                  className="text-input"
                  placeholder="Pseudo ou adresse e-mail"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setSent(false);
                  }}
                />
                {sent && (
                  <p className="success-text small">
                    Si un compte correspond, un e-mail vient de partir (lien valable 1 heure). Pense à regarder dans les spams.
                  </p>
                )}
                {error && <p className="error">{error}</p>}
                <button className="btn primary" type="submit" disabled={busy || !username.trim()}>
                  {busy ? '…' : 'Recevoir le lien'}
                </button>
                <button type="button" className="link-btn small" onClick={() => setMode('login')}>
                  ← Retour à la connexion
                </button>
                <p className="muted small">
                  Pas d’adresse sur ton compte ? Écris au{' '}
                  <a href="/aide" target="_blank" rel="noopener">
                    support
                  </a>{' '}
                  depuis la page Aide.
                </p>
              </>
            ) : (
              <>
                <input
                  className="text-input"
                  placeholder="Pseudo"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
                <input
                  className="text-input"
                  type="password"
                  placeholder={mode === 'register' ? 'Mot de passe (8 caractères min.)' : 'Mot de passe'}
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                {mode === 'register' && (
                  <input
                    className="text-input"
                    type="email"
                    placeholder="E-mail (facultatif, pour récupérer ton compte)"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                )}
                {(error || s.error) && <p className="error">{error ?? s.error}</p>}
                <button className="btn primary" type="submit" disabled={busy || !username.trim() || !password}>
                  {busy ? '…' : mode === 'register' ? 'Créer mon compte' : 'Connexion'}
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
                  >
                    Mot de passe oublié ?
                  </button>
                )}
              </>
            )}
            {mode === 'register' && (
              <p className="muted small">
                Ta progression actuelle (Elo, XP, parties, succès) est envoyée sur ton nouveau compte. Sans adresse e-mail,
                un mot de passe oublié ne pourra pas être récupéré. En créant un compte, tu
                acceptes les{' '}
                <a href="/infos/conditions" target="_blank" rel="noopener">
                  conditions d’utilisation
                </a>{' '}
                et la{' '}
                <a href="/infos/confidentialite" target="_blank" rel="noopener">
                  politique de confidentialité
                </a>
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
