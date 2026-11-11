import { useState } from 'react';
import type { GameSettings, TimeControl } from '../game/types';
import { TIME_CONTROLS } from '../game/timeControls';
import { Modal } from './Modal';

import { t } from '../i18n';
interface Props {
  initial: GameSettings;
  onStart: (s: GameSettings) => void;
  onClose?: () => void;
}

const CATEGORIES: TimeControl['category'][] = ['Bullet', 'Blitz', 'Rapide', 'Classique', 'Libre'];

export function NewGameModal({ initial, onStart, onClose }: Props) {
  const [s, setS] = useState<GameSettings>(initial);

  return (
    <Modal title={t("Nouvelle partie 1v1")} onClose={onClose}>
      <p className="muted">{t("Deux joueurs sur le même écran.")}</p>

      <div className="names">
        <label>
          <span className="label">{t("Blancs")}</span>
          <input value={s.whiteName} maxLength={20} onChange={(e) => setS({ ...s, whiteName: e.target.value })} />
        </label>
        <button
          className="icon-btn swap"
          title={t("Échanger les couleurs")}
          onClick={() => setS({ ...s, whiteName: s.blackName, blackName: s.whiteName })}
        >
          ⇄
        </button>
        <label>
          <span className="label">{t("Noirs")}</span>
          <input value={s.blackName} maxLength={20} onChange={(e) => setS({ ...s, blackName: e.target.value })} />
        </label>
      </div>

      <span className="label">{t("Cadence")}</span>
      <div className="tc-grid">
        {CATEGORIES.map((cat) =>
          TIME_CONTROLS.filter((x) => x.category === cat).map((tc) => (
            <button
              key={tc.id}
              className={`tc ${s.timeControl.id === tc.id ? 'selected' : ''}`}
              onClick={() => setS({ ...s, timeControl: tc })}
            >
              <strong>{tc.label}</strong>
              <small>{t(tc.category)}</small>
            </button>
          )),
        )}
      </div>

      <label className="toggle">
        <input type="checkbox" checked={s.autoFlip} onChange={(e) => setS({ ...s, autoFlip: e.target.checked })} />
        <span>{t("Retourner le plateau à chaque coup")}</span>
      </label>

      <button
        className="btn primary big"
        onClick={() =>
          onStart({
            ...s,
            whiteName: s.whiteName.trim() || 'Blancs',
            blackName: s.blackName.trim() || 'Noirs',
          })
        }
      >{t("Lancer la partie")}</button>
      {onClose && (
        <button className="btn ghost modal-cancel" onClick={onClose}>{t("Annuler")}</button>
      )}
    </Modal>
  );
}
