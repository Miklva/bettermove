import type { TimeControl } from './types';

export const TIME_CONTROLS: TimeControl[] = [
  { id: '1+0', label: '1 min', category: 'Bullet', initial: 60, increment: 0 },
  { id: '2+1', label: '2 | 1', category: 'Bullet', initial: 120, increment: 1 },
  { id: '3+0', label: '3 min', category: 'Blitz', initial: 180, increment: 0 },
  { id: '3+2', label: '3 | 2', category: 'Blitz', initial: 180, increment: 2 },
  { id: '5+0', label: '5 min', category: 'Blitz', initial: 300, increment: 0 },
  { id: '10+0', label: '10 min', category: 'Rapide', initial: 600, increment: 0 },
  { id: '15+10', label: '15 | 10', category: 'Rapide', initial: 900, increment: 10 },
  { id: '30+0', label: '30 min', category: 'Classique', initial: 1800, increment: 0 },
  { id: 'none', label: 'Sans pendule', category: 'Libre', initial: null, increment: 0 },
];

export const DEFAULT_TIME_CONTROL = TIME_CONTROLS.find((t) => t.id === '10+0')!;

export function formatClock(ms: number): string {
  const clamped = Math.max(0, ms);
  const totalSec = Math.floor(clamped / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  if (clamped < 10_000) {
    const tenths = Math.floor((clamped % 1000) / 100);
    return `${m}:${String(s).padStart(2, '0')}.${tenths}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}
