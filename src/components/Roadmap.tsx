// Menu Aide > Prochainement : ce qui est prevu pour la suite de l'application.
import { Modal } from './Modal';

const PLAN: { when: string; items: { icon: string; title: string; text: string }[] }[] = [
  {
    when: 'Bientôt',
    items: [
      { icon: '🌍', title: 'Plusieurs langues', text: 'BetterMove en anglais, en espagnol et dans d’autres langues, pour jouer avec le monde entier.' },
      { icon: '📱', title: 'Application installable', text: 'Ajouter BetterMove à l’écran d’accueil du téléphone et recevoir une notification quand un ami te défie.' },
      { icon: '🏆', title: 'Tournois hebdomadaires', text: 'Un tournoi en ligne chaque semaine, avec un classement et des skins à gagner.' },
    ],
  },
  {
    when: 'Plus tard',
    items: [
      { icon: '⚪', title: 'Les dames et d’autres jeux', text: 'Les mêmes outils pour apprendre et progresser : cours, problèmes, bots et parties en ligne.' },
      { icon: '✉️', title: 'Parties par correspondance', text: 'Un coup par jour avec tes amis, à ton rythme, sans pendule.' },
      { icon: '🏫', title: 'Clubs et classes', text: 'Un espace pour les clubs d’échecs et les profs : groupes d’élèves, devoirs et suivi des progrès.' },
      { icon: '🎲', title: 'Échecs aléatoires (Chess960)', text: 'Les pièces mélangées au départ : plus d’ouvertures à réciter, que de la réflexion.' },
    ],
  },
  {
    when: 'Un jour, peut-être',
    items: [
      { icon: '🎸', title: 'Au-delà des jeux', text: 'Et si la même méthode servait à apprendre autre chose, comme un instrument de musique ?' },
    ],
  },
];

export function RoadmapModal({ onClose, onIdea }: { onClose: () => void; onIdea: () => void }) {
  return (
    <Modal title="🔮 Prochainement" onClose={onClose}>
      <div className="roadmap">
        <p className="muted">Ce qu’on prépare pour la suite. Rien n’est figé : l’ordre dépend surtout de vos retours.</p>
        {PLAN.map((g) => (
          <section key={g.when}>
            <h3 className="roadmap-when">{g.when}</h3>
            <ul className="roadmap-list">
              {g.items.map((it) => (
                <li key={it.title}>
                  <span className="roadmap-icon">{it.icon}</span>
                  <div>
                    <strong>{it.title}</strong>
                    <p className="muted small">{it.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <button className="btn primary wide" onClick={onIdea}>
          💡 Proposer une idée
        </button>
      </div>
    </Modal>
  );
}
