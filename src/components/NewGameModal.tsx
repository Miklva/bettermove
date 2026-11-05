import { useState } from 'react';
import type { GameSettings, TimeControl } from '../game/types';
import { TIME_CONTROLS } from '../game/timeControls';
import { Modal } from './Modal';

interface Props {
  initial: GameSettings;
  onStart: (s: GameSettings) => void;
  onClose?: () => void;
}

const CATEGORIES: TimeControl['category'][] = ['Bullet', 'Blitz', 'Rapide', 'Classique', 'Libre'];

export function NewGameModal({ initial, onStart, onClose }: Props) {
  const [s, setS] = useState<GameSettings>(initial);

  return (
    <Modal title="Nouvelle partie 1v1" onClose={onClose}>
      <p className="muted">Deux joueurs sur le même écran.</p>

      <div className="names">
        <label>
          <span className="label">Blancs</span>
          <input value={s.whiteName} maxLength={20} onChange={(e) => setS({ ...s, whiteName: e.target.value })} />
        </label>
        <button
          className="icon-btn swap"
          title="Échanger les couleurs"
          onClick={() => setS({ ...s, whiteName: s.blackName, blackName: s.whiteName })}
        >
          ⇄
        </button>
        <label>
          <span className="label">Noirs</span>
          <input value={s.blackName} maxLength={20} onChange={(e) => setS({ ...s, blackName: e.target.value })} />
        </label>
      </div>

      <span className="label">Cadence</span>
      <div className="tc-grid">
        {CATEGORIES.map((cat) =>
          TIME_CONTROLS.filter((t) => t.category === cat).map((t) => (
            <button
              key={t.id}
              className={`tc ${s.timeControl.id === t.id ? 'selected' : ''}`}
              onClick={() => setS({ ...s, timeControl: t })}
            >
              <strong>{t.label}</strong>
              <small>{t.category}</small>
            </button>
          )),
        )}
      </div>

      <label className="toggle">
        <input type="checkbox" checked={s.autoFlip} onChange={(e) => setS({ ...s, autoFlip: e.target.checked })} />
        <span>Retourner le plateau à chaque coup</span>
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
      >
        Lancer la partie
      </button>
    </Modal>
  );
}
