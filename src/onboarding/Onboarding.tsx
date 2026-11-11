// Accueil d'un nouveau joueur (choix du niveau) et visite guidee de l'application.
import { useState } from 'react';
import { Modal } from '../components/Modal';
import { LEVELS, type Level } from './level';

import { t } from '../i18n';
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
    <Modal title={change ? t("Changer mon niveau") : t("Quel est ton niveau ?")} onClose={onClose}>
      <div className="onboard">
        <p>
          {change
            ? t("Ton Elo contre les bots et en problèmes sera remis à la valeur de départ du niveau choisi. Tes parties, leçons et succès sont conservés.")
            : t("Pour t’adapter les bots, les problèmes et les cours, dis-nous où tu en es aux échecs.")}
        </p>
        <div className="level-grid">
          {LEVELS.map((l) => (
            <button key={l.id} className={`level-card ${picked === l.id ? 'selected' : ''}`} onClick={() => setPicked(l.id)}>
              <span className="level-icon">{l.icon}</span>
              <strong>{t(l.title)}</strong>
              <span className="muted small">{t(l.desc)}</span>
              <span className="level-elo small">{t("Départ : {bots} contre les bots · {puzzles} en problèmes", { bots: l.bots, puzzles: l.puzzles })}</span>
            </button>
          ))}
        </div>
        <button className="btn primary big wide" disabled={!picked} onClick={() => picked && onChoose(picked)}>
          {change ? t("Valider") : t("C’est parti")}
        </button>
        {!change && onAccount && (
          <button className="link-btn small muted center" onClick={onAccount}>{t("J’ai déjà un compte BetterMove")}</button>
        )}
      </div>
    </Modal>
  );
}

/** Ecran affiche juste apres le choix du niveau : on propose la visite guidee */
export function WelcomeNext({ level, onTour, onClose }: { level: Level; onTour: () => void; onClose: () => void }) {
  const l = LEVELS.find((x) => x.id === level)!;
  return (
    <Modal title={`${l.icon} ${t(l.title)}`} onClose={onClose}>
      <div className="onboard">
        <p>{t("C’est noté ! Ton Elo de départ : {bots} contre les bots et {puzzles} en problèmes. Il s’ajustera vite à tes résultats.", { bots: l.bots, puzzles: l.puzzles })}</p>
        <p>{t("Je te fais faire le tour de l’application en une minute, et on finira par les cours pour bien démarrer.")}</p>
        <div className="onboard-actions">
          <button className="btn primary big" onClick={onTour}>{t("🧭 Visiter l’application")}</button>
          <button className="link-btn small muted center" onClick={onClose}>{t("Passer, j’explore seul")}</button>
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

export function WelcomeModal({ onStart }: { onStart: () => void }) {
  return (
    <Modal title={t("Bienvenue sur BetterMove ♞")} onClose={onStart}>
      <div className="onboard welcome">
        <p className="welcome-lead">{t("Ici, un seul objectif : te faire progresser aux échecs, à ton rythme, en t’amusant.")}</p>
        <div className="welcome-points">
          <div className="welcome-point">
            <span className="welcome-icon">📈</span>
            <div>
              <strong>{t("Progresser pour de vrai")}</strong>
              <p className="muted">{t("Des cours, des problèmes et des bots à ton niveau. L’app repère tes erreurs dans tes parties et t’aide à les corriger.")}</p>
            </div>
          </div>
          <div className="welcome-point">
            <span className="welcome-icon">🤝</span>
            <div>
              <strong>{t("Par la communauté, pour la communauté")}</strong>
              <p className="muted">{t("BetterMove est un projet indépendant qui grandit avec ses joueurs. Discute, entraîne-toi et défie les autres dans l’onglet Communauté.")}</p>
            </div>
          </div>
        </div>
        <div className="row welcome-actions">
          <button className="btn primary big" onClick={onStart}>{t("Continuer")}</button>
        </div>
      </div>
    </Modal>
  );
}
