// Connexion PostgreSQL et creation du schema au demarrage
import pg from 'pg';
import { readFile } from 'node:fs/promises';

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgres://bettermove:bettermove@localhost:5432/bettermove',
  max: 10,
});

export async function migrate() {
  const sql = await readFile(new URL('./schema.sql', import.meta.url), 'utf8');
  // La base peut demarrer apres l'API : on reessaie quelques secondes
  for (let i = 0; ; i++) {
    try {
      await pool.query(sql);
      return;
    } catch (e) {
      if (i >= 20) throw e;
      console.log(`Base indisponible (${e.code ?? e.message}), nouvel essai...`);
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
}
