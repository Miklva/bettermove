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

/** Langues des mails (une langue inconnue recoit l'anglais, une langue absente le francais) */
const MAIL_LANGS = ['fr', 'en', 'es', 'pt', 'de', 'ru'];
export const mailLang = (v) => (v === undefined || v === null || v === '' ? 'fr' : MAIL_LANGS.includes(v) ? v : 'en');
/** Langue demandee par le client (en-tete X-Lang envoye par l'app) */
export const reqLang = (req) => mailLang(String(req.get?.('X-Lang') ?? '').slice(0, 5).toLowerCase() || 'fr');

const L = {
  fr: {
    tagline: 'application gratuite pour progresser aux échecs',
    hello: 'Bonjour',
    noButton: 'Le bouton ne marche pas ? Copie ce lien dans ton navigateur :',
    supportTag: 'Support BetterMove · demande',
    bye: 'À bientôt sur l’échiquier,',
    team: 'L’équipe BetterMove',
    back: 'Retourner sur BetterMove',
    yourMsg: 'Ton message',
    replyFooter: 'Tu peux répondre directement à ce mail pour continuer l’échange avec le support.',
    byeText: "A bientot sur l'echiquier,\nL'equipe BetterMove",
    yourMsgText: 'Ton message (demande',
  },
  en: {
    tagline: 'free app to get better at chess',
    hello: 'Hi',
    noButton: 'Button not working? Copy this link into your browser:',
    supportTag: 'BetterMove support · request',
    bye: 'See you on the board,',
    team: 'The BetterMove team',
    back: 'Back to BetterMove',
    yourMsg: 'Your message',
    replyFooter: 'You can reply directly to this email to continue the conversation with support.',
    byeText: 'See you on the board,\nThe BetterMove team',
    yourMsgText: 'Your message (request',
  },
  es: {
    tagline: 'aplicación gratuita para mejorar en ajedrez',
    hello: 'Hola',
    noButton: '¿El botón no funciona? Copia este enlace en tu navegador:',
    supportTag: 'Soporte BetterMove · solicitud',
    bye: 'Nos vemos en el tablero,',
    team: 'El equipo de BetterMove',
    back: 'Volver a BetterMove',
    yourMsg: 'Tu mensaje',
    replyFooter: 'Puedes responder directamente a este correo para seguir la conversación con el soporte.',
    byeText: 'Nos vemos en el tablero,\nEl equipo de BetterMove',
    yourMsgText: 'Tu mensaje (solicitud',
  },
  pt: {
    tagline: 'aplicação gratuita para evoluir no xadrez',
    hello: 'Olá',
    noButton: 'O botão não funciona? Copia este link para o teu navegador:',
    supportTag: 'Suporte BetterMove · pedido',
    bye: 'Até breve no tabuleiro,',
    team: 'A equipa BetterMove',
    back: 'Voltar ao BetterMove',
    yourMsg: 'A tua mensagem',
    replyFooter: 'Podes responder diretamente a este e-mail para continuar a conversa com o suporte.',
    byeText: 'Até breve no tabuleiro,\nA equipa BetterMove',
    yourMsgText: 'A tua mensagem (pedido',
  },
  de: {
    tagline: 'kostenlose App, um besser Schach zu spielen',
    hello: 'Hallo',
    noButton: 'Der Button funktioniert nicht? Kopiere diesen Link in deinen Browser:',
    supportTag: 'BetterMove-Support · Anfrage',
    bye: 'Bis bald am Brett,',
    team: 'Das BetterMove-Team',
    back: 'Zurück zu BetterMove',
    yourMsg: 'Deine Nachricht',
    replyFooter: 'Du kannst direkt auf diese E-Mail antworten, um das Gespräch mit dem Support fortzusetzen.',
    byeText: 'Bis bald am Brett,\nDas BetterMove-Team',
    yourMsgText: 'Deine Nachricht (Anfrage',
  },
  ru: {
    tagline: 'бесплатное приложение, чтобы расти в шахматах',
    hello: 'Привет',
    noButton: 'Кнопка не работает? Скопируй эту ссылку в браузер:',
    supportTag: 'Поддержка BetterMove · обращение',
    bye: 'До встречи за доской,',
    team: 'Команда BetterMove',
    back: 'Вернуться в BetterMove',
    yourMsg: 'Твоё сообщение',
    replyFooter: 'Ты можешь ответить прямо на это письмо, чтобы продолжить разговор с поддержкой.',
    byeText: 'До встречи за доской,\nКоманда BetterMove',
    yourMsgText: 'Твоё сообщение (обращение',
  },
};

/** Textes des mails de compte, par langue */
export const ACCOUNT_MAILS = {
  verify: {
    fr: {
      subject: 'Confirme ton adresse e-mail BetterMove',
      title: 'Confirme ton adresse e-mail',
      intro: 'Confirme cette adresse pour pouvoir récupérer ton compte BetterMove si tu oublies un jour ton mot de passe.',
      button: 'Confirmer mon adresse',
      note: 'Ce lien est valable 48 heures.',
      footer: "Tu n'as pas créé de compte BetterMove ? Ignore simplement ce message : l'adresse ne sera pas confirmée.",
    },
    en: {
      subject: 'Confirm your BetterMove email address',
      title: 'Confirm your email address',
      intro: 'Confirm this address so you can recover your BetterMove account if you ever forget your password.',
      button: 'Confirm my address',
      note: 'This link is valid for 48 hours.',
      footer: "Didn't create a BetterMove account? Just ignore this message: the address won't be confirmed.",
    },
    es: {
      subject: 'Confirma tu correo electrónico de BetterMove',
      title: 'Confirma tu correo electrónico',
      intro: 'Confirma esta dirección para poder recuperar tu cuenta de BetterMove si algún día olvidas tu contraseña.',
      button: 'Confirmar mi dirección',
      note: 'Este enlace es válido durante 48 horas.',
      footer: '¿No has creado una cuenta en BetterMove? Ignora este mensaje: la dirección no se confirmará.',
    },
    pt: {
      subject: 'Confirma o teu e-mail do BetterMove',
      title: 'Confirma o teu endereço de e-mail',
      intro: 'Confirma este endereço para poderes recuperar a tua conta BetterMove se um dia te esqueceres da palavra-passe.',
      button: 'Confirmar o meu endereço',
      note: 'Este link é válido durante 48 horas.',
      footer: 'Não criaste uma conta BetterMove? Ignora esta mensagem: o endereço não será confirmado.',
    },
    de: {
      subject: 'Bestätige deine E-Mail-Adresse für BetterMove',
      title: 'Bestätige deine E-Mail-Adresse',
      intro: 'Bestätige diese Adresse, damit du dein BetterMove-Konto wiederherstellen kannst, falls du einmal dein Passwort vergisst.',
      button: 'Meine Adresse bestätigen',
      note: 'Dieser Link ist 48 Stunden gültig.',
      footer: 'Du hast kein BetterMove-Konto erstellt? Ignoriere diese Nachricht einfach: Die Adresse wird nicht bestätigt.',
    },
    ru: {
      subject: 'Подтверди свой e-mail в BetterMove',
      title: 'Подтверди свой e-mail',
      intro: 'Подтверди этот адрес, чтобы восстановить аккаунт BetterMove, если когда-нибудь забудешь пароль.',
      button: 'Подтвердить адрес',
      note: 'Ссылка действует 48 часов.',
      footer: 'Ты не создавал аккаунт в BetterMove? Просто проигнорируй это письмо: адрес не будет подтверждён.',
    },
  },
  reset: {
    fr: {
      subject: 'Réinitialise ton mot de passe BetterMove',
      title: 'Mot de passe oublié ?',
      intro: 'Tu as demandé à choisir un nouveau mot de passe pour ton compte BetterMove. Clique sur le bouton ci-dessous pour le faire.',
      button: 'Choisir un nouveau mot de passe',
      note: 'Ce lien est valable 1 heure et ne peut servir qu’une seule fois.',
      footer: "Ce n'est pas toi ? Ignore ce message : ton mot de passe actuel reste valable et personne n'a accès à ton compte.",
    },
    en: {
      subject: 'Reset your BetterMove password',
      title: 'Forgot your password?',
      intro: 'You asked to choose a new password for your BetterMove account. Click the button below to do it.',
      button: 'Choose a new password',
      note: 'This link is valid for 1 hour and can only be used once.',
      footer: "Wasn't you? Ignore this message: your current password still works and nobody has access to your account.",
    },
    es: {
      subject: 'Restablece tu contraseña de BetterMove',
      title: '¿Has olvidado tu contraseña?',
      intro: 'Has pedido elegir una nueva contraseña para tu cuenta de BetterMove. Haz clic en el botón de abajo para hacerlo.',
      button: 'Elegir una nueva contraseña',
      note: 'Este enlace es válido durante 1 hora y solo puede usarse una vez.',
      footer: '¿No has sido tú? Ignora este mensaje: tu contraseña actual sigue siendo válida y nadie tiene acceso a tu cuenta.',
    },
    pt: {
      subject: 'Redefine a tua palavra-passe do BetterMove',
      title: 'Esqueceste-te da palavra-passe?',
      intro: 'Pediste para escolher uma nova palavra-passe para a tua conta BetterMove. Clica no botão abaixo para o fazer.',
      button: 'Escolher uma nova palavra-passe',
      note: 'Este link é válido durante 1 hora e só pode ser usado uma vez.',
      footer: 'Não foste tu? Ignora esta mensagem: a tua palavra-passe atual continua válida e ninguém tem acesso à tua conta.',
    },
    de: {
      subject: 'Setze dein BetterMove-Passwort zurück',
      title: 'Passwort vergessen?',
      intro: 'Du hast angefragt, ein neues Passwort für dein BetterMove-Konto zu wählen. Klicke dazu auf den Button unten.',
      button: 'Neues Passwort wählen',
      note: 'Dieser Link ist 1 Stunde gültig und kann nur einmal verwendet werden.',
      footer: 'Das warst nicht du? Ignoriere diese Nachricht: Dein aktuelles Passwort bleibt gültig, und niemand hat Zugriff auf dein Konto.',
    },
    ru: {
      subject: 'Сброс пароля BetterMove',
      title: 'Забыл пароль?',
      intro: 'Ты запросил смену пароля для аккаунта BetterMove. Нажми на кнопку ниже, чтобы выбрать новый.',
      button: 'Выбрать новый пароль',
      note: 'Ссылка действует 1 час и может быть использована только один раз.',
      footer: 'Это был не ты? Проигнорируй письмо: твой текущий пароль по-прежнему действует, и никто не получил доступ к аккаунту.',
    },
  },
};

const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/**
 * Mail de compte (confirmation, mot de passe) : version HTML soignee + version texte.
 * Mise en page en tableaux et styles en ligne : seule facon fiable d'etre bien affiche par Gmail, Outlook, mobiles.
 */
/** Cadre commun des mails (en-tete BetterMove, carte blanche, pied de page) */
function layout({ title, preheader, body, footer = '', lang = 'fr' }) {
  // Logo charge depuis le site seulement s'il est public en HTTPS (sinon image cassee dans la boite mail)
  const logo = /^https:\/\//.test(SITE_URL)
    ? `<img src="${esc(SITE_URL)}/apple-touch-icon.png" width="40" height="40" alt="" style="display:block;border:0;border-radius:10px">`
    : '';
  const site = SITE_URL.replace(/^https?:\/\//, '');
  return `<!DOCTYPE html>
<html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head>
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
      ${footer ? `${footer}<br>` : ''}BetterMove · <a href="${esc(SITE_URL)}" style="color:#7a8475;">${esc(site)}</a> · ${L[lang].tagline}
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
export function accountEmail({ username, title, intro, button: label, url, note, footer, lang = 'fr' }) {
  const T = L[mailLang(lang)];
  const body = `
      <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#1f2a1a;">${esc(title)}</h1>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">${T.hello} <b>${esc(username)}</b>,</p>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.6;">${esc(intro)}</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;"><tr>${button(url, label)}</tr></table>
      <p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#5c6657;">${esc(note)}</p>
      <p style="margin:0 0 24px;font-size:12px;line-height:1.5;color:#7a8475;">${T.noButton}<br><a href="${esc(url)}" style="color:#3f7d17;word-break:break-all;">${esc(url)}</a></p>`;
  const html = layout({ title, preheader: intro, body, footer: esc(footer), lang: mailLang(lang) });
  const text = `${T.hello} ${username},\n\n${intro}\n\n${label}${mailLang(lang) === "fr" ? " :" : ":"} ${url}\n\n${note}\n\n${footer}\n\nBetterMove - ${SITE_URL}\n`;
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
export function supportReplyEmail({ id, name, subject, reply, original, lang = 'fr' }) {
  const T = L[mailLang(lang)];
  const body = `
      <p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#5fa52a;">${T.supportTag} #${esc(id)}</p>
      <h1 style="margin:0 0 18px;font-size:21px;line-height:1.3;color:#1f2a1a;">${esc(subject)}</h1>
      <p style="margin:0 0 14px;font-size:15px;line-height:1.6;">${T.hello} <b>${esc(name)}</b>,</p>
      <div style="margin:0 0 18px;font-size:15px;line-height:1.65;white-space:pre-wrap;">${esc(reply)}</div>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.6;">${T.bye}<br><b>${T.team}</b></p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 26px;"><tr>${button(SITE_URL, T.back)}</tr></table>
      <p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#7a8475;">${T.yourMsg}</p>
      <div style="margin:0 0 22px;padding:12px 16px;background:#f7f9f5;border-left:4px solid #d5dccf;border-radius:8px;font-size:13px;line-height:1.55;color:#5c6657;white-space:pre-wrap;">${esc(original)}</div>`;
  const html = layout({
    title: `Re: ${subject}`,
    preheader: reply.slice(0, 120),
    body,
    footer: T.replyFooter,
    lang: mailLang(lang),
  });
  const text =
    `${T.hello} ${name},\n\n${reply}\n\n${T.byeText}\n${SITE_URL}\n\n` +
    `--- ${T.yourMsgText} #${id}) ---\n${original}\n`;
  return { html, text };
}
