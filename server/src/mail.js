// Envoi de mails (SMTP) : support, confirmation d'adresse, mot de passe oublie
import nodemailer from 'nodemailer';

export const mailer = process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: Number(process.env.SMTP_PORT ?? 587) === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    })
  : null;

const FROM = process.env.SMTP_FROM || process.env.SMTP_USER;
const DEV = process.env.NODE_ENV !== 'production';

/** Adresse publique du site, pour les liens des mails (jamais deduite de la requete : en-tete Host falsifiable) */
export const SITE_URL = (process.env.SITE_URL || (DEV ? 'http://localhost:8080' : '')).replace(/\/+$/, '');
if (!SITE_URL) console.warn('SITE_URL absent : les liens des mails (mot de passe oublie) sont desactives');

/** Les mails de compte peuvent-ils partir ? (en dev sans SMTP, le lien est ecrit dans les logs) */
export const accountMailReady = () => !!SITE_URL && (!!mailer || DEV);

/** Envoie un mail ; en dev sans SMTP, l'ecrit dans la console */
export async function sendMail({ to, subject, text, html, replyTo }) {
  if (!mailer) {
    if (!DEV) throw new Error('SMTP non configure');
    console.log(`\n[mail de dev] A : ${to}\nSujet : ${subject}\n${text}\n`);
    return;
  }
  await mailer.sendMail({ from: FROM, to, subject, text, html, replyTo });
}

const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/**
 * Mail de compte (confirmation, mot de passe) : version HTML soignee + version texte.
 * Mise en page en tableaux et styles en ligne : seule facon fiable d'etre bien affiche par Gmail, Outlook, mobiles.
 */
/** Cadre commun des mails (en-tete BetterMove, carte blanche, pied de page) */
function layout({ title, preheader, body, footer = '' }) {
  // Logo charge depuis le site seulement s'il est public en HTTPS (sinon image cassee dans la boite mail)
  const logo = /^https:\/\//.test(SITE_URL)
    ? `<img src="${esc(SITE_URL)}/apple-touch-icon.png" width="40" height="40" alt="" style="display:block;border:0;border-radius:10px">`
    : '';
  const site = SITE_URL.replace(/^https?:\/\//, '');
  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:#f3f5f1;">
<div style="display:none;max-height:0;overflow:hidden;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f5f1;">
<tr><td align="center" style="padding:32px 12px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#1f2a1a;">
    <tr><td style="background:#1b2416;padding:20px 28px;">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        ${logo ? `<td style="padding-right:12px;">${logo}</td>` : ''}
        <td style="font-size:22px;font-weight:700;color:#ffffff;">Better<span style="color:#8bd450;">Move</span></td>
      </tr></table>
    </td></tr>
    <tr><td style="padding:28px 28px 8px;">${body}</td></tr>
    <tr><td style="padding:16px 28px 24px;border-top:1px solid #e6eae2;font-size:12px;line-height:1.5;color:#7a8475;">
      ${footer ? `${footer}<br>` : ''}BetterMove · <a href="${esc(SITE_URL)}" style="color:#7a8475;">${esc(site)}</a> · application gratuite pour progresser aux échecs
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
}

const button = (url, label, color = '#5fa52a') =>
  `<td style="border-radius:10px;background:${color};"><a href="${esc(url)}" style="display:inline-block;padding:12px 22px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">${esc(label)}</a></td>`;

/**
 * Mail de compte (confirmation, mot de passe) : version HTML soignee + version texte.
 * Mise en page en tableaux et styles en ligne : seule facon fiable d'etre bien affiche par Gmail, Outlook, mobiles.
 */
export function accountEmail({ username, title, intro, button: label, url, note, footer }) {
  const body = `
      <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#1f2a1a;">${esc(title)}</h1>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">Bonjour <b>${esc(username)}</b>,</p>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.6;">${esc(intro)}</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;"><tr>${button(url, label)}</tr></table>
      <p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#5c6657;">${esc(note)}</p>
      <p style="margin:0 0 24px;font-size:12px;line-height:1.5;color:#7a8475;">Le bouton ne marche pas ? Copie ce lien dans ton navigateur :<br><a href="${esc(url)}" style="color:#3f7d17;word-break:break-all;">${esc(url)}</a></p>`;
  const html = layout({ title, preheader: intro, body, footer: esc(footer) });
  const text = `Bonjour ${username},\n\n${intro}\n\n${label} : ${url}\n\n${note}\n\n${footer}\n\nBetterMove - ${SITE_URL}\n`;
  return { html, text };
}

const CONTEXT_LABELS = { page: 'Page', navigateur: 'Navigateur', ecran: 'Écran', compte: 'Compte', date: 'Date' };

/** Mail recu par le support quand un joueur ecrit depuis la page Aide */
export function supportEmail({ id, category, subject, message, name, email, username, context }) {
  const when = new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'full', timeStyle: 'short' });
  const row = (label, value) =>
    `<tr><td style="padding:6px 12px 6px 0;font-size:13px;color:#7a8475;white-space:nowrap;vertical-align:top;">${esc(label)}</td><td style="padding:6px 0;font-size:14px;color:#1f2a1a;word-break:break-word;">${value}</td></tr>`;
  const profile = username ? `${SITE_URL}/profil/${encodeURIComponent(username)}` : null;
  const sender = [
    row('Nom', esc(name)),
    row('E-mail', email ? esc(email) : '<span style="color:#7a8475;">non communiqué</span>'),
    row('Compte', profile ? `<a href="${esc(profile)}" style="color:#3f7d17;">${esc(username)}</a>` : '<span style="color:#7a8475;">visiteur sans compte</span>'),
    row('Reçu le', esc(when)),
  ].join('');
  const ctx = Object.entries(context ?? {})
    .filter(([k, v]) => k !== 'compte' && k !== 'date' && v !== null && v !== undefined && v !== '')
    .map(([k, v]) => row(CONTEXT_LABELS[k] ?? k, esc(typeof v === 'string' ? v : JSON.stringify(v))))
    .join('');
  const body = `
      ${email ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;"><tr><td style="background:#fff6e0;border:1px solid #f0d58c;border-radius:10px;padding:10px 14px;font-size:13px;line-height:1.5;color:#6b4e00;">
        <b>Ne réponds pas depuis ta messagerie</b> : le joueur recevrait cette fiche interne. Utilise le bouton <b>Répondre depuis l’admin</b>, il recevra un mail BetterMove propre.
      </td></tr></table>` : ''}
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 14px;"><tr>
        <td style="background:#eaf5e0;color:#3f7d17;font-size:12px;font-weight:700;padding:5px 10px;border-radius:999px;">Demande #${esc(id)}</td>
        <td style="width:8px;"></td>
        <td style="background:#f0f2ee;color:#4a5445;font-size:12px;font-weight:700;padding:5px 10px;border-radius:999px;">${esc(category)}</td>
      </tr></table>
      <h1 style="margin:0 0 18px;font-size:21px;line-height:1.3;color:#1f2a1a;">${esc(subject)}</h1>
      <div style="margin:0 0 22px;padding:16px 18px;background:#f7f9f5;border-left:4px solid #8bd450;border-radius:8px;font-size:15px;line-height:1.6;white-space:pre-wrap;">${esc(message)}</div>
      <p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#7a8475;">Expéditeur</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">${sender}</table>
      ${ctx ? `<p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#7a8475;">Contexte technique</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 22px;">${ctx}</table>` : ''}
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;"><tr>
        ${button(`${SITE_URL}/admin`, email ? 'Répondre depuis l’admin' : 'Ouvrir dans l’admin')}
      </tr></table>`;
  const html = layout({
    title: `Demande #${id} : ${subject}`,
    preheader: message.slice(0, 120),
    body,
    footer: email
      ? 'Fiche interne du support : ne pas transférer au joueur.'
      : 'Le joueur n’a pas laissé d’adresse : réponse impossible par mail.',
  });
  const text =
    `Demande #${id} [${category}] ${subject}\n\n${message}\n\n---\nDe : ${name}${email ? ` <${email}>` : ''}${username ? ` (compte ${username})` : ''}\n` +
    `Recu le : ${when}\n` +
    Object.entries(context ?? {}).map(([k, v]) => `${CONTEXT_LABELS[k] ?? k} : ${typeof v === 'string' ? v : JSON.stringify(v)}`).join('\n') +
    `\n\nAdmin : ${SITE_URL}/admin\n`;
  return { html, text };
}

/** Reponse du support envoyee au joueur depuis la page Admin */
export function supportReplyEmail({ id, name, subject, reply, original }) {
  const body = `
      <p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#5fa52a;">Support BetterMove · demande #${esc(id)}</p>
      <h1 style="margin:0 0 18px;font-size:21px;line-height:1.3;color:#1f2a1a;">${esc(subject)}</h1>
      <p style="margin:0 0 14px;font-size:15px;line-height:1.6;">Bonjour <b>${esc(name)}</b>,</p>
      <div style="margin:0 0 18px;font-size:15px;line-height:1.65;white-space:pre-wrap;">${esc(reply)}</div>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.6;">À bientôt sur l’échiquier,<br><b>L’équipe BetterMove</b></p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 26px;"><tr>${button(SITE_URL, 'Retourner sur BetterMove')}</tr></table>
      <p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#7a8475;">Ton message</p>
      <div style="margin:0 0 22px;padding:12px 16px;background:#f7f9f5;border-left:4px solid #d5dccf;border-radius:8px;font-size:13px;line-height:1.55;color:#5c6657;white-space:pre-wrap;">${esc(original)}</div>`;
  const html = layout({
    title: `Re: ${subject}`,
    preheader: reply.slice(0, 120),
    body,
    footer: 'Tu peux répondre directement à ce mail pour continuer l’échange avec le support.',
  });
  const text =
    `Bonjour ${name},\n\n${reply}\n\nA bientot sur l'echiquier,\nL'equipe BetterMove\n${SITE_URL}\n\n` +
    `--- Ton message (demande #${id}) ---\n${original}\n`;
  return { html, text };
}
