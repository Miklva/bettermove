// Plein ecran pendant une partie : plus de bandeau, d'onglets ni de barre du navigateur,
// seulement le plateau, les pendules, les joueurs, les pieces prises, les coups et le chat.
import { useEffect, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { track } from '../achievements/events';

import { t } from '../i18n';
let on = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function apply(v: boolean) {
  on = v;
  document.body.classList.toggle('game-focus', v);
  emit();
}

export function enterFocus() {
  track('focus');
  apply(true);
  window.scrollTo(0, 0);
  // Vrai plein ecran (cache aussi les onglets du navigateur) quand le navigateur le permet
  const el = document.documentElement;
  if (!document.fullscreenElement && el.requestFullscreen) el.requestFullscreen().catch(() => {});
}

export function exitFocus() {
  apply(false);
  if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
}

// Echap ou geste du navigateur : on quitte aussi le mode partie
document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement && on) apply(false);
});

export function useFocusMode() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => on,
  );
}

/** Bouton a placer dans une partie ; affiche aussi le bouton de sortie quand le mode est actif */
export function FocusButton() {
  const active = useFocusMode();
  // En quittant la partie (changement de page), on sort du plein ecran
  useEffect(() => () => exitFocus(), []);
  return (
    <>
      {!active && (
        <button className="btn focus-btn" onClick={enterFocus} title={t("Afficher seulement la partie, en plein écran")}>{t("⛶ Plein écran")}</button>
      )}
      {active &&
        createPortal(
          <button className="btn focus-exit" onClick={exitFocus} title={t("Quitter le plein écran (Échap)")}>
            ✕ <span className="focus-exit-label">{t("Quitter le plein écran")}</span>
          </button>,
          document.body,
        )}
    </>
  );
}
