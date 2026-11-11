// Recompenses de niveau : le chemin des cadeaux, de plus en plus rares
import { useState } from 'react';
import { levelFromXp } from '../rating/xp';
import type { PlayerProfile } from '../rating/profile';
import { ACHIEVEMENTS } from '../achievements/list';
import type { Unlocked } from '../achievements/store';
import { itemById, type ShopItem } from '../shop/items';
import { equip, owns, useShop } from '../shop/store';
import { useSettings } from '../settings/settings';
import { previewSound, sounds } from '../lib/sounds';
import { Emote, emotesOfPack } from '../emotes/emotes';
import { BoardPreview, PiecesPreview } from './ShopPage';
import { claimLevel, LEVEL_REWARDS, pendingLevels, RARITY_LABEL, rarityOf, REWARD_LEVELS, useClaimed, type Reward } from '../rewards/levels';

import { t, tmap } from '../i18n';
interface Props {
  player: PlayerProfile;
  unlocked: Unlocked;
}

const xpFor = (level: number) => 50 * level * (level - 1);
const TYPE_LABEL: Record<ShopItem['type'], string> = tmap({ pieces: 'Skin de pièces', board: 'Plateau', sounds: 'Pack de sons', emotes: 'Emojis de chat' });

export function LevelsPage({ player, unlocked }: Props) {
  const xp = player.profile.xp;
  const lv = levelFromXp(xp);
  const claimed = new Set(useClaimed());
  useShop();
  const pending = pendingLevels(lv.level);
  const [flash, setFlash] = useState<number[]>([]);
  const next = REWARD_LEVELS.find((l) => l > lv.level);

  const claim = (levels: number[]) => {
    const got = levels.filter((l) => claimLevel(l, lv.level));
    if (!got.length) return;
    sounds.success();
    setFlash(got);
    window.setTimeout(() => setFlash([]), 1600);
  };

  return (
    <div className="levels">
      <div className="card levels-hero">
        <div className="lv-badge big">
          <small>{t("Niveau")}</small>
          <strong>{lv.level}</strong>
        </div>
        <div className="levels-hero-main">
          <div className="lv-bar">
            <i style={{ width: `${Math.round(lv.progress * 100)}%` }} />
          </div>
          <p className="small">
            {t('{xp} XP · encore {left} XP pour le niveau {next}', { xp, left: lv.needed - lv.into, next: lv.level + 1 })}
          </p>
          {next && (
            <p className="muted small">{t('Prochain cadeau au niveau {n} ({rarity}), encore {left} XP.', { n: next, rarity: RARITY_LABEL[rarityOf(next)].toLowerCase(), left: xpFor(next) - xp })}</p>
          )}
          <p className="muted tiny">{t("L’XP se gagne partout : parties contre les bots et en ligne, quêtes du jour, coffre quotidien, problèmes, Rush, cours, professeur, review, Suivi. Au début chaque niveau rapporte quelque chose, puis les cadeaux deviennent rares… et exclusifs : ces skins ne s’achètent pas.")}</p>
        </div>
        {pending.length > 0 && (
          <button className="btn primary levels-claim-all" onClick={() => claim(pending)}>{t('🎁 Tout récupérer ({n})', { n: pending.length })}
          </button>
        )}
      </div>

      <div className="lv-track">
        {REWARD_LEVELS.map((level) => {
          const reached = lv.level >= level;
          const onlyAch = LEVEL_REWARDS[level].every((r) => r.kind === 'ach');
          const isClaimed = claimed.has(level) || (reached && onlyAch);
          const rar = rarityOf(level);
          return (
            <div
              key={level}
              className={`card lv-row r-${rar} ${reached ? (isClaimed ? 'claimed' : 'ready') : 'locked'} ${flash.includes(level) ? 'flash' : ''}`}
            >
              <div className="lv-badge">
                <small>{t("Niv.")}</small>
                <strong>{level}</strong>
              </div>
              <div className="lv-rewards">
                <span className={`lv-rarity r-${rar}`}>{RARITY_LABEL[rar]}</span>
                <div className="lv-items">
                  {LEVEL_REWARDS[level].map((r, k) => (
                    <RewardChip key={k} r={r} unlocked={unlocked} claimed={isClaimed} />
                  ))}
                </div>
              </div>
              <div className="lv-action">
                {!reached ? (
                  <span className="muted small">🔒 {xpFor(level) - xp}{" "}{t("XP")}</span>
                ) : isClaimed ? (
                  <span className="equipped-tag">{t("✔ Récupéré")}</span>
                ) : (
                  <button className="btn primary" onClick={() => claim([level])}>{t("Récupérer")}</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RewardChip({ r, unlocked, claimed }: { r: Reward; unlocked: Unlocked; claimed: boolean }) {
  const shop = useShop();
  const { settings, update } = useSettings();
  if (r.kind === 'coins')
    return (
      <div className="lv-item coins">
        <span className="lv-coin">🪙</span>
        <div>
          <strong>{r.amount}</strong>
          <span className="muted tiny">{t("pièces")}</span>
        </div>
      </div>
    );
  if (r.kind === 'ach') {
    const a = ACHIEVEMENTS.find((x) => x.id === r.id);
    if (!a) return null;
    return (
      <div className={`lv-item ach ${unlocked[a.id] ? 'done' : ''}`} title={a.desc}>
        <span className="lv-ach-icon">{a.icon}</span>
        <div>
          <strong>{a.title}</strong>
          <span className="muted tiny">{unlocked[a.id] ? t('Succès débloqué') : t('Succès au palier')}</span>
        </div>
      </div>
    );
  }
  const it = itemById(r.id);
  if (!it) return null;
  const equipped =
    it.type === 'pieces'
      ? shop.equipped.pieces === it.id
      : it.type === 'sounds'
        ? shop.equipped.sounds === it.id
        : it.type === 'board'
          ? settings.boardTheme === it.id.replace('board-', '')
          : false;
  return (
    <div className="lv-item item">
      <div className="lv-preview">
        {it.type === 'pieces' && <PiecesPreview id={it.id} />}
        {it.type === 'board' && <BoardPreview light={it.light!} dark={it.dark!} texture={it.texture} />}
        {it.type === 'emotes' && (
          <div className="emote-preview">
            {emotesOfPack(it.id)
              .slice(0, 4)
              .map((e) => (
                <Emote key={e.id} def={e} size={26} />
              ))}
          </div>
        )}
        {it.type === 'sounds' && (
          <button className="btn small-btn" onClick={() => previewSound(it.id, 'cap-q')} title={t("Écouter")}>{t("▶ Écouter")}</button>
        )}
      </div>
      <div className="lv-item-text">
        <strong>{it.name}</strong>
        <span className="muted tiny">{TYPE_LABEL[it.type]}{" "}{t("exclusif")}</span>
        {claimed && owns(it.id) && it.type !== 'emotes' && (
          <button
            className="btn small-btn"
            disabled={equipped}
            onClick={() => (it.type === 'board' ? update({ boardTheme: it.id.replace('board-', '') }) : equip(it.type as 'pieces' | 'sounds', it.id))}
          >
            {equipped ? t("✔ Équipé") : t("Équiper")}
          </button>
        )}
      </div>
    </div>
  );
}
