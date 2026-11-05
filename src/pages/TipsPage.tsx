// Astuces : rappels utiles, personnalises selon les erreurs du Suivi, et astuces ecrites par le joueur
import { useMemo, useState } from 'react';
import { buildReport, listAnalyses, type WeakStat } from '../coach/report';
import type { GameAnalysis, WeakId } from '../coach/analyze';
import { listGames } from '../review/store';
import { TIP_CATS, TIPS_LIBRARY, type Tip, type TipCat } from '../tips/library';
import { addCustom, loadTips, removeCustom, toggleLearned, togglePin, updateCustom, type TipsData } from '../tips/store';
import { todayKey } from '../puzzles/db';
import { insight } from './CoachPage';
import { useRouteSync } from '../router';

const TREND: Record<string, string> = {
  new: 'nouveau',
  worse: 'en hausse',
  stable: 'stable',
  better: 'en baisse',
  resolved: 'corrigé',
};

const catOf = (id: TipCat) => TIP_CATS.find((c) => c.id === id)!;

/** Erreurs d'une famille commises apres une date (pour reperer un reflexe "oublie") */
function errorsSince(analyses: GameAnalysis[], weak: WeakId[], since: string) {
  let n = 0;
  for (const a of analyses) {
    if ((a.playedAt ?? a.analyzedAt) <= since) continue;
    n += a.errors.filter((e) => e.types.some((t) => weak.includes(t))).length;
  }
  return n;
}

function hash(s: string) {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

interface Props {
  onCoach: () => void;
}

export function TipsPage({ onCoach }: Props) {
  const [data, setData] = useState<TipsData>(loadTips);
  const [cat, setCat] = useState<TipCat | 'all'>('all');
  useRouteSync<TipCat | 'all'>(2, cat, setCat, (c) => (c === 'all' ? 'toutes' : c), (s) => (s === 'toutes' ? 'all' : TIP_CATS.find((c) => c.id === s)?.id));
  const [draft, setDraft] = useState('');
  const [draftCat, setDraftCat] = useState<TipCat>('reflexes');
  const [editing, setEditing] = useState<{ id: string; text: string; cat: TipCat } | null>(null);

  const analyses = useMemo(() => Object.values(listAnalyses()), []);
  const report = useMemo(() => (analyses.length ? buildReport(analyses, listGames()) : null), [analyses]);

  // Points faibles actuels (hors positionnel, trop vague pour un rappel)
  const focus: WeakStat[] = useMemo(
    () => (report?.stats ?? []).filter((s) => s.count > 0 && s.trend !== 'resolved' && s.def.id !== 'positional').slice(0, 3),
    [report],
  );
  const focusIds = new Set(focus.map((s) => s.def.id));

  // Rappels marques "acquis" mais oublies depuis
  const forgotten = useMemo(() => {
    const out: { tip: Tip; n: number }[] = [];
    for (const [id, at] of Object.entries(data.learned)) {
      const tip = TIPS_LIBRARY.find((t) => t.id === id);
      if (!tip?.weak) continue;
      const n = errorsSince(analyses, tip.weak, at);
      if (n > 0) out.push({ tip, n });
    }
    return out;
  }, [data.learned, analyses]);

  const customAsTips: (Tip & { custom: true; at: string })[] = data.custom.map((c) => ({
    id: c.id,
    cat: c.cat,
    title: 'Mon astuce',
    text: c.text,
    custom: true,
    at: c.at,
  }));
  const allTips: Tip[] = [...customAsTips, ...TIPS_LIBRARY];
  const pinned = data.pinned.map((id) => allTips.find((t) => t.id === id)).filter((t): t is Tip => !!t);

  // Rappel du jour : parmi les rappels lies a tes erreurs, sinon epingles, sinon toute la bibliotheque
  const daily = useMemo(() => {
    const pool = [
      ...TIPS_LIBRARY.filter((t) => t.weak?.some((w) => focusIds.has(w)) && !data.learned[t.id]),
      ...pinned,
    ];
    const list = pool.length ? pool : TIPS_LIBRARY;
    return list[hash(todayKey()) % list.length];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, data.pinned]);

  const card = (t: Tip, opts: { forYou?: boolean; compact?: boolean } = {}) => {
    const isCustom = t.id.startsWith('u');
    const learned = !!data.learned[t.id];
    const isPinned = data.pinned.includes(t.id);
    const c = catOf(t.cat);
    if (editing?.id === t.id)
      return (
        <div key={t.id} className="card tip-card editing">
          <textarea className="text-input" rows={3} value={editing.text} onChange={(e) => setEditing({ ...editing, text: e.target.value })} />
          <div className="row">
            <select className="select" value={editing.cat} onChange={(e) => setEditing({ ...editing, cat: e.target.value as TipCat })}>
              {TIP_CATS.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.icon} {x.label}
                </option>
              ))}
            </select>
            <button
              className="btn primary"
              disabled={!editing.text.trim()}
              onClick={() => {
                setData(updateCustom(editing.id, editing.text, editing.cat));
                setEditing(null);
              }}
            >
              Enregistrer
            </button>
            <button className="btn ghost" onClick={() => setEditing(null)}>
              Annuler
            </button>
          </div>
        </div>
      );
    return (
      <div key={t.id} className={`card tip-card ${learned ? 'learned' : ''} ${isCustom ? 'custom' : ''}`}>
        <div className="tip-head">
          <span className="tag">
            {c.icon} {c.label}
          </span>
          {opts.forYou && <span className="tag for-you">Pour toi</span>}
          {isCustom && <span className="tag mine">Mon astuce</span>}
          <span className="tip-actions">
            <button className={`icon-btn ${isPinned ? 'on' : ''}`} title={isPinned ? 'Retirer des épinglées' : 'Épingler'} onClick={() => setData(togglePin(t.id))}>
              {isPinned ? '⭐' : '☆'}
            </button>
            {isCustom ? (
              <>
                <button className="icon-btn" title="Modifier" onClick={() => setEditing({ id: t.id, text: t.text, cat: t.cat })}>
                  ✏️
                </button>
                <button className="icon-btn" title="Supprimer" onClick={() => setData(removeCustom(t.id))}>
                  🗑️
                </button>
              </>
            ) : (
              <button
                className={`icon-btn ${learned ? 'on' : ''}`}
                title={learned ? 'Marquée comme acquise (cliquer pour annuler)' : 'Je l’applique déjà'}
                onClick={() => setData(toggleLearned(t.id))}
              >
                {learned ? '✅' : '✔️'}
              </button>
            )}
          </span>
        </div>
        {!isCustom && <strong>{t.title}</strong>}
        <p>{t.text}</p>
        {learned && !opts.compact && <span className="muted tiny">Acquise. Je te préviendrai si tu l’oublies dans tes parties.</span>}
      </div>
    );
  };

  const library = TIPS_LIBRARY.filter((t) => cat === 'all' || t.cat === cat);
  const mine = customAsTips.filter((t) => cat === 'all' || t.cat === cat);

  return (
    <div className="tips">
      <section className="card tips-hero">
        <div>
          <h1>💡 Astuces</h1>
          <p className="muted">
            Les bons réflexes à garder en tête. Ceux qui correspondent à tes erreurs actuelles remontent en haut, et si tu oublies un
            réflexe que tu pensais acquis, on te le rappelle.
          </p>
        </div>
        {daily && (
          <div className="tips-daily">
            <span className="tc-label">Rappel du jour</span>
            <strong>{daily.id.startsWith('u') ? 'Mon astuce' : daily.title}</strong>
            <p>{daily.text}</p>
          </div>
        )}
      </section>

      {forgotten.length > 0 && (
        <section className="tips-section">
          <div className="tc-label">⚠️ Réflexes oubliés</div>
          <div className="tips-grid">
            {forgotten.map(({ tip, n }) => (
              <div key={tip.id} className="tip-forgot">
                <p className="small">
                  Tu l’avais marqué comme acquis, mais tes parties montrent {n} erreur{n > 1 ? 's' : ''} de ce type depuis.
                </p>
                {card(tip, { compact: true })}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="tips-section">
        <div className="tc-label">🎯 Pour toi en ce moment</div>
        {!report && (
          <p className="muted small">
            Joue ou importe quelques parties : le Suivi personnalisé les analyse et les rappels adaptés à tes erreurs apparaîtront ici.
          </p>
        )}
        {report && focus.length === 0 && <p className="muted small">Aucune erreur récurrente en ce moment. Bravo, continue comme ça !</p>}
        {(() => {
          // Chaque rappel n'apparait qu'une fois, sous le point faible le plus important
          const used = new Set<string>();
          return focus.map((s) => {
          const tips = TIPS_LIBRARY.filter((t) => t.weak?.includes(s.def.id) && !used.has(t.id)).slice(0, 3);
          tips.forEach((t) => used.add(t.id));
          return (
            <div key={s.def.id} className="card tips-focus">
              <div className="tips-focus-head">
                <span className="tips-focus-icon">{s.def.icon}</span>
                <div>
                  <strong>{s.def.title}</strong>
                  <p className="muted small">
                    {s.count} fois sur tes {report!.games} dernières parties analysées · {TREND[s.trend]}
                  </p>
                  {insight(s) && <p className="small tips-insight">{insight(s)}</p>}
                </div>
                <button className="btn ghost" onClick={onCoach}>
                  M’entraîner
                </button>
              </div>
              <div className="tips-grid">{tips.map((t) => card(t, { forYou: true }))}</div>
            </div>
          );
          });
        })()}
      </section>

      {pinned.length > 0 && (
        <section className="tips-section">
          <div className="tc-label">⭐ Mes rappels épinglés</div>
          <div className="tips-grid">{pinned.map((t) => card(t, { forYou: t.weak?.some((w) => focusIds.has(w)) }))}</div>
        </section>
      )}

      <section className="tips-section">
        <div className="tc-label">✍️ Ajouter mon astuce</div>
        <div className="card tips-add">
          <textarea
            className="text-input"
            rows={2}
            maxLength={400}
            placeholder="Ex. : Contre la Scandinave, ne pas sortir la dame trop tôt. Toujours vérifier le fou en b5 avant de jouer d6."
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <div className="row">
            <select className="select" value={draftCat} onChange={(e) => setDraftCat(e.target.value as TipCat)}>
              {TIP_CATS.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.icon} {x.label}
                </option>
              ))}
            </select>
            <button
              className="btn primary"
              disabled={!draft.trim()}
              onClick={() => {
                setData(addCustom(draft, draftCat));
                setDraft('');
              }}
            >
              Ajouter
            </button>
            <span className="muted tiny">Tes astuces sont épinglées et sauvegardées avec ton compte.</span>
          </div>
        </div>
      </section>

      <section className="tips-section">
        <div className="tips-lib-head">
          <div className="tc-label">📚 Toutes les astuces</div>
          <div className="chips small">
            <button className={`chip ${cat === 'all' ? 'selected' : ''}`} onClick={() => setCat('all')}>
              Tout
            </button>
            {TIP_CATS.map((c) => (
              <button key={c.id} className={`chip ${cat === c.id ? 'selected' : ''}`} onClick={() => setCat(c.id)}>
                {c.icon} {c.label}
              </button>
            ))}
          </div>
        </div>
        <div className="tips-grid">
          {mine.map((t) => card(t))}
          {library.map((t) => card(t, { forYou: t.weak?.some((w) => focusIds.has(w)) }))}
        </div>
      </section>
    </div>
  );
}
