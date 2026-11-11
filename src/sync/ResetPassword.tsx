// Nouveau mot de passe depuis le lien recu par mail (/compte/reinitialiser/<jeton>)
import { useState } from 'react';
import { Modal } from '../components/Modal';
import { apiCall, login } from './client';
import { t, tServer } from '../i18n';

export function ResetPasswordModal({ token, onClose, onForgot }: { token: string; onClose: () => void; onForgot: () => void }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);

  const submit = async () => {
    if (password !== confirm) return setError(t('Les deux mots de passe sont différents'));
    setBusy(true);
    setError(null);
    try {
      const r = await apiCall<{ username: string }>('/auth/reset', { method: 'POST', body: JSON.stringify({ token, password }) });
      sessionStorage.setItem('bettermove.notice', t('🔑 Mot de passe changé. Bon retour, {name} !', { name: r.username }));
      // Connexion directe avec le nouveau mot de passe (et synchronisation de la progression)
      await login(r.username, password, false).catch(() => undefined);
      window.location.href = '/';
    } catch (e) {
      const msg = e instanceof Error ? e.message : t('Erreur');
      setError(msg);
      if (/invalide|expire/i.test(msg) || msg === tServer('Lien invalide ou expire : refais une demande')) setExpired(true);
      setBusy(false);
    }
  };

  return (
    <Modal title={t("Nouveau mot de passe")} onClose={onClose}>
      <form
        className="account-form"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <p className="muted small">{t("Choisis un nouveau mot de passe. Tous tes appareils seront déconnectés.")}</p>
        <input
          className="text-input"
          type="password"
          autoComplete="new-password"
          placeholder={t("Nouveau mot de passe (8 caractères minimum)")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
        />
        <input
          className="text-input"
          type="password"
          autoComplete="new-password"
          placeholder={t("Confirme le mot de passe")}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        {error && <p className="error">{error}</p>}
        {expired ? (
          <button type="button" className="btn primary" onClick={onForgot}>
            {t('Refaire une demande')}
          </button>
        ) : (
          <button className="btn primary" type="submit" disabled={busy || password.length < 8 || !confirm}>
            {busy ? '…' : t('Changer mon mot de passe')}
          </button>
        )}
      </form>
    </Modal>
  );
}
