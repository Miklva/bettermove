// Adresses traduites : /apprendre/cours (francais, sans prefixe) <-> /en/learn/lessons, /es/aprender/lecciones...
// Le code de l'app ne manipule que les adresses francaises ; la conversion se fait dans le routeur.
import { langOfPath, type Lang } from './index';

type L = Exclude<Lang, 'fr'>;

/** Segment francais -> segment par langue (le russe reprend les adresses anglaises, plus lisibles) */
const SLUGS: Record<string, Partial<Record<L, string>>> = {
  jouer: { en: 'play', es: 'jugar', pt: 'jogar', de: 'spielen' },
  monde: { en: 'world', es: 'mundo', pt: 'mundo', de: 'welt' },
  partie: { en: 'game', es: 'partida', pt: 'partida', de: 'partie' },
  apprendre: { en: 'learn', es: 'aprender', pt: 'aprender', de: 'lernen' },
  cours: { en: 'lessons', es: 'lecciones', pt: 'licoes', de: 'lektionen' },
  professeur: { en: 'teacher', es: 'profesor', pt: 'professor', de: 'lehrer' },
  problemes: { en: 'puzzles', es: 'problemas', pt: 'problemas', de: 'aufgaben' },
  revisions: { en: 'review', es: 'repaso', pt: 'revisao', de: 'wiederholung' },
  repertoire: { en: 'repertoire', es: 'repertorio', pt: 'repertorio', de: 'repertoire' },
  progresser: { en: 'progress', es: 'progresar', pt: 'progredir', de: 'fortschritt' },
  historique: { en: 'history', es: 'historial', pt: 'historico', de: 'verlauf' },
  suivi: { en: 'coach', es: 'seguimiento', pt: 'acompanhamento', de: 'coach' },
  astuces: { en: 'tips', es: 'consejos', pt: 'dicas', de: 'tipps' },
  succes: { en: 'achievements', es: 'logros', pt: 'conquistas', de: 'erfolge' },
  niveaux: { en: 'levels', es: 'niveles', pt: 'niveis', de: 'stufen' },
  communaute: { en: 'community', es: 'comunidad', pt: 'comunidade', de: 'community' },
  salon: { en: 'lounge', es: 'sala', pt: 'sala', de: 'lounge' },
  classement: { en: 'leaderboard', es: 'clasificacion', pt: 'classificacao', de: 'rangliste' },
  evenements: { en: 'events', es: 'eventos', pt: 'eventos', de: 'events' },
  messages: { en: 'messages', es: 'mensajes', pt: 'mensagens', de: 'nachrichten' },
  boutique: { en: 'shop', es: 'tienda', pt: 'loja', de: 'shop' },
  profil: { en: 'profile', es: 'perfil', pt: 'perfil', de: 'profil' },
  aide: { en: 'help', es: 'ayuda', pt: 'ajuda', de: 'hilfe' },
  infos: { en: 'info', es: 'info', pt: 'info', de: 'info' },
  guides: { en: 'guides', es: 'guias', pt: 'guias', de: 'ratgeber' },
  compte: { en: 'account', es: 'cuenta', pt: 'conta', de: 'konto' },
  // Guides (meme adresse que dans src/seo/en.ts, verifie au build)
  'comment-apprendre-les-echecs': { en: 'how-to-learn-chess' },
  'regles-des-echecs': { en: 'chess-rules' },
  'comment-progresser-aux-echecs': { en: 'how-to-get-better-at-chess' },
  'meilleures-ouvertures-debutant': { en: 'best-chess-openings-for-beginners' },
  'tactiques-aux-echecs': { en: 'chess-tactics' },
  'mats-a-connaitre': { en: 'checkmate-patterns' },
  'analyser-ses-parties-d-echecs': { en: 'how-to-analyze-chess-games' },
  'classement-elo-echecs': { en: 'chess-elo-rating' },
};

const slugOf = (fr: string, l: L) => SLUGS[fr]?.[l] ?? SLUGS[fr]?.en ?? fr;

/** Inverse par langue : segment traduit -> segment francais */
const REVERSE: Record<string, Record<string, string>> = {};
for (const l of ['en', 'es', 'pt', 'de', 'ru'] as L[]) {
  REVERSE[l] = {};
  for (const fr of Object.keys(SLUGS)) REVERSE[l][slugOf(fr, l)] = fr;
}

/** Adresse interne (francaise) -> adresse affichee dans la langue l */
export function toPublic(path: string, l: Lang): string {
  if (l === 'fr') return path;
  const segs = path.split('/').filter(Boolean);
  return `/${l}` + (segs.length ? '/' + segs.map((s) => slugOf(s, l)).join('/') : '');
}

/** Adresse affichee -> adresse interne (francaise) */
export function toInternal(pub: string): string {
  const l = langOfPath(pub);
  if (!l) return pub;
  const segs = pub.split('/').filter(Boolean).slice(1);
  return '/' + segs.map((s) => REVERSE[l][s] ?? s).join('/');
}
