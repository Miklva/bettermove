// Drapeaux dessines en SVG (Windows n'affiche pas les emojis drapeaux, seulement "FR", "GB"...)
import { useId } from 'react';

export type FlagCode = 'fr' | 'en' | 'es' | 'pt' | 'de' | 'ru';

/** Nom de la langue dans sa propre langue (infobulle des salons) */
export const LANG_NAMES: Record<FlagCode, string> = {
  fr: 'Français',
  en: 'English',
  es: 'Español',
  pt: 'Português',
  de: 'Deutsch',
  ru: 'Русский',
};

const Stripes = ({ colors, vertical = false, weights }: { colors: string[]; vertical?: boolean; weights?: number[] }) => {
  const w = weights ?? colors.map(() => 1);
  const total = w.reduce((a, b) => a + b, 0);
  let at = 0;
  return (
    <>
      {colors.map((c, i) => {
        const start = (at / total) * (vertical ? 30 : 20);
        at += w[i];
        const size = (w[i] / total) * (vertical ? 30 : 20);
        return vertical ? (
          <rect key={i} x={start} y={0} width={size + 0.05} height={20} fill={c} />
        ) : (
          <rect key={i} x={0} y={start} width={30} height={size + 0.05} fill={c} />
        );
      })}
    </>
  );
};

function UnionJack() {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <svg viewBox="0 0 60 30" width="100%" height="100%" preserveAspectRatio="none">
      <clipPath id={`uj-${id}`}>
        <path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z" />
      </clipPath>
      <rect width="60" height="30" fill="#012169" />
      <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
      <path d="M0,0 L60,30 M60,0 L0,30" clipPath={`url(#uj-${id})`} stroke="#C8102E" strokeWidth="4" />
      <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10" />
      <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6" />
    </svg>
  );
}

export function Flag({ code, size = 22 }: { code: FlagCode; size?: number }) {
  const h = Math.round((size * 2) / 3);
  return (
    <span className="flag" style={{ width: size, height: h }} aria-hidden>
      {code === 'en' ? (
        <UnionJack />
      ) : (
        <svg viewBox="0 0 30 20" width="100%" height="100%" preserveAspectRatio="none">
          {code === 'fr' && <Stripes vertical colors={['#0055A4', '#FFFFFF', '#EF4135']} />}
          {code === 'de' && <Stripes colors={['#000000', '#DD0000', '#FFCE00']} />}
          {code === 'ru' && <Stripes colors={['#FFFFFF', '#0039A6', '#D52B1E']} />}
          {code === 'es' && <Stripes colors={['#AA151B', '#F1BF00', '#AA151B']} weights={[1, 2, 1]} />}
          {code === 'pt' && (
            <>
              <Stripes vertical colors={['#046A38', '#DA291C']} weights={[2, 3]} />
              <circle cx="12" cy="10" r="4.2" fill="#FFE900" />
              <circle cx="12" cy="10" r="2.6" fill="#DA291C" />
              <rect x="10.8" y="8.2" width="2.4" height="3" rx="0.6" fill="#fff" />
            </>
          )}
        </svg>
      )}
    </span>
  );
}
