// Sons de jeu synthetises avec la Web Audio API (aucun fichier audio a gerer).
// Packs de sons (boutique) : la prise depend de la valeur de la piece prise, et la review a ses propres sons.

let ctx: AudioContext | null = null;
let enabled = true;
let volume = 0.8;
let master: GainNode | null = null;

export function setSoundEnabled(value: boolean) {
  enabled = value;
}

type Pack = 'classic' | 'impact' | 'arcade' | 'crystal' | string;
let pack: Pack = 'classic';
export function setSoundPack(id: string) {
  const p = id.replace('sounds-', '');
  pack = ['classic', 'impact', 'arcade', 'crystal'].includes(p) || SYNTH[p] ? p : 'classic';
}

/* ---------------- Packs synthetises (decrits par quelques parametres) ---------------- */

interface Synth {
  /** Facon de jouer les notes */
  style: 'notes' | 'drum' | 'glide' | 'bell';
  wave: OscillatorType;
  /** Gamme utilisee (frequences croissantes, au moins 8 notes) */
  scale: number[];
  gain: number;
  /** Duree d'une note */
  len: number;
  /** Ecart entre deux notes d'un arpege */
  step: number;
  /** Bruit de piece ajoute aux prises */
  knock?: [number, number];
}

const C = [262, 294, 330, 392, 440, 523, 587, 659, 784, 880, 1047, 1175, 1319, 1568];
const PENTA = [220, 262, 294, 330, 392, 440, 523, 587, 659, 784, 880, 1047];
const MINOR = [196, 220, 233, 262, 294, 311, 349, 392, 440, 466, 523, 587];

const SYNTH: Record<string, Synth> = {
  bois: { style: 'drum', wave: 'sine', scale: [320, 380, 450, 520, 600, 700, 820, 950, 1100], gain: 1.6, len: 0.1, step: 0.07 },
  cloches: { style: 'bell', wave: 'sine', scale: C.map((f) => f / 2), gain: 0.07, len: 1.4, step: 0.16 },
  retro: { style: 'notes', wave: 'triangle', scale: PENTA.map((f) => f * 2), gain: 0.08, len: 0.08, step: 0.045 },
  cosmos: { style: 'glide', wave: 'sine', scale: PENTA, gain: 0.07, len: 0.45, step: 0.12 },
  zen: { style: 'notes', wave: 'sine', scale: PENTA, gain: 0.05, len: 1.1, step: 0.18, knock: [600, 0.3] },
  piano: { style: 'notes', wave: 'triangle', scale: C, gain: 0.09, len: 0.5, step: 0.07, knock: [1400, 0.5] },
  percu: { style: 'drum', wave: 'sine', scale: [90, 120, 160, 210, 280, 380, 520, 700, 950], gain: 2.4, len: 0.16, step: 0.09 },
  robot: { style: 'notes', wave: 'square', scale: [180, 240, 300, 410, 470, 620, 750, 930, 1100, 1300], gain: 0.05, len: 0.06, step: 0.05 },
  harpe: { style: 'notes', wave: 'triangle', scale: C, gain: 0.06, len: 0.7, step: 0.035 },
  fanfare: { style: 'notes', wave: 'sawtooth', scale: C, gain: 0.045, len: 0.22, step: 0.09, knock: [900, 0.5] },
  orgue: { style: 'bell', wave: 'triangle', scale: C.map((f) => f / 2), gain: 0.06, len: 1.6, step: 0.2 },
  galaxie: { style: 'glide', wave: 'triangle', scale: PENTA.map((f) => f / 2), gain: 0.07, len: 0.8, step: 0.16 },
  sombre: { style: 'notes', wave: 'sawtooth', scale: MINOR, gain: 0.05, len: 0.35, step: 0.1, knock: [500, 0.8] },
};

/** Joue une suite de notes de la gamme du pack (indices dans la gamme) */
function play(sy: Synth, idx: number[], opts: { at?: number; soft?: boolean } = {}) {
  const at0 = opts.at ?? 0;
  const g = sy.gain * (opts.soft ? 0.6 : 1);
  idx.forEach((i, n) => {
    const f = sy.scale[Math.max(0, Math.min(sy.scale.length - 1, i))];
    const at = at0 + n * sy.step;
    switch (sy.style) {
      case 'drum':
        knock(at, f, g, sy.len);
        break;
      case 'glide':
        glide(at, f * 0.7, f * 1.4, sy.len, g, sy.wave);
        break;
      case 'bell':
        tone(at, f, sy.len, g, 'sine');
        tone(at, f * 2.76, sy.len * 0.5, g * 0.4, 'sine');
        tone(at, f * 5.4, sy.len * 0.25, g * 0.2, 'sine');
        break;
      default:
        tone(at, f, sy.len, g, sy.wave);
    }
  });
}

/** Nombre de notes selon la valeur de la piece : 1 (pion) a 4 (dame) */
const notesFor = (v: number) => (v >= 9 ? 4 : v >= 5 ? 3 : v >= 3 ? 2 : 1);

function synthCapture(sy: Synth, v: number) {
  const n = notesFor(v);
  const top = Math.min(sy.scale.length - 1, 4 + n * 2);
  if (sy.knock) knock(0, sy.knock[0], sy.knock[1]);
  play(sy, Array.from({ length: n }, (_, i) => top - (n - 1 - i) * 2));
}

function synthLost(sy: Synth, v: number) {
  const n = notesFor(v);
  if (sy.knock) knock(0, sy.knock[0] * 0.6, sy.knock[1] * 1.2);
  play(sy, Array.from({ length: n }, (_, i) => Math.max(0, 4 - i * 1 - (n > 2 ? 1 : 0))));
}

function synthReview(sy: Synth, category: string): boolean {
  const L = sy.scale.length - 1;
  const cues: Record<string, number[]> = {
    brilliant: [L - 6, L - 4, L - 2, L - 1, L],
    great: [L - 5, L - 3, L - 1],
    best: [L - 2],
    book: [Math.floor(L / 2)],
    miss: [3, 1],
    mistake: [4, 2],
    blunder: [5, 3, 1, 0],
  };
  const idx = cues[category];
  if (!idx) return false;
  if (category === 'blunder' && sy.knock) knock(0, sy.knock[0] * 0.4, sy.knock[1] * 2, 0.2);
  play(sy, idx, { soft: category === 'book' || category === 'best' });
  return true;
}

/* ---------------- Coup simple, fin de partie et messages : propres a chaque pack ---------------- */

export type Outcome = 'win' | 'loss' | 'draw';

function synthMove(sy: Synth) {
  const f = sy.scale[3];
  switch (sy.style) {
    case 'drum':
      knock(0, f, sy.gain * 0.75, sy.len * 0.8);
      break;
    case 'glide':
      glide(0, f * 0.9, f * 1.15, Math.min(0.18, sy.len * 0.4), sy.gain * 0.7, sy.wave);
      break;
    case 'bell':
      tone(0, f * 2, Math.min(0.5, sy.len * 0.35), sy.gain * 0.6, 'sine');
      tone(0, f * 5.5, 0.12, sy.gain * 0.15, 'sine');
      break;
    default:
      if (sy.knock) knock(0, sy.knock[0] * 1.4, sy.knock[1] * 0.8, 0.05);
      tone(0, f, Math.min(0.14, sy.len * 0.5), sy.gain * 0.7, sy.wave);
  }
}

function synthEnd(sy: Synth, o: Outcome) {
  const L = sy.scale.length - 1;
  const seq = o === 'win' ? [2, 4, 6, Math.min(L, 9)] : o === 'loss' ? [6, 4, 3, 0] : [4, 4, 5, 4];
  if (o === 'loss' && sy.knock) knock(0, sy.knock[0] * 0.4, sy.knock[1] * 1.5, 0.2);
  sy.style === 'drum' ? seq.forEach((i, n) => knock(n * sy.step * 1.6, sy.scale[i], sy.gain, sy.len * 1.2)) : play({ ...sy, step: sy.step * 1.6 }, seq);
}

function synthMessage(sy: Synth, mine: boolean) {
  const L = sy.scale.length - 1;
  const seq = mine ? [L - 4, L - 2] : [L - 3, L - 5];
  if (sy.style === 'drum') seq.forEach((i, n) => knock(n * 0.07, sy.scale[i], sy.gain * 0.6, 0.06));
  else play({ ...sy, len: Math.min(sy.len, 0.25), step: 0.07 }, seq, { soft: true });
}

/** Coup simple (sans prise) */
function move() {
  if (SYNTH[pack]) return synthMove(SYNTH[pack]);
  switch (pack) {
    case 'impact':
      knock(0, 900, 2.2, 0.09);
      tone(0, 120, 0.12, 0.08, 'sine');
      break;
    case 'arcade':
      tone(0, 660, 0.05, 0.06, 'square');
      break;
    case 'crystal':
      tone(0, 1760, 0.25, 0.05, 'sine');
      knock(0, 3000, 0.3, 0.03);
      break;
    default:
      knock(0, 1800, 1.4);
  }
}

/** Fin de partie : victoire, defaite ou nulle */
function end(o: Outcome) {
  if (SYNTH[pack]) return synthEnd(SYNTH[pack], o);
  const notes = (list: number[], step: number, len: number, gain: number, type: OscillatorType) => list.forEach((f, i) => tone(i * step, f, len, gain, type));
  switch (pack) {
    case 'impact':
      if (o === 'win') {
        knock(0, 300, 3, 0.3);
        notes([262, 392, 523, 784], 0.12, 0.5, 0.11, 'sawtooth');
      } else if (o === 'loss') {
        knock(0, 150, 3.5, 0.4);
        notes([196, 147, 110, 73], 0.18, 0.6, 0.13, 'sawtooth');
      } else notes([330, 330, 349], 0.15, 0.4, 0.1, 'sawtooth');
      break;
    case 'arcade':
      if (o === 'win') notes([523, 659, 784, 1047, 784, 1047], 0.08, 0.1, 0.07, 'square');
      else if (o === 'loss') notes([494, 466, 440, 415, 392], 0.14, 0.14, 0.07, 'square');
      else notes([523, 523, 523], 0.12, 0.08, 0.06, 'square');
      break;
    case 'crystal':
      if (o === 'win') notes([1047, 1319, 1568, 2093, 2637], 0.08, 0.9, 0.045, 'sine');
      else if (o === 'loss') notes([880, 740, 622, 523], 0.15, 0.9, 0.045, 'sine');
      else notes([1175, 1319, 1175], 0.14, 0.8, 0.04, 'sine');
      break;
    default:
      // Classique : bois + petit motif au triangle
      knock(0, 1200, 1.2, 0.1);
      if (o === 'win') notes([523, 659, 784, 1047], 0.12, 0.35, 0.11, 'triangle');
      else if (o === 'loss') notes([440, 349, 294, 220], 0.16, 0.4, 0.11, 'triangle');
      else notes([523, 587, 523], 0.14, 0.35, 0.1, 'triangle');
  }
}

/** Message de chat : envoye (mine) ou recu */
function message(mine: boolean) {
  if (SYNTH[pack]) return synthMessage(SYNTH[pack], mine);
  switch (pack) {
    case 'impact':
      knock(0, mine ? 1600 : 1100, 1.2, 0.05);
      tone(0.02, mine ? 880 : 660, 0.08, 0.06, 'triangle');
      break;
    case 'arcade':
      (mine ? [880, 1175] : [1175, 880]).forEach((f, i) => tone(i * 0.05, f, 0.05, 0.05, 'square'));
      break;
    case 'crystal':
      (mine ? [1568, 2093] : [2093, 1568]).forEach((f, i) => tone(i * 0.06, f, 0.35, 0.035, 'sine'));
      break;
    default:
      (mine ? [784, 1047] : [1047, 784]).forEach((f, i) => tone(i * 0.07, f, 0.12, 0.07, 'sine'));
  }
}

const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 };

/** Prise : le son grossit avec la valeur de la piece prise (sauf pack classique) */
function capture(piece?: string) {
  const v = VALUE[piece ?? 'p'] ?? 1;
  if (SYNTH[pack]) return synthCapture(SYNTH[pack], v);
  const k = (v - 1) / 8; // 0 (pion) .. 1 (dame)
  switch (pack) {
    case 'impact':
      knock(0, 1100 - 600 * k, 1.6 + 1.6 * k, 0.1 + 0.12 * k);
      knock(0.04, 1500 - 500 * k, 1.0 + k);
      if (v >= 5) tone(0.02, 110 - 30 * k, 0.25 + 0.3 * k, 0.12 + 0.1 * k, 'sine');
      if (v >= 9) knock(0.1, 300, 2.4, 0.25);
      break;
    case 'arcade': {
      const notes = v >= 9 ? [523, 659, 784, 1047] : v >= 5 ? [523, 659, 784] : v >= 3 ? [523, 784] : [784];
      notes.forEach((f, i) => tone(i * 0.06, f, 0.07, 0.07, 'square'));
      break;
    }
    case 'crystal': {
      const base = 1568 - 700 * k;
      tone(0, base, 0.35 + 0.4 * k, 0.07, 'sine');
      tone(0.03, base * 1.5, 0.3 + 0.3 * k, 0.04, 'sine');
      if (v >= 5) tone(0.08, base * 2, 0.5, 0.035, 'sine');
      if (v >= 9) tone(0.16, base * 2.5, 0.7, 0.03, 'sine');
      knock(0, 2500, 0.4, 0.05);
      break;
    }
    default:
      knock(0, 900, 1.8, 0.1);
      knock(0.045, 1500, 1.0);
  }
}

/**
 * L'adversaire prend une de tes pieces : son plus sombre, qui s'alourdit avec la valeur perdue
 * (dans tous les packs, y compris le classique).
 */
function lost(piece?: string) {
  const v = VALUE[piece ?? 'p'] ?? 1;
  if (SYNTH[pack]) return synthLost(SYNTH[pack], v);
  const k = (v - 1) / 8;
  switch (pack) {
    case 'impact':
      knock(0, 700 - 400 * k, 2 + 1.5 * k, 0.14 + 0.15 * k);
      tone(0.03, 98 - 30 * k, 0.3 + 0.4 * k, 0.14 + 0.08 * k, 'sawtooth');
      if (v >= 5) tone(0.15, 73 - 20 * k, 0.4 + 0.3 * k, 0.12, 'sawtooth');
      if (v >= 9) knock(0.22, 150, 3, 0.35);
      break;
    case 'arcade': {
      // Notes qui descendent : une par pion, quatre pour la dame
      const notes = v >= 9 ? [523, 415, 330, 262] : v >= 5 ? [440, 349, 277] : v >= 3 ? [392, 311] : [330];
      notes.forEach((f, i) => tone(i * 0.08, f, 0.09, 0.07, 'square'));
      break;
    }
    case 'crystal': {
      const base = 880 - 400 * k;
      tone(0, base, 0.4 + 0.4 * k, 0.06, 'sine');
      tone(0.1, base * 0.84, 0.5 + 0.4 * k, 0.05, 'sine');
      if (v >= 5) tone(0.22, base * 0.67, 0.7, 0.045, 'sine');
      if (v >= 9) tone(0.36, base * 0.5, 1, 0.04, 'sine');
      break;
    }
    default:
      // Classique : le meme bois, plus grave, avec une note qui baisse selon la perte
      knock(0, 700 - 250 * k, 1.8 + k, 0.11 + 0.06 * k);
      knock(0.045, 1100 - 300 * k, 0.9);
      if (v >= 3) tone(0.05, 330 - 90 * k, 0.18 + 0.2 * k, 0.07 + 0.04 * k, 'triangle');
      if (v >= 9) tone(0.2, 196, 0.35, 0.09, 'triangle');
  }
}

/** Review : son selon la categorie du coup. Renvoie false si la categorie n'a pas de son propre. */
function review(category: string): boolean {
  if (SYNTH[pack]) return synthReview(SYNTH[pack], category);
  if (pack === 'classic') {
    if (category === 'blunder') sounds.blunder();
    else if (category === 'brilliant' || category === 'great') sounds.brilliant();
    else if (category === 'book') sounds.book();
    else return false;
    return true;
  }
  const cues: Record<string, Partial<Record<string, () => void>>> = {
    classic: {},
    impact: {
      blunder: () => {
        knock(0, 200, 3, 0.35);
        tone(0, 98, 0.6, 0.18, 'sawtooth');
        tone(0.15, 73, 0.7, 0.15, 'sawtooth');
      },
      mistake: () => {
        knock(0, 400, 2, 0.2);
        tone(0, 147, 0.4, 0.12, 'sawtooth');
      },
      miss: () => tone(0, 196, 0.4, 0.12, 'triangle'),
      brilliant: () => {
        knock(0, 2500, 1.5, 0.1);
        [523, 784, 1047, 1568].forEach((f, i) => tone(i * 0.05, f, 0.4, 0.08, 'triangle'));
      },
      great: () => [659, 988, 1319].forEach((f, i) => tone(i * 0.06, f, 0.3, 0.08, 'triangle')),
      best: () => tone(0, 1047, 0.15, 0.06, 'triangle'),
      book: () => knock(0, 1200, 1.2, 0.12),
    },
    arcade: {
      blunder: () => [392, 330, 262, 196].forEach((f, i) => tone(i * 0.09, f, 0.1, 0.08, 'square')),
      mistake: () => [330, 262].forEach((f, i) => tone(i * 0.09, f, 0.1, 0.07, 'square')),
      miss: () => tone(0, 220, 0.15, 0.06, 'square'),
      brilliant: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(i * 0.05, f, 0.08, 0.07, 'square')),
      great: () => [659, 880, 1175].forEach((f, i) => tone(i * 0.05, f, 0.08, 0.07, 'square')),
      best: () => tone(0, 1319, 0.06, 0.05, 'square'),
      book: () => tone(0, 784, 0.05, 0.05, 'square'),
    },
    crystal: {
      blunder: () => [622, 466, 349].forEach((f, i) => tone(i * 0.12, f, 0.6, 0.06, 'sine')),
      mistake: () => [523, 415].forEach((f, i) => tone(i * 0.12, f, 0.5, 0.05, 'sine')),
      miss: () => tone(0, 440, 0.5, 0.05, 'sine'),
      brilliant: () => [1047, 1319, 1568, 2093, 2637].forEach((f, i) => tone(i * 0.07, f, 0.8, 0.045, 'sine')),
      great: () => [1319, 1760, 2093].forEach((f, i) => tone(i * 0.07, f, 0.7, 0.045, 'sine')),
      best: () => tone(0, 2093, 0.5, 0.035, 'sine'),
      book: () => tone(0, 1568, 0.4, 0.03, 'sine'),
    },
  };
  const cue = cues[pack]?.[category];
  if (!cue) return false;
  cue();
  return true;
}

export function setVolume(value: number) {
  volume = Math.max(0, Math.min(1, value));
  if (master) master.gain.value = volume;
}

/** Sortie commune a tous les sons (applique le volume) */
function out(ac: AudioContext): AudioNode {
  if (!master) {
    master = ac.createGain();
    master.gain.value = volume;
    master.connect(ac.destination);
  }
  return master;
}

function audio(): AudioContext | null {
  if (!enabled) return null;
  try {
    if (!ctx) ctx = new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Bruit filtre court : bruit de piece posee sur le bois */
function knock(at: number, freq: number, gain: number, duration = 0.08) {
  const ac = audio();
  if (!ac) return;
  const len = Math.floor(ac.sampleRate * duration);
  const buffer = ac.createBuffer(1, len, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 4);
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = freq;
  filter.Q.value = 1.2;
  const g = ac.createGain();
  g.gain.value = gain;
  src.connect(filter).connect(g).connect(out(ac));
  src.start(ac.currentTime + at);
}

/** Note qui glisse d'une frequence a l'autre (pack Cosmique) */
function glide(at: number, f1: number, f2: number, duration: number, gain = 0.1, type: OscillatorType = 'sine') {
  const ac = audio();
  if (!ac) return;
  const osc = ac.createOscillator();
  osc.type = type;
  const t = ac.currentTime + at;
  osc.frequency.setValueAtTime(f1, t);
  osc.frequency.exponentialRampToValueAtTime(f2, t + duration);
  const g = ac.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(g).connect(out(ac));
  osc.start(t);
  osc.stop(t + duration + 0.05);
}

function tone(at: number, freq: number, duration: number, gain = 0.15, type: OscillatorType = 'sine') {
  const ac = audio();
  if (!ac) return;
  const osc = ac.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  const g = ac.createGain();
  const t = ac.currentTime + at;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(g).connect(out(ac));
  osc.start(t);
  osc.stop(t + duration + 0.05);
}

export const sounds = {
  move: () => move(),
  /** Fin de partie selon le resultat (pour le joueur) ; sans resultat connu : petit motif neutre */
  end: (o: Outcome) => end(o),
  /** Chat : message envoye (true) ou recu (false) */
  message: (mine: boolean) => message(mine),
  /**
   * Prise : `piece` = type de la piece prise (p, n, b, r, q).
   * `lostByMe` = c'est une de MES pieces que l'adversaire vient de prendre.
   */
  capture: (piece?: string, lostByMe = false) => (lostByMe ? lost(piece) : capture(piece)),
  review: (category: string) => review(category),
  castle: () => {
    move();
    setTimeout(move, 110);
  },
  check: () => {
    move();
    tone(0.02, 880, 0.18, 0.12, 'triangle');
    tone(0.12, 1175, 0.22, 0.1, 'triangle');
  },
  promote: () => {
    move();
    tone(0.03, 660, 0.12, 0.1, 'triangle');
    tone(0.1, 990, 0.2, 0.1, 'triangle');
  },
  start: () => {
    tone(0, 523, 0.15, 0.1, 'triangle');
    tone(0.1, 784, 0.25, 0.1, 'triangle');
  },
  gameEnd: () => {
    tone(0, 523, 0.3, 0.12, 'triangle');
    tone(0.12, 659, 0.3, 0.12, 'triangle');
    tone(0.24, 784, 0.5, 0.12, 'triangle');
  },
  /** Pendule : il reste 1/10 du temps. Un coup de cloche grave qui resonne. */
  dong: () => {
    knock(0, 300, 0.6, 0.05);
    tone(0, 196, 2.2, 0.16, 'sine');
    tone(0, 392, 1.4, 0.06, 'sine');
    tone(0, 588, 0.9, 0.035, 'sine');
    tone(0, 823, 0.6, 0.025, 'sine');
    tone(0.004, 198, 2.0, 0.06, 'sine');
  },
  lowTime: () => {
    tone(0, 1320, 0.08, 0.08, 'square');
    tone(0.15, 1320, 0.08, 0.08, 'square');
  },
  success: () => {
    tone(0, 660, 0.14, 0.11, 'triangle');
    tone(0.09, 880, 0.14, 0.11, 'triangle');
    tone(0.18, 1320, 0.3, 0.1, 'triangle');
  },
  fail: () => {
    tone(0, 330, 0.18, 0.12, 'triangle');
    tone(0.12, 247, 0.3, 0.12, 'triangle');
  },
  /** Review : gaffe */
  blunder: () => {
    tone(0, 220, 0.25, 0.14, 'sawtooth');
    tone(0.12, 165, 0.35, 0.12, 'sawtooth');
  },
  /** Review : coup brillant ou tres bon coup */
  brilliant: () => {
    tone(0, 880, 0.12, 0.09, 'triangle');
    tone(0.07, 1175, 0.12, 0.09, 'triangle');
    tone(0.14, 1568, 0.3, 0.09, 'triangle');
    tone(0.22, 2093, 0.35, 0.06, 'sine');
  },
  /** Review : coup theorique */
  book: () => {
    knock(0, 1200, 0.9, 0.12);
    tone(0.02, 523, 0.18, 0.06, 'sine');
  },
  illegal: () => tone(0, 180, 0.15, 0.12, 'sawtooth'),
};

/** Sons ecoutables un par un dans la boutique */
export const SOUND_KEYS = ['move', 'cap-p', 'cap-n', 'cap-r', 'cap-q', 'lost-p', 'lost-n', 'lost-r', 'lost-q', 'brilliant', 'great', 'best', 'book', 'miss', 'mistake', 'blunder', 'win', 'loss', 'draw', 'msg-out', 'msg-in'] as const;
export type SoundKey = (typeof SOUND_KEYS)[number];

/** Joue un son d'un pack sans changer le pack equipe. Renvoie false si le pack n'a pas ce son. */
export function previewSound(packId: string, key: SoundKey): boolean {
  const before = pack;
  setSoundPack(packId);
  let ok = true;
  if (key === 'move') move();
  else if (key === 'win' || key === 'loss' || key === 'draw') end(key);
  else if (key === 'msg-out' || key === 'msg-in') message(key === 'msg-out');
  else if (key.startsWith('cap-')) capture(key.slice(4));
  else if (key.startsWith('lost-')) lost(key.slice(5));
  else ok = review(key);
  pack = before;
  return ok;
}

/** Le pack a-t-il un son dedie pour ce moment ? */
export function hasSound(packId: string, key: SoundKey): boolean {
  if (key.startsWith('cap-') || key.startsWith('lost-') || ['move', 'win', 'loss', 'draw', 'msg-out', 'msg-in'].includes(key)) return true;
  if (packId === 'sounds-classic') return ['blunder', 'brilliant', 'great', 'book'].includes(key);
  return true;
}
