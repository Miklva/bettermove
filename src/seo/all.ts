// Toutes les pages a referencer : pages de l'app, guides et lecons, avec le texte lu par les moteurs de recherche.
import { ALL_LESSONS } from '../lessons/courses';
import { ARTICLES } from './articles';
import { SEO_PAGES, type SeoPage } from './pages';
import { EN_ARTICLES, EN_PAGES } from './en';
import { toPublic } from '../i18n/slugs';
import type { Lang } from '../i18n';

export interface SeoDoc extends SeoPage {
  /** Contenu HTML lisible avant le chargement de l'app */
  bodyHtml: string;
  kind: 'page' | 'article' | 'lesson';
  /** Langue de la page */
  lang: Lang;
  /** Adresse francaise de reference : relie les versions d'une meme page (hreflang) */
  key: string;
}

const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const cut = (v: string, n: number) => (v.length <= n ? v : `${v.slice(0, n - 1).replace(/\s+\S*$/, '')}…`);

const pages: SeoDoc[] = SEO_PAGES.map((p) => ({ ...p, kind: 'page', lang: 'fr', key: p.path, bodyHtml: `<p>${esc(p.intro)}</p>` }));

const guidesIndex: SeoDoc = {
  path: '/guides',
  title: 'Guides d’échecs gratuits : règles, tactiques, ouvertures · BetterMove',
  description: 'Des guides clairs pour apprendre et progresser aux échecs : règles, tactiques, mats, ouvertures, analyse et classement Elo.',
  h1: 'Guides pour apprendre et progresser aux échecs',
  intro: 'Les réponses aux questions que se posent tous les joueurs, du premier coup au classement Elo.',
  priority: 0.8,
  kind: 'page',
  lang: 'fr',
  key: '/guides',
  bodyHtml: `<p>Les réponses aux questions que se posent tous les joueurs, du premier coup au classement Elo.</p><ul>${ARTICLES.map(
    (a) => `<li><a href="/guides/${a.slug}">${esc(a.h1)}</a></li>`,
  ).join('')}</ul>`,
};

const articleHtml = (a: (typeof ARTICLES)[number], href: (p: string) => string) =>
  `<p>${esc(a.intro)}</p>` +
  a.sections
    .map(
      (s) =>
        `<h2>${esc(s.h2)}</h2>${s.paragraphs.map((p) => `<p>${esc(p)}</p>`).join('')}${
          s.list ? `<ul>${s.list.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>` : ''
        }`,
    )
    .join('') +
  `<p><a href="${href(a.cta.path)}">${esc(a.cta.label)}</a></p>`;

const articles: SeoDoc[] = ARTICLES.map((a) => ({
  path: `/guides/${a.slug}`,
  title: `${a.title} · BetterMove`,
  description: a.description,
  h1: a.h1,
  intro: a.intro,
  priority: 0.7,
  kind: 'article',
  lang: 'fr',
  key: `/guides/${a.slug}`,
  bodyHtml: articleHtml(a, (p) => p),
}));

type LessonEntry = (typeof ALL_LESSONS)[number];

/** Page de referencement d'une lecon (francais ou anglais, selon la langue du texte de la lecon) */
export function lessonDoc(l: LessonEntry, lang: 'fr' | 'en' = 'fr'): SeoDoc {
  const theory = l.steps.filter((s): s is Extract<typeof s, { type: 'theory' }> => s.type === 'theory');
  const first = theory[0]?.text ?? l.summary;
  const key = `/apprendre/cours/${l.id}`;
  const path = lang === 'en' ? toPublic(key, 'en') : key;
  const T =
    lang === 'en'
      ? { title: `${l.title}: free chess lesson (${l.chapter.title})`, h1: `${l.title}: chess lesson`, link: 'Take the interactive lesson with exercises' }
      : { title: `${l.title} : cours d’échecs gratuit (${l.chapter.title})`, h1: `${l.title} : cours d’échecs`, link: 'Suivre la leçon interactive avec exercices' };
  return {
    path,
    title: `${T.title} · BetterMove`,
    description: cut(`${l.summary} ${first}`, 158),
    h1: T.h1,
    intro: l.summary,
    priority: 0.6,
    kind: 'lesson',
    lang,
    key,
    bodyHtml:
      `<p><strong>${esc(l.chapter.title)}</strong> · ${esc(l.summary)}</p>` +
      theory.map((s) => `<h2>${esc(s.title)}</h2><p>${esc(s.text)}</p>`).join('') +
      `<p><a href="${path}">${T.link}</a></p>`,
  };
}

const lessons: SeoDoc[] = ALL_LESSONS.map((l) => lessonDoc(l));
/** Titres francais d'origine (pour savoir si le cours a ete traduit) */
const FR_TITLES = new Map(ALL_LESSONS.map((l) => [l.id, l.title]));

// Versions anglaises : adresses /en/... traduites, seulement pour les pages dont le texte existe en anglais
const en = (fr: string) => toPublic(fr, 'en');
const frPage = (path: string) => [...pages, guidesIndex].find((p) => p.path === path)!;
const enPages: SeoDoc[] = Object.entries(EN_PAGES).map(([key, p]) => ({
  ...p,
  path: en(key),
  priority: frPage(key).priority,
  kind: 'page',
  lang: 'en',
  key,
  bodyHtml:
    `<p>${esc(p.intro)}</p>` +
    (key === '/guides' ? `<ul>${EN_ARTICLES.map((a) => `<li><a href="${en(`/guides/${a.frSlug}`)}">${esc(a.h1)}</a></li>`).join('')}</ul>` : ''),
}));
for (const a of EN_ARTICLES)
  if (en(`/guides/${a.frSlug}`) !== `/en/guides/${a.slug}`) throw new Error(`Adresse du guide ${a.slug} absente de src/i18n/slugs.ts`);
const enArticles: SeoDoc[] = EN_ARTICLES.map((a) => ({
  path: en(`/guides/${a.frSlug}`),
  title: `${a.title} · BetterMove`,
  description: a.description,
  h1: a.h1,
  intro: a.intro,
  priority: 0.7,
  kind: 'article',
  lang: 'en',
  key: `/guides/${a.frSlug}`,
  bodyHtml: articleHtml(a, en),
}));

export const SEO_DOCS: SeoDoc[] = [...pages, guidesIndex, ...articles, ...lessons, ...enPages, ...enArticles];

/** Page de referencement correspondant a une adresse interne (francaise), dans la langue voulue si elle existe */
export function seoFor(path: string, l: Lang = 'fr'): SeoDoc {
  const clean = path.replace(/\/+$/, '') || '/';
  const match = SEO_DOCS.filter((p) => clean === p.key || (p.key !== '/' && clean.startsWith(p.key + '/'))).sort(
    (a, b) => b.key.length - a.key.length || Number(b.lang === l) - Number(a.lang === l),
  );
  const best = match[0];
  if (!best) return SEO_DOCS.find((p) => p.key === '/' && p.lang === l) ?? SEO_DOCS[0];
  // Lecon en anglais : construite a la volee depuis le cours deja traduit dans l'app
  if (best.kind === 'lesson' && l === 'en') {
    const lesson = ALL_LESSONS.find((x) => `/apprendre/cours/${x.id}` === best.key);
    if (lesson && lesson.title !== FR_TITLES.get(lesson.id)) return lessonDoc(lesson, 'en');
  }
  return match.find((p) => p.key === best.key && p.lang === l) ?? match.find((p) => p.key === best.key && p.lang === 'fr') ?? best;
}
