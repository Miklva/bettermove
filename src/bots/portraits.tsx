// Portraits des bots : bustes illustres en SVG, dessines a la main (aucune image externe).
// Chaque bot est decrit par quelques parametres (peau, cheveux, tenue, accessoires).
import type { ReactNode } from 'react';

type Hair = 'kid' | 'ponytail' | 'messy' | 'bob' | 'fade' | 'curly' | 'sidepart' | 'long' | 'bald' | 'updo';
type Outfit = 'hoodie' | 'sweater' | 'tee' | 'cardigan' | 'jacket' | 'blouse' | 'turtleneck' | 'leather' | 'tweed' | 'gown';
type Mouth = 'grin' | 'smile' | 'smirk' | 'calm' | 'open';
type Brows = 'up' | 'flat' | 'raised' | 'fierce';

interface Look {
  bg: [string, string];
  skin: string;
  hair: Hair;
  hairColor: string;
  outfit: Outfit;
  cloth: string;
  cloth2?: string;
  mouth: Mouth;
  brows: Brows;
  glasses?: 'round' | 'thin';
  beard?: 'short' | 'full';
  hat?: 'cap' | 'beanie' | 'crown';
  hatColor?: string;
  freckles?: boolean;
  blush?: boolean;
  earrings?: string;
  clip?: boolean;
  streak?: string;
  lashes?: boolean;
}

const LOOKS: Record<string, Look> = {
  pip: {
    bg: ['#ffe9a8', '#ffc857'],
    skin: '#f6d2b4',
    hair: 'kid',
    hairColor: '#e0a23a',
    outfit: 'hoodie',
    cloth: '#ff8a3d',
    cloth2: '#ffb27a',
    mouth: 'grin',
    brows: 'up',
    hat: 'cap',
    hatColor: '#3d8bff',
    freckles: true,
    blush: true,
  },
  lea: {
    bg: ['#d9f7d6', '#8fd694'],
    skin: '#e8b58f',
    hair: 'ponytail',
    hairColor: '#6b3f22',
    outfit: 'sweater',
    cloth: '#3fa36b',
    cloth2: '#2d7d51',
    mouth: 'smile',
    brows: 'up',
    clip: true,
    blush: true,
    lashes: true,
  },
  hugo: {
    bg: ['#ffd1d1', '#ff7b7b'],
    skin: '#d9a07a',
    hair: 'messy',
    hairColor: '#2b1d16',
    outfit: 'hoodie',
    cloth: '#2f2f3a',
    cloth2: '#4a4a5a',
    mouth: 'smirk',
    brows: 'fierce',
    hat: 'beanie',
    hatColor: '#d63b3b',
  },
  camille: {
    bg: ['#dbe8ff', '#8fb3f0'],
    skin: '#f3cfb3',
    hair: 'bob',
    hairColor: '#a4482a',
    outfit: 'cardigan',
    cloth: '#4a6fb5',
    cloth2: '#f4f1ea',
    mouth: 'calm',
    brows: 'flat',
    glasses: 'round',
    lashes: true,
  },
  malik: {
    bg: ['#efe0ff', '#b48ef0'],
    skin: '#7a4b2e',
    hair: 'fade',
    hairColor: '#17110d',
    outfit: 'jacket',
    cloth: '#f2b632',
    cloth2: '#2a2238',
    mouth: 'smirk',
    brows: 'raised',
    beard: 'short',
  },
  sofia: {
    bg: ['#ffe0ea', '#f2879f'],
    skin: '#c68d64',
    hair: 'curly',
    hairColor: '#1f1410',
    outfit: 'blouse',
    cloth: '#d6334f',
    cloth2: '#a3203a',
    mouth: 'smile',
    brows: 'flat',
    earrings: '#f2c94c',
    lashes: true,
  },
  theo: {
    bg: ['#dff6fb', '#86cfe0'],
    skin: '#f5dcc8',
    hair: 'sidepart',
    hairColor: '#e2c27a',
    outfit: 'turtleneck',
    cloth: '#7fb0d6',
    cloth2: '#5d8fb8',
    mouth: 'calm',
    brows: 'flat',
    glasses: 'thin',
  },
  ines: {
    bg: ['#ffe2cc', '#ff9a52'],
    skin: '#a8714c',
    hair: 'long',
    hairColor: '#24160f',
    outfit: 'leather',
    cloth: '#2a2626',
    cloth2: '#e8e1d9',
    mouth: 'smirk',
    brows: 'fierce',
    streak: '#ff7a2f',
    earrings: '#e9e9e9',
    lashes: true,
  },
  prof: {
    bg: ['#f3ead9', '#c9a978'],
    skin: '#efc9a8',
    hair: 'bald',
    hairColor: '#eceae6',
    outfit: 'tweed',
    cloth: '#8a5a3a',
    cloth2: '#b23a3a',
    mouth: 'smile',
    brows: 'raised',
    glasses: 'round',
    beard: 'full',
  },
  reine: {
    bg: ['#ffd7d7', '#c0233a'],
    skin: '#f7dccb',
    hair: 'updo',
    hairColor: '#b8261d',
    outfit: 'gown',
    cloth: '#9c1424',
    cloth2: '#e8b43a',
    mouth: 'calm',
    brows: 'raised',
    hat: 'crown',
    hatColor: '#f2c230',
    earrings: '#f2c230',
    lashes: true,
  },
};

// ---------------------------------------------------------------------------
// Calques

function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c + amt * 255)));
  const r = f(n >> 16);
  const g = f((n >> 8) & 255);
  const b = f(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function backHair(l: Look): ReactNode {
  const c = l.hairColor;
  switch (l.hair) {
    case 'long':
      return (
        <>
          <path d="M29 44 C26 18 74 18 71 44 L75 86 C64 92 36 92 25 86 Z" fill={c} />
          {l.streak && <path d="M66 34 C72 50 72 70 74 86 L69 87 C68 70 67 52 62 36 Z" fill={l.streak} />}
        </>
      );
    case 'bob':
      return <path d="M30 42 C28 18 72 18 70 42 L71 62 C65 66 60 64 58 60 L42 60 C40 64 35 66 29 62 Z" fill={c} />;
    case 'ponytail':
      return <path d="M64 28 C80 26 84 44 78 62 C76 52 72 44 66 40 Z" fill={c} />;
    case 'curly':
      return (
        <g fill={c}>
          {[
            [30, 30, 9],
            [70, 30, 9],
            [26, 44, 9],
            [74, 44, 9],
            [27, 57, 8],
            [73, 57, 8],
            [31, 67, 6],
            [69, 67, 6],
          ].map(([x, y, r], i) => (
            <circle key={i} cx={x} cy={y} r={r} />
          ))}
        </g>
      );
    case 'updo':
      return <circle cx="50" cy="19" r="10" fill={c} />;
    default:
      return null;
  }
}

function torso(l: Look): ReactNode {
  const body = 'M6 100 C8 82 26 73 50 73 C74 73 92 82 94 100 Z';
  const c = l.cloth;
  const c2 = l.cloth2 ?? shade(c, -0.15);
  const dark = shade(c, -0.18);
  switch (l.outfit) {
    case 'hoodie':
      return (
        <>
          <path d="M26 80 C26 66 74 66 74 80 C66 76 34 76 26 80 Z" fill={dark} />
          <path d={body} fill={c} />
          <path d="M36 76 C40 86 60 86 64 76" fill="none" stroke={c2} strokeWidth="4" />
          <path d="M45 82 L44 94 M55 82 L56 94" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" opacity=".85" />
        </>
      );
    case 'sweater':
      return (
        <>
          <path d={body} fill={c} />
          <path d="M40 74 C42 80 58 80 60 74" fill="none" stroke={c2} strokeWidth="3.4" />
          <path d="M20 92 L28 92 M72 92 L80 92" stroke={c2} strokeWidth="2" opacity=".6" />
        </>
      );
    case 'cardigan':
      return (
        <>
          <path d={body} fill={c} />
          <path d="M42 73 L50 100 L58 73 Z" fill={c2} />
          <path d="M42 73 L50 100 M58 73 L50 100" stroke={dark} strokeWidth="2" />
          <circle cx="47.5" cy="88" r="1.3" fill={shade(c, 0.25)} />
          <circle cx="47" cy="95" r="1.3" fill={shade(c, 0.25)} />
        </>
      );
    case 'jacket':
      return (
        <>
          <path d={body} fill={c} />
          <path d="M42 73 L50 100 L58 73 Z" fill={c2} />
          <path d="M40 73 L46 86 L42 100 M60 73 L54 86 L58 100" fill="none" stroke={dark} strokeWidth="2.4" />
          <path d="M20 84 L20 100 M80 84 L80 100" stroke={dark} strokeWidth="1.4" opacity=".6" />
        </>
      );
    case 'blouse':
      return (
        <>
          <path d={body} fill={c} />
          <path d="M40 73 L50 84 L60 73" fill={l.skin} />
          <path d="M40 73 L50 84 L60 73" fill="none" stroke={c2} strokeWidth="2.4" />
        </>
      );
    case 'turtleneck':
      return (
        <>
          <path d={body} fill={c} />
          <path d="M41 62 L59 62 L61 77 C55 80 45 80 39 77 Z" fill={c2} />
          <path d="M40 68 L60 68 M40 72 L60 72" stroke={shade(c2, -0.12)} strokeWidth="1" />
        </>
      );
    case 'leather':
      return (
        <>
          <path d={body} fill={c} />
          <path d="M42 73 L50 92 L58 73 Z" fill={c2} />
          <path d="M42 73 L36 80 L44 90 L50 100 M58 73 L64 80 L56 90 L50 100" fill="none" stroke="#555" strokeWidth="1.6" />
          <path d="M58 82 L54 98" stroke="#bbb" strokeWidth="1" />
        </>
      );
    case 'tweed':
      return (
        <>
          <path d={body} fill={c} />
          <path d="M43 73 L50 90 L57 73 Z" fill="#f4efe6" />
          <path d="M43 73 L48 86 L42 100 M57 73 L52 86 L58 100" fill="none" stroke={dark} strokeWidth="2.4" />
          <path d="M45 76 L50 79 L45 82 Z M55 76 L50 79 L55 82 Z" fill={c2} />
          <circle cx="50" cy="79" r="1.4" fill={shade(c2, -0.2)} />
          <path d="M14 94 L22 94 M78 94 L86 94" stroke={shade(c, 0.12)} strokeWidth="1.2" />
        </>
      );
    case 'gown':
      return (
        <>
          <path d={body} fill={c} />
          <path d="M34 66 L38 79 C46 76 54 76 62 79 L66 66 C60 72 40 72 34 66 Z" fill={c2} />
          <path d="M40 80 C46 90 54 90 60 80" fill="none" stroke={c2} strokeWidth="1.6" />
          <circle cx="50" cy="88" r="2.4" fill={c2} />
        </>
      );
    default:
      return (
        <>
          <path d={body} fill={c} />
          <path d="M42 74 C44 79 56 79 58 74" fill="none" stroke={c2} strokeWidth="2" />
        </>
      );
  }
}

function frontHair(l: Look): ReactNode {
  const c = l.hairColor;
  const hi = shade(c, 0.14);
  switch (l.hair) {
    case 'kid':
      return (
        <>
          <path d="M33 40 C31 22 69 22 67 40 C62 32 56 30 50 32 C44 30 38 33 33 40 Z" fill={c} />
          <path d="M48 31 C46 25 52 22 55 25 C52 25 51 28 51 31 Z" fill={c} />
        </>
      );
    case 'ponytail':
      return (
        <>
          <path d="M32 44 C29 20 71 20 68 44 C66 34 58 28 50 30 C44 31 36 34 32 44 Z" fill={c} />
          <path d="M40 27 C46 24 58 24 62 28" stroke={hi} strokeWidth="1.6" fill="none" />
        </>
      );
    case 'messy':
      return (
        <path
          d="M32 44 C30 34 32 28 36 26 L38 20 L42 25 L46 18 L50 24 L55 17 L57 24 L63 20 L63 27 C68 30 70 36 68 44 C66 36 60 32 54 33 L50 30 L46 34 C40 33 34 38 32 44 Z"
          fill={c}
        />
      );
    case 'bob':
      return <path d="M31 42 C30 22 70 20 69 40 C64 30 52 28 46 34 C42 38 36 38 31 42 Z" fill={c} />;
    case 'fade':
      return (
        <>
          <path d="M33 40 C32 26 68 26 67 40 C62 32 38 32 33 40 Z" fill={c} />
          <path d="M33 40 C32 36 33 33 34 31 M67 40 C68 36 67 33 66 31" stroke={shade(c, 0.25)} strokeWidth="2" />
        </>
      );
    case 'curly':
      return (
        <g fill={c}>
          {[
            [36, 30, 7],
            [44, 25, 7],
            [52, 24, 7],
            [60, 26, 7],
            [66, 32, 6],
            [33, 37, 5],
          ].map(([x, y, r], i) => (
            <circle key={i} cx={x} cy={y} r={r} />
          ))}
        </g>
      );
    case 'sidepart':
      return (
        <>
          <path d="M32 42 C30 22 70 20 68 40 C66 32 60 28 54 28 C46 30 38 34 32 42 Z" fill={c} />
          <path d="M54 28 C60 26 66 30 68 38" fill="none" stroke={hi} strokeWidth="1.6" />
          <path d="M42 26 C38 28 34 32 33 37" fill="none" stroke={shade(c, -0.15)} strokeWidth="1.2" />
        </>
      );
    case 'long':
      return (
        <path d="M32 46 C28 20 72 20 68 46 C66 34 60 28 52 28 C48 34 40 38 32 46 Z" fill={c} />
      );
    case 'bald':
      return (
        <>
          <path d="M32 38 C30 42 31 48 33 50 L35 48 C34 44 34 41 35 38 Z" fill={c} />
          <path d="M68 38 C70 42 69 48 67 50 L65 48 C66 44 66 41 65 38 Z" fill={c} />
          <path d="M42 26 C46 24 52 24 56 25" stroke="#fff" strokeWidth="1.4" opacity=".5" fill="none" />
        </>
      );
    case 'updo':
      return (
        <>
          <path d="M32 42 C30 22 70 22 68 42 C64 32 56 28 50 30 C44 28 36 32 32 42 Z" fill={c} />
          <path d="M44 15 C48 13 54 14 57 17" stroke={hi} strokeWidth="1.4" fill="none" />
        </>
      );
  }
}

function hat(l: Look): ReactNode {
  const c = l.hatColor ?? '#333';
  if (l.hat === 'cap')
    return (
      <>
        <path d="M32 34 C32 18 68 18 68 34 Z" fill={c} />
        <path d="M58 32 C68 30 80 31 84 35 C76 36 66 36 58 36 Z" fill={shade(c, -0.15)} />
        <circle cx="50" cy="19.5" r="1.8" fill={shade(c, -0.2)} />
        <path d="M44 22 C46 26 46 30 45 34 M56 22 C54 26 54 30 55 34" stroke={shade(c, 0.15)} strokeWidth="1" fill="none" />
      </>
    );
  if (l.hat === 'beanie')
    return (
      <>
        <path d="M31 36 C30 14 70 14 69 36 Z" fill={c} />
        <rect x="30" y="31" width="40" height="7" rx="3" fill={shade(c, -0.15)} />
        <path d="M36 31 L36 38 M42 31 L42 38 M48 31 L48 38 M54 31 L54 38 M60 31 L60 38 M66 31 L66 38" stroke={shade(c, -0.28)} strokeWidth="0.8" />
      </>
    );
  if (l.hat === 'crown')
    return (
      <>
        <path d="M36 22 L38 8 L44 15 L50 5 L56 15 L62 8 L64 22 Z" fill={c} stroke={shade(c, -0.25)} strokeWidth="0.8" />
        <rect x="36" y="20" width="28" height="4" rx="1" fill={shade(c, -0.1)} />
        <circle cx="50" cy="13" r="1.8" fill="#d6304a" />
        <circle cx="42" cy="18" r="1.2" fill="#3a8be0" />
        <circle cx="58" cy="18" r="1.2" fill="#3a8be0" />
      </>
    );
  return null;
}

function face(l: Look): ReactNode {
  const ink = '#2a1e1a';
  const browY = l.hat === 'cap' || l.hat === 'beanie' ? 38.5 : 37.5;
  const brows = {
    up: ['M39 ' + browY + ' Q43 ' + (browY - 2.4) + ' 47 ' + browY, 'M53 ' + browY + ' Q57 ' + (browY - 2.4) + ' 61 ' + browY],
    flat: [`M39 ${browY} L47 ${browY - 0.5}`, `M53 ${browY - 0.5} L61 ${browY}`],
    raised: [`M39 ${browY} Q43 ${browY - 1.5} 47 ${browY}`, `M53 ${browY - 1.2} Q57 ${browY - 4} 61 ${browY - 1.5}`],
    fierce: [`M39 ${browY - 1.5} L47 ${browY + 0.8}`, `M53 ${browY + 0.8} L61 ${browY - 1.5}`],
  }[l.brows];
  const mouth = {
    grin: <path d="M43 52 Q50 60 57 52 Z" fill="#8a2f2f" stroke={ink} strokeWidth="1" strokeLinejoin="round" />,
    smile: <path d="M44 53 Q50 58 56 53" fill="none" stroke={ink} strokeWidth="1.5" strokeLinecap="round" />,
    smirk: <path d="M44 54 Q51 56 57 51" fill="none" stroke={ink} strokeWidth="1.5" strokeLinecap="round" />,
    calm: <path d="M45 54 Q50 56 55 54" fill="none" stroke={ink} strokeWidth="1.4" strokeLinecap="round" />,
    open: <ellipse cx="50" cy="54" rx="3" ry="2.4" fill="#8a2f2f" />,
  }[l.mouth];
  const browColor = l.hair === 'bald' ? '#9a948c' : shade(l.hairColor, -0.1);
  return (
    <>
      {brows.map((d, i) => (
        <path key={i} d={d} fill="none" stroke={browColor} strokeWidth="2" strokeLinecap="round" />
      ))}
      {[43, 57].map((x) => (
        <g key={x}>
          <ellipse cx={x} cy="43.5" rx="2.4" ry="2.9" fill={ink} />
          <circle cx={x + 0.8} cy="42.5" r="0.8" fill="#fff" />
          {l.lashes && <path d={x < 50 ? `M${x - 2.4} 41.6 L${x - 3.8} 40.6` : `M${x + 2.4} 41.6 L${x + 3.8} 40.6`} stroke={ink} strokeWidth="1" />}
        </g>
      ))}
      <path d="M50 45 Q48.4 49.5 50.5 50" fill="none" stroke={shade(l.skin, -0.22)} strokeWidth="1.3" strokeLinecap="round" />
      {l.blush && (
        <>
          <ellipse cx="39" cy="50" rx="3.2" ry="2" fill="#ff8a8a" opacity=".35" />
          <ellipse cx="61" cy="50" rx="3.2" ry="2" fill="#ff8a8a" opacity=".35" />
        </>
      )}
      {l.freckles && (
        <g fill={shade(l.skin, -0.25)}>
          <circle cx="38" cy="48" r=".7" />
          <circle cx="40.5" cy="49.4" r=".7" />
          <circle cx="37.5" cy="50.6" r=".7" />
          <circle cx="62" cy="48" r=".7" />
          <circle cx="59.5" cy="49.4" r=".7" />
          <circle cx="62.5" cy="50.6" r=".7" />
        </g>
      )}
      {l.beard === 'short' && (
        <path d="M34 48 C35 60 42 66 50 66 C58 66 65 60 66 48 C64 56 60 58 56 57 C52 55 48 55 44 57 C40 58 36 56 34 48 Z" fill={l.hairColor} opacity=".92" />
      )}
      {l.beard === 'full' && (
        <path d="M33 46 C33 66 42 74 50 74 C58 74 67 66 67 46 C64 54 60 57 56 56 C52 55 48 55 44 56 C40 57 36 54 33 46 Z" fill={l.hairColor} />
      )}
      {l.beard && <ellipse cx="50" cy="54.6" rx="4.6" ry="2.3" fill={shade(l.skin, -0.05)} />}
      {l.beard && <path d="M44 52.5 Q50 50 56 52.5" fill="none" stroke={l.beard === 'full' ? l.hairColor : shade(l.hairColor, 0.05)} strokeWidth="2.6" strokeLinecap="round" />}
      {mouth}
      {l.glasses === 'round' && (
        <g fill="rgba(255,255,255,.18)" stroke="#3a2b22" strokeWidth="1.3">
          <circle cx="43" cy="43.5" r="5" />
          <circle cx="57" cy="43.5" r="5" />
          <path d="M48 43 Q50 41.6 52 43 M38 43 L33.5 41.5 M62 43 L66.5 41.5" fill="none" />
        </g>
      )}
      {l.glasses === 'thin' && (
        <g fill="rgba(255,255,255,.15)" stroke="#5a6470" strokeWidth="1">
          <rect x="37.5" y="40" width="11" height="7" rx="2.2" />
          <rect x="51.5" y="40" width="11" height="7" rx="2.2" />
          <path d="M48.5 42.5 L51.5 42.5 M37.5 42 L33.5 41 M62.5 42 L66.5 41" fill="none" />
        </g>
      )}
    </>
  );
}

function Human({ l }: { l: Look }) {
  const skinShadow = shade(l.skin, -0.1);
  return (
    <>
      {backHair(l)}
      <path d="M43 58 L57 58 L58 75 C54 78 46 78 42 75 Z" fill={skinShadow} />
      {torso(l)}
      <circle cx="33" cy="45" r="4" fill={l.skin} />
      <circle cx="67" cy="45" r="4" fill={l.skin} />
      {l.earrings && (
        <>
          <circle cx="33" cy="50" r="1.6" fill={l.earrings} />
          <circle cx="67" cy="50" r="1.6" fill={l.earrings} />
        </>
      )}
      <ellipse cx="50" cy="44" rx="17" ry="20" fill={l.skin} />
      {face(l)}
      {frontHair(l)}
      {l.clip && (
        <g transform="translate(60 29) rotate(25)">
          <path d="M0 0 C4 -5 9 -3 10 0 C6 3 2 3 0 0 Z" fill="#7bd36b" stroke="#3f8f3a" strokeWidth=".8" />
        </g>
      )}
      {hat(l)}
    </>
  );
}

function Robot() {
  return (
    <>
      <path d="M6 100 C8 82 26 73 50 73 C74 73 92 82 94 100 Z" fill="#4b5563" />
      <path d="M30 86 L70 86 L70 100 L30 100 Z" fill="#374151" />
      <circle cx="40" cy="93" r="2" fill="#38e1ff" />
      <circle cx="50" cy="93" r="2" fill="#a3e635" />
      <circle cx="60" cy="93" r="2" fill="#f87171" />
      <rect x="44" y="60" width="12" height="14" fill="#6b7280" />
      <path d="M44 64 L56 64 M44 68 L56 68" stroke="#4b5563" strokeWidth="1.2" />
      <line x1="50" y1="20" x2="50" y2="10" stroke="#9ca3af" strokeWidth="2" />
      <circle cx="50" cy="8" r="3.2" fill="#ff4d6d" />
      <rect x="27" y="38" width="6" height="14" rx="2" fill="#6b7280" />
      <rect x="67" y="38" width="6" height="14" rx="2" fill="#6b7280" />
      <rect x="31" y="20" width="38" height="42" rx="10" fill="#c7cdd6" stroke="#8b939f" strokeWidth="1.5" />
      <rect x="35" y="33" width="30" height="13" rx="6" fill="#111827" />
      <ellipse cx="43" cy="39.5" rx="4" ry="3" fill="#38e1ff" />
      <ellipse cx="57" cy="39.5" rx="4" ry="3" fill="#38e1ff" />
      <circle cx="44" cy="38.6" r="1" fill="#e0fbff" />
      <circle cx="58" cy="38.6" r="1" fill="#e0fbff" />
      <rect x="40" y="51" width="20" height="5" rx="2" fill="#374151" />
      <path d="M44 51 L44 56 M48 51 L48 56 M52 51 L52 56 M56 51 L56 56" stroke="#9ca3af" strokeWidth=".9" />
      <circle cx="35" cy="25" r="1" fill="#8b939f" />
      <circle cx="65" cy="25" r="1" fill="#8b939f" />
    </>
  );
}

/** Portrait illustre d'un bot (buste et tete) */
export function BotPortrait({ id, size = 40, className = '' }: { id: string; size?: number; className?: string }) {
  const l = LOOKS[id];
  const gid = `bp-${id}`;
  const bg: [string, string] = l?.bg ?? ['#d7f3ff', '#5b6b8c'];
  return (
    <svg
      className={`bot-portrait ${className}`}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-hidden
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={bg[0]} />
          <stop offset="1" stopColor={bg[1]} />
        </linearGradient>
        <clipPath id={`${gid}-c`}>
          <rect width="100" height="100" rx="22" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${gid}-c)`}>
        <rect width="100" height="100" fill={`url(#${gid})`} />
        <g transform="translate(-9 -3) scale(1.18)">{l ? <Human l={l} /> : <Robot />}</g>
      </g>
    </svg>
  );
}
