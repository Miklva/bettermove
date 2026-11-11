// Pages a referencer au build : celles de all.ts plus les lecons en anglais (non chargees dans l'app).
import { ALL_LESSONS } from '../lessons/courses';
import { translateLesson } from '../lessons/localize';
import EN_LESSONS from '../i18n/locales/lessons.en';
import { lessonDoc, SEO_DOCS } from './all';

const tr = (v: string) => EN_LESSONS[v] ?? v;

const enLessons = ALL_LESSONS.map((l) =>
  lessonDoc({ ...translateLesson(l, EN_LESSONS), chapter: { ...l.chapter, title: tr(l.chapter.title) } }, 'en'),
);

export const BUILD_DOCS = [...SEO_DOCS, ...enLessons];
