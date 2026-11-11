#!/usr/bin/env node
// Importe la base de problemes Lichess (CC0) dans public/puzzles/
//
// 1. Telecharger https://database.lichess.org/lichess_db_puzzle.csv.zst (environ 270 Mo)
// 2. npm run puzzles:import -- chemin/vers/lichess_db_puzzle.csv.zst
//
// Options :
//   --out <dossier>          dossier de sortie (defaut : public/puzzles)
//   --max-per-band <n>       nombre max de problemes par tranche de 50 Elo (defaut : illimite)
//   --min-plays <n>          ignore les problemes joues moins de n fois (defaut : 0)
//   --min-popularity <n>     ignore les problemes moins populaires que n, de -100 a 100 (defaut : -100)
//
// Le fichier peut etre le .csv.zst d'origine ou un .csv deja decompresse.
// Format accepte : CSV Lichess complet, ou CSV simple "id,fen,coups,elo".

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { Readable } from 'node:stream';

const args = process.argv.slice(2);
const input = args.find((a, i) => !a.startsWith('--') && !(args[i - 1] || '').startsWith('--'));
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};

if (!input) {
  console.error('Usage : npm run puzzles:import -- <lichess_db_puzzle.csv.zst> [--max-per-band 20000]');
  process.exit(1);
}

const OUT = path.resolve(opt('out', 'public/puzzles'));
const MAX_PER_BAND = Number(opt('max-per-band', Infinity));
const MIN_PLAYS = Number(opt('min-plays', 0));
const MIN_POP = Number(opt('min-popularity', -100));
const BAND = 50;
const CHUNK = 5000;

async function openInput(file) {
  const raw = fs.createReadStream(file);
  if (!file.endsWith('.zst')) return raw;
  const { Decompress } = await import('fzstd');
  const out = new Readable({ read() {} });
  const dec = new Decompress((chunk, final) => {
    out.push(Buffer.from(chunk));
    if (final) out.push(null);
  });
  raw.on('data', (buf) => dec.push(new Uint8Array(buf)));
  raw.on('end', () => {
    try {
      dec.push(new Uint8Array(0), true);
    } catch {
      out.push(null);
    }
  });
  raw.on('error', (e) => out.destroy(e));
  return out;
}

// Un CSV Lichess ne contient pas de guillemets dans les champs utiles : un split suffit
function parse(line) {
  const f = line.split(',');
  if (f.length < 4 || f[0] === 'PuzzleId') return null;
  const rating = Number(f[3]);
  if (!Number.isFinite(rating)) return null;
  const full = f.length >= 8;
  return {
    id: f[0],
    fen: f[1],
    moves: f[2],
    rating,
    plays: full ? Number(f[6]) : Infinity,
    popularity: full ? Number(f[5]) : 100,
    themes: full && f[7] ? f[7].split(' ') : [],
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Sous Windows, renommer un dossier echoue (EPERM/EBUSY) si OneDrive, l'antivirus ou le serveur
// de dev le surveille : on reessaie, puis on deplace les fichiers un par un.
async function moveDir(from, to) {
  for (let i = 0; i < 5; i++) {
    try {
      fs.renameSync(from, to);
      return;
    } catch (e) {
      if (!['EPERM', 'EBUSY', 'EACCES'].includes(e.code)) throw e;
      await sleep(500 * (i + 1));
    }
  }
  console.log('  Dossier verrouille, deplacement fichier par fichier...');
  fs.mkdirSync(to, { recursive: true });
  for (const f of fs.readdirSync(from)) {
    const src = path.join(from, f);
    const dst = path.join(to, f);
    try {
      fs.renameSync(src, dst);
    } catch {
      fs.copyFileSync(src, dst);
      fs.rmSync(src, { force: true });
    }
  }
  try {
    fs.rmSync(from, { recursive: true, force: true });
  } catch {
    console.log(`  Supprime a la main le dossier vide ${from}`);
  }
}

async function main() {
  if (!fs.existsSync(input)) {
    console.error(`Fichier introuvable : ${input}`);
    process.exit(1);
  }
  // On ecrit dans un dossier temporaire : l'ancienne base reste utilisable tant que l'import n'est pas fini
  const FINAL = OUT;
  const TMP = path.resolve(".puzzles-import-tmp");
  fs.rmSync(TMP, { recursive: true, force: true });
  fs.mkdirSync(TMP, { recursive: true });

  const themeIndex = new Map();
  const buffers = new Map(); // tranche -> problemes en attente
  const chunks = new Map(); // tranche -> nombre de fichiers ecrits
  const counts = new Map(); // tranche -> total
  let total = 0;
  let skipped = 0;
  const t0 = Date.now();

  const flush = (band) => {
    const buf = buffers.get(band);
    if (!buf || buf.length === 0) return;
    const n = chunks.get(band) ?? 0;
    fs.writeFileSync(path.join(TMP, `b${band}-${n}.json`), JSON.stringify(buf));
    chunks.set(band, n + 1);
    buffers.set(band, []);
  };

  const rl = readline.createInterface({ input: await openInput(input), crlfDelay: Infinity });
  for await (const line of rl) {
    const p = parse(line);
    if (!p) continue;
    if (p.plays < MIN_PLAYS || p.popularity < MIN_POP) {
      skipped++;
      continue;
    }
    const band = Math.floor(p.rating / BAND) * BAND;
    if ((counts.get(band) ?? 0) >= MAX_PER_BAND) {
      skipped++;
      continue;
    }
    const themes = p.themes.map((t) => {
      if (!themeIndex.has(t)) themeIndex.set(t, themeIndex.size);
      return themeIndex.get(t);
    });
    // Format compact : [id, fen, coups, elo, themes]
    const rec = themes.length ? [p.id, p.fen, p.moves, p.rating, themes] : [p.id, p.fen, p.moves, p.rating];
    if (!buffers.has(band)) buffers.set(band, []);
    buffers.get(band).push(rec);
    counts.set(band, (counts.get(band) ?? 0) + 1);
    if (buffers.get(band).length >= CHUNK) flush(band);
    total++;
    if (total % 250000 === 0) console.log(`  ${total.toLocaleString('fr-FR')} problemes...`);
  }
  for (const band of buffers.keys()) flush(band);

  const bands = [...counts.keys()]
    .sort((a, b) => a - b)
    .map((min) => ({ min, count: counts.get(min), chunks: chunks.get(min) }));
  const index = {
    version: 1,
    source: 'Lichess open database (CC0)',
    importedAt: new Date().toISOString(),
    total,
    bandSize: BAND,
    themes: [...themeIndex.keys()],
    bands,
  };
  fs.writeFileSync(path.join(TMP, 'index.json'), JSON.stringify(index, null, 1));

  // Remplacement de l'ancienne base seulement a la fin
  fs.rmSync(FINAL, { recursive: true, force: true });
  await moveDir(TMP, FINAL);

  const size = fs.readdirSync(FINAL).reduce((s, f) => s + fs.statSync(path.join(FINAL, f)).size, 0);
  console.log(
    `Termine : ${total.toLocaleString('fr-FR')} problemes (${skipped.toLocaleString('fr-FR')} ignores), ` +
      `${index.themes.length} themes, ${(size / 1e6).toFixed(0)} Mo, ${((Date.now() - t0) / 1000).toFixed(0)} s`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
