// Mes donnees (RGPD) : export, changement de mot de passe, suppression du compte, effacement local.
import { useState } from 'react';
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
  const [panel, setPanel] = useState<null | 'password' | 'delete' | 'wipe'>(null);
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
