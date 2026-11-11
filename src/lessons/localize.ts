// Traduction du contenu des cours (titres, textes, quiz, conseils) : le texte francais sert de cle.
import { ALL_LESSONS, CHAPTERS, type Lesson, type Step } from './courses';

type Dict = Record<string, string>;

const tr = (d: Dict, v: string) => d[v] ?? v;

/** Copie traduite d'une etape */
export function translateStep(s: Step, d: Dict): Step {
  const o = { ...s } as Record<string, unknown>;
  for (const f of ['title', 'text', 'question', 'explain'] as const) if (typeof o[f] === 'string') o[f] = tr(d, o[f] as string);
  if (Array.isArray(o.tips)) o.tips = (o.tips as string[]).map((t) => tr(d, t));
  // Les options d'un quiz sont des coups (UCI) ; celles d'une question a choix sont du texte
  if (s.type === 'choice') o.options = s.options.map((t) => tr(d, t));
  return o as Step;
}

/** Copie traduite d'une lecon */
export const translateLesson = <T extends Lesson>(l: T, d: Dict): T => ({
  ...l,
  title: tr(d, l.title),
  summary: tr(d, l.summary),
  steps: l.steps.map((s) => translateStep(s, d)),
});

/** Traduit les cours en place (une seule fois au demarrage, la langue ne change qu'en rechargeant la page) */
function applyDict(d: Dict) {
  const done = new Map<Lesson, Lesson>();
  const fix = (l: Lesson) => {
    const t = done.get(l) ?? translateLesson(l, d);
    done.set(l, t);
    Object.assign(l, { title: t.title, summary: t.summary, steps: t.steps });
  };
  for (const c of CHAPTERS) {
    c.title = tr(d, c.title);
    c.description = tr(d, c.description);
    c.lessons.forEach(fix);
    c.advanced?.forEach(fix);
  }
  for (const l of ALL_LESSONS) Object.assign(l, { title: tr(d, l.title), summary: tr(d, l.summary), steps: l.steps.map((s) => translateStep(s, d)) });
}

const LOCALES = import.meta.glob<{ default: Dict }>('../i18n/locales/lessons.*.ts');

/** Charge et applique la traduction des cours (anglais si la langue n'a pas encore la sienne) */
export async function localizeLessons(lang: string): Promise<void> {
  if (lang === 'fr') return;
  // Pas encore de traduction dans cette langue : l'anglais, plus lisible que le francais pour un visiteur etranger
  const load = LOCALES[`../i18n/locales/lessons.${lang}.ts`] ?? LOCALES['../i18n/locales/lessons.en.ts'];
  if (load) applyDict((await load()).default);
}
