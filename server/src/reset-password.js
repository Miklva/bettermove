// Reinitialise le mot de passe d'un compte (outil d'administration, a lancer sur le serveur).
// Utilisation : docker compose exec api node src/reset-password.js <pseudo> <nouveau mot de passe>
import bcrypt from 'bcryptjs';
import { pool } from './db.js';

const [username, password] = process.argv.slice(2);
if (!username || !password) {
  console.error('Utilisation : node src/reset-password.js <pseudo> <nouveau mot de passe>');
  process.exit(1);
}
if (password.length < 8) {
  console.error('Le mot de passe doit faire au moins 8 caracteres.');
  process.exit(1);
}

const hash = await bcrypt.hash(password, 10);
const { rows } = await pool.query(
  'UPDATE users SET password_hash = $2, session_version = session_version + 1 WHERE lower(username) = lower($1) RETURNING username',
  [username, hash],
);
if (rows.length) console.log(`Mot de passe change pour ${rows[0].username}.`);
else console.error(`Aucun compte nomme ${username}.`);
await pool.end();
process.exit(rows.length ? 0 : 1);
