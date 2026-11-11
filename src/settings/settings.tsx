import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { lang } from '../i18n';
import { load, save } from '../lib/storage';
import { setSoundEnabled, setVolume } from '../lib/sounds';
import { BOARD_THEMES, DEFAULT_BOARD_THEME, type BoardTheme } from '../themes/boards';
import { owns } from '../shop/store';
import { mark, track } from '../achievements/events';

export type AnimationSpeed = 'none' | 'fast' | 'normal' | 'slow';
export type AnimFps = 'max' | 'mid' | 'low';
export type Appearance = 'dark' | 'light' | 'system';

export interface Settings {
  appearance: Appearance;
  /** Notation des coups : francaise (Cf3) ou anglaise (Nf3) */
  notation: 'fr' | 'en';
  boardTheme: string;
  coordinates: boolean;
  showDests: boolean;
  highlightLastMove: boolean;
  animation: AnimationSpeed;
  /** Coups joues a l'avance pendant que l'adversaire reflechit */
  premoves: boolean;
  /** Promotion directe en dame, sans fenetre de choix */
  autoQueen: boolean;
  confirmResign: boolean;
  /** Skins et plateaux animes (paillettes, couleurs qui bougent) */
  cosmeticAnim: boolean;
  /** Frequence des animations des skins : fluide, equilibree, economie */
  animFps: AnimFps;
  sound: boolean;
  /** Volume de 0 a 1 */
  volume: number;
}

export const DEFAULT_SETTINGS: Settings = {
  appearance: 'dark',
  // Notation francaise (C, F, T, D, R) seulement pour le site en francais
  notation: lang() === 'fr' ? 'fr' : 'en',
  boardTheme: DEFAULT_BOARD_THEME.id,
  coordinates: true,
  showDests: true,
  highlightLastMove: true,
  animation: 'normal',
  premoves: true,
  autoQueen: false,
  confirmResign: true,
  cosmeticAnim: true,
  animFps: 'max',
  sound: true,
  volume: 0.8,
};

export const ANIMATION_MS: Record<AnimationSpeed, number> = { none: 0, fast: 100, normal: 180, slow: 320 };

const KEY = 'bettermove.settings.v1';

interface Ctx {
  settings: Settings;
  theme: BoardTheme;
  update: (patch: Partial<Settings>) => void;
  reset: () => void;
}

const SettingsContext = createContext<Ctx | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => {
    // Reprise des anciens reglages (theme et son) s'ils existent
    const legacy: Partial<Settings> = {
      boardTheme: load('bettermove.boardTheme', DEFAULT_SETTINGS.boardTheme),
      sound: load('bettermove.sound', DEFAULT_SETTINGS.sound),
    };
    return { ...DEFAULT_SETTINGS, ...legacy, ...load<Partial<Settings>>(KEY, {}) };
  });

  useEffect(() => {
    save(KEY, settings);
    setSoundEnabled(settings.sound);
    setVolume(settings.volume);
  }, [settings]);

  // Skins animes : en pause partout si le joueur les coupe
  useEffect(() => {
    const root = document.documentElement.classList;
    root.toggle('no-cosmetic-anim', !settings.cosmeticAnim);
    root.toggle('anim-fps-mid', settings.cosmeticAnim && settings.animFps === 'mid');
    root.toggle('anim-fps-low', settings.cosmeticAnim && settings.animFps === 'low');
  }, [settings.cosmeticAnim, settings.animFps]);

  // Mode clair / sombre (ou celui du systeme)
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: light)');
    const apply = () => {
      const light = settings.appearance === 'light' || (settings.appearance === 'system' && media.matches);
      document.documentElement.dataset.theme = light ? 'light' : 'dark';
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', light ? '#f3f4f7' : '#15171c');
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [settings.appearance]);

  const theme =
    BOARD_THEMES.find((t) => t.id === settings.boardTheme && (!t.itemId || owns(t.itemId))) ?? DEFAULT_BOARD_THEME;

  return (
    <SettingsContext.Provider
      value={{
        settings,
        theme,
        update: (patch) => {
          if (patch.boardTheme) track('board-change');
          if (patch.appearance) mark(`theme-${patch.appearance}`);
          if (patch.cosmeticAnim === false) mark('anim-off');
          setSettings((s) => ({ ...s, ...patch }));
        },
        reset: () => setSettings(DEFAULT_SETTINGS),
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): Ctx {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings doit etre utilise dans SettingsProvider');
  return ctx;
}
