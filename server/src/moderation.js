// Moderation du chat : liste de mots interdits (a completer dans BANNED_WORDS ou via la variable
// d'environnement BANNED_WORDS="mot1,mot2"), detection malgre accents, majuscules, chiffres et separateurs.

const DEFAULT_BANNED = [
  // Insultes courantes (francais)
  'con', 'conne', 'connard', 'connasse', 'abruti', 'debile', 'cretin', 'salope', 'salaud', 'pute', 'putain',
  'encule', 'enculer', 'batard', 'fdp', 'ntm', 'nique', 'niquer', 'tg', 'ta gueule', 'pd', 'pede', 'tapette',
  'merde', 'emmerdeur', 'bouffon', 'clochard', 'grosse merde', 'fils de pute', 'nique ta mere', 'va te faire',
  'suce', 'sucer', 'bite', 'couille', 'chienne', 'trou du cul', 'pouffiasse', 'catin',
  // Insultes courantes (anglais)
  'fuck', 'fucking', 'shit', 'bitch', 'asshole', 'bastard', 'dick', 'cunt', 'whore', 'slut', 'retard', 'stfu', 'kys',
  // Haine et discriminations
  'negre', 'negro', 'nigger', 'nigga', 'bougnoule', 'youpin', 'bicot', 'raton', 'chinetoque', 'tarlouze', 'gouine', 'nazi', 'hitler',
];

const extra = (process.env.BANNED_WORDS ?? '')
  .split(',')
  .map((w) => w.trim())
  .filter(Boolean);

/** Minuscules, sans accents, chiffres et symboles "leet" convertis */
export function normalize(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[0@4]/g, (c) => (c === '0' ? 'o' : 'a'))
    .replace(/[1!|]/g, 'i')
    .replace(/3/g, 'e')
    .replace(/[5$]/g, 's')
    .replace(/7/g, 't');
}

const words = [...DEFAULT_BANNED, ...extra].map(normalize);

// Un mot interdit peut etre ecrit avec des separateurs ("c.o.n", "p u t e") ou des lettres doublees ("conn")
const patterns = words.map((w) => {
  const letters = [...w.replace(/\s+/g, '')].map((ch) => `${ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}+`);
  return new RegExp(`(^|[^a-z])(${letters.join('[\\s._*-]*')})(?=$|[^a-z])`, 'g');
});

/** Remplace les mots interdits par des etoiles. Renvoie le texte et le nombre de mots masques. */
export function censor(text) {
  const norm = normalize(text);
  // Les positions sont les memes dans le texte normalise (une lettre pour une lettre) sauf accents combines :
  // on travaille sur la version NFC pour garder l'alignement.
  const base = text.normalize('NFC');
  const chars = [...base];
  const normChars = [...normalize(base)];
  if (normChars.length !== chars.length) {
    // Alignement impossible (caracteres speciaux) : on masque sur le texte normalise
    let hits = 0;
    let out = norm;
    for (const re of patterns) out = out.replace(re, (_m, pre, word) => (hits++, pre + '*'.repeat(word.length)));
    return { text: hits ? out : text, hits };
  }
  let hits = 0;
  const masked = normChars.join('');
  for (const re of patterns) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(masked))) {
      const start = m.index + m[1].length;
      for (let i = start; i < start + m[2].length; i++) chars[i] = '*';
      hits++;
    }
  }
  return { text: chars.join(''), hits };
}

export const containsBanned = (text) => censor(text).hits > 0;

/** Administrateurs (pseudos separes par des virgules) : peuvent supprimer tous les messages */
const ADMINS = (process.env.ADMIN_USERS ?? '')
  .split(',')
  .map((x) => x.trim().toLowerCase())
  .filter(Boolean);
export const isAdmin = (name) => ADMINS.includes(String(name).toLowerCase());

/* ---------------- Pseudos ---------------- */

// Termes haineux interdits n'importe ou dans un pseudo, meme colles a d'autres lettres
// ("xXAdolfHitlerXx"), deguises ("H1tl3r", "HitIer" avec un i majuscule, "Hytler") ou a l'envers.
const HATE_IN_NAMES = [
  'hitler', 'hitlr', 'hitla', 'hilter', 'adolf', 'adolph', 'fuhrer', 'fuehrer', 'fuhrer', 'nazi', 'nazis', 'neonazi',
  'siegheil', 'sieghail', 'himmler', 'goebbels', 'goering', 'mengele', 'eichmann', 'gestapo',
  'waffen', 'ss88', 'hh88', 'auschwitz', 'holocaust', 'shoah', 'genocide', 'kkk', 'kukluxklan',
  'whitepower', 'whitepride', 'aryannation', '1488', '14words', 'swastika', 'svastika', 'thirdreich', 'dritteReich', 'troisiemereich', '3reich', 'iiireich', 'reichsfuhrer',
  'nigger', 'nigga', 'niger', 'bougnoule', 'youpin', 'chinetoque', 'tarlouze', 'negro', 'negre',
];
// Vrais prenoms ou mots qui contiennent un terme ci-dessus : autorises
const NAME_EXCEPTIONS = ['nazim', 'nazir', 'nazih', 'nazira', 'nazia', 'nigeria', 'montenegro', 'niger', 'reichert', 'reichel'];

const collapse = (t) => t.replace(/(.)\1+/g, '$1'); // lettres doublees
/** Squelette : minuscules, sans accents, sans separateurs, chiffres et lettres qui se ressemblent fusionnes */
function skeleton(text) {
  const base = collapse(
    text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/ph/g, 'f')
      .replace(/[^a-z0-9@$!|+]/g, ''),
  );
  return base
    .replace(/0/g, 'o')
    .replace(/[@4]/g, 'a')
    .replace(/3/g, 'e')
    .replace(/[5$]/g, 's')
    .replace(/[7+]/g, 't')
    .replace(/[1!|l]/g, 'i') // l, I, 1 se confondent visuellement
    .replace(/y/g, 'i');
}
const hateSkeletons = [...new Set(HATE_IN_NAMES.map(skeleton))];
// Variante "lettres fusionnees" ("H1itler") seulement pour les termes assez longs (sinon "heil" ~ "helper")
const hateLoose = [...new Set(hateSkeletons.map(collapse).filter((w) => w.length >= 5))];
const exceptionSkeletons = NAME_EXCEPTIONS.map(skeleton);
// Chiffres codes neonazis (88 = HH, 14/88) et KKK : verifies sur le texte brut
// "heil" seulement en mot isole (sinon Sheila, Heilmann...)
const HATE_RAW = /(^|\D)(1488|8814|14\D?88)(\D|$)|k[\W_]*k[\W_]*k|(^|[^a-z])h[e3][i1!|]l+(?![a-z])/i;

/** Pseudo refuse : insulte (comme dans le chat) ou reference haineuse, meme deguisee */
export function forbiddenUsername(name) {
  const raw = String(name ?? '');
  if (containsBanned(raw)) return true;
  if (HATE_RAW.test(raw)) return true;
  let s = skeleton(raw);
  // Les exceptions (vrais prenoms) sont retirees avant la recherche
  for (const ok of exceptionSkeletons) s = s.split(ok).join('_');
  const loose = collapse(s);
  const has = (t, list) => {
    const rev = [...t].reverse().join('');
    return list.some((w) => w.length >= 3 && (t.includes(w) || rev.includes(w)));
  };
  return has(s, hateSkeletons) || has(loose, hateLoose);
}
