// Pilotage de Stockfish 19 (version "lite" mono-thread) dans un Web Worker, via le protocole UCI.
// Les fichiers du moteur sont dans public/stockfish/ (licence GPLv3, voir Copying.txt).

export interface EngineLine {
  /** Coup au format UCI (ex. e2e4, e7e8q) */
  move: string;
  /** Evaluation en centipions, du point de vue du camp au trait */
  cp: number;
  /** Mat en N (positif = le camp au trait mate), absent sinon */
  mate?: number;
  pv: string[];
  depth: number;
}

export interface AnalyseOptions {
  depth?: number;
  movetime?: number;
  multipv?: number;
}

const ENGINE_URL = `${import.meta.env?.BASE_URL ?? '/'}stockfish/stockfish-19-lite-single.js`;
const MATE_CP = 100_000;

class StockfishEngine {
  private worker: Worker | null = null;
  private ready: Promise<void> | null = null;
  private listeners = new Set<(line: string) => void>();
  /** File d'attente : une seule analyse a la fois */
  private chain: Promise<unknown> = Promise.resolve();
  private searching = false;

  private send(cmd: string) {
    this.worker?.postMessage(cmd);
  }

  private waitFor(predicate: (line: string) => boolean): Promise<string> {
    return new Promise((resolve) => {
      const fn = (line: string) => {
        if (predicate(line)) {
          this.listeners.delete(fn);
          resolve(line);
        }
      };
      this.listeners.add(fn);
    });
  }

  init(): Promise<void> {
    if (this.ready) return this.ready;
    this.ready = new Promise<void>((resolve, reject) => {
      try {
        this.worker = new Worker(ENGINE_URL);
      } catch (e) {
        reject(e);
        return;
      }
      this.worker.onmessage = (ev: MessageEvent) => {
        const line = typeof ev.data === 'string' ? ev.data : String(ev.data);
        for (const l of [...this.listeners]) l(line);
      };
      this.worker.onerror = (e) => reject(e);
      const ok = this.waitFor((l) => l === 'uciok').then(() => {
        this.send('setoption name Hash value 32');
        this.send('isready');
        return this.waitFor((l) => l === 'readyok');
      });
      this.send('uci');
      ok.then(() => resolve(), reject);
    });
    return this.ready;
  }

  /** Analyse une position et renvoie les meilleures lignes, triees de la meilleure a la moins bonne */
  analyse(fen: string, opts: AnalyseOptions = {}): Promise<EngineLine[]> {
    const run = async () => {
      await this.init();
      const multipv = Math.max(1, opts.multipv ?? 1);
      const lines = new Map<number, EngineLine>();
      const onInfo = (l: string) => {
        if (!l.startsWith('info ') || !l.includes(' pv ')) return;
        if (l.includes('lowerbound') || l.includes('upperbound')) return;
        const tok = l.split(' ');
        const get = (k: string) => tok[tok.indexOf(k) + 1];
        const idx = tok.includes('multipv') ? Number(get('multipv')) : 1;
        const pv = tok.slice(tok.indexOf('pv') + 1);
        const scoreType = get('score');
        const scoreVal = Number(tok[tok.indexOf('score') + 2]);
        const mate = scoreType === 'mate' ? scoreVal : undefined;
        const cp = mate !== undefined ? Math.sign(mate || -1) * (MATE_CP - Math.abs(mate) * 100) : scoreVal;
        lines.set(idx, { move: pv[0], cp, mate, pv, depth: Number(get('depth')) });
      };
      this.listeners.add(onInfo);
      this.send('ucinewgame');
      this.send(`setoption name MultiPV value ${multipv}`);
      this.send(`position fen ${fen}`);
      const limits = [
        opts.depth ? `depth ${opts.depth}` : '',
        opts.movetime ? `movetime ${opts.movetime}` : '',
      ].join(' ');
      this.searching = true;
      const done = this.waitFor((l) => l.startsWith('bestmove'));
      this.send(`go ${limits.trim() || 'depth 12'}`);
      const best = await done;
      this.searching = false;
      this.listeners.delete(onInfo);
      const result = [...lines.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v);
      // Position sans coup legal ou analyse vide : on renvoie au moins le bestmove
      if (result.length === 0) {
        const mv = best.split(' ')[1];
        if (mv && mv !== '(none)') result.push({ move: mv, cp: 0, pv: [mv], depth: 0 });
      }
      return result;
    };
    const p = this.chain.then(run, run);
    this.chain = p.catch(() => undefined);
    return p;
  }

  /** Interrompt l'analyse en cours (le resultat partiel est quand meme renvoye) */
  stop() {
    if (this.searching) this.send('stop');
  }
}

export const engine = new StockfishEngine();

/** Probabilite de gain (0..1) a partir des centipions, formule utilisee par Lichess */
export function winChance(cp: number): number {
  const c = Math.max(-2000, Math.min(2000, cp));
  return 1 / (1 + Math.exp(-0.00368208 * c));
}
