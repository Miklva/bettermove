// Icones de la navigation : traits fins (lucide, licence ISC) a la place des emojis.
import type { ComponentType, SVGProps } from 'react';
export {
  Bot,
  Globe,
  Users,
  Swords,
  GraduationCap,
  BookOpen,
  Presentation,
  Puzzle,
  Zap,
  Library,
  TrendingUp,
  History,
  Target,
  Lightbulb,
  Trophy,
  Gift,
  MessageCircle,
  CalendarDays,
  Medal,
  ShoppingBag,
  Volume2,
  VolumeX,
  CircleHelp,
  Settings,
  Wrench,
  Menu,
  Coins,
  RotateCcw,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Compass,
  Info,
  Sprout,
  LifeBuoy,
  Sparkles,
  BookText,
  Clapperboard,
} from 'lucide-react';

export type IconType = ComponentType<{ size?: number; strokeWidth?: number; className?: string; 'aria-hidden'?: boolean }>;

/** Pion d'echecs, dessine dans le meme style que les icones lucide */
export function Pawn({ size = 24, strokeWidth = 2, ...rest }: SVGProps<SVGSVGElement> & { size?: number; strokeWidth?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      <circle cx="12" cy="6" r="3" />
      <path d="M9.5 10.5h5" />
      <path d="M10 10.5c0 3-1 5.5-2.5 7.5h9c-1.5-2-2.5-4.5-2.5-7.5" />
      <path d="M6 21h12" />
      <path d="M7.5 18h9" />
    </svg>
  );
}
