import { useState, type ReactNode } from 'react';
import { Modal } from '../components/Modal';
import { BOARD_THEMES } from '../themes/boards';
import { BoardPreview } from '../pages/ShopPage';
import { owns, useShop } from '../shop/store';
import { sounds } from '../lib/sounds';
import { useSettings, type AnimFps, type AnimationSpeed, type Appearance } from './settings';

import { LANGS, lang, t } from '../i18n';
import { switchLanguage } from '../router';
interface Props {
  onClose: () => void;
  onResetRating: () => void;
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="setting-row">
      <span>
        <span className="setting-label">{label}</span>
        {hint && <small className="muted">{hint}</small>}
      </span>
      <input type="checkbox" className="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="setting-section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

const APPEARANCES: [Appearance, string][] = [
  ['dark', 'Sombre'],
  ['light', 'Clair'],
  ['system', 'Système'],
];

const FPS: [AnimFps, string, string][] = [
  ['max', 'Fluide', '60 images par seconde'],
  ['mid', 'Équilibrée', 'environ 20 images par seconde'],
  ['low', 'Économie', 'environ 8 images par seconde, le plus léger'],
];

const SPEEDS: [AnimationSpeed, string][] = [
  ['none', 'Aucune'],
  ['fast', 'Rapide'],
  ['normal', 'Normale'],
  ['slow', 'Lente'],
];

export function SettingsModal({ onClose, onResetRating }: Props) {
  const { settings: s, update, reset } = useSettings();
  const [confirmReset, setConfirmReset] = useState(false);
  // Re-rendu quand un objet est achete
  const shop = useShop();

  return (
    <Modal title={t("Paramètres")} onClose={onClose}>
      <div className="settings">
        <Section title={t("🌍 Langue")}>
          <div className="chips lang-chips">
            {LANGS.map((l) => (
              <button key={l.id} className={`chip ${lang() === l.id ? 'selected' : ''}`} onClick={() => l.id !== lang() && switchLanguage(l.id)}>
                {l.flag} {l.label}
              </button>
            ))}
          </div>
        </Section>
        <Section title={t("Apparence")}>
          <div className="setting-row">
            <span className="setting-label">{t("Thème de l'app")}</span>
            <div className="chips">
              {APPEARANCES.map(([id, label]) => (
                <button
                  key={id}
                  className={`chip ${s.appearance === id ? 'selected' : ''}`}
                  onClick={() => update({ appearance: id })}
                >
                  {t(label)}
                </button>
              ))}
            </div>
          </div>
        </Section>

        <Section title={t("Plateau")}>
          <div className="swatches">
            {BOARD_THEMES.filter((t) => !t.itemId || owns(t.itemId)).map((t) => (
              <button
                key={t.id}
                className={`swatch ${t.id === s.boardTheme ? 'selected' : ''}`}
                onClick={() => update({ boardTheme: t.id })}
                title={t.name}
              >
                <BoardPreview light={t.light} dark={t.dark} texture={t.texture} />
                <em>{t.name}</em>
              </button>
            ))}
            {shop && BOARD_THEMES.some((t) => t.itemId && !owns(t.itemId)) && (
              <p className="muted small">{t("D’autres plateaux, pièces et sons sont dans la Boutique 🛒.")}</p>
            )}
          </div>
          <Toggle label={t("Coordonnées")} checked={s.coordinates} onChange={(v) => update({ coordinates: v })} />
          <Toggle label={t("Afficher les coups possibles")} checked={s.showDests} onChange={(v) => update({ showDests: v })} />
          <Toggle
            label={t("Surligner le dernier coup")}
            checked={s.highlightLastMove}
            onChange={(v) => update({ highlightLastMove: v })}
          />
          <Toggle
            label={t("Skins animés")}
            hint={t("Paillettes et couleurs qui bougent sur les pièces et plateaux animés. Coupe-les si l'app rame sur ton appareil.")}
            checked={s.cosmeticAnim}
            onChange={(v) => update({ cosmeticAnim: v })}
          />
          {s.cosmeticAnim && (
            <div className="setting-row setting-stack">
              <span>
                <span className="setting-label">{t("Fréquence des animations")}</span>
                <small className="muted">{t("Moins d’images par seconde = moins de calcul. Choisis Économie si ça rame.")}</small>
              </span>
              <div className="chips">
                {FPS.map(([id, label, hint]) => (
                  <button key={id} title={t(hint)} className={`chip ${(s.animFps ?? 'max') === id ? 'selected' : ''}`} onClick={() => update({ animFps: id })}>
                    {t(label)}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="setting-row">
            <span className="setting-label">{t("Animation des pièces")}</span>
            <div className="chips">
              {SPEEDS.map(([id, label]) => (
                <button
                  key={id}
                  className={`chip ${s.animation === id ? 'selected' : ''}`}
                  onClick={() => update({ animation: id })}
                >
                  {t(label)}
                </button>
              ))}
            </div>
          </div>
        </Section>

        <Section title={t("Jeu")}>
          <div className="setting-row">
            <span>
              <span className="setting-label">{t("Notation des coups")}</span>
              <small className="muted">{t("Française : R D T F C (Cf3). Anglaise : K Q R B N (Nf3), comme sur chess.com.")}</small>
            </span>
            <div className="chips">
              {(
                [
                  ['fr', t("Française")],
                  ['en', t("Anglaise")],
                ] as const
              ).map(([id, label]) => (
                <button key={id} className={`chip ${s.notation === id ? 'selected' : ''}`} onClick={() => update({ notation: id })}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <Toggle
            label={t("Coups en avance")}
            hint={t("Contre les bots et en ligne : prépare un ou plusieurs coups pendant que l'adversaire réfléchit, ils partent un par un dès que c'est ton tour (s'ils sont toujours légaux). Clic droit pour tout annuler.")}
            checked={s.premoves}
            onChange={(v) => update({ premoves: v })}
          />
          <Toggle
            label={t("Promotion automatique en dame")}
            hint={t("Sinon, une fenêtre te laisse choisir la pièce.")}
            checked={s.autoQueen}
            onChange={(v) => update({ autoQueen: v })}
          />
          <Toggle
            label={t("Confirmer avant d'abandonner")}
            checked={s.confirmResign}
            onChange={(v) => update({ confirmResign: v })}
          />
        </Section>

        <Section title={t("Son")}>
          <Toggle label={t("Sons du jeu")} checked={s.sound} onChange={(v) => update({ sound: v })} />
          <div className="setting-row">
            <span className="setting-label">{t("Volume")}</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={s.volume}
              disabled={!s.sound}
              onChange={(e) => update({ volume: Number(e.target.value) })}
              onPointerUp={() => sounds.move()}
            />
          </div>
        </Section>

        <Section title={t("Données")}>
          <div className="setting-row">
            <span>
              <span className="setting-label">{t("Réinitialiser mes classements")}</span>
              <small className="muted">{t("Remet tes classements (bots et problèmes) à zéro et efface l'historique.")}</small>
            </span>
            {confirmReset ? (
              <span className="row tight">
                <button className="btn" onClick={() => setConfirmReset(false)}>{t("Non")}</button>
                <button
                  className="btn danger"
                  onClick={() => {
                    onResetRating();
                    setConfirmReset(false);
                  }}
                >{t("Oui")}</button>
              </span>
            ) : (
              <button className="btn danger" onClick={() => setConfirmReset(true)}>{t("Réinitialiser")}</button>
            )}
          </div>
          <button className="btn ghost wide" onClick={reset}>{t("Remettre les paramètres par défaut")}</button>
        </Section>
      </div>
    </Modal>
  );
}
