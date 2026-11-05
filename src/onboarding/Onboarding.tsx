// Accueil d'un nouveau joueur (choix du niveau) et visite guidee de l'application.
import { useState } from 'react';
import { Modal } from '../components/Modal';
import { LEVELS, type Level } from './level';

export function LevelModal({
  change,
  onChoose,
  onClose,
  onAccount,
}: {
  /** Changement de niveau depuis le compte (et non premiere visite) */
  change?: boolean;
  onChoose: (l: Level) => void;
  onClose: () => void;
  onAccount?: () => void;
}) {
  const [picked, setPicked] = useState<Level | null>(null);
  return (
    <Modal title={change ? 'Changer mon niveau' : 'Quel est ton niveau ?'} onClose={onClose}>
      <div className="onboard">
        <p>
          {change
            ? 'Ton Elo contre les bots et en problèmes sera remis à la valeur de départ du niveau choisi. Tes parties, leçons et succès sont conservés.'
            : 'Pour t’adapter les bots, les problèmes et les cours, dis-nous où tu en es aux échecs.'}
        </p>
        <div className="level-grid">
          {LEVELS.map((l) => (
            <button key={l.id} className={`level-card ${picked === l.id ? 'selected' : ''}`} onClick={() => setPicked(l.id)}>
              <span className="level-icon">{l.icon}</span>
              <strong>{l.title}</strong>
              <span className="muted small">{l.desc}</span>
              <span className="level-elo small">
                Départ : {l.bots} contre les bots · {l.puzzles} en problèmes
              </span>
            </button>
          ))}
        </div>
        <button className="btn primary big wide" disabled={!picked} onClick={() => picked && onChoose(picked)}>
          {change ? 'Valider' : 'C’est parti'}
        </button>
        {!change && onAccount && (
          <button className="link-btn small muted center" onClick={onAccount}>
            J’ai déjà un compte BetterMove
          </button>
        )}
      </div>
    </Modal>
  );
}

/** Ecran affiche juste apres le choix du niveau */
export function WelcomeNext({
  level,
  onInitiation,
  onTour,
  onPlay,
  onClose,
}: {
  level: Level;
  onInitiation: () => void;
  onTour: () => void;
  onPlay: () => void;
  onClose: () => void;
}) {
  const l = LEVELS.find((x) => x.id === level)!;
  const novice = level === 'none' || level === 'beginner';
  return (
    <Modal title={`${l.icon} ${l.title}`} onClose={onClose}>
      <div className="onboard">
        <p>
          Ton Elo de départ : <b>{l.bots}</b> contre les bots et <b>{l.puzzles}</b> en problèmes. Il s’ajustera vite à tes
          résultats.
        </p>
        {novice ? (
          <p>
            On te conseille de commencer par le <b>parcours d’initiation</b> : comment bougent les pièces, le but du jeu et les bons
            réflexes. Il reste accessible à tout moment avec le bouton ❓ en haut à droite.
          </p>
        ) : (
          <p>Tu peux te lancer contre un bot, ou faire une visite rapide de l’application.</p>
        )}
        <div className="onboard-actions">
          {novice && (
            <button className="btn primary big" onClick={onInitiation}>
              🌱 Commencer l’initiation
            </button>
          )}
          <button className={`btn ${novice ? '' : 'primary big'}`} onClick={onPlay}>
            🤖 Jouer contre un bot
          </button>
          <button className="btn ghost" onClick={onTour}>
            🧭 Visite de l’application
          </button>
        </div>
      </div>
    </Modal>
  );
}

const SLIDES: { icon: string; title: string; text: string; items?: string[] }[] = [
  {
    icon: '♞',
    title: 'Bienvenue sur BetterMove',
    text: 'Tu joues, tu comprends tes erreurs, tu t’entraînes dessus. La barre du haut est rangée en 5 espaces, et chaque espace a ses sous-onglets juste en dessous. Chaque page a aussi son lien, à partager ou à mettre en favori.',
  },
  {
    icon: '♟️',
    title: 'Jouer',
    text: 'Tout ce qui se joue sur un échiquier.',
    items: [
      '🤖 Contre un bot : de 400 à 2700 Elo, des adversaires au caractère bien trempé, qui jouent et discutent comme des humains',
      '🌍 Contre le monde : un joueur BetterMove au hasard, de ton niveau, en partie classée (compte requis)',
      '👥 1v1 sur cet écran : deux joueurs, un seul appareil',
      '⚔️ Contre un ami : défis lancés depuis la Communauté, avec revanche en un clic',
      '⛶ En partie : plein écran, coups à l’avance (premoves) et chat avec émojis',
    ],
  },
  {
    icon: '🎓',
    title: 'Apprendre',
    text: 'Pour acquérir de nouvelles connaissances.',
    items: [
      '📚 Cours : initiation, tactiques, mats, finales, ouvertures (3 étoiles partout débloquent l’approfondissement)',
      '👨‍🏫 Contre le professeur : une vraie partie commentée coup par coup',
      '🧩 Problèmes : des milliers de positions à ton niveau, expliquées en cas d’erreur',
      '⚡ Puzzle Rush : un maximum de problèmes contre la montre',
      '📖 Répertoire : choisis tes ouvertures et révise-les jusqu’à les connaître par cœur',
    ],
  },
  {
    icon: '📈',
    title: 'Progresser',
    text: 'Pour mesurer tes progrès et apprendre de tes parties.',
    items: [
      '📜 Historique : toutes tes parties (bots, en ligne, chess.com, Lichess), statistiques et analyse Stockfish',
      '🎯 Suivi personnalisé : tes erreurs récurrentes, leur évolution, et des exercices tirés de tes parties',
      '💡 Astuces : les bons réflexes, mis en avant selon tes erreurs',
      '🏆 Succès : plus de 250 défis à débloquer, qui rapportent XP et pièces',
      '🎁 Niveaux : chaque niveau gagné offre une récompense, jusqu’à des skins animés exclusifs',
    ],
  },
  {
    icon: '💬',
    title: 'Communauté',
    text: 'Le salon de tous les joueurs et le classement. Clique sur un pseudo pour voir son profil, l’ajouter en ami, lui écrire en privé, le défier ou le mettre en sourdine. Un badge rouge signale tes messages, demandes et défis.',
  },
  {
    icon: '🛒',
    title: 'Boutique',
    text: 'Les parties, cours, succès et le suivi rapportent des pièces 🪙 (ton solde est en haut à droite). Dépense-les en skins de pièces, plateaux, packs de sons et émojis de chat. Bouton « Visualiser » pour essayer avant d’acheter, et remboursement possible pendant 24 h.',
  },
  {
    icon: '❓',
    title: 'Aide et compte',
    text: 'En haut à droite : le badge Niv. ouvre la route des récompenses ; ❓ pour revoir cette visite, le parcours d’initiation ou contacter le support ; ton avatar pour ton compte, ton profil et la sauvegarde ; ⚙️ pour les réglages (thème, sons, animations…).',
  },
];

export function TourModal({ onClose }: { onClose: () => void }) {
  const [i, setI] = useState(0);
  const s = SLIDES[i];
  const last = i === SLIDES.length - 1;
  return (
    <Modal title="Visite de l’application" onClose={onClose}>
      <div className="tour">
        <div className="tour-icon">{s.icon}</div>
        <h3>{s.title}</h3>
        <p>{s.text}</p>
        {s.items && (
          <ul className="tour-items">
            {s.items.map((it) => (
              <li key={it}>{it}</li>
            ))}
          </ul>
        )}
        <div className="tour-dots">
          {SLIDES.map((_, k) => (
            <button key={k} className={k === i ? 'on' : ''} onClick={() => setI(k)} aria-label={`Étape ${k + 1}`} />
          ))}
        </div>
        <div className="row tour-nav">
          <button className="btn ghost" disabled={i === 0} onClick={() => setI(i - 1)}>
            ← Précédent
          </button>
          <button className="btn primary" onClick={() => (last ? onClose() : setI(i + 1))}>
            {last ? 'Terminer' : 'Suivant →'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ---------------- Bienvenue (premiere visite) ---------------- */

const WELCOME_KEY = 'bettermove.welcomeSeen';
export const welcomeSeen = () => {
  try {
    return localStorage.getItem(WELCOME_KEY) === '1';
  } catch {
    return true;
  }
};
export const markWelcomeSeen = () => {
  try {
    localStorage.setItem(WELCOME_KEY, '1');
  } catch {
    /* navigation privee : tant pis */
  }
};

export function WelcomeModal({ onStart, onFeedback }: { onStart: () => void; onFeedback: () => void }) {
  return (
    <Modal title="Bienvenue sur BetterMove ♞" onClose={onStart}>
      <div className="onboard welcome">
        <p className="welcome-lead">Ici, un seul objectif : te faire progresser aux échecs, à ton rythme, en t’amusant.</p>
        <div className="welcome-points">
          <div className="welcome-point">
            <span className="welcome-icon">📈</span>
            <div>
              <strong>Progresser pour de vrai</strong>
              <p className="muted">
                Des cours, des problèmes et des bots à ton niveau. L’app repère tes erreurs dans tes parties et t’aide à les
                corriger.
              </p>
            </div>
          </div>
          <div className="welcome-point">
            <span className="welcome-icon">🤝</span>
            <div>
              <strong>Par la communauté, pour la communauté</strong>
              <p className="muted">
                BetterMove est un projet indépendant qui grandit avec ses joueurs. Discute, entraîne-toi et défie les autres dans
                l’onglet Communauté.
              </p>
            </div>
          </div>
          <div className="welcome-point">
            <span className="welcome-icon">💬</span>
            <div>
              <strong>Ta voix compte</strong>
              <p className="muted">
                Une idée, un bug, une remarque ? Écris-nous via ❓ › Contacter le support. Chaque message est lu, et ce sont les
                retours des joueurs qui décident des prochaines nouveautés.
              </p>
            </div>
          </div>
        </div>
        <div className="row welcome-actions">
          <button className="btn primary big" onClick={onStart}>
            Continuer
          </button>
          <button className="btn ghost" onClick={onFeedback}>
            Donner mon avis
          </button>
        </div>
      </div>
    </Modal>
  );
}
