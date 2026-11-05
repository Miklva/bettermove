// Lier ses comptes chess.com et Lichess pour importer tout son historique dans BetterMove.
import { useState } from 'react';
import type { ImportProgress, Site } from '../review/importers';
import { getLinked, runImport, setLinked, SITE_NAME, type Linked } from './linked';

/** Pseudos proposes en un clic */
export const QUICK_USERS: Record<Site, string[]> = {
  chesscom: ['Mikllasauterelle'],
  lichess: [],
};

export function LinkedAccounts({ onImported }: { onImported: (added: number) => void }) {
  const [linked, setLinkedState] = useState<Linked>(getLinked);
  const [names, setNames] = useState<Record<Site, string>>(() => ({
    chesscom: linked.chesscom?.username ?? '',
    lichess: linked.lichess?.username ?? '',
  }));
  const [busy, setBusy] = useState<Site | null>(null);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (site: Site, full: boolean) => {
    const name = names[site].trim();
    if (!name) return;
    setBusy(site);
    setError(null);
    setMessage(null);
    setProgress({ step: 'Connexion…', found: 0, added: 0 });
    try {
      const r = await runImport(site, name, full, setProgress);
      setLinkedState(getLinked());
      setMessage(
        r.added
          ? `${r.added} partie${r.added > 1 ? 's' : ''} ajoutée${r.added > 1 ? 's' : ''} depuis ${SITE_NAME[site]}.`
          : `Aucune nouvelle partie sur ${SITE_NAME[site]}.`,
      );
      onImported(r.added);
    } catch (e) {
      setError(
        e instanceof Error && e.message !== 'Failed to fetch' && !e.message.includes('NetworkError')
          ? e.message
          : `Impossible de joindre ${SITE_NAME[site]}. Vérifie ta connexion et réessaie.`,
      );
    } finally {
      setBusy(null);
      setProgress(null);
    }
  };

  const unlink = (site: Site) => {
    const l = { ...getLinked() };
    delete l[site];
    setLinked(l);
    setLinkedState(l);
  };

  const toggleAuto = () => {
    const l = { ...getLinked(), auto: !linked.auto };
    setLinked(l);
    setLinkedState(l);
  };

  return (
    <div className="card linked">
      <h2>Tes comptes en ligne</h2>
      <p className="muted">
        Importe toutes tes parties chess.com et Lichess dans BetterMove : elles rejoignent ton historique et tes statistiques, et tu
        peux analyser chacune avec Stockfish.
      </p>

      {(['chesscom', 'lichess'] as Site[]).map((site) => {
        const acc = linked[site];
        const linkedHere = acc && acc.username.toLowerCase() === names[site].trim().toLowerCase();
        return (
          <div key={site} className="linked-row">
            <div className="linked-site">
              <strong>{site === 'chesscom' ? '♟️ chess.com' : '🐴 Lichess'}</strong>
              {acc && (
                <span className="muted small">
                  Lié à <b>{acc.username}</b> · {acc.count} partie{acc.count > 1 ? 's' : ''}
                  {acc.importedAt ? ` · mis à jour le ${new Date(acc.importedAt).toLocaleDateString('fr-FR')}` : ''}
                </span>
              )}
            </div>
            <div className="row tight-row">
              <input
                className="text-input"
                value={names[site]}
                placeholder={site === 'chesscom' ? 'Pseudo chess.com' : 'Pseudo Lichess'}
                onChange={(e) => setNames({ ...names, [site]: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && !busy && run(site, !linkedHere)}
                disabled={!!busy}
              />
              {linkedHere ? (
                <>
                  <button className="btn primary" disabled={!!busy} onClick={() => run(site, false)}>
                    Importer les nouvelles
                  </button>
                  <button className="btn ghost" disabled={!!busy} onClick={() => run(site, true)} title="Relire tout l’historique">
                    Tout réimporter
                  </button>
                </>
              ) : (
                <button className="btn primary" disabled={!!busy || !names[site].trim()} onClick={() => run(site, true)}>
                  Importer toutes mes parties
                </button>
              )}
            </div>
            {QUICK_USERS[site].length > 0 && !linkedHere && (
              <div className="chips">
                {QUICK_USERS[site].map((u) => (
                  <button key={u} className="chip" disabled={!!busy} onClick={() => setNames({ ...names, [site]: u })}>
                    ⚡ {u}
                  </button>
                ))}
              </div>
            )}
            {acc && (
              <button className="link-btn small muted" onClick={() => unlink(site)} disabled={!!busy}>
                Délier (les parties déjà importées restent)
              </button>
            )}
            {busy === site && progress && (
              <div className="import-progress">
                <div className="bar indeterminate">
                  <span />
                </div>
                <span className="small muted">
                  {progress.step} · {progress.found} partie{progress.found > 1 ? 's' : ''} trouvée{progress.found > 1 ? 's' : ''},{' '}
                  {progress.added} nouvelle{progress.added > 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>
        );
      })}

      <label className="toggle-line">
        <input type="checkbox" checked={linked.auto} onChange={toggleAuto} />
        <span>Importer automatiquement mes nouvelles parties quand j’ouvre l’historique</span>
      </label>
      {message && <p className="success-text">{message}</p>}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
