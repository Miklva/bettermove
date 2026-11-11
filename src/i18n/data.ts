// Traduit en place les donnees affichees un peu partout (bots, themes des problemes, cadences, couleurs).
// Appele une fois au demarrage, apres le chargement du dictionnaire (la langue ne change qu'en rechargeant).
import { BOTS } from '../bots/roster';
import { THEMES } from '../puzzles/themes';
import { TIME_CONTROLS } from '../game/timeControls';
import { COLOR_NAME } from '../game/rules';
import { RUSH_MODES } from '../rush/store';
import { ACHIEVEMENTS, CATEGORIES } from '../achievements/list';
import { TIP_CATS, TIPS_LIBRARY } from '../tips/library';
import { WEAKNESSES } from '../coach/report';
import { ITEMS } from '../shop/items';
import { REP_OPENINGS } from '../repertoire/lines';
import { EMOTES } from '../emotes/emotes';
import { lang, t } from './index';

export function localizeData() {
  // Nombre de bots dans certaines descriptions de succes (aussi en francais)
  for (const a of ACHIEVEMENTS) if (a.desc.includes('{n}')) a.desc = t(a.desc, { n: BOTS.length });
  if (lang() === 'fr') return;
  for (const e of EMOTES) e.label = t(e.label);
  for (const b of BOTS) {
    b.name = t(b.name);
    b.style = t(b.style);
    b.description = t(b.description);
    b.hello = t(b.hello);
    b.onWin = t(b.onWin);
    b.onLose = t(b.onLose);
  }
  for (const th of Object.values(THEMES)) {
    th.label = t(th.label);
    if (th.tip) th.tip = t(th.tip);
  }
  for (const tc of TIME_CONTROLS) {
    tc.label = t(tc.label);
  }
  for (const m of RUSH_MODES) {
    m.label = t(m.label);
    m.desc = t(m.desc);
  }
  for (const a of ACHIEVEMENTS) {
    a.title = t(a.title);
    a.desc = t(a.desc);
  }
  for (const c of [...CATEGORIES, ...TIP_CATS]) c.label = t(c.label);
  for (const tip of TIPS_LIBRARY) {
    tip.title = t(tip.title);
    tip.text = t(tip.text);
  }
  for (const w of Object.values(WEAKNESSES)) {
    w.title = t(w.title);
    w.what = t(w.what);
    w.tips = w.tips.map((x) => t(x));
  }
  for (const it of ITEMS) {
    it.name = t(it.name);
    it.desc = t(it.desc);
  }
  for (const o of REP_OPENINGS) {
    o.name = t(o.name);
    o.ideas = t(o.ideas);
  }
  COLOR_NAME.w = t(COLOR_NAME.w);
  COLOR_NAME.b = t(COLOR_NAME.b);
}
