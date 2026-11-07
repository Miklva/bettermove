// Generique de fin facon cinema : les credits defilent de bas en haut.
import { useEffect } from 'react';

const ROLES: { role: string; names: string[] }[] = [
  { role: 'Création, conception et réalisation', names: ['OHT|TheMikll 洋'] },
  { role: 'Développement', names: ['OHT|TheMikll 洋', 'Claude'] },
  { role: 'Moteur d’échecs', names: ['Stockfish, par ses développeurs et contributeurs', 'Portage WebAssembly stockfish.js : Nathan Rugg'] },
  { role: 'Échiquier interactif', names: ['chessground, par l’équipe Lichess'] },
  { role: 'Dessin des pièces', names: ['Colin M. L. Burnett (cburnett)'] },
  { role: 'Règles du jeu', names: ['chess.js, par Jeff Hlywa'] },
  { role: 'Problèmes et Puzzle Rush', names: ['Base de problèmes ouverte de Lichess', 'et les millions de joueurs qui les ont résolus'] },
  { role: 'Noms des ouvertures', names: ['lichess-org/chess-openings'] },
  { role: 'Interface', names: ['React', 'Vite', 'TypeScript'] },
  { role: 'Serveur', names: ['Node.js', 'Express', 'PostgreSQL', 'Nodemailer'] },
  { role: 'Hébergement', names: ['Oracle Cloud', 'Caddy et Let’s Encrypt', 'DuckDNS'] },
  { role: 'Premiers joueurs', names: ['Toute la communauté BetterMove', 'qui a testé, signalé et proposé'] },
];

export function Credits({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onClose]);

  return (
    <div className="credits" role="dialog" aria-modal="true" aria-label="Crédits">
      <button className="credits-close" onClick={onClose} aria-label="Fermer les crédits">
        ✕
      </button>
      <div className="credits-window">
        <div className="credits-roll">
          <div className="credits-logo">
            <span aria-hidden>♞</span> Better<b>Move</b>
          </div>
          <p className="credits-tagline">Progresser aux échecs, à ton rythme, en t’amusant</p>
          {ROLES.map((r) => (
            <section key={r.role} className="credits-block">
              <h3>{r.role}</h3>
              {r.names.map((n) => (
                <p key={n}>{n}</p>
              ))}
            </section>
          ))}
          <section className="credits-block">
            <h3>Et surtout</h3>
            <p className="credits-you">Toi, qui joues</p>
          </section>
          <p className="credits-note">Aucun cavalier n’a été maltraité pendant le développement de cette application.</p>
          <p className="credits-note">BetterMove est un logiciel libre, sous licence GPL-3.0.</p>
          <div className="credits-end">Merci d’avoir joué ♟</div>
        </div>
      </div>
    </div>
  );
}
