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
export function accountEmail({ username, title, intro, button, url, note, footer }) {
  // Logo charge depuis le site seulement s'il est public en HTTPS (sinon image cassee dans la boite mail)
  const logo = /^https:\/\//.test(SITE_URL)
    ? `<img src="${esc(SITE_URL)}/apple-touch-icon.png" width="40" height="40" alt="" style="display:block;border:0;border-radius:10px">`
    : '';
  const site = SITE_URL.replace(/^https?:\/\//, '');
  const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:#f3f5f1;">
<div style="display:none;max-height:0;overflow:hidden;">${esc(intro)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f5f1;">
<tr><td align="center" style="padding:32px 12px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#1f2a1a;">
    <tr><td style="background:#1b2416;padding:20px 28px;">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        ${logo ? `<td style="padding-right:12px;">${logo}</td>` : ''}
        <td style="font-size:22px;font-weight:700;color:#ffffff;">Better<span style="color:#8bd450;">Move</span></td>
      </tr></table>
    </td></tr>
    <tr><td style="padding:32px 28px 8px;">
      <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#1f2a1a;">${esc(title)}</h1>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">Bonjour <b>${esc(username)}</b>,</p>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.6;">${esc(intro)}</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;"><tr>
        <td style="border-radius:10px;background:#5fa52a;">
          <a href="${esc(url)}" style="display:inline-block;padding:14px 28px;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">${esc(button)}</a>
        </td>
      </tr></table>
      <p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#5c6657;">${esc(note)}</p>
      <p style="margin:0 0 24px;font-size:12px;line-height:1.5;color:#7a8475;">Le bouton ne marche pas ? Copie ce lien dans ton navigateur :<br><a href="${esc(url)}" style="color:#3f7d17;word-break:break-all;">${esc(url)}</a></p>
    </td></tr>
    <tr><td style="padding:16px 28px 24px;border-top:1px solid #e6eae2;font-size:12px;line-height:1.5;color:#7a8475;">
      ${esc(footer)}<br>BetterMove · <a href="${esc(SITE_URL)}" style="color:#7a8475;">${esc(site)}</a> · application gratuite pour progresser aux échecs
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
  const text = `Bonjour ${username},\n\n${intro}\n\n${button} : ${url}\n\n${note}\n\n${footer}\n\nBetterMove - ${SITE_URL}\n`;
  return { html, text };
}
