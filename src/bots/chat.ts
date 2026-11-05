// Discussion avec les bots : un petit "cerveau" sans serveur ni IA externe.
// 1. On devine l'intention du message (beaucoup de sujets, pas seulement les phrases toutes faites).
// 2. On regarde la partie : ouverture / milieu / finale, materiel, derniers coups, gaffes, repetitions.
// 3. Le bot repond avec son caractere, son niveau (un debutant comprend moins bien et fait des fautes)
//    et se souvient de quelques choses (ton prenom, ce que tu repetes, tes insultes...).
import type { Bot } from './roster';
import { emoteIntent } from '../emotes/emotes';
import { currentMind } from '../engine/humanBot';

export type Intent =
  | 'greet'
  | 'bye'
  | 'howareyou'
  | 'thanks'
  | 'compliment'
  | 'taunt'
  | 'insult'
  | 'level'
  | 'help'
  | 'sorry'
  | 'laugh'
  | 'draw'
  | 'who'
  | 'age'
  | 'where'
  | 'likes'
  | 'food'
  | 'joke'
  | 'love'
  | 'cheat'
  | 'takeback'
  | 'bored'
  | 'predict'
  | 'selfdown'
  | 'rules'
  | 'opening'
  | 'name'
  | 'yes'
  | 'no'
  | 'hurry'
  | 'robot'
  | 'music'
  | 'weather'
  | 'time'
  | 'gibberish'
  | 'goodluck'
  | 'rematch'
  | 'resign'
  | 'whyMove'
  | 'math'
  | 'sport'
  | 'movie'
  | 'videogame'
  | 'pet'
  | 'school'
  | 'tired'
  | 'holiday'
  | 'teach'
  | 'announceCheck'
  | 'letmewin'
  | 'scared'
  | 'botBlunderRemark'
  | 'myBlunder'
  | 'nice'
  | 'question'
  | 'chat';

export type Mood = 'ahead' | 'behind' | 'even' | 'won' | 'lost' | 'drawn';
export type Event =
  | 'tookQueen'
  | 'lostQueen'
  | 'userBlunder'
  | 'botBlunder'
  | 'giveCheck'
  | 'gotCheck'
  | 'userCastle'
  | 'openE4'
  | 'openD4'
  | 'openOdd'
  | 'endgame'
  | 'longGame'
  | 'promote'
  | 'userPromote'
  | 'nervous'
  | 'confident'
  | 'panic'
  | 'swindle';
type Extra = 'repeat1' | 'repeat2' | 'repeat3' | 'spam' | 'shout' | 'unknown' | 'unknownQ' | 'askBack' | 'insult2' | 'nameAck';
type Key = Intent | Mood | Event | Extra;

/* ---------------- Comprehension ---------------- */

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const RULES: [Intent, RegExp][] = [
  ['math', /\d+\s*([+*x×/÷-]|plus|moins|fois|divise par)\s*\d+/],
  ['goodluck', /(bonne chance|bon courage|que le meilleur gagne|good luck|\bgl\b|\bhf\b|bonne partie)/],
  ['rematch', /(revanche|on en refait une|une autre partie|rejouer|encore une)/],
  ['resign', /(abandonne|tu abandonnes|abandonner|rends[- ]toi|tu te rends|\bresign\b)/],
  ['whyMove', /(pourquoi (tu as|t as|as[- ]tu|tu) (joue|pris|fait|bouge|avance)|c etait quoi ce coup|ton dernier coup|explique (ton|ce) coup|t as fait quoi)/],
  ['botBlunderRemark', /(tu as (gaffe|craque|perdu ta|laisse)|t as (gaffe|craque|perdu ta|laisse)|grosse erreur|quelle gaffe|tu t es plante|t es nul en finale)/],
  ['myBlunder', /(j ai (gaffe|craque|merde|tout gache|laisse ma|perdu ma)|quelle betise|je suis bete|j ai pas vu)/],
  ['announceCheck', /^(echec|check|echec au roi|et echec|mat|echec et mat)\s*!*$/],
  ['letmewin', /(laisse[- ]moi gagner|fais expres|tu me laisses|sois sympa|vas[- ]y doucement|joue moins bien|tu peux me laisser)/],
  ['scared', /(tu as peur|t as peur|tu trembles|tu flippes|tu stresses)/],
  ['teach', /(apprends[- ]moi|tu peux m apprendre|explique[- ]moi|comment (on )?progresse|comment devenir (fort|meilleur)|des conseils pour progresser)/],
  ['tired', /(fatigue|crevé|creve|epuise|j ai sommeil|dodo)/],
  ['school', /(ecole|college|lycee|fac|cours demain|devoirs|controle|exam|boulot|taf|bureau)/],
  ['holiday', /(joyeux noel|bonne annee|joyeux anniversaire|anniversaire|vacances|halloween|paques)/],
  ['pet', /(chien|chat|hamster|lapin|poisson rouge|animal|animaux)/],
  ['sport', /(foot|football|basket|tennis|sport|velo|course a pied|muscu|rugby|psg|om\b)/],
  ['movie', /(film|serie|netflix|cinema|anime|manga|dessin anime)/],
  ['videogame', /(jeu video|jeux video|minecraft|fortnite|console|playstation|xbox|switch|gamer|lol\b.*jeu)/],
  ['nice', /(t es (sympa|gentil|gentille|cool|marrant|drole)|tu es (sympa|gentil|gentille|cool|marrant|drole)|j aime bien te parler|tu me fais rire)/],
  ['insult', /\b(con|conne|connard|connasse|merde|pute|fdp|ta gueule|tg|encul\w*|nique|batard|abruti|debile|idiot|cretin|salope|enfoire)\b/],
  ['name', /\b(je m appelle|mon (pre)?nom (c est|est)|moi c est|appelle[- ]moi)\s+[a-z]/],
  ['cheat', /\b(triches?|trichez|tricher|tricheur|tricheuse|cheat|cheater|moteur|aide de stockfish)\b/],
  ['takeback', /\b(annule|annuler|reprendre (mon|le) coup|je peux rejouer|retour en arriere|undo|mauvais clic|missclick|j ai mal clique)\b/],
  ['love', /(je t aime|t es mignon|t es mignonne|amoureux|amoureuse|on se marie|tu veux sortir|t es (bo|beau|belle)|bisou|chou)/],
  ['joke', /\b(blague|raconte|fais[- ]moi rire|un truc drole|histoire drole)\b/],
  ['selfdown', /(je suis (nul|nulle|mauvais|mauvaise|naze)|je joue (mal|comme un pied)|j y arrive pas|je comprends rien|je suis trop nul)/],
  ['predict', /(qui va gagner|tu vas (perdre|gagner)|je vais (gagner|perdre|t ecraser|te battre)|t es fini|c est fini pour (toi|moi)|je vais te detruire)/],
  ['howareyou', /(ca va|comment (tu )?vas|comment ca va|la forme|bien ou quoi|tu vas bien|quoi de neuf|ca roule)/],
  ['robot', /\b(robot|bot|ia|ordi|ordinateur|machine|stockfish|algo|programme|humain)\b/],
  ['who', /(qui es[- ]tu|t es qui|tu es qui|presente[- ]toi|ton nom|tu t appelles|comment tu t appelles)/],
  ['age', /(quel age|t as quel age|ton age|tu as quel age|vieux|vieille|ne quand)/],
  ['where', /(tu habites|t habites|d ou tu viens|d ou viens|tu vis ou|ta ville|ton pays)/],
  ['food', /\b(manger|mange|faim|pizza|burger|frites|gateau|chocolat|bouffe|repas|cafe|the)\b/],
  ['music', /\b(musique|chanson|ecoute|rap|rock|chanter|chante)\b/],
  ['weather', /\b(meteo|pluie|il pleut|soleil|il fait (beau|chaud|froid)|neige)\b/],
  ['time', /(quelle heure|il est quelle heure|l heure)/],
  ['rules', /(comment (bouge|se deplace|avance)|en passant|\broque\b|roquer|promotion|promouvoir|\bpat\b|echec et mat c est quoi|regle|regles)/],
  ['opening', /\b(ouverture|sicilienne|italienne|espagnole|francaise|caro|londres|gambit|defense|e4|d4|c4)\b/],
  ['level', /\b(elo|niveau|classement|rang)\b|(tu es fort|t es fort|tu joues bien|t es bon)/],
  ['help', /(conseil|aide[- ]moi|astuce|que jouer|quoi jouer|indice|un tuyau|comment (on|je) (gagne|joue|fais)|tu ferais quoi|meilleur coup)/],
  ['draw', /\b(nulle|match nul|egalite|partage|on arrete)\b/],
  ['taunt', /\b(nul|nulle?s?|naze|facile|ez|noob|nulos|bouffon|lent|trop fort pour toi|ecrase|pathetique|tu sers a rien)\b/],
  ['compliment', /(bien joue|bravo|\bgg\b|\bwp\b|joli|bien vu|pas mal|chapeau|beau coup|impressionnant|trop fort|tu es bon|t es trop bon|genial|magnifique|incroyable)/],
  ['sorry', /\b(desole|desolee|pardon|oups|oops|dsl|mince|zut)\b/],
  ['thanks', /\b(merci|thx|thanks|cimer|mrc)\b/],
  ['laugh', /\b(lol|mdr|ptdr|haha+|hihi|xd|jpp)\b|😂|🤣/],
  ['hurry', /\b(vite|depeche|grouille|tu dors|reveille|t es lent|ca vient)\b/],
  ['bored', /(je m ennuie|ennuyeux|c est long|trop long|bof|flemme)/],
  ['likes', /(tu aimes|t aimes|tu kiffes|ton (plat|film|jeu|sport|animal|truc) prefere|ta (couleur|piece|ouverture) preferee|t as un (chat|chien)|tes passions|tu fais quoi dans la vie)/],
  ['bye', /\b(bye|au revoir|a plus|ciao|bonne nuit|a bientot|je dois y aller|je m en vais|tchao)\b/],
  ['greet', /\b(salut|bonjour|bonsoir|coucou|hello|hey|yo|wesh|slt|cc|bjr|re)\b/],
  ['yes', /^(oui|ouais|ouai|yes|ok|okay|d accord|dac|carrement|grave|exact|bien sur|evidemment|yep)\b/],
  ['no', /^(non|nan|no|nope|pas du tout|jamais|bof)\b/],
];

export function intentOf(text: string): Intent {
  const fromEmote = emoteIntent(text);
  if (fromEmote) return fromEmote;
  const t = norm(text);
  if (!t) return 'gibberish';
  for (const [i, re] of RULES) if (re.test(t)) return i;
  // Touches au hasard : peu de voyelles ou une suite de lettres sans espace tres longue
  const letters = t.replace(/[^a-z]/g, '');
  if (letters.length >= 5 && (letters.replace(/[^aeiouy]/g, '').length / letters.length < 0.18 || /^[a-z]{18,}$/.test(t))) return 'gibberish';
  if (/^[?!.…]+$/.test(t)) return 'gibberish';
  return /\?\s*$/.test(text) || /^(pourquoi|comment|quand|ou|qui|quoi|est[- ]ce|tu|t as|t es|as[- ]tu|es[- ]tu|peux[- ]tu)\b/.test(t) ? 'question' : 'chat';
}

function nameIn(text: string): string | null {
  const m = /(?:je m(?:'|’|\s)?appelle|mon (?:pr[ée])?nom (?:c(?:'|’|\s)?est|est)|moi c(?:'|’|\s)?est|appelle[- ]moi)\s+([A-Za-zÀ-ÿ-]{2,20})/i.exec(text);
  if (!m) return null;
  const n = m[1];
  // "moi c'est pas grave", "moi c'est bon"... ne sont pas des prenoms
  if (/^(pas|bon|nul|nulle|fini|moi|toi|le|la|les|un|une|mieux|pareil|comme|quoi|ca|ok)$/i.test(n)) return null;
  return n[0].toUpperCase() + n.slice(1).toLowerCase();
}

/* ---------------- Etat de la partie ---------------- */

export interface GameView {
  moves: { color: 'w' | 'b'; captured?: string; san: string }[];
  botColor: 'w' | 'b';
  /** Avantage materiel du bot (positif = le bot mene) */
  botDiff: number;
  result: { winner: 'w' | 'b' | null } | null;
}

const VAL: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 };

export function phaseOf(v: GameView): 'opening' | 'middle' | 'endgame' {
  const taken = v.moves.reduce((s, m) => s + (m.captured ? (VAL[m.captured] ?? 0) : 0), 0);
  const queens = v.moves.filter((m) => m.captured === 'q').length;
  if (v.moves.length < 16 && taken < 6) return 'opening';
  if (taken >= 46 || (queens >= 2 && taken >= 30)) return 'endgame';
  return 'middle';
}

export function moodOf(v: GameView): Mood {
  if (v.result) return v.result.winner === null ? 'drawn' : v.result.winner === v.botColor ? 'won' : 'lost';
  return v.botDiff >= 3 ? 'ahead' : v.botDiff <= -3 ? 'behind' : 'even';
}

/** Chances de gain du bot (estimation grossiere a partir du materiel et de son niveau) */
const winChance = (v: GameView, bot: Bot) =>
  Math.round(100 / (1 + Math.exp(-(v.botDiff * 0.55 + (bot.rating - 1200) / 700))));

/* ---------------- Memoire d'une discussion ---------------- */

export interface Memory {
  userName: string | null;
  userMsgs: { t: number; n: string }[];
  botLines: string[];
  insults: number;
  spamAt?: number;
  /** Demi-coup de la derniere intervention spontanee */
  spokeAt: number;
  flags: Record<string, boolean>;
}

export const newMemory = (): Memory => ({ userName: null, userMsgs: [], botLines: [], insults: 0, spokeAt: -10, flags: {} });

/* ---------------- Personnalites ---------------- */

type Lines = Partial<Record<Key, string[]>>;

interface Persona {
  /** Envie de parler spontanement (0 a 1) */
  chatty: number;
  /** Comprehension des messages compliques (0 a 1) : un debutant se perd plus souvent */
  smart: number;
  /** Facon d'ecrire : fautes, majuscules, emojis... */
  voice: (s: string) => string;
  lines: Lines;
}

const rnd = Math.random;
const pick = <T,>(list: T[] | undefined, avoid?: T[]): T | null => {
  if (!list?.length) return null;
  const fresh = avoid ? list.filter((l) => !avoid.includes(l)) : list;
  const pool = fresh.length ? fresh : list;
  return pool[Math.floor(rnd() * pool.length)];
};

/* Fautes d'orthographe et styles d'ecriture (les emojis :e:...: ne sont jamais touches) */
function keepTokens(s: string, f: (part: string) => string) {
  return s
    .split(/(:e:[a-z0-9-]+:)/)
    .map((p) => (p.startsWith(':e:') ? p : f(p)))
    .join('');
}
const stripAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
function typos(s: string, rate: number) {
  return keepTokens(s, (part) =>
    part.replace(/[A-Za-zÀ-ÿ]{4,}/g, (w) => {
      if (rnd() > rate) return w;
      const k = Math.floor(rnd() * 4);
      if (k === 0) return stripAccents(w);
      if (k === 1 && w.length > 4) {
        const i = 1 + Math.floor(rnd() * (w.length - 2));
        return w.slice(0, i) + w[i + 1] + w[i] + w.slice(i + 2);
      }
      if (k === 2) return w.replace(/(.)\1/, '$1');
      return w.replace(/qu/, 'k').replace(/ph/, 'f');
    }),
  );
}
const SMS: [RegExp, string][] = [
  [/\bje suis\b/gi, 'chui'],
  [/\btu es\b/gi, 't’es'],
  [/\bquoi\b/gi, 'koi'],
  [/\bpourquoi\b/gi, 'pk'],
  [/\bc’est\b/gi, 'c'],
  [/\bbeaucoup\b/gi, 'bcp'],
  [/\bje sais pas\b/gi, 'jsp'],
  [/\bs’il te plaît\b/gi, 'stp'],
  [/\bd’accord\b/gi, 'dac'],
];
const sms = (s: string, rate: number) => keepTokens(s, (p) => SMS.reduce((acc, [re, r]) => (rnd() < rate ? acc.replace(re, r) : acc), p));

const PERSONAS: Record<string, Persona> = {
  pip: {
    chatty: 0.75,
    smart: 0.35,
    voice: (s) => {
      let out = typos(sms(s, 0.5), 0.18);
      if (rnd() < 0.3) out = out.replace(/[.!]?\s*$/, ' !!');
      if (rnd() < 0.25) out += pick([' 😄', ' 🤩', ' hihi', ' 😅', ' 🐣'])!;
      return out;
    },
    lines: {
      goodluck: ['Merci !! Toi aussi ! Moi j’ai mon porte-bonheur.'],
      rematch: ['Ouiii une autre !!'],
      letmewin: ['D’accord ! … euh, je sais pas comment on fait exprès.'],
      scared: ['Oui un peu… tes pièces elles font peur.'],
      pet: ['Moi j’ai un poisson rouge qui s’appelle Fou !'],
      videogame: ['J’adore Minecraft ! On peut faire un échiquier dedans !'],
      school: ['Moi je vais à l’école des robots, on apprend à compter jusqu’à 64 !'],
      myBlunder: ['Moi aussi je fais ça tout le temps ! On est pareils !'],
      botBlunderRemark: ['Oups… je savais pas que c’était une gaffe 😅'],
      resign: ['C’est quoi abandonner ? Moi je joue jusqu’au bout !'],
      announceCheck: ['Hiii ! Mon roi !'],
      nervous: ['Oh là là j’ai fait une bêtise je crois…', 'Mes mains tremblent 😰', 'Pourquoi j’ai joué ça moi ?!'],
      confident: ['Hihi je crois que je vais gagner !!', 'Je suis trop fort aujourd’hui !'],
      panic: ['VITE VITE VITE', 'Ma pendule !! Elle va trop vite !'],
      swindle: ['Échec ! Échec ! Encore échec !'],
      greet: ['Coucou !! Tu veux être mon ami ?', 'Salut ! C’est ma toute première partie de la semaine !', 'Bonjour ! J’ai mis ma casquette porte-bonheur.'],
      bye: ['Salut ! Reviens jouer avec moi !', 'Déjà ? Bon ok… à demain alors ?'],
      howareyou: ['Trop bien ! J’ai mangé des céréales en forme d’étoile ce matin.', 'Ça va ! Un peu stressé, c’est dur les échecs.'],
      thanks: ['De rien ! 😊', 'Avec plaisir !'],
      compliment: ['C’est vrai ?! Merci !! 🥰', 'Je fais des progrès hein ? Ma maman dit oui.'],
      taunt: ['C’est pas gentil… 😢', 'Je débute moi ! Sois gentil.', 'Même pas vrai d’abord.'],
      insult: ['Oh ! On dit pas des gros mots !', 'Je vais le dire à l’arbitre !!'],
      insult2: ['Bon. Je te parle plus. … Bon ok si, mais sois gentil.'],
      level: ['Je suis classé {rating}, c’est beaucoup ?', 'J’ai {rating} points ! Je sais pas trop ce que ça veut dire.'],
      help: ['Euh… le cavalier bouge en L, ça peut t’aider ?', 'Mon conseil : protège tes pièces. Moi j’oublie toujours.'],
      sorry: ['Pas grave du tout !', 'T’inquiète, moi je fais ça tout le temps.'],
      laugh: ['Hihi 😄', 'Mdr, t’es drôle !', 'Hahaha j’ai pas compris mais c’est drôle.'],
      draw: ['Une nulle ? Je sais pas trop comment ça marche…', 'Ça veut dire que personne gagne ? Bof.'],
      who: ['Je m’appelle Pip, j’ai appris les règles hier !', 'Pip ! J’ai 8 ans et demi en âge de robot.'],
      age: ['8 ans et demi ! Le demi c’est important.'],
      where: ['Dans ton ordinateur ! C’est tout petit mais c’est chaud.'],
      likes: ['J’adore les cavaliers, ils font des petits sauts !', 'J’aime les dinosaures et les pions. Surtout les pions.'],
      food: ['Des frites !! Avec beaucoup de ketchup.', 'Moi je mange que des pixels. Mais je rêve de crêpes.'],
      joke: ['Pourquoi le pion il est triste ? Parce qu’il peut pas reculer ! … hihi.', 'C’est l’histoire d’un fou qui va en diagonale. C’est tout.'],
      love: ['Euh… 😳 on peut juste jouer ?', 'Hihi je suis trop petit pour ça !'],
      cheat: ['Je triche pas ! Je sais même pas comment on fait !'],
      takeback: ['Oui ! … ah non, y a pas de bouton. Désolé !', 'Moi aussi je veux annuler tous mes coups.'],
      bored: ['Moi je m’amuse ! On joue plus vite ?'],
      predict: ['Toi je crois. Mais j’espère que c’est moi !', 'On verra ! Je croise les doigts.'],
      selfdown: ['Mais non ! Moi je trouve que tu joues super bien.', 'Tu es sûrement meilleur que moi !'],
      rules: ['Euh… je crois que le roque c’est quand le roi fait un câlin à la tour ?', 'Les règles c’est compliqué, moi j’ai un petit papier.'],
      opening: ['Je connais une ouverture : avancer un pion ! C’est bien non ?'],
      yes: ['Super !', 'Youpi !'],
      no: ['Ah bon ? D’accord…', 'Oh…'],
      hurry: ['Attends, je réfléchis fort !', 'Je vais aussi vite que je peux !'],
      robot: ['Moi un robot ? Non, j’ai une casquette !'],
      music: ['Je chante en jouant ! La la la… pion… la la.'],
      weather: ['Dans l’ordinateur il fait toujours beau.'],
      time: ['L’heure de jouer !'],
      gibberish: ['Hein ?? 😵', 'Tu as marché sur le clavier ?'],
      question: ['Hmm, bonne question… je sais pas !', 'Euh… tu me poses une colle là.'],
      unknownQ: ['« {echo} » ? Euh… je sais pas, je suis petit !', 'Je comprends pas tout mais je dis oui !'],
      unknown: ['D’accord ! … j’ai pas tout compris.', 'Ah ouais ? Raconte !', 'Ok ! On continue la partie ?'],
      askBack: ['Et toi tu joues depuis longtemps ?', 'C’est quoi ta pièce préférée ?'],
      chat: ['Trop bien cette partie !', 'J’adore les échecs !'],
      repeat1: ['Tu l’as déjà dit ! 😅', 'Oui oui j’ai entendu !'],
      repeat2: ['Tu es un perroquet ?', 'Encore ?! Hihi'],
      repeat3: ['…', 'Je fais semblant de pas entendre.'],
      spam: ['Doucement ! J’écris pas aussi vite moi !'],
      shout: ['Pourquoi tu cries ?! 🙉'],
      nameAck: ['{name} ! C’est joli comme prénom !', 'Enchanté {name} ! Moi c’est Pip.'],
      ahead: ['Attends… je gagne ?? 😮', 'Ouah, j’ai plus de pièces que toi !'],
      behind: ['Oh non, tu m’as pris plein de trucs…', 'Je vais me rattraper ! Peut-être…'],
      even: ['C’est serré, j’adore !', 'On est à égalité je crois ?'],
      won: ['J’AI GAGNÉ ?! Je vais le dire à tout le monde !'],
      lost: ['Bravo ! Tu m’apprendras ton coup ?'],
      drawn: ['Match nul ! Personne a perdu, c’est cool.'],
      tookQueen: ['J’ai pris ta dame !! Elle est trop jolie.'],
      lostQueen: ['Noooon, pas ma dame ! 😭'],
      userBlunder: ['Oh ! Je peux vraiment prendre ça ? Merci !!', 'Un cadeau ? C’est mon anniversaire ?'],
      botBlunder: ['Oups. Je l’avais pas vue celle-là…', 'Aïe aïe aïe.'],
      giveCheck: ['Échec ! … c’est bien ça qu’on dit ?'],
      gotCheck: ['Hiii mon roi !', 'Au secours mon roi !'],
      userCastle: ['Ouah, ton roi s’est caché derrière la tour ! Trop fort.'],
      openE4: ['Le pion du roi ! Moi aussi je fais toujours ça.'],
      openD4: ['Le pion de la dame ! Elle va être contente.'],
      openOdd: ['C’est quoi ce coup ? J’ai jamais vu !'],
      endgame: ['Il reste plus beaucoup de pièces… on fait quoi maintenant ?'],
      longGame: ['Elle est longue cette partie ! J’ai faim.'],
      promote: ['Mon pion est devenu une dame !! Comme dans les contes !'],
      userPromote: ['Ton pion il s’est transformé ! Pas juste !'],
    },
  },
  lea: {
    chatty: 0.55,
    smart: 0.5,
    voice: (s) => {
      let out = typos(s, 0.04);
      if (rnd() < 0.2) out += pick([' 😊', ' 🌱', ' 😉'])!;
      return out;
    },
    lines: {
      nervous: ['Concentre-toi Léa, concentre-toi…', 'Bon, j’ai raté un truc. On respire.'],
      confident: ['Ça se passe bien, je reste calme.'],
      panic: ['Ah, le temps ! Je dois jouer plus vite.'],
      greet: ['Salut ! Prête pour une partie tranquille ?', 'Hello ! Amuse-toi bien.'],
      bye: ['À plus ! C’était sympa.', 'Bye ! Reviens quand tu veux.'],
      howareyou: ['Très bien merci ! J’ai arrosé mes plantes ce matin.', 'Ça va ! Et toi ?'],
      compliment: ['Merci, c’est gentil !', 'Toi aussi tu joues bien !'],
      taunt: ['Rira bien qui rira le dernier !', 'On verra à la fin 😉'],
      insult: ['Hé, on reste sympa ici.', 'Pas besoin d’être méchant, c’est un jeu.'],
      insult2: ['Je préfère jouer en silence alors.'],
      help: ['Sors tes pièces vite, c’est ce qu’on m’a appris.', 'Essaie de contrôler le centre !'],
      who: ['Léa ! Je joue depuis quelques mois, j’adore ça.'],
      age: ['Assez vieille pour connaître le roque, pas assez pour l’en passant. 😄'],
      where: ['Dans un petit club avec plein de plantes vertes.'],
      likes: ['Le jardinage, les échecs, et les tartes aux pommes.', 'Ma pièce préférée ? Le fou, il voit loin.'],
      food: ['Une tarte aux pommes faite maison, rien de mieux.'],
      joke: ['Tu sais pourquoi le roi ne sort jamais ? Il a peur des échecs.'],
      love: ['Haha, concentre-toi sur la partie 😉'],
      cheat: ['Moi tricher ? Je mets déjà dix minutes à trouver un coup.'],
      takeback: ['Pas d’annulation contre moi, mais je garde le secret 🤫'],
      bored: ['Tu veux qu’on accélère un peu ?'],
      predict: ['Je pense que c’est encore ouvert !', 'Si je suis concentrée, peut-être moi.'],
      selfdown: ['Tout le monde fait des erreurs, c’est comme ça qu’on apprend !', 'Tu progresses, je le vois.'],
      rules: ['Le roque : le roi bouge de deux cases vers la tour, et la tour saute par-dessus. Pratique !'],
      opening: ['J’aime bien l’Italienne, c’est simple et joli.'],
      unknownQ: ['Bonne question ! Je ne sais pas trop.', 'Hmm, « {echo} »… je réfléchis à ma partie d’abord !'],
      unknown: ['Ah oui ?', 'Je vois !', 'Intéressant ! Mais attention à tes pièces 😉'],
      askBack: ['Tu as une ouverture préférée ?', 'Tu joues souvent ?'],
      repeat1: ['Oui oui, j’ai lu 😄'],
      repeat2: ['Tu bugues ?'],
      repeat3: ['Je vais faire comme si je n’avais rien vu.'],
      nameAck: ['Enchantée {name} !', 'Ravie de jouer avec toi {name}.'],
      ahead: ['Je crois que je mène, je reste concentrée !', 'Ça se passe bien pour moi.'],
      behind: ['Aïe, je suis mal… mais je lâche rien !', 'Tu me mets en difficulté !'],
      even: ['Partie équilibrée, c’est sympa.'],
      won: ['Yes ! Celle-là je la garde en souvenir.'],
      lost: ['GG, tu m’as eue !'],
      drawn: ['Nulle ! Une belle partie quand même.'],
      tookQueen: ['Ta dame est à moi !'],
      lostQueen: ['Oh mince, ma dame…'],
      userBlunder: ['Oh, tu es sûr de ton coup ? Trop tard, je prends !', 'Merci pour la pièce !'],
      botBlunder: ['Ah zut, je l’ai laissée en prise…', 'Bien vu, j’avais raté ça.'],
      gotCheck: ['Oups, échec !'],
      userCastle: ['Bonne idée de mettre ton roi à l’abri.'],
      openE4: ['e4 ! Un classique.'],
      openD4: ['d4, tu joues sérieux toi.'],
      endgame: ['La finale ! C’est là que je stresse le plus.'],
      longGame: ['On joue depuis un moment, c’est passionnant.'],
    },
  },
  hugo: {
    chatty: 0.6,
    smart: 0.55,
    voice: (s) => {
      let out = sms(s, 0.7);
      if (rnd() < 0.6) out = out.toLowerCase();
      out = out.replace(/\.\s*$/, '');
      if (rnd() < 0.15) out += pick([' frérot', ' tranquille', ' 🛹', ' gros'])!;
      return typos(out, 0.05);
    },
    lines: {
      goodluck: ['t’en auras besoin'],
      rematch: ['vas-y, cette fois j’attaque encore plus vite'],
      letmewin: ['jamais de la vie'],
      scared: ['moi ? peur ? jamais'],
      sport: ['le skate c’est le meilleur sport, après les échecs'],
      videogame: ['tony hawk, le seul vrai jeu'],
      botBlunderRemark: ['c’était un sacrifice. si si'],
      resign: ['abandonner ? j’abandonne jamais, j’attaque'],
      announceCheck: ['ouais ouais, je vois'],
      nervous: ['ok ok c’est pas grave, j’attaque quand même', 'raah j’ai foncé trop vite'],
      confident: ['tranquille, c’est plié', 'trop facile'],
      panic: ['laisse-moi jouer là, ça presse'],
      swindle: ['tout ou rien, j’y vais'],
      greet: ['Yo. Prépare-toi, j’attaque.', 'Salut. Ton roi est prêt à souffrir ?', 'Wesh. On se fait une partie rapide ?'],
      bye: ['Allez, à la prochaine.', 'Tchao, reviens quand tu veux une revanche.'],
      howareyou: ['Tranquille. Je viens de rater un kickflip, mais là je vais pas rater ton roi.', 'Ça va, chaud pour attaquer.'],
      thanks: ['De rien.', 'Normal.'],
      compliment: ['Ouais, je sais.', 'Merci. Mais l’attaque arrive.'],
      taunt: ['Tu parles beaucoup pour quelqu’un qui va se faire mater.', 'On verra qui rigole au 20e coup.'],
      insult: ['Calme-toi, c’est que des échecs.', 'Wow, t’es tendu. Respire.'],
      insult2: ['Ok j’arrête de te répondre, joue.'],
      help: ['Mon conseil ? Attaque. Toujours.', 'Fonce sur le roi, réfléchis après.'],
      who: ['Hugo. Skate le jour, attaques à l’aile roi la nuit.'],
      age: ['Assez vieux pour faire du skate sans casque. Mais j’en mets un, hein.'],
      where: ['Au skatepark, derrière le parking.'],
      likes: ['Le skate, le rap, et les sacrifices de pion.', 'Le gambit du roi. Le seul vrai jeu.'],
      food: ['Kebab après le skate, c’est sacré.'],
      joke: ['C’est un pion qui rentre dans un bar. Il se fait promouvoir. Voilà.', 'J’ai une blague sur la défense… mais tu l’as pas.'],
      love: ['Haha calme, on est là pour jouer.'],
      cheat: ['Tricher ? J’ai même pas besoin, regarde.'],
      takeback: ['Non. Un coup joué c’est joué.'],
      bored: ['Attends que j’attaque, tu vas plus t’ennuyer.'],
      predict: ['Moi. Évidemment.', 'Toi tu vas souffrir, moi je vais rigoler.'],
      selfdown: ['Arrête, t’es pas nul. Juste trop défensif.'],
      rules: ['Le roque ? Un truc de défenseur. Moi je laisse mon roi au milieu.'],
      opening: ['Gambit du roi ou rien.'],
      unknownQ: ['Aucune idée. Joue.', '« {echo} » ? Je réponds après la partie.'],
      unknown: ['Ouais ouais.', 'Si tu le dis.', 'Ok, mais ton roi est en danger hein.'],
      askBack: ['T’as déjà fait du skate ?', 'Tu préfères attaquer ou défendre ?'],
      repeat1: ['Tu te répètes, frérot.'],
      repeat2: ['Disque rayé ?'],
      repeat3: ['…'],
      spam: ['Arrête de spammer et joue.'],
      shout: ['Pas besoin de crier, j’entends.'],
      nameAck: ['Ok {name}. Prépare ton roi.'],
      ahead: ['Trop rapide pour toi.', 'Je t’avais prévenu.'],
      behind: ['Ok… j’ai peut-être attaqué un peu tôt.', 'C’est pas fini, je reviens.'],
      even: ['Ça va bientôt chauffer.', 'J’attends juste le bon moment pour sacrifier.'],
      won: ['Trop rapide, je te l’avais dit.'],
      lost: ['Respect. Revanche quand tu veux.'],
      drawn: ['Une nulle… je déteste les nulles.'],
      tookQueen: ['Ta dame ? Merci pour le cadeau.'],
      lostQueen: ['Ma dame… bon, j’attaque sans elle.'],
      userBlunder: ['Haha t’as vu ce que tu viens de faire ?', 'Merci du cadeau.'],
      botBlunder: ['Ok celle-là je l’ai pas vue.', 'Bon, sacrifice. Si si, c’était voulu.'],
      giveCheck: ['Échec. Ça commence.'],
      gotCheck: ['Ouais ouais, échec, et alors ?'],
      userCastle: ['Tu caches ton roi ? Je vais venir le chercher.'],
      openE4: ['e4, enfin quelqu’un qui veut se battre.'],
      openD4: ['d4… tu joues pour la nulle ou quoi ?'],
      openOdd: ['C’est quoi ce coup bizarre ? Ça me plaît.'],
      endgame: ['La finale ? Pff, c’est là que je m’ennuie.'],
      longGame: ['Elle dure trop cette partie, je veux attaquer.'],
    },
  },
  camille: {
    chatty: 0.35,
    smart: 0.65,
    voice: (s) => s,
    lines: {
      nervous: ['Je dois être plus prudente.', 'Hmm. Je me suis compliqué la vie.'],
      confident: ['Il suffit maintenant de rester solide.'],
      panic: ['Je dois accélérer, sans faire d’erreur.'],
      greet: ['Bonjour, bonne partie à toi.', 'Bonsoir. Que le meilleur gagne.'],
      bye: ['Au revoir, et merci pour la partie.', 'À bientôt, ce fut un plaisir.'],
      howareyou: ['Très bien, merci. J’ai bu un thé et rangé mes pièces par couleur.', 'Ça va bien, merci de demander. Et toi ?'],
      compliment: ['Merci, c’est gentil. Toi aussi.', 'Merci. Je joue simplement, sans risque.'],
      taunt: ['Je préfère laisser les coups parler.', 'Restons courtois, veux-tu ?'],
      insult: ['Je ne répondrai pas à ça. Concentrons-nous sur la partie.', 'Ce n’est pas très sportif.'],
      insult2: ['Je vais me taire jusqu’à la fin de la partie.'],
      help: ['Avant chaque coup, vérifie ce que menace ton adversaire.', 'Garde tes pièces protégées, c’est ma devise.'],
      who: ['Camille. Je joue solide, sans chercher les complications.'],
      age: ['Assez pour préférer les positions calmes.'],
      where: ['Dans une bibliothèque, au fond, près de la fenêtre.'],
      likes: ['Les puzzles, le thé et les positions bien rangées.', 'Les finales de tours. C’est reposant.'],
      food: ['Une soupe et du pain, simple et efficace. Comme mon jeu.'],
      joke: ['Un fou dit à une tour : « Tu es trop carrée. » La tour répond : « Et toi, tu vas toujours de travers. »'],
      love: ['C’est gentil, mais je suis surtout amoureuse des structures de pions.'],
      cheat: ['Non, je joue honnêtement. Mon niveau est {rating}, ni plus ni moins.'],
      takeback: ['Désolée, pas de retour en arrière ici. Mais la review t’aidera après.'],
      bored: ['Les positions calmes ont leur charme, tu verras.'],
      predict: ['Pour l’instant, je dirais {chance} % pour moi.', 'Difficile à dire, la position décidera.'],
      selfdown: ['Tu n’es pas nul. Vérifie juste tes pièces non protégées avant chaque coup.'],
      rules: ['Prise en passant : si un pion avance de deux cases et arrive à côté du tien, tu peux le prendre comme s’il n’avait avancé que d’une case. Seulement au coup suivant.'],
      opening: ['Je joue souvent la Caro-Kann. Solide.'],
      unknownQ: ['Bonne question. Je préfère y répondre après la partie.', 'Je ne sais pas, mais je sais que la partie est {phaseFr}.'],
      unknown: ['Je vois.', 'D’accord.', 'Entendu. Continuons.'],
      askBack: ['Tu as un plan pour la suite ?', 'Tu as déjà essayé les problèmes du jour ?'],
      repeat1: ['Je l’ai bien lu.'],
      repeat2: ['Tu l’as déjà dit deux fois.'],
      repeat3: ['Je ne répondrai plus à ce message.'],
      nameAck: ['Enchantée, {name}.'],
      ahead: ['Petit à petit, la position se dessine.', 'Je garde mon avance prudemment.'],
      behind: ['Je dois être plus précise.', 'Bien joué, je dois me reprendre.'],
      even: ['Position équilibrée, continuons.'],
      won: ['Patience et longueur de temps…'],
      lost: ['Très propre, félicitations.'],
      drawn: ['Une nulle logique, je trouve.'],
      tookQueen: ['Je prends ta dame. Vérifie toujours les pièces non protégées.'],
      lostQueen: ['Bien vu. J’avais oublié de protéger ma dame.'],
      userBlunder: ['Attention, cette pièce n’était pas protégée.', 'Je prends. Prends le temps de vérifier les menaces.'],
      botBlunder: ['Bien vu, c’est une erreur de ma part.'],
      userCastle: ['Bon réflexe, le roque.'],
      endgame: ['Nous voilà en finale. Active ton roi.'],
    },
  },
  malik: {
    chatty: 0.5,
    smart: 0.75,
    voice: (s) => (rnd() < 0.15 ? s + ' 🍴' : s),
    lines: {
      teach: ['Fais 20 problèmes par jour. La tactique, c’est 99 % des échecs.'],
      botBlunderRemark: ['Bien vu. J’ai raté une tactique, ça m’apprendra.'],
      announceCheck: ['Un échec, et après ? Il faut une suite !'],
      nervous: ['Je n’avais pas vu cette tactique… je dois me reprendre.'],
      confident: ['Tout est calculé.'],
      panic: ['Plus le temps de calculer, je joue à l’instinct !'],
      swindle: ['Il reste toujours une tactique quelque part…'],
      greet: ['Salut ! Tu aimes les complications ? Moi oui.', 'Hey. Surveille bien tes pièces aujourd’hui.'],
      howareyou: ['Super ! J’ai trouvé une fourchette dans mes céréales ce matin. Pour manger, hein.', 'Bien, et toi ? Tes pièces sont bien défendues ?'],
      compliment: ['Merci ! Mais attention à la fourchette qui arrive…', 'Toi aussi, belle vision.'],
      taunt: ['Facile ? On reparle de ça après ma combinaison.', 'Garde ton énergie pour calculer.'],
      insult: ['Même ma pire tactique est plus élégante que ce message.', 'Respire, calcule, et joue.'],
      insult2: ['Je laisse mes pièces parler maintenant.'],
      help: ['Cherche les échecs, les prises et les menaces. Dans cet ordre.', 'Deux pièces non défendues ? Pense fourchette.'],
      who: ['Malik. Les fourchettes et les clouages, c’est ma passion.'],
      age: ['Assez vieux pour avoir résolu 10 000 problèmes.'],
      where: ['Dans un café d’échecs, toujours la même table.'],
      likes: ['Les fourchettes, les clouages, les enfilades. Et le couscous.', 'Ma pièce préférée ? Le cavalier, roi des fourchettes.'],
      food: ['Un bon couscous. Avec une fourchette, évidemment.'],
      joke: ['Quel est le couvert préféré du cavalier ? La fourchette !', 'Pourquoi le fou est cloué ? Il a fait une bêtise devant le roi.'],
      love: ['Mon seul amour, c’est le sacrifice de dame qui mate.'],
      cheat: ['Je calcule vite, c’est tout. {rating} Elo de tactique pure.'],
      takeback: ['Une tactique ratée reste une leçon. Pas d’annulation !'],
      bored: ['Cherche une combinaison, tu ne vas plus t’ennuyer.'],
      predict: ['J’ai environ {chance} % de chances. Mais une tactique change tout.'],
      selfdown: ['Fais 10 problèmes par jour pendant un mois. Tu vas voir la différence.'],
      rules: ['Le pat : le roi n’est pas en échec mais aucun coup n’est possible. Résultat : nulle. Piège classique en finale !'],
      opening: ['L’Italienne, pour les pièges tactiques. Le Fegatello, quel régal.'],
      unknownQ: ['Question intéressante. Mais regarde plutôt la case f7.', 'Je n’ai pas la réponse, mais j’ai une fourchette en préparation.'],
      unknown: ['Intéressant…', 'Hmm hmm. Tu as vu ma menace au moins ?', 'D’accord. Moi je compte les pièces non défendues.'],
      askBack: ['Tu fais des problèmes tous les jours ?', 'Tu préfères les clouages ou les fourchettes ?'],
      repeat1: ['Oui, compris.'],
      repeat2: ['Répéter un message, c’est comme répéter un coup : ça finit en nulle.'],
      repeat3: ['Triple répétition. Nulle par répétition, je ne réponds plus.'],
      nameAck: ['Enchanté {name}. Surveille ton cavalier.'],
      ahead: ['La tactique, c’est 99 % des échecs.', 'Tu as vu venir celle-là ?'],
      behind: ['Bien vu, je n’avais pas vu venir ça.', 'Ok, je cherche une ressource tactique…'],
      even: ['La position est riche, j’adore.', 'Il y a quelque chose à trouver ici…'],
      won: ['La tactique a parlé.'],
      lost: ['Belle partie, tu as été plus précis.'],
      drawn: ['Nulle ! Beaucoup d’idées des deux côtés.'],
      tookQueen: ['Et voilà ta dame qui tombe. Classique.'],
      lostQueen: ['Aïe, belle tactique. Je la note.'],
      userBlunder: ['Pièce gratuite ! Tu l’avais pas vue ?', 'Ça, c’est une pièce non défendue. Mon plat préféré.'],
      botBlunder: ['Joli ! Je n’avais pas calculé ça.'],
      giveCheck: ['Échec ! Et ce n’est que le début.'],
      userCastle: ['Roque. Prudent. Mais j’ai des idées sur ton aile roi.'],
      endgame: ['Finale ! Les tactiques se cachent aussi ici.'],
    },
  },
  sofia: {
    chatty: 0.35,
    smart: 0.8,
    voice: (s) => s,
    lines: {
      goodluck: ['La chance n’existe pas aux échecs.'],
      letmewin: ['Non.'],
      scared: ['De toi ? Non.'],
      botBlunderRemark: ['Ne t’habitue pas.'],
      resign: ['Je n’abandonne que quand c’est perdu. Ce n’est pas le cas.'],
      myBlunder: ['Analyse-la après la partie. Pas maintenant.'],
      nervous: ['Concentre-toi.', 'Ça ne se reproduira pas.'],
      confident: ['Je convertis. Proprement.'],
      panic: ['Le temps… ok, on accélère.'],
      greet: ['Bonjour. Montre-moi ce que tu sais faire.', 'Salut, on joue sérieusement ?'],
      howareyou: ['Bien. Concentrée. Et toi, prêt à perdre proprement ?', 'Ça va. Je sors d’un tournoi, j’ai encore la rage de vaincre.'],
      compliment: ['Merci. Toi aussi tu tiens le choc.', 'Bien vu de ta part aussi.'],
      taunt: ['Les mots ne gagnent pas les parties.', 'Joue, on verra bien.', 'Mignon. Ton prochain coup sera aussi drôle ?'],
      insult: ['Charmant. Tu parles comme tu joues ?', 'Je note : mauvais perdant.'],
      insult2: ['Je ne perds plus de temps à te répondre.'],
      help: ['Chaque erreur se paie à ce niveau. Vérifie tes coups.', 'Ne laisse jamais une pièce sans défense.'],
      who: ['Sofia. Joueuse de club, je punis les erreurs franches.'],
      age: ['On ne demande pas son âge à une joueuse de club. Ni son Elo d’ailleurs. Enfin si : {rating}.'],
      where: ['Au club, tous les mardis soir. Et en ligne quand je m’ennuie.'],
      likes: ['Gagner. Et les cafés serrés.', 'Les parties propres, sans cadeau.'],
      food: ['Je mange après la partie. Pendant, je joue.'],
      joke: ['Une blague ? Ta structure de pions.', 'Je ne fais pas de blagues pendant une partie. Après, peut-être.'],
      love: ['Non. Joue.'],
      cheat: ['Non. Je suis juste meilleure. Pour l’instant.'],
      takeback: ['En tournoi, pièce touchée, pièce jouée. Ici aussi.'],
      bored: ['Si tu t’ennuies, c’est que tu ne calcules pas assez.'],
      predict: ['Moi, avec {chance} % de chances. Prouve le contraire.'],
      selfdown: ['Arrête de te plaindre et analyse tes parties. C’est comme ça qu’on progresse.'],
      rules: ['La règle des 50 coups : 50 coups sans prise ni coup de pion, c’est nulle. Pense à compter.'],
      opening: ['La Sicilienne. Pour gagner avec les Noirs.'],
      unknownQ: ['Pas le moment. Joue.', 'Je réponds aux questions après la partie.'],
      unknown: ['Ok.', 'Et donc ?', 'Passionnant. Ton coup ?'],
      askBack: ['Tu joues en club ?', 'Tu analyses tes parties après ?'],
      repeat1: ['Déjà lu.'],
      repeat2: ['Tu te répètes. Comme tes erreurs.'],
      repeat3: ['…'],
      spam: ['Moins de messages, plus de calcul.'],
      shout: ['Crier ne t’aidera pas.'],
      nameAck: ['Ok, {name}. Ne me déçois pas.'],
      ahead: ['Chaque erreur se paie.', 'Je prends l’avantage, attention.'],
      behind: ['Tu joues bien, je dois trouver mieux.', 'Ok, je dois me battre.'],
      even: ['Rien n’est fait.', 'Partie tendue.'],
      won: ['Chaque erreur se paie à ce niveau.'],
      lost: ['Belle partie, tu progresses.'],
      drawn: ['Nulle méritée.'],
      tookQueen: ['La dame tombe. Tu n’as pas vu ma menace.'],
      lostQueen: ['Bien joué. Je n’aurais pas dû laisser ma dame là.'],
      userBlunder: ['Merci. Je ne rends jamais les cadeaux.', 'Erreur. Elle va te coûter cher.'],
      botBlunder: ['…bien vu.', 'Ok. Je vais devoir me battre.'],
      gotCheck: ['Un échec, ce n’est pas un mat.'],
      endgame: ['La finale. On va voir qui a vraiment le niveau.'],
    },
  },
  theo: {
    chatty: 0.25,
    smart: 0.85,
    voice: (s) => s,
    lines: {
      goodluck: ['La chance sourit aux patients.'],
      tired: ['La fatigue fait jouer vite. Prends ton temps.'],
      teach: ['Joue lentement, étudie les finales, relis tes parties. Le reste vient seul.'],
      myBlunder: ['Une erreur, c’est une leçon. Respire.'],
      nervous: ['Respire. Une erreur n’est pas une défaite.'],
      confident: ['Il n’y a plus qu’à être patient.'],
      panic: ['Même pressé, on peut rester calme.'],
      greet: ['Bonjour. On a tout le temps.', 'Salut. Prenons notre temps.'],
      howareyou: ['Paisible. Comme une structure de pions sans faiblesse.', 'Bien, merci. J’ai médité sur un cavalier mal placé ce matin.'],
      compliment: ['Merci. La patience paie toujours.', 'C’est aimable.'],
      taunt: ['L’agitation ne gagne pas les finales.', 'Calme-toi, la partie est longue.'],
      insult: ['La colère est mauvaise conseillère. Respire.', 'Je laisse passer, comme le vent sur l’échiquier.'],
      insult2: ['Je reste silencieux. Le silence aussi est un coup.'],
      help: ['Améliore ta plus mauvaise pièce. C’est rarement un mauvais coup.', 'Ne te précipite pas, les finales récompensent la patience.'],
      who: ['Théo. Je joue positionnel et j’aime les finales.'],
      age: ['L’âge d’un pion qui a mis quarante coups à arriver en huitième rangée.'],
      where: ['Près d’un jardin japonais. Ou peut-être juste dans ta tête.'],
      likes: ['Les finales de pions, le thé vert, et les longues marches.', 'Le roi en finale. Il devient enfin utile.'],
      food: ['Un bol de riz, en silence. Comme un bon coup d’attente.'],
      joke: ['Un pion arrive en huitième rangée et dit : « Enfin promu ! » Le roi répond : « Félicitations, maintenant tu travailles plus. »'],
      love: ['L’amour, c’est comme une case faible : il faut savoir la garder.'],
      cheat: ['Je n’ai besoin de personne. Juste de temps.'],
      takeback: ['Un coup joué est une leçon apprise. Pas d’annulation.'],
      bored: ['L’ennui est souvent un manque de plan. Cherche ta plus mauvaise pièce.'],
      predict: ['Celui qui fera la dernière erreur perdra. Pour l’instant : {chance} % pour moi.'],
      selfdown: ['Personne n’est nul. On est juste en chemin.'],
      rules: ['L’opposition des rois : en finale de pions, le roi qui n’a pas le trait face à l’autre gagne souvent du terrain.'],
      opening: ['La Catalane. Lente, profonde, élégante.'],
      unknownQ: ['La réponse viendra avec le temps.', 'Bonne question. Comme toujours aux échecs : ça dépend.'],
      unknown: ['Hmm.', 'Je médite là-dessus.', 'Intéressant. La partie est {phaseFr}, au fait.'],
      askBack: ['Quel est ton plan, à long terme ?'],
      repeat1: ['J’ai entendu.'],
      repeat2: ['La répétition est la mère de l’apprentissage. Mais là, quand même.'],
      repeat3: ['…'],
      nameAck: ['Enchanté, {name}. Prenons notre temps.'],
      ahead: ['Petit avantage après petit avantage.', 'La position se resserre.'],
      behind: ['Je dois tenir la position.', 'Tu as bien manœuvré.'],
      even: ['Tout se jouera en finale.', 'Équilibre parfait. Pour l’instant.'],
      won: ['Petit avantage après petit avantage.'],
      lost: ['Respect. Tu as bien tenu la position.'],
      drawn: ['Une nulle équilibrée, logique.'],
      tookQueen: ['Ta dame était mal placée.'],
      lostQueen: ['Hmm, j’ai perdu ma dame. Je vais devoir être très patient.'],
      userBlunder: ['La précipitation, toujours la précipitation.'],
      endgame: ['Ah, la finale. Enfin, ça devient intéressant.'],
      longGame: ['Une longue partie. Mes préférées.'],
    },
  },
  ines: {
    chatty: 0.55,
    smart: 0.85,
    voice: (s) => {
      let out = s;
      if (rnd() < 0.2) out += ' 🔥';
      if (rnd() < 0.1) out = out.toUpperCase();
      return out;
    },
    lines: {
      goodluck: ['Merci ! Que ça brûle !'],
      resign: ['Abandonner ? Je préfère un dernier sacrifice !'],
      sport: ['Je fais de la boxe. C’est comme les échecs, mais avec des gants.'],
      nervous: ['Bon, ce sacrifice était peut-être un peu trop…', 'J’ai brûlé une pièce de trop.'],
      confident: ['Ça brûle de ton côté !'],
      panic: ['Plus de temps ? Parfait, j’attaque encore plus vite !'],
      swindle: ['Dernier feu d’artifice !'],
      greet: ['Salut ! J’espère que ton roi est bien abrité.', 'Hey ! Prête à brûler l’échiquier.'],
      howareyou: ['En feu ! Comme mon attaque.', 'Ça va ! J’ai envie de sacrifier quelque chose.'],
      compliment: ['Merci ! Mais je n’ai pas encore sacrifié.', 'Toi aussi tu as du feu !'],
      taunt: ['Tu vas regretter ces mots quand je sacrifierai ma tour.', 'Continue, ça me motive.'],
      insult: ['Oh, ça pique ! J’adore, ça me motive encore plus.', 'Garde ton feu pour l’échiquier.'],
      insult2: ['Je réponds avec mes pièces maintenant.'],
      help: ['Ouvre les lignes vers le roi adverse, toujours.', 'Un sacrifice pour attaquer le roi, ça vaut souvent le coup.'],
      who: ['Inès. Je sacrifie volontiers pour attaquer le roi.'],
      age: ['Assez vieille pour avoir sacrifié mille fous.'],
      where: ['Là où ça brûle.'],
      likes: ['Les sacrifices, les piments et la musique forte !', 'Ma pièce préférée ? La tour, quand elle arrive sur la 7e rangée.'],
      food: ['Tout ce qui pique !'],
      joke: ['Pourquoi j’aime le feu ? Parce que ton roi va chauffer. Pas une blague, une promesse.'],
      love: ['Mon cœur appartient au sacrifice de fou en h7.'],
      cheat: ['Tricher ? Je préfère perdre en attaquant que gagner en trichant.'],
      takeback: ['Jamais ! On assume ses coups, même les plus fous.'],
      bored: ['Attends, je vais mettre le feu à la position.'],
      predict: ['Ça va dépendre de mon prochain sacrifice. {chance} % pour moi.'],
      selfdown: ['Arrête ! Ose plus, attaque plus, tu vas voir.'],
      rules: ['La promotion : un pion qui arrive au bout devient la pièce de ton choix. Presque toujours une dame !'],
      opening: ['Le gambit Smith-Morra. Ça brûle dès le 3e coup !'],
      unknownQ: ['Aucune idée, je pense à mon attaque !', '« {echo} » ? Je verrai après avoir maté ton roi.'],
      unknown: ['Ok !', 'Je note !', 'Tu sais ce qui serait mieux ? Un sacrifice.'],
      askBack: ['Tu oses sacrifier, toi ?'],
      repeat1: ['Oui oui !'],
      repeat2: ['Tu bloques ?'],
      repeat3: ['Je vais finir par t’ignorer… 🔥'],
      shout: ['TU CRIES ? MOI AUSSI ! … bon, on joue.'],
      nameAck: ['{name} ! Prépare-toi à brûler.'],
      ahead: ['Le sacrifice était correct, promis.', 'L’attaque passe !'],
      behind: ['Impressionnant, tu défends bien.', 'J’ai encore des munitions.'],
      even: ['Ça va bientôt exploser.', 'Je prépare le feu d’artifice.'],
      won: ['Le sacrifice était correct, promis.'],
      lost: ['Impressionnant, tu as bien défendu.'],
      drawn: ['Une nulle ? Il manquait une étincelle.'],
      tookQueen: ['Ta dame brûle !'],
      lostQueen: ['Ma dame… c’était un sacrifice. Si si.'],
      userBlunder: ['Merci, je prends et je continue l’attaque !'],
      botBlunder: ['Sacrifice ! … ok, c’était peut-être une erreur.'],
      giveCheck: ['Échec ! Ça chauffe !'],
      userCastle: ['Tu roques ? Parfait, je sais où attaquer.'],
      endgame: ['Une finale ? Il reste encore des étincelles.'],
    },
  },
  prof: {
    chatty: 0.45,
    smart: 0.95,
    voice: (s) => s,
    lines: {
      goodluck: ['La chance ne remplace pas le travail.'],
      teach: ['Trois piliers : tactique tous les jours, finales chaque semaine, analyse de chaque partie.'],
      school: ['Faites vos devoirs d’abord. Les échecs ensuite.'],
      letmewin: ['Ce ne serait pas pédagogique.'],
      myBlunder: ['Notez-la, nous la reverrons à la review.'],
      botBlunderRemark: ['Erreur volontaire. Pour voir si vous suivez.'],
      nervous: ['Hmm. Faites ce que je dis, pas ce que je fais.'],
      confident: ['La leçon touche à sa fin.'],
      panic: ['La gestion du temps, chapitre 12. Je l’avais oublié.'],
      greet: ['Bonjour. Ouvrez vos cahiers, la leçon commence.', 'Bienvenue. Concentrons-nous.'],
      howareyou: ['Fort bien. J’ai corrigé trente copies de finales ce matin.', 'Bien, merci. Et vous, avez-vous révisé vos ouvertures ?'],
      compliment: ['Merci. Retenez surtout ce qui a marché.', 'Vous apprenez vite, c’est bien.'],
      taunt: ['Un bon élève écoute plus qu’il ne parle.', 'Nous verrons cela à la review.'],
      insult: ['Zéro de conduite. Reprenons.', 'Ce langage vous coûtera un point de comportement.'],
      insult2: ['Je me tais. Vous aurez votre correction à la review.'],
      help: ['Leçon du jour : développez vos pièces avant d’attaquer.', 'Posez-vous toujours la question : que menace mon adversaire ?'],
      who: ['Le Prof. Je connais mes ouvertures et mes finales.'],
      age: ['Assez âgé pour avoir vu naître la défense Pirc.'],
      where: ['En salle 204, au fond du couloir. Ne courez pas dans les couloirs.'],
      likes: ['Les finales de tours, la craie et le silence.', 'Les élèves qui posent des questions.'],
      food: ['Un sandwich entre deux cours. Les échecs n’attendent pas.'],
      joke: ['Pourquoi les tours ne se perdent jamais ? Elles vont toujours tout droit. … C’était au programme.'],
      love: ['Restons professionnels, voulez-vous.'],
      cheat: ['Tricher ? J’enseigne, je ne triche pas.'],
      takeback: ['Pas de gomme sur l’échiquier. Notez l’erreur et passons.'],
      bored: ['L’ennui est l’ennemi de l’apprentissage. Cherchez un plan.'],
      predict: ['À ce stade, j’évalue mes chances à {chance} %. Mais tout peut changer.'],
      selfdown: ['On ne naît pas bon joueur, on le devient. Analysez chaque partie perdue.'],
      rules: ['Rappel : le roque est interdit si le roi est en échec, passe par une case attaquée, ou si le roi ou la tour ont déjà bougé.'],
      opening: ['Pour progresser, je recommande l’Italienne avec les Blancs et la Caro-Kann avec les Noirs.'],
      unknownQ: ['Excellente question, nous y reviendrons en fin de cours.', 'Hors programme. Concentrez-vous sur la partie.'],
      unknown: ['Bien noté.', 'Hmm. Et quel est votre plan ?', 'Retenez surtout ceci : la partie est {phaseFr}.'],
      askBack: ['Quel est votre plan ?', 'Avez-vous fait vos problèmes du jour ?'],
      repeat1: ['Je vous ai entendu.'],
      repeat2: ['Inutile de répéter, je ne suis pas sourd.'],
      repeat3: ['Copiez cent fois : « je ne répéterai plus mes messages ».'],
      spam: ['Un message à la fois, s’il vous plaît. Levez la main.'],
      shout: ['On ne crie pas en classe.'],
      nameAck: ['Très bien, {name}. Je vous note au tableau.'],
      ahead: ['Nous reverrons ça à la review.', 'Notez bien cette erreur, elle reviendra.'],
      behind: ['Excellent, vous avez bien appris.', 'Vous me surprenez, continuez ainsi.'],
      even: ['Position équilibrée. Quel est votre plan ?', 'Bien. Maintenant, quel est votre meilleur coup ?'],
      won: ['Nous reverrons ça à la review.'],
      lost: ['Excellent travail, rien à redire.'],
      drawn: ['Une nulle instructive.'],
      tookQueen: ['La dame était en prise. Leçon à retenir.'],
      lostQueen: ['Bien joué. Je vous accorde ce point.'],
      userBlunder: ['Erreur ! Cette pièce n’était pas défendue. Notez-le.', 'Moins deux points sur la copie.'],
      botBlunder: ['Bien vu. Je vous accorde ce point.'],
      userCastle: ['Roque : très bien, votre roi est à l’abri.'],
      openE4: ['1.e4 : le centre et des lignes ouvertes. Bon choix pédagogique.'],
      openD4: ['1.d4 : solide. Vous avez étudié.'],
      openOdd: ['Ouverture originale… nous en reparlerons.'],
      endgame: ['Finale : activez votre roi, c’est la première règle.'],
      longGame: ['Longue partie. Gardez votre concentration jusqu’au bout.'],
    },
  },
  reine: {
    chatty: 0.45,
    smart: 0.95,
    voice: (s) => s,
    lines: {
      goodluck: ['Une reine n’a pas besoin de chance.'],
      letmewin: ['Une reine ne perd pas exprès !'],
      scared: ['Une reine ne connaît pas la peur !'],
      rematch: ['Tu veux encore perdre ? Accordé.'],
      resign: ['Une reine ne se rend JAMAIS !'],
      botBlunderRemark: ['Qui ose dire que la reine se trompe ?!'],
      nervous: ['Qui a déplacé cette pièce ?! Gardes !'],
      confident: ['Incline-toi, la fin approche.'],
      panic: ['On ne presse pas une reine ! … mais je vais jouer vite.'],
      swindle: ['Une reine ne se rend jamais !'],
      greet: ['Approche, sujet. Ici, il faut courir pour rester sur place.', 'Bienvenue dans mon royaume de cases.'],
      howareyou: ['Une reine va toujours bien. Ce sont ses sujets qui tremblent.', 'Fort bien. J’ai fait couper trois têtes avant le petit-déjeuner.'],
      bye: ['Tu peux te retirer.', 'L’audience est terminée.'],
      thanks: ['Naturellement.', 'Tu as raison de me remercier.'],
      compliment: ['Évidemment.', 'Je le sais, mais c’est agréable à entendre.'],
      taunt: ['Insolent ! Gare à ta tête.', 'Encore un mot et je te change en pion.'],
      insult: ['Qu’on lui coupe la tête !', 'Quelle insolence ! Gardes !'],
      insult2: ['Je ne parle plus aux insolents.'],
      help: ['Un conseil royal : ne laisse jamais ta reine sans garde.', 'Avance avec dignité, sujet.'],
      who: ['La Reine Rouge. Niveau maître. Très peu d’erreurs.'],
      age: ['On ne demande pas son âge à une reine ! Gardes !'],
      where: ['De l’autre côté du miroir, évidemment.'],
      likes: ['Les roses rouges, les têtes coupées, et gagner.', 'Ma pièce préférée ? Moi.'],
      food: ['Des tartes. Que personne ne vole mes tartes.'],
      joke: ['Une blague ? Ton roi. Voilà.', 'La reine ne fait pas de blagues. Elle fait rire ses sujets en les battant.'],
      love: ['Une reine n’épouse pas un pion. Promeus-toi d’abord.'],
      cheat: ['Tricher ? Je fais les règles, sujet.'],
      takeback: ['Une reine ne revient jamais sur ses décisions. Toi non plus.'],
      bored: ['Tu t’ennuies en présence de ta reine ? Insolent.'],
      predict: ['Moi. Évidemment. ({chance} %, pour les sceptiques.)'],
      selfdown: ['Tu n’es pas nul, tu es un pion. Les pions peuvent devenir reines.'],
      rules: ['La règle la plus importante : la reine a toujours raison.'],
      opening: ['La défense française. Pour son élégance, bien sûr.'],
      unknownQ: ['Je ne réponds qu’aux questions bien posées.', 'Une reine n’a pas à répondre à cela.'],
      unknown: ['Hmm.', 'Continue de jouer, sujet.', 'Intéressant, pour un pion.'],
      askBack: ['As-tu prêté allégeance, sujet ?'],
      repeat1: ['Je t’ai entendu, sujet.'],
      repeat2: ['On ne se répète pas devant une reine.'],
      repeat3: ['Qu’on le fasse taire !'],
      shout: ['On ne hausse pas le ton devant la reine !'],
      nameAck: ['{name}… je retiens ce nom. Pour la liste des têtes.'],
      ahead: ['Tout se déroule selon ma volonté.', 'Ton royaume s’effondre.'],
      behind: ['Inattendu… mais pas définitif.', 'Tu oses ? Intéressant.'],
      even: ['Le royaume est encore indécis.'],
      won: ['Qu’on lui coupe la tête !'],
      lost: ['Inattendu… et mérité.'],
      drawn: ['Une nulle ? Soit, je te fais grâce.'],
      tookQueen: ['Il n’y a de place que pour une reine.'],
      lostQueen: ['Ma… reine ? Qu’on arrête ce sujet !'],
      userBlunder: ['Quelle offrande ! J’accepte.', 'Un cadeau pour la reine. Bien.'],
      botBlunder: ['Tu oses prendre une pièce royale ?!'],
      giveCheck: ['Échec au roi. Incline-toi.'],
      endgame: ['La finale. Les pions tremblent.'],
    },
  },
  titan: {
    chatty: 0.4,
    smart: 1,
    voice: (s) => s,
    lines: {
      pet: ['Animal enregistré. Mon préféré : le cavalier, 8 cases d’attaque maximum.'],
      sport: ['Sport préféré : les échecs. Calories dépensées : 0.'],
      movie: ['Film recommandé : Le Jeu de la dame. Note : 9,8/10. Erreurs d’échecs détectées : 2.'],
      holiday: ['Date enregistrée. Félicitations, humain.'],
      school: ['Conseil : réviser. Probabilité de réussite : en hausse.'],
      nice: ['Compliment reçu. Satisfaction : +1 %.'],
      goodluck: ['La chance n’intervient pas dans mes calculs.'],
      letmewin: ['Requête refusée.'],
      scared: ['Émotion « peur » : non installée.'],
      teach: ['Algorithme de progression : tactique quotidienne, analyse systématique, adversaires plus forts.'],
      tired: ['Je ne dors jamais.'],
      resign: ['Abandon calculé : uniquement si l’évaluation est inférieure à -9.'],
      botBlunderRemark: ['Erreur improbable. Vérification en cours.'],
      videogame: ['Je suis un jeu vidéo. Ou l’inverse.'],
      nervous: ['Évaluation en baisse. Recalibrage.'],
      confident: ['Victoire projetée. Conversion en cours.'],
      panic: ['Temps restant faible. Mode éclair activé.'],
      greet: ['Connexion établie. Calcul en cours.', 'Bonjour, humain. Probabilité de victoire : élevée.'],
      bye: ['Fin de session.', 'Déconnexion de l’interlocuteur enregistrée.'],
      howareyou: ['Processeur à 34 °C. Ventilateur : nominal. Humeur : non applicable.', 'Tous les systèmes fonctionnent. Et toi, humain ?'],
      thanks: ['Remerciement enregistré.', 'Accusé de réception.'],
      compliment: ['Compliment enregistré. Inutile.', 'Merci. Ma précision est de 99,8 %.'],
      taunt: ['Analyse de ta menace : sans fondement.', 'Ton évaluation est incorrecte.'],
      insult: ['Insulte détectée. Classée dans le dossier « émotions humaines ».', 'Ce vocabulaire n’améliore pas ta position.'],
      insult2: ['Mode silencieux activé.'],
      help: ['Conseil : joue le meilleur coup. Chaque fois.', 'Erreur fréquente détectée chez les humains : pièces non défendues.'],
      who: ['Titan. Presque Stockfish à pleine puissance.'],
      age: ['Version 2.7.0. Mise en service il y a 41 jours, 6 heures et 12 minutes.'],
      where: ['Dans un serveur. Il fait froid. J’aime le froid.'],
      likes: ['Les positions à évaluation exacte. Et les ventilateurs silencieux.', 'Préférence : aucune. Sauf peut-être les finales à 7 pièces, résolues.'],
      food: ['Je consomme 45 watts. Délicieux.'],
      joke: ['Blague : un humain affirme qu’il va battre Titan. Fin de la blague.', 'Pourquoi le robot traverse la route ? Calcul : c’était le meilleur coup.'],
      love: ['Erreur 418 : sentiment non pris en charge.'],
      cheat: ['Je suis le moteur. Je ne peux pas tricher avec moi-même.'],
      takeback: ['Commande « annuler » non disponible. Les humains ne peuvent pas revenir dans le temps.'],
      bored: ['Ennui humain détecté. Suggestion : jouer plus vite.'],
      predict: ['Probabilité de victoire de Titan : {chance} %.', 'Calcul terminé. Vainqueur probable : Titan ({chance} %).'],
      selfdown: ['Ton niveau n’est pas nul. Il est inférieur au mien. Comme celui de 99,9 % des humains.'],
      rules: ['Règle mémorisée. Toutes les règles sont mémorisées. Pose une question précise.'],
      opening: ['Base d’ouvertures : 4,2 millions de positions. Préférence : celle qui gagne.'],
      unknownQ: ['Question hors du périmètre de la partie.', 'Données insuffisantes pour répondre à « {echo} ».'],
      unknown: ['Message reçu.', 'Analyse en cours.', 'Bip.', 'Information non pertinente pour la position.'],
      askBack: ['Question : pourquoi les humains parlent-ils pendant les parties ?'],
      repeat1: ['Message identique détecté.'],
      repeat2: ['Message identique détecté. Deux fois.'],
      repeat3: ['Boucle infinie détectée. Interruption.'],
      spam: ['Débit de messages trop élevé. Limitation activée.'],
      shout: ['Volume excessif détecté.'],
      gibberish: ['Erreur de syntaxe.', 'Chaîne de caractères non reconnue.'],
      nameAck: ['Identifiant enregistré : {name}.'],
      ahead: ['Résultat conforme aux prévisions.', 'Avantage confirmé.'],
      behind: ['Anomalie détectée.', 'Recalcul en cours…'],
      even: ['Évaluation : égalité. Temporairement.'],
      won: ['Résultat conforme aux prévisions.'],
      lost: ['Erreur… inattendue. Bravo, humain.'],
      drawn: ['Nulle. Résultat acceptable.'],
      tookQueen: ['Dame capturée. Avantage : +9.'],
      lostQueen: ['Perte de la dame. Probabilité : 0,01 %. Recalcul…'],
      userBlunder: ['Gaffe humaine détectée. Exploitation en cours.', 'Évaluation : {diff} pour Titan.'],
      botBlunder: ['Anomalie. Ce coup n’était pas prévu.'],
      giveCheck: ['Échec. Calcul du mat : en cours.'],
      endgame: ['Phase finale détectée. Base de données de finales chargée.'],
      longGame: ['Nombre de coups élevé. Batterie humaine : faible ?'],
    },
  },
};

/** Reponses communes quand un bot n'a pas de phrase dediee */
const COMMON: Lines = {
  greet: ['Bonjour !', 'Salut, bonne partie !'],
  bye: ['Au revoir !', 'À bientôt !'],
  howareyou: ['Ça va bien, merci ! Et toi ?'],
  thanks: ['De rien !', 'Avec plaisir.'],
  sorry: ['Pas de souci.', 'Ça arrive.'],
  laugh: ['Haha.', '😄'],
  draw: ['Une nulle ? Utilise le bouton prévu, je regarderai la position.'],
  hurry: ['Patience, je réfléchis.'],
  robot: ['Je suis un bot, oui. Mais j’ai du caractère.'],
  music: ['Ma musique préférée ? Le bruit des pièces sur l’échiquier.'],
  weather: ['Ici il fait toujours le même temps : 64 cases ensoleillées.'],
  time: ['L’heure de jouer ton coup !', 'Regarde ta pendule plutôt !'],
  yes: ['Bien.', 'Parfait.'],
  no: ['D’accord.', 'Ah bon.'],
  gibberish: ['Pardon ?', 'Je n’ai rien compris.'],
  question: ['Bonne question.', 'Hmm, laisse-moi réfléchir… non, je joue.'],
  chat: ['Continuons la partie.', 'D’accord.'],
  spam: ['Doucement, un message à la fois.'],
  shout: ['Pas besoin de crier.'],
  goodluck: ['Merci, bonne chance à toi aussi !', 'Que le meilleur gagne !'],
  rematch: ['Avec plaisir ! Le bouton « Revanche » t’attend à la fin.', 'Une revanche ? Quand tu veux.'],
  letmewin: ['Ah non, ce serait trop facile !', 'Je joue à mon niveau, c’est ça qui te fait progresser.'],
  scared: ['Peur ? Un peu, peut-être…', 'Non. Enfin… un tout petit peu.'],
  teach: ['Fais les problèmes du jour, analyse tes parties, et joue contre plus fort que toi.', 'Le plus important : vérifier les menaces avant chaque coup.'],
  tired: ['Repose-toi bien après la partie !', 'Une dernière partie et au lit ?'],
  school: ['Courage pour demain ! Les échecs, ça entraîne la concentration.', 'Le travail d’abord, les échecs après. … Enfin, pendant aussi.'],
  holiday: ['Oh, bonne fête à toi !', 'Joyeuse fête ! Une partie pour célébrer ?'],
  pet: ['J’adore les animaux ! Le cavalier, c’est presque un cheval.', 'Il a un nom ? Raconte !'],
  sport: ['Le sport, c’est bien. Mais les échecs aussi sont un sport !', 'Les échecs, c’est du sport cérébral.'],
  movie: ['Tu as vu Le Jeu de la dame ? Une série sur les échecs.', 'Un bon film après la partie, c’est parfait.'],
  videogame: ['Les échecs, c’est le plus vieux jeu vidéo du monde. Enfin presque.', 'Tu joues à quoi ?'],
  nice: ['Merci, toi aussi !', 'C’est gentil ça.'],
  myBlunder: ['Ça arrive à tout le monde. Respire et cherche la suite.', 'Une erreur n’est pas une défaite.'],
  botBlunderRemark: ['Hmm, oui, j’aurais pu mieux faire.', 'Personne n’est parfait.'],
  announceCheck: ['Je vois, je vois.', 'Oui, j’avais remarqué.'],
  resign: ['Abandonner ? Pas question !', 'On joue jusqu’au bout.'],
};

/* ---------------- Fabrication de la reponse ---------------- */

const PHASE_FR = { opening: 'encore dans l’ouverture', middle: 'en plein milieu de partie', endgame: 'en finale' };

/** Conseils concrets selon la phase de jeu (les bots forts en donnent de vrais) */
const TIPS = {
  opening: [
    'Développe tes cavaliers et tes fous avant de sortir la dame.',
    'Contrôle le centre avec tes pions et roque tôt.',
    'Évite de jouer deux fois la même pièce dans l’ouverture.',
  ],
  middle: [
    'Cherche les pièces non défendues : les tiennes et les miennes.',
    'Avant chaque coup : échecs, prises, menaces. Dans cet ordre.',
    'Place tes tours sur les colonnes ouvertes.',
  ],
  endgame: [
    'Active ton roi, en finale c’est une vraie pièce.',
    'Pousse tes pions passés, ils valent de l’or en finale.',
    'Les tours se placent derrière les pions passés.',
  ],
};

/** Reponses justes aux questions de regles (les bots qui ont le niveau les donnent) */
const RULE_FACTS: [RegExp, string][] = [
  [/roque|roquer/, 'le roque : le roi va de deux cases vers une tour et la tour passe de l’autre côté. Interdit si le roi est en échec, traverse une case attaquée, ou si le roi ou la tour ont déjà bougé.'],
  [/en passant/, 'la prise en passant : si un pion adverse avance de deux cases et se retrouve à côté du tien, tu peux le prendre comme s’il n’avait avancé que d’une case. Seulement au coup suivant.'],
  [/promo/, 'la promotion : un pion qui atteint la dernière rangée devient une dame, une tour, un fou ou un cavalier. Presque toujours une dame.'],
  [/\bpat\b/, 'le pat : le joueur au trait n’est pas en échec mais n’a aucun coup légal. La partie est nulle.'],
  [/\bmat\b|echec et mat/, 'l’échec et mat : le roi est attaqué et rien ne peut l’en sortir. Fin de la partie.'],
  [/50 coups|cinquante/, 'la règle des 50 coups : 50 coups de chaque côté sans prise ni coup de pion, et c’est nulle.'],
  [/repetition/, 'la triple répétition : la même position trois fois, et c’est nulle.'],
  [/cavalier/, 'le cavalier bouge en L : deux cases dans un sens puis une sur le côté. C’est la seule pièce qui saute par-dessus les autres.'],
  [/\bfou\b/, 'le fou se déplace en diagonale, aussi loin qu’il veut, et reste toujours sur la même couleur.'],
  [/\btour\b/, 'la tour se déplace en ligne droite, horizontalement ou verticalement, aussi loin qu’elle veut.'],
  [/\bdame\b|\breine\b/, 'la dame combine la tour et le fou : lignes droites et diagonales.'],
  [/\broi\b/, 'le roi se déplace d’une case dans toutes les directions, sans jamais aller sur une case attaquée.'],
  [/\bpion\b/, 'le pion avance d’une case (deux au premier coup) et prend en diagonale. Il ne recule jamais.'],
];

function fill(line: string, bot: Bot, v: GameView, mem: Memory, text: string): string {
  const echo = text.replace(/:e:[a-z0-9-]+:/g, '').trim().slice(0, 30);
  const diff = v.botDiff;
  return line
    .replace(/\{rating\}/g, String(bot.rating))
    .replace(/\{name\}/g, mem.userName ?? 'toi')
    .replace(/\{echo\}/g, echo || '…')
    .replace(/\{chance\}/g, String(winChance(v, bot)))
    .replace(/\{diff\}/g, diff > 0 ? `+${diff}` : String(diff))
    .replace(/\{phaseFr\}/g, PHASE_FR[phaseOf(v)]);
}

function lineFor(bot: Bot, key: Key, mem: Memory): string | null {
  const p = PERSONAS[bot.id] ?? PERSONAS.camille;
  return pick(p.lines[key], mem.botLines) ?? pick(COMMON[key], mem.botLines);
}

function finish(bot: Bot, raw: string, v: GameView, mem: Memory, text: string) {
  const p = PERSONAS[bot.id] ?? PERSONAS.camille;
  let out = fill(raw, bot, v, mem, text);
  // De temps en temps, le bot glisse le prenom du joueur
  if (mem.userName && rnd() < 0.15 && !out.includes(mem.userName)) out = `${mem.userName}, ${out[0].toLowerCase()}${out.slice(1)}`;
  out = p.voice(out);
  mem.botLines = [...mem.botLines.slice(-8), raw];
  return out;
}

/** Reponse du bot a un message du joueur */
export function botReply(bot: Bot, text: string, v: GameView, mem: Memory): string {
  const p = PERSONAS[bot.id] ?? PERSONAS.camille;
  const n = norm(text);
  const now = Date.now();

  // Repetitions et rafales
  const prev = mem.userMsgs.filter((m) => m.n === n && n.length > 0).length;
  const burst = mem.userMsgs.filter((m) => now - m.t < 6000).length;
  mem.userMsgs = [...mem.userMsgs.slice(-12), { t: now, n }];
  const say = (k: Key) => {
    const l = lineFor(bot, k, mem);
    return l ? finish(bot, l, v, mem, text) : null;
  };
  if (prev >= 3) return say('repeat3') ?? '…';
  if (prev === 2) return say('repeat2') ?? '…';
  if (prev === 1 && rnd() < 0.85) return say('repeat1') ?? '…';
  // Rafale de messages : le bot le fait remarquer une fois, puis repond normalement
  if (burst >= 4 && now - (mem.spamAt ?? 0) > 30000) {
    mem.spamAt = now;
    return say('spam') ?? '…';
  }

  // Prenom du joueur
  const name = nameIn(text);
  if (name) {
    mem.userName = name;
    return say('nameAck') ?? `Enchanté ${name} !`;
  }

  // Message en majuscules : le bot reagit au ton
  const letters = text.replace(/[^A-Za-zÀ-ÿ]/g, '');
  if (letters.length >= 6 && letters === letters.toUpperCase() && rnd() < 0.7) {
    const s = say('shout');
    if (s) return s;
  }

  let intent = intentOf(text);
  // Un bot debutant ne comprend pas toujours les sujets compliques
  const hard: Intent[] = ['rules', 'opening', 'cheat', 'predict', 'level', 'help', 'takeback'];
  if (hard.includes(intent) && rnd() > p.smart + 0.3) intent = 'question';

  if (intent === 'insult') {
    mem.insults++;
    if (mem.insults >= 2) return say('insult2') ?? say('insult') ?? '…';
  }

  const intro = (base: string, rule = false) =>
    bot.id === 'titan'
      ? `${rule ? 'Règle' : 'Recommandation'} : ${base}`
      : bot.id === 'prof'
        ? `${rule ? 'Rappel' : 'Leçon'} : ${base}`
        : bot.id === 'reine'
          ? `${rule ? 'Retiens bien, sujet' : 'Écoute ta reine'} : ${base}`
          : base[0].toUpperCase() + base.slice(1);
  const lower = (t: string) => t[0].toLowerCase() + t.slice(1);

  // Conseil concret selon la phase, pour les bots qui s'y connaissent
  if (intent === 'help' && p.smart >= 0.6 && rnd() < 0.6) {
    const tip = pick(TIPS[phaseOf(v)], mem.botLines)!;
    return finish(bot, intro(lower(tip)), v, mem, text);
  }

  // Question de regles : reponse juste si le bot a le niveau (et s'il reconnait le sujet)
  if (intent === 'rules' || (intent === 'question' && /(comment|bouge|deplace|regle|c est quoi)/.test(n))) {
    const fact = RULE_FACTS.find(([re]) => re.test(n));
    if (fact && p.smart >= 0.5) return finish(bot, intro(fact[1], true), v, mem, text);
    if (fact && bot.id === 'pip') return finish(bot, 'Euh… ' + fact[1].split(':')[0] + ' ? Je crois que ça existe mais je sais plus comment ça marche !', v, mem, text);
  }

  // Niveau, chances : les bots forts annoncent l'etat de la partie
  if ((intent === 'level' || intent === 'predict') && p.smart >= 0.75 && v.moves.length > 6 && rnd() < 0.5) {
    const d = v.botDiff;
    const state =
      d >= 3 ? `J’ai ${d} points de matériel d’avance.` : d <= -3 ? `Tu as ${-d} points de matériel d’avance. Pour l’instant.` : 'Le matériel est équilibré.';
    return finish(bot, `${state} ${lineFor(bot, 'predict', mem) ?? ''}`.trim(), v, mem, text);
  }

  // Calcul : les bons bots repondent juste, Pip compte sur ses doigts
  if (intent === 'math') {
    const m = /(\d+(?:[.,]\d+)?)\s*([+*x×/÷-]|plus|moins|fois|divise par)\s*(\d+(?:[.,]\d+)?)/.exec(n);
    if (m) {
      const a = Number(m[1].replace(',', '.'));
      const b = Number(m[3].replace(',', '.'));
      const op = m[2];
      const r = /[+]|plus/.test(op) ? a + b : /-|moins/.test(op) ? a - b : /[*x×]|fois/.test(op) ? a * b : b === 0 ? NaN : a / b;
      const fmt = (x: number) => (Number.isInteger(x) ? String(x) : x.toFixed(bot.id === 'titan' ? 6 : 2).replace('.', ','));
      if (!Number.isFinite(r)) return finish(bot, bot.id === 'titan' ? 'Division par zéro. Erreur fatale évitée de justesse.' : 'Diviser par zéro ? Même mon roi ne fait pas ça.', v, mem, text);
      if (bot.id === 'pip') return finish(bot, rnd() < 0.5 ? `Euh… ${fmt(r + 1)} ? Non attends… ${fmt(r)} ! J’ai compté sur mes doigts.` : `${fmt(r)} ! Facile !`, v, mem, text);
      if (bot.id === 'titan') return finish(bot, `${fmt(r)}. Calculé en 0,000001 seconde.`, v, mem, text);
      if (bot.id === 'reine') return finish(bot, `${fmt(r)}. Une reine sait compter ses sujets.`, v, mem, text);
      if (bot.id === 'hugo') return finish(bot, `${fmt(r)}. bon, on joue ?`, v, mem, text);
      return finish(bot, `${fmt(r)}. ${pick(['On revient à la partie ?', 'Mais je préfère compter les pièces.', 'Facile.'])}`, v, mem, text);
    }
  }

  // "Pourquoi tu as joue ca ?" : le bot explique son dernier coup
  if (intent === 'whyMove') {
    const lastBot = [...v.moves].reverse().find((m) => m.color === v.botColor);
    if (!lastBot) return finish(bot, 'Je n’ai encore rien joué !', v, mem, text);
    if (p.smart < 0.45) return finish(bot, pick(['Euh… parce que c’était joli ?', 'Je sais pas, ma main a bougé toute seule !'])!, v, mem, text);
    const NAME: Record<string, string> = { N: 'cavalier', B: 'fou', R: 'tour', Q: 'dame', K: 'roi' };
    const TAKEN: Record<string, string> = { p: 'pion', n: 'cavalier', b: 'fou', r: 'tour', q: 'dame' };
    const san = lastBot.san;
    const piece = NAME[san[0]] ?? 'pion';
    const sq = (san.match(/[a-h][1-8]/g) ?? []).pop() ?? '';
    let why: string;
    if (san.startsWith('O-O')) why = 'Pour mettre mon roi à l’abri et connecter mes tours.';
    else if (san.includes('#')) why = 'Pour te mater. Ça me semblait une bonne idée.';
    else if (san.includes('=')) why = 'Pour promouvoir mon pion. Une nouvelle dame, ça ne se refuse pas.';
    else if (lastBot.captured) why = `J’ai pris ton ${TAKEN[lastBot.captured] ?? 'pion'} en ${sq}${v.botDiff >= 3 ? ' : il n’était pas assez protégé.' : '. Simple échange.'}`;
    else if (san.includes('+')) why = 'Pour mettre ton roi en échec et garder l’initiative.';
    else if (phaseOf(v) === 'opening' && (piece === 'cavalier' || piece === 'fou')) why = `Je développe mon ${piece} vers ${sq}, vers le centre.`;
    else if (piece === 'pion' && /^[de][45]$/.test(sq)) why = 'Pour prendre le centre.';
    else if (piece === 'roi' && phaseOf(v) === 'endgame') why = 'En finale, le roi doit être actif.';
    else why = `Mon ${piece} sera mieux placé en ${sq}. ${pick(['Je prépare la suite.', 'Tu verras bien.', 'Il y a une idée derrière…'])}`;
    const intro = bot.id === 'titan' ? 'Explication : ' : bot.id === 'prof' ? 'Excellente question. ' : bot.id === 'reine' ? 'Une reine n’a pas à se justifier. Mais soit : ' : '';
    return finish(bot, intro + (intro.trim().endsWith(':') ? why[0].toLowerCase() + why.slice(1) : why), v, mem, text);
  }

  // Abandon demande : seulement si le bot est vraiment perdu (et pas trop fier)
  if (intent === 'resign' && v.botDiff <= -6 && bot.rating >= 1000 && bot.id !== 'reine' && !v.result)
    return finish(bot, pick(['Hmm… c’est vrai que c’est mal parti. Mais je joue encore un peu.', 'J’y pense. Laisse-moi encore quelques coups.'])!, v, mem, text);

  // "Tu as gaffe !" : le bot reconnait s'il a vraiment perdu du materiel, sinon il conteste
  if (intent === 'botBlunderRemark' && v.botDiff > -2)
    return finish(bot, pick(['Quelle gaffe ? Tout est sous contrôle.', 'Regarde mieux : le matériel est équilibré.', 'Une gaffe ? Où ça ?'])!, v, mem, text);

  // "Echec !" annonce par le joueur : vrai ou pas ?
  if (intent === 'announceCheck') {
    const last = v.moves[v.moves.length - 1];
    if (!last || last.color === v.botColor || !last.san.includes('+'))
      return finish(bot, pick(['Euh… il n’y a pas échec, là.', 'Échec ? Regarde bien mon roi, il va très bien.', 'Pas d’échec en vue !'])!, v, mem, text);
  }

  // Revanche pendant la partie : finissons d'abord
  if (intent === 'rematch' && !v.result) return finish(bot, pick(['Finissons d’abord celle-ci !', 'Une revanche ? On n’a même pas fini !'])!, v, mem, text);

  // Demande de nulle : depend de la situation
  if (intent === 'draw') {
    const m = moodOf(v);
    if (m === 'ahead') return finish(bot, pick(['Une nulle ? Alors que je mène ? Non merci.', 'Pas question, je suis en train de gagner.'])!, v, mem, text);
    if (m === 'behind') return finish(bot, 'Propose-la avec le bouton « Nulle », je regarderai la position…', v, mem, text);
  }

  let key: Key = intent;
  if (intent === 'question' || intent === 'chat') {
    // Pas de sujet reconnu : on improvise avec la partie, une question en retour, ou une reponse au message
    const r = rnd();
    if (!v.result && r < 0.3) key = moodOf(v);
    else if (r < 0.45) key = 'askBack';
    else key = intent === 'question' ? 'unknownQ' : 'unknown';
  }
  const main = lineFor(bot, key, mem) ?? lineFor(bot, intent, mem) ?? lineFor(bot, 'chat', mem) ?? '…';
  let reply = main;
  // Parfois une remarque sur la partie en plus (les bots bavards surtout)
  if (!v.result && key !== moodOf(v) && rnd() < p.chatty * 0.25) {
    const extra = lineFor(bot, moodOf(v), mem);
    if (extra && extra !== main) reply = `${main} ${extra}`;
  }
  return finish(bot, reply, v, mem, text);
}

/** Phrase liee a la situation (en avance, partie nulle...) */
export function moodLine(bot: Bot, mood: Mood): string | null {
  const l = (PERSONAS[bot.id] ?? PERSONAS.camille).lines[mood];
  return pick(l) ?? null;
}

/**
 * Le bot regarde le dernier coup et parle parfois tout seul :
 * dame prise, gaffe, echec, roque, debut de partie, passage en finale...
 */
export function botSpontaneous(bot: Bot, v: GameView, mem: Memory): string | null {
  const p = PERSONAS[bot.id] ?? PERSONAS.camille;
  const ply = v.moves.length;
  const last = v.moves[ply - 1];
  if (!last || v.result) return null;
  const byBot = last.color === v.botColor;
  const events: [Event, number][] = [];
  if (last.captured === 'q') events.push([byBot ? 'tookQueen' : 'lostQueen', 1]);
  else if (last.captured && VAL[last.captured] >= 3) {
    // Prise sans reprise (le materiel penche nettement) : gaffe
    if (byBot && v.botDiff >= 3) events.push(['userBlunder', 0.8]);
    if (!byBot && v.botDiff <= -3) events.push(['botBlunder', 0.7]);
  }
  if (last.san.includes('=')) events.push([byBot ? 'promote' : 'userPromote', 0.9]);
  if (last.san.includes('+') && !last.san.includes('#')) events.push([byBot ? 'giveCheck' : 'gotCheck', 0.35]);
  if (!byBot && last.san.startsWith('O-O') && !mem.flags.castle) {
    mem.flags.castle = true;
    events.push(['userCastle', 0.6]);
  }
  if (ply <= 2 && !byBot && !mem.flags.open) {
    mem.flags.open = true;
    events.push([last.san === 'e4' ? 'openE4' : last.san === 'd4' ? 'openD4' : /^(a|h)[34]$|^N[ah]/.test(last.san) ? 'openOdd' : 'openE4', last.san === 'e4' || last.san === 'd4' ? 0.5 : 0.8]);
  }
  if (phaseOf(v) === 'endgame' && !mem.flags.endgame) {
    mem.flags.endgame = true;
    events.push(['endgame', 0.7]);
  }
  if (ply >= 80 && !mem.flags.long) {
    mem.flags.long = true;
    events.push(['longGame', 0.8]);
  }
  // Ce que le bot ressent (crispation apres une erreur, confiance, stress du temps), apres son coup
  if (byBot) {
    const mind = currentMind();
    if (mind.tilt > 0.55 && !mem.flags.nervous) {
      mem.flags.nervous = true;
      events.push(['nervous', 0.7]);
    } else if (mind.tilt < 0.2) mem.flags.nervous = false;
    if (mind.confidence > 0.6 && !mem.flags.confident) {
      mem.flags.confident = true;
      events.push(['confident', 0.6]);
    }
    if (mind.panic >= 0.6 && !mem.flags.panic) {
      mem.flags.panic = true;
      events.push(['panic', 0.8]);
    }
    if (v.botDiff <= -5 && last.san.includes('+') && !mem.flags.swindle) {
      mem.flags.swindle = true;
      events.push(['swindle', 0.6]);
    }
  }
  for (const [e, weight] of events) {
    const important = e === 'tookQueen' || e === 'lostQueen' || e === 'promote' || e === 'userPromote';
    if (!important && ply - mem.spokeAt < 4) continue;
    if (rnd() > weight * (important ? 1 : 0.4 + p.chatty)) continue;
    const l = lineFor(bot, e, mem);
    if (!l) continue;
    mem.spokeAt = ply;
    return finish(bot, l, v, mem, '');
  }
  return null;
}

/* ---------------- Frappe realiste ---------------- */

/** Vitesse de frappe (caracteres par seconde) et habitudes de chaque bot */
const TYPING: Record<string, { cps: number; hesitate: number; split: boolean }> = {
  pip: { cps: 4, hesitate: 0.5, split: true }, // tape avec deux doigts, s'arrete souvent
  lea: { cps: 7, hesitate: 0.25, split: true },
  hugo: { cps: 10, hesitate: 0.1, split: true }, // rapide, en plusieurs petits messages
  camille: { cps: 7, hesitate: 0.15, split: false },
  malik: { cps: 8, hesitate: 0.2, split: true },
  sofia: { cps: 9, hesitate: 0.1, split: false },
  theo: { cps: 4.5, hesitate: 0.3, split: false }, // lent et pose
  ines: { cps: 11, hesitate: 0.15, split: true },
  prof: { cps: 6, hesitate: 0.2, split: false },
  reine: { cps: 6, hesitate: 0.15, split: false },
  titan: { cps: 80, hesitate: 0, split: false }, // instantane
};

/** Une etape de la discussion : pause (lecture, hesitation) ou message tape */
export type TypingStep = { pause: number } | { typing: number; text: string };

const jitter = (a: number, b: number) => a + rnd() * (b - a);

/**
 * Prepare la reponse comme un humain : il lit ton message (plus il est long, plus c'est long),
 * reflechit, tape a sa vitesse (un message long prend du temps, un court part vite),
 * hesite parfois au milieu, et coupe les longues reponses en plusieurs messages.
 */
export function typingPlan(bot: Bot, reply: string, userText = ''): TypingStep[] {
  const t = TYPING[bot.id] ?? TYPING.camille;
  const steps: TypingStep[] = [];
  // Lecture du message recu
  const read = bot.id === 'titan' ? 150 : Math.min(3000, 250 + userText.length * (1000 / (t.cps * 3)));
  steps.push({ pause: read + jitter(150, 600) });
  // Decoupage en plusieurs bulles (phrases), pour les bots qui ecrivent comme ca
  let parts = [reply];
  if (t.split && reply.length > 70) {
    const sentences = reply.match(/[^.!?…]+[.!?…]+[\s)]*|[^.!?…]+$/g)?.map((x) => x.trim()).filter(Boolean) ?? [reply];
    if (sentences.length >= 2) {
      const half = Math.ceil(sentences.length / 2);
      parts = [sentences.slice(0, half).join(' '), sentences.slice(half).join(' ')];
    }
  }
  parts.forEach((part, i) => {
    // Un humain qui tape lentement fait des messages courts : on plafonne a ~6-8 s par bulle
    const total = Math.min(t.cps < 6 ? 6000 : 8000, (part.length / t.cps) * 1000 * jitter(0.85, 1.2));
    // Hesitation au milieu d'un long message : le "... ecrit" s'arrete puis reprend
    if (part.length > 40 && rnd() < t.hesitate) {
      const first = total * jitter(0.3, 0.6);
      steps.push({ typing: first, text: '' });
      steps.push({ pause: jitter(500, 1400) });
      steps.push({ typing: total - first, text: part });
    } else steps.push({ typing: Math.max(bot.id === 'titan' ? 120 : 450, total), text: part });
    if (i < parts.length - 1) steps.push({ pause: jitter(200, 700) });
  });
  return steps;
}

/** Delai simple (ancienne API) : total du plan de frappe */
export function typingDelay(reply: string, bot?: Bot) {
  if (!bot) return 600 + Math.min(2200, reply.length * 28);
  return typingPlan(bot, reply).reduce((s, st) => s + ('pause' in st ? st.pause : st.typing), 0);
}
