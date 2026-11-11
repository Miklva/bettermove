// Traduction de l'app. Le texte francais sert de cle : t('Jouer') -> 'Play' en anglais.
// Un texte sans traduction reste en francais (on traduit page par page sans rien casser).

export type Lang = 'fr' | 'en' | 'es' | 'pt' | 'de' | 'ru';

export const LANGS: { id: Lang; label: string; flag: string }[] = [
  { id: 'fr', label: 'Français', flag: '🇫🇷' },
  { id: 'en', label: 'English', flag: '🇬🇧' },
  { id: 'es', label: 'Español', flag: '🇪🇸' },
  { id: 'pt', label: 'Português', flag: '🇵🇹' },
  { id: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { id: 'ru', label: 'Русский', flag: '🇷🇺' },
];

const IDS = LANGS.map((l) => l.id);
const KEY = 'bettermove.lang';
const BOT_RE = /bot|crawl|spider|slurp|google|bing|yandex|duckduck|baidu|lighthouse|headless/i;

/** Langue indiquee par l'adresse (/en/...), sinon null (francais = sans prefixe) */
export function langOfPath(path: string): Lang | null {
  const first = path.split('/')[1] as Lang;
  return first !== 'fr' && IDS.includes(first) ? first : null;
}

function saved(): Lang | null {
  try {
    const v = localStorage.getItem(KEY) as Lang | null;
    return v && IDS.includes(v) ? v : null;
  } catch {
    return null;
  }
}

/** Langue du navigateur ; une langue non prise en charge donne l'anglais */
function browserLang(): Lang {
  for (const l of navigator.languages ?? [navigator.language]) {
    const code = l.slice(0, 2).toLowerCase() as Lang;
    if (IDS.includes(code)) return code;
  }
  return 'en';
}

export const isBot = () => BOT_RE.test(navigator.userAgent) || navigator.webdriver === true;

/** Langue de la page : l'adresse decide ; sans prefixe, c'est du francais */
let current: Lang = (typeof window !== 'undefined' && langOfPath(window.location.pathname)) || 'fr';

/**
 * Premiere visite d'un humain sur une adresse francaise : on l'envoie vers sa langue
 * (choix enregistre, sinon langue du navigateur). Les robots restent sur l'adresse demandee.
 */
export function preferredLang(): Lang | null {
  if (langOfPath(window.location.pathname) || isBot()) return null;
  const want = saved() ?? browserLang();
  return want === 'fr' ? null : want;
}

export const lang = () => current;

let dict: Record<string, string> = {};

/** Charge le dictionnaire de la langue courante (avant le premier affichage) */
export async function loadLocale(l: Lang = current): Promise<void> {
  current = l;
  document.documentElement.lang = l;
  if (l === 'fr') {
    dict = {};
    return;
  }
  // Contenu long (succes, astuces, suivi) : traduit d'abord en anglais, utilise en attendant pour les autres langues
  const content = CONTENT[`./locales/content.${l}.ts`] ?? CONTENT['./locales/content.en.ts'];
  const [mod, extra] = await Promise.all([import(`./locales/${l}.ts`), content ? content() : Promise.resolve({ default: {} })]);
  dict = { ...extra.default, ...(mod.default as Record<string, string>) };
}

const CONTENT = import.meta.glob<{ default: Record<string, string> }>('./locales/content.*.ts');

/** Traduit un texte francais ; {nom} est remplace par vars.nom */
export function t(fr: string, vars?: Record<string, string | number>): string {
  let out = dict[fr] ?? fr;
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, String(v));
  return out;
}

/**
 * Pluriel : tn(n, '{n} jour', '{n} jours'). La traduction de la forme plurielle peut donner
 * plusieurs formes separees par | dans l'ordre des categories de la langue (russe : few|many).
 */
export function tn(n: number, one: string, many: string, vars?: Record<string, string | number>): string {
  const all = { n, ...vars };
  const cat = new Intl.PluralRules(current === 'pt' ? 'pt-PT' : current).select(n);
  if (cat === 'one') return t(one, all);
  const forms = (dict[many] ?? many).split('|');
  const pick = forms.length === 1 ? forms[0] : cat === 'few' ? forms[0] : forms[forms.length - 1];
  let out = pick;
  for (const [k, v] of Object.entries(all)) out = out.replaceAll(`{${k}}`, String(v));
  return out;
}

/** Locale pour les dates et nombres */
export const locale = () => (current === 'pt' ? 'pt-PT' : current === 'en' ? 'en-GB' : current === 'fr' ? 'fr-FR' : current);

/** Enregistre le choix de langue */
export function saveLang(l: Lang) {
  try {
    localStorage.setItem(KEY, l);
  } catch {
    /* rien */
  }
}

/** Nombre avec la mise en forme de la langue (1 234 / 1,234) */
export const num = (n: number) => n.toLocaleString(current === 'pt' ? 'pt-PT' : current);

/** Table de textes francais traduite a la lecture (ex. libelles par cle) ; les objets imbriques aussi */
export function tmap<T extends object>(o: T): T {
  return new Proxy(o, {
    get(x, k) {
      const v = Reflect.get(x, k);
      if (typeof v === 'string') return t(v);
      if (v && typeof v === 'object' && !Array.isArray(v)) return tmap(v);
      return v;
    },
  });
}

// Messages renvoyes par le serveur (en francais) : traduits ici, y compris ceux qui contiennent un nombre
const SERVER_PATTERNS: [RegExp, string, string[]][] = [
  [/^Tu es en sourdine encore (\d+) min pour langage inapproprié\.$/, 'Tu es en sourdine encore {n} min pour langage inapproprié.', ['n']],
  [/^(\d+) caractères maximum$/, '{n} caractères maximum', ['n']],
  [/^Possible seulement pendant les (\d+) jours qui suivent la création du compte\.$/, 'Possible seulement pendant les {n} jours qui suivent la création du compte.', ['n']],
  [/^Langage inapproprié masqué\. Avertissement (\d+)\/3 avant une sourdine de 10 minutes\.$/, 'Langage inapproprié masqué. Avertissement {n}/3 avant une sourdine de 10 minutes.', ['n']],
  [/^Erreur (\d+)$/, 'Erreur {n}', ['n']],
];

export function tServer(msg: string | null | undefined): string {
  if (!msg) return msg ?? '';
  if (dict[msg]) return dict[msg];
  for (const [re, key, names] of SERVER_PATTERNS) {
    const m = re.exec(msg);
    if (m) return t(key, Object.fromEntries(names.map((n, i) => [n, m[i + 1]])));
  }
  return msg;
}
