// Nouveau mot de passe depuis le lien recu par mail (/compte/reinitialiser/<jeton>)
import { useState } from 'react';
import { Modal } from '../components/Modal';
import { apiCall, login } from './client';

export function ResetPasswordModal({ token, onClose, onForgot }: { token: string; onClose: () => void; onForgot: () => void }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);

  const submit = async () => {
    if (password !== confirm) return setError('Les deux mots de passe sont différents');
    setBusy(true);
    setError(null);
    try {
      const r = await apiCall<{ username: string }>('/auth/reset', { method: 'POST', body: JSON.stringify({ token, password }) });
      sessionStorage.setItem('bettermove.notice', `🔑 Mot de passe changé. Bon retour, ${r.username} !`);
      // Connexion directe avec le nouveau mot de passe (et synchronisation de la progression)
      await login(r.username, password, false).catch(() => undefined);
      window.location.href = '/';
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur';
      setError(msg);
      if (/invalide|expire/i.test(msg)) setExpired(true);
      setBusy(false);
    }
  };

  return (
    <Modal title="Nouveau mot de passe" onClose={onClose}>
      <form
        className="account-form"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <p className="muted small">Choisis un nouveau mot de passe. Tous tes appareils seront déconnectés.</p>
        <input
          className="text-input"
          type="password"
          autoComplete="new-password"
          placeholder="Nouveau mot de passe (8 caractères minimum)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
        />
        <input
          className="text-input"
          type="password"
          autoComplete="new-password"
          placeholder="Confirme le mot de passe"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        {error && <p className="error">{error}</p>}
        {expired ? (
          <button type="button" className="btn primary" onClick={onForgot}>
            Refaire une demande
          </button>
        ) : (
          <button className="btn primary" type="submit" disabled={busy || password.length < 8 || !confirm}>
            {busy ? '…' : 'Changer mon mot de passe'}
          </button>
        )}
      </form>
    </Modal>
  );
}
