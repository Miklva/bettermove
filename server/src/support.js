// Support : enregistre la demande et l'envoie par mail a l'adresse du support (SMTP a configurer)
import { Router } from 'express';
import nodemailer from 'nodemailer';
import jwt from 'jsonwebtoken';
import { pool } from './db.js';
import { JWT_SECRET } from './auth.js';

export const supportRouter = Router();

// Adresse du support : uniquement par variable d'environnement, jamais envoyee au navigateur
const TO = process.env.SUPPORT_TO?.trim() || null;
const transport = process.env.SMTP_HOST && TO
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: Number(process.env.SMTP_PORT ?? 587) === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    })
  : null;

const recent = new Map();
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clip = (s, n) => (typeof s === 'string' ? s.trim().slice(0, n) : '');

/** Le formulaire peut-il envoyer un mail directement ? */
supportRouter.get('/status', (_req, res) => res.json({ mail: !!transport }));

supportRouter.post('/', async (req, res) => {
  const ip = req.ip;
  const now = Date.now();
  const list = (recent.get(ip) ?? []).filter((t) => now - t < 60 * 60 * 1000);
  if (list.length >= 5) return res.status(429).json({ error: 'Trop de messages envoyés, réessaie plus tard.' });

  const b = req.body ?? {};
  const subject = clip(b.subject, 150);
  const message = clip(b.message, 5000);
  const email = clip(b.email, 200);
  if (!subject || message.length < 10) return res.status(400).json({ error: 'Sujet et message (10 caractères minimum) requis.' });
  if (email && !EMAIL.test(email)) return res.status(400).json({ error: 'Adresse mail invalide.' });

  // Compte connecte (facultatif)
  let userId = null;
  let username = null;
  try {
    const p = jwt.verify(req.cookies?.bm_session ?? '', JWT_SECRET);
    userId = p.uid;
    username = p.name;
  } catch {
    /* visiteur */
  }
  const name = clip(b.name, 100) || username || 'Anonyme';
  const category = clip(b.category, 40) || 'Autre';
  const context = typeof b.context === 'object' && b.context ? b.context : {};

  const { rows } = await pool.query(
    `INSERT INTO support_messages (user_id, name, email, category, subject, message, context)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [userId, name, email || null, category, subject, message, JSON.stringify(context).slice(0, 4000)],
  );
  const id = Number(rows[0].id);
  list.push(now);
  recent.set(ip, list);

  if (!transport) return res.status(202).json({ id, mailed: false });
  try {
    await transport.sendMail({
      from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
      to: TO,
      replyTo: email || undefined,
      subject: `[BetterMove #${id}] [${category}] ${subject}`,
      text: `${message}\n\n---\nDe : ${name}${email ? ` <${email}>` : ''}${username ? ` (compte ${username})` : ''}\nContexte : ${JSON.stringify(context)}`,
    });
    await pool.query('UPDATE support_messages SET mailed = true WHERE id = $1', [id]);
    res.status(201).json({ id, mailed: true });
  } catch (e) {
    console.error('Envoi du mail de support impossible', e);
    res.status(202).json({ id, mailed: false });
  }
});
