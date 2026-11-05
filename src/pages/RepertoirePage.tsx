// Repertoire d'ouvertures : choisir ses ouvertures, les apprendre coup par coup, creer ses lignes.
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Chess } from 'chess.js';
import { Board } from '../components/Board';
import { Modal } from '../components/Modal';
import { formatSan } from '../lib/notation';
import { sounds } from '../lib/sounds';
import { useSettings } from '../settings/settings';
import { earn } from '../shop/store';
import { REP_OPENINGS, type RepOpening } from '../repertoire/lines';
import {
  activeLines,
  addCustomLine,
  findConflict,
  loadRep,
  lineStat,
  openingMastery,
  pickLine,
  recordLine,
  removeCustom,
  repSummary,
  replaceWith,
  subscribeRep,
  takePending,
  toggleOpening,
  whenText,
  type RepLine,
  type Side,
} from '../repertoire/store';
import { useRouteTab } from '../router';
import { track } from '../achievements/events';

let snap = JSON.stringify(loadRep());
const useRep = () =>
  useSyncExternalStore(
    (fn) =>
      subscribeRep(() => {
        snap = JSON.stringify(loadRep());
        fn();
      }),
    () => snap,
  );

type Conflict = NonNullable<ReturnType<typeof findConflict>>;
const toCg = (c: Side) => (c === 'w' ? 'white' : 'black');

function destsOf(c: Chess) {
  const d = new Map<string, string[]>();
  for (const m of c.moves({ verbose: true })) d.set(m.from, [...(d.get(m.from) ?? []), m.to]);
  return d;
}

/** "1.e4 e5 2.Cf3" */
export function lineText(sans: string[], notation: 'fr' | 'en', from = 0) {
  return sans
    .map((s, i) => {
      const ply = from + i;
      const n = Math.floor(ply / 2) + 1;
      const f = formatSan(s, notation);
      if (ply % 2 === 0) return `${n}.${f}`;
      return i === 0 ? `${n}…${f}` : f;
    })
    .join(' ');
}

export function RepertoirePage({ notify }: { notify: (m: string) => void }) {
  useRep();
  const { settings } = useSettings();
  const [side, setSide] = useState<Side>('w');
  const [view, setView] = useState<'list' | 'drill' | 'build'>('list');
  useRouteTab(2, side, setSide, { w: 'blancs', b: 'noirs' });
  const [drillFilter, setDrillFilter] = useState<{ id?: string; prefix?: string[] } | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [conflict, setConflict] = useState<{ c: Conflict; id: string } | null>(null);

  // Arrivee depuis la review : entrainement sur la ligne concernee
  useEffect(() => {
    const p = takePending();
    if (p) {
      setSide(p.color);
      setDrillFilter({ prefix: p.prefix });
      setView('drill');
    }
  }, []);

  const sum = repSummary();
  const mineLines = activeLines(side);
  const chosen = loadRep().chosen;
  const custom = loadRep().custom.filter((c) => c.color === side);
  const groups = useMemo(() => {
    const g = new Map<string, RepOpening[]>();
    for (const o of REP_OPENINGS.filter((x) => x.color === side)) g.set(o.against, [...(g.get(o.against) ?? []), o]);
    return [...g.entries()];
  }, [side]);

  const toggle = (o: RepOpening) => {
    const r = toggleOpening(o.id);
    if (!r.ok && r.conflict) setConflict({ c: r.conflict, id: o.id });
    else notify(chosen.includes(o.id) ? `${o.name} retirée du répertoire` : `${o.name} ajoutée au répertoire`);
  };

  if (view === 'drill')
    return (
      <Drill
        side={side}
        filter={drillFilter}
        onExit={() => {
          setView('list');
          setDrillFilter(null);
        }}
      />
    );
  if (view === 'build') return <Builder side={side} onExit={() => setView('list')} notify={notify} />;

  const dueSide = mineLines.filter((l) => {
    const s = lineStat(l.key);
    return !s || daysLeft(s.due) <= 0;
  }).length;

  return (
    <div className="rep">
      <section className="card rep-hero">
        <div>
          <h1>📖 Mon répertoire</h1>
          <p className="muted">
            Choisis tes ouvertures, puis entraîne-toi : l’app joue les coups adverses, tu joues les tiens. Chaque ligne revient de
            plus en plus tard quand tu la connais. Après tes parties, l’Historique te dit où tu es sorti de ta préparation.
          </p>
        </div>
        <div className="rep-stats">
          <div>
            <b>{sum.total}</b>
            <span className="tc-label">lignes</span>
          </div>
          <div>
            <b>{sum.learned}</b>
            <span className="tc-label">apprises</span>
          </div>
          <div>
            <b>{sum.due}</b>
            <span className="tc-label">à revoir</span>
          </div>
        </div>
      </section>

      <div className="rep-bar">
        <div className="chips">
          <button className={`chip ${side === 'w' ? 'selected' : ''}`} onClick={() => setSide('w')}>
            ♔ Avec les Blancs
          </button>
          <button className={`chip ${side === 'b' ? 'selected' : ''}`} onClick={() => setSide('b')}>
            ♚ Avec les Noirs
          </button>
        </div>
        <div className="row">
          <button className="btn ghost" onClick={() => setView('build')}>
            ✏️ Créer une ligne
          </button>
          <button
            className="btn primary"
            disabled={!mineLines.length}
            onClick={() => {
              setDrillFilter(null);
              setView('drill');
            }}
          >
            🎯 S’entraîner{dueSide > 0 ? ` (${dueSide} à revoir)` : ''}
          </button>
        </div>
      </div>

      {!mineLines.length && (
        <p className="muted rep-empty">
          Aucune ouverture {side === 'w' ? 'avec les Blancs' : 'avec les Noirs'} pour l’instant. Ajoute-en une ci-dessous, une par
          famille suffit pour commencer.
        </p>
      )}

      {groups.map(([against, list]) => (
        <section key={against} className="rep-group">
          <div className="tc-label">Contre {against}</div>
          <div className="rep-grid">
            {list.map((o) => {
              const on = chosen.includes(o.id);
              const m = openingMastery(o.id);
              return (
                <div key={o.id} className={`card rep-card ${on ? 'on' : ''}`}>
                  <div className="rep-card-head">
                    <strong>{o.name}</strong>
                    <span className={`tag level-${o.level}`}>{o.level}</span>
                  </div>
                  <p className="muted small">{o.ideas}</p>
                  <p className="rep-main">{lineText(o.lines[0].split(' ').slice(0, 8), settings.notation)}…</p>
                  {on && (
                    <div className="rep-mastery" title="Lignes connues">
                      <i style={{ width: `${Math.round(m * 100)}%` }} />
                      <span className="muted tiny">
                        {Math.round(m * o.lines.length)}/{o.lines.length} lignes connues
                      </span>
                    </div>
                  )}
                  <div className="row">
                    <button className={`btn ${on ? 'ghost' : 'primary'}`} onClick={() => toggle(o)}>
                      {on ? 'Retirer' : '+ Ajouter'}
                    </button>
                    {on && (
                      <button
                        className="btn"
                        onClick={() => {
                          setDrillFilter({ id: o.id });
                          setView('drill');
                        }}
                      >
                        S’entraîner
                      </button>
                    )}
                    <button className="btn ghost" onClick={() => setOpen(open === o.id ? null : o.id)}>
                      {open === o.id ? 'Masquer' : `${o.lines.length} lignes`}
                    </button>
                  </div>
                  {open === o.id && (
                    <ol className="rep-lines">
                      {o.lines.map((l) => {
                        const st = lineStat(`${o.color}:${l}`);
                        return (
                          <li key={l}>
                            <span>{lineText(l.split(' '), settings.notation)}</span>
                            {on && st && <span className="muted tiny"> · revoir {whenText(st.due)}</span>}
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <section className="rep-group">
        <div className="tc-label">Mes lignes perso</div>
        {custom.length === 0 && <p className="muted small">Crée tes propres lignes avec « Créer une ligne ». Elles s’entraînent comme les autres.</p>}
        <div className="rep-grid">
          {custom.map((c) => (
            <div key={c.id} className="card rep-card on">
              <div className="rep-card-head">
                <strong>{c.name}</strong>
                <button className="icon-btn" title="Supprimer" onClick={() => removeCustom(c.id)}>
                  🗑️
                </button>
              </div>
              <p className="rep-main">{lineText(c.line.split(' '), settings.notation)}</p>
            </div>
          ))}
        </div>
      </section>

      {conflict && (
        <Modal title="Deux coups pour la même position" onClose={() => setConflict(null)}>
          <p>
            Après <b>{conflict.c.prefix.length ? lineText(conflict.c.prefix, settings.notation) : 'le début de partie'}</b>, tu joues{' '}
            <b>{formatSan(conflict.c.yours, settings.notation)}</b> dans <b>{conflict.c.with}</b>, mais{' '}
            <b>{formatSan(conflict.c.other, settings.notation)}</b> dans <b>{conflict.c.name}</b>.
          </p>
          <p className="muted small">Un répertoire donne une seule réponse par position, sinon on ne sait plus quoi réviser.</p>
          <div className="row">
            <button
              className="btn primary"
              onClick={() => {
                replaceWith(conflict.id);
                notify(`${conflict.c.name} remplace ${conflict.c.with}`);
                setConflict(null);
              }}
            >
              Remplacer {conflict.c.with}
            </button>
            <button className="btn ghost" onClick={() => setConflict(null)}>
              Garder {conflict.c.with}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function daysLeft(day: string) {
  return Math.round((Date.parse(`${day}T12:00:00Z`) - Date.now()) / 86400000);
}

/* ---------------- Entrainement ---------------- */

function Drill({ side, filter, onExit }: { side: Side; filter: { id?: string; prefix?: string[] } | null; onExit: () => void }) {
  const { settings } = useSettings();
  const match = useCallback(
    (l: RepLine) => {
      if (filter?.id && l.sourceId !== filter.id) return false;
      if (filter?.prefix && !filter.prefix.every((s, i) => l.sans[i] === s)) return false;
      return true;
    },
    [filter],
  );
  const chess = useRef(new Chess());
  const [line, setLine] = useState<RepLine | null>(null);
  const [ply, setPly] = useState(0);
  const [fen, setFen] = useState(chess.current.fen());
  const [lastMove, setLastMove] = useState('');
  const [errors, setErrors] = useState(0);
  const [shapes, setShapes] = useState<{ orig: string; dest?: string; brush: string }[]>([]);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'ko' | 'info'; text: string } | null>(null);
  const [resetToken, setResetToken] = useState(0);
  const [finished, setFinished] = useState<{ errors: number; due: string } | null>(null);
  const [count, setCount] = useState({ lines: 0, perfect: 0 });
  const timers = useRef<number[]>([]);
  const later = (f: () => void, ms: number) => timers.current.push(window.setTimeout(f, ms));
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const syncBoard = () => {
    setFen(chess.current.fen());
    const h = chess.current.history({ verbose: true });
    const l = h[h.length - 1];
    setLastMove(l ? l.from + l.to : '');
  };
  const play = (san: string, opp: boolean) => {
    const m = chess.current.move(san);
    syncBoard();
    if (m.captured) sounds.capture(m.captured, opp);
    else if (m.san.includes('O-O')) sounds.castle();
    else sounds.move();
  };

  // Joue les coups adverses tant que ce n'est pas a toi
  const advance = (l: RepLine, from: number) => {
    let i = from;
    const step = () => {
      if (i >= l.sans.length) {
        finish(l);
        return;
      }
      const userTurn = (i % 2 === 0) === (side === 'w');
      if (userTurn) {
        setPly(i);
        return;
      }
      play(l.sans[i], true);
      i++;
      setPly(i);
      later(step, 420);
    };
    step();
  };

  const errorsRef = useRef(0);
  const finish = (l: RepLine) => {
    const st = recordLine(l.key, errorsRef.current);
    setFinished({ errors: errorsRef.current, due: st.due });
    setCount((c) => ({ lines: c.lines + 1, perfect: c.perfect + (errorsRef.current ? 0 : 1) }));
    track('rep-line');
    if (!errorsRef.current) {
      sounds.success();
      earn(2, 'Ligne de répertoire', true);
    }
  };

  const next = (exclude?: string) => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    const l = pickLine(side, exclude, match);
    chess.current = new Chess();
    syncBoard();
    setShapes([]);
    setMsg(null);
    setErrors(0);
    errorsRef.current = 0;
    setFinished(null);
    setLine(l);
    setPly(0);
    if (l) later(() => advance(l, 0), 350);
  };

  useEffect(() => {
    next();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const userTurn = !!line && !finished && ply < line.sans.length && (ply % 2 === 0) === (side === 'w');

  const onMove = (from: string, to: string) => {
    if (!line || !userTurn) return;
    const expected = line.sans[ply];
    const test = new Chess(chess.current.fen());
    let san: string;
    try {
      const piece = test.get(from as never) as { type: string } | null;
      const promo = piece?.type === 'p' && (to[1] === '8' || to[1] === '1') ? 'q' : undefined;
      san = test.move({ from, to, promotion: promo }).san;
    } catch {
      setResetToken((x) => x + 1);
      return;
    }
    if (san !== expected) {
      // Mauvais coup : on montre le coup prevu, le joueur doit le rejouer
      errorsRef.current++;
      setErrors(errorsRef.current);
      sounds.fail();
      const m = new Chess(chess.current.fen()).move(expected);
      setShapes([{ orig: m.from, dest: m.to, brush: 'green' }]);
      setMsg({
        kind: 'ko',
        text: `${formatSan(san, settings.notation)} n’est pas dans ton répertoire. Le coup prévu : ${formatSan(expected, settings.notation)}. Joue-le pour continuer.`,
      });
      setResetToken((x) => x + 1);
      return;
    }
    setShapes([]);
    setMsg({ kind: 'ok', text: `${formatSan(san, settings.notation)} ✓` });
    play(san, false);
    const n = ply + 1;
    setPly(n);
    later(() => advance(line, n), 380);
  };

  const orientation = toCg(side);
  const dests = useMemo(() => (userTurn ? destsOf(chess.current) : new Map<string, string[]>()), [fen, userTurn]); // eslint-disable-line react-hooks/exhaustive-deps
  const played = chess.current.history();
  const opening = line ? REP_OPENINGS.find((o) => o.id === line.sourceId) : null;

  return (
    <div className="play rep-drill">
      <section className="board-col">
        <div className="board-stage">
          <Board
            fen={fen}
            orientation={orientation}
            turnColor={toCg(chess.current.turn())}
            movableColor={userTurn ? orientation : undefined}
            dests={dests}
            lastMove={lastMove}
            inCheck={chess.current.inCheck()}
            premovable={false}
            shapes={shapes}
            resetToken={resetToken}
            onMove={onMove}
          />
        </div>
      </section>
      <aside className="side flush">
        <div className="card">
          <div className="tc-label">
            📖 Entraînement · {side === 'w' ? 'Blancs' : 'Noirs'} · {count.lines} ligne{count.lines > 1 ? 's' : ''} ({count.perfect} sans
            faute)
          </div>
          {!line && <p>Aucune ligne à travailler ici. Ajoute une ouverture à ton répertoire.</p>}
          {line && (
            <>
              <div className="status">{line.name}</div>
              {opening && <p className="muted small">{opening.ideas}</p>}
              <p className="rep-played">{played.length ? lineText(played, settings.notation) : 'Position de départ'}</p>
              {!finished && (
                <p className={`rep-msg ${msg?.kind ?? ''}`}>
                  {msg?.text ?? (userTurn ? 'À toi : joue le coup de ton répertoire.' : 'L’adversaire joue…')}
                </p>
              )}
              {finished && (
                <div className={`rep-msg ${finished.errors ? 'ko' : 'ok'}`}>
                  {finished.errors
                    ? `Ligne terminée avec ${finished.errors} erreur${finished.errors > 1 ? 's' : ''} : elle revient demain.`
                    : `Ligne parfaite ! Prochaine révision ${whenText(finished.due)}. +2 🪙`}
                </div>
              )}
              {errors > 0 && !finished && <p className="muted tiny">Erreurs sur cette ligne : {errors}</p>}
            </>
          )}
        </div>
        <div className="row">
          {finished && (
            <button className="btn primary" onClick={() => next(line?.key)}>
              Ligne suivante
            </button>
          )}
          {line && !finished && (
            <button
              className="btn ghost"
              onClick={() => {
                const rest = line.sans.slice(ply);
                setMsg({ kind: 'info', text: `Suite prévue : ${lineText(rest, settings.notation, ply)}` });
              }}
            >
              Voir la suite
            </button>
          )}
          <button className="btn ghost" onClick={onExit}>
            Terminer
          </button>
        </div>
      </aside>
    </div>
  );
}

/* ---------------- Creation d'une ligne ---------------- */

function Builder({ side, onExit, notify }: { side: Side; onExit: () => void; notify: (m: string) => void }) {
  const { settings } = useSettings();
  const [color, setColor] = useState<Side>(side);
  const [sans, setSans] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [resetToken, setResetToken] = useState(0);
  const chess = useMemo(() => {
    const c = new Chess();
    for (const s of sans) c.move(s);
    return c;
  }, [sans]);
  const h = chess.history({ verbose: true });
  const last = h[h.length - 1];

  return (
    <div className="play rep-drill">
      <section className="board-col">
        <div className="board-stage">
          <Board
            fen={chess.fen()}
            orientation={toCg(color)}
            turnColor={toCg(chess.turn())}
            movableColor={toCg(chess.turn())}
            dests={destsOf(chess)}
            lastMove={last ? last.from + last.to : ''}
            inCheck={chess.inCheck()}
            premovable={false}
            resetToken={resetToken}
            onMove={(from, to) => {
              const c = new Chess(chess.fen());
              try {
                const piece = c.get(from as never) as { type: string } | null;
                const promo = piece?.type === 'p' && (to[1] === '8' || to[1] === '1') ? 'q' : undefined;
                const m = c.move({ from, to, promotion: promo });
                setSans([...sans, m.san]);
                setErr(null);
                sounds.move();
              } catch {
                setResetToken((x) => x + 1);
              }
            }}
          />
        </div>
      </section>
      <aside className="side flush">
        <div className="card rep-builder">
          <div className="tc-label">✏️ Nouvelle ligne</div>
          <p className="muted small">Joue les coups des deux camps sur le plateau, puis enregistre.</p>
          <span className="label">Je joue</span>
          <div className="chips">
            <button className={`chip ${color === 'w' ? 'selected' : ''}`} onClick={() => setColor('w')}>
              Les Blancs
            </button>
            <button className={`chip ${color === 'b' ? 'selected' : ''}`} onClick={() => setColor('b')}>
              Les Noirs
            </button>
          </div>
          <p className="rep-played">{sans.length ? lineText(sans, settings.notation) : 'Aucun coup joué'}</p>
          <input className="text-input" placeholder="Nom de la ligne (ex. Mon Londres)" value={name} onChange={(e) => setName(e.target.value)} />
          {err && <p className="error small">{err}</p>}
          <div className="row">
            <button className="btn ghost" disabled={!sans.length} onClick={() => setSans(sans.slice(0, -1))}>
              ↶ Annuler un coup
            </button>
            <button className="btn ghost" disabled={!sans.length} onClick={() => setSans([])}>
              Recommencer
            </button>
          </div>
          <button
            className="btn primary wide"
            disabled={sans.length < 2}
            onClick={() => {
              const r = addCustomLine(color, sans, name.trim() || 'Ma ligne');
              if (!r.ok) {
                setErr(
                  `Conflit avec ${r.conflict.with} : après ${r.conflict.prefix.length ? lineText(r.conflict.prefix, settings.notation) : 'le début'}, tu y joues ${formatSan(r.conflict.yours, settings.notation)}.`,
                );
                return;
              }
              notify('Ligne ajoutée à ton répertoire');
              setSans([]);
              setName('');
            }}
          >
            Enregistrer dans mon répertoire
          </button>
        </div>
        <button className="btn ghost" onClick={onExit}>
          ← Retour au répertoire
        </button>
      </aside>
    </div>
  );
}
