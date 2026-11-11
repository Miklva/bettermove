// Chat contre un bot : il repond avec son caractere et reagit aux grands moments de la partie
import { useEffect, useRef, useState } from 'react';
import { t } from '../i18n';
import { GameChat, type ChatLine } from '../components/GameChat';
import { BotPortrait } from './portraits';
import { botReply, botSpontaneous, moodLine, newMemory, typingPlan, type GameView } from './chat';
import type { Bot } from './roster';
import type { Color } from '../game/types';
import { mark, track } from '../achievements/events';

interface Props {
  bot: Bot;
  botColor: Color;
  gameId: string;
  moves: { color: Color; captured?: string; san: string }[];
  result: { winner: Color | null } | null;
  /** Avantage materiel du bot (positif = le bot mene) */
  botDiff: number;
}

// Le cerveau de discussion parle francais, et anglais pour toutes les autres langues (voir chatEn.ts).

export function BotChat({ bot, botColor, gameId, moves, result, botDiff }: Props) {
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [typing, setTyping] = useState(false);
  const timers = useRef<number[]>([]);
  const lastBot = useRef<string | undefined>(undefined);
  const seenMoves = useRef(0);
  const ended = useRef(false);
  const n = useRef(0);
  // Memoire de la discussion (prenom, repetitions, insultes...) : remise a zero a chaque partie
  const mem = useRef(newMemory());
  const view: GameView = { moves, botColor, botDiff, result };
  const viewRef = useRef(view);
  viewRef.current = view;

  const add = (mine: boolean, text: string) => {
    n.current++;
    setLines((l) => [...l.slice(-60), { id: `${gameId}-${n.current}`, mine, name: mine ? t('Toi') : bot.name, text }]);
    if (!mine) lastBot.current = text;
  };

  /** Le bot lit, reflechit, tape (indicateur "ecrit..."), hesite, et peut envoyer plusieurs bulles */
  // Fin prevue du dernier message en cours : les reponses suivantes attendent leur tour (pas de message coupe)
  const busyUntil = useRef(0);
  const say = (text: string, userText = '', firstDelay?: number) => {
    const steps = typingPlan(bot, text, userText);
    if (firstDelay !== undefined && 'pause' in steps[0]) steps[0] = { pause: firstDelay };
    let at = Math.max(0, busyUntil.current - Date.now());
    for (const st of steps) {
      if ('pause' in st) {
        at += st.pause;
        timers.current.push(window.setTimeout(() => setTyping(false), at));
      } else {
        timers.current.push(window.setTimeout(() => setTyping(true), at));
        at += st.typing;
        if (st.text) {
          const part = st.text;
          timers.current.push(
            window.setTimeout(() => {
              setTyping(false);
              add(false, part);
            }, at),
          );
        }
      }
    }
    busyUntil.current = Date.now() + at;
  };

  // Nouvelle partie : le bot dit bonjour
  useEffect(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    busyUntil.current = 0;
    setTyping(false);
    setLines([]);
    seenMoves.current = moves.length;
    ended.current = !!result;
    mem.current = newMemory();
    if (!result) say(bot.hello, '', 500);
    return () => timers.current.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  // Reactions spontanees : dame prise, fin de partie
  useEffect(() => {
    if (moves.length <= seenMoves.current) {
      seenMoves.current = moves.length;
      return;
    }
    seenMoves.current = moves.length;
    const line = botSpontaneous(bot, viewRef.current, mem.current);
    if (line) say(line);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moves.length]);

  useEffect(() => {
    if (!result || ended.current) return;
    ended.current = true;
    const line =
      result.winner === botColor ? bot.onWin : result.winner === null ? moodLine(bot, 'drawn') ?? t('Partie nulle, bien joué.') : bot.onLose;
    say(line, '', 900);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  return (
    <GameChat
      title={t('Discussion avec {name}', { name: bot.name })}
      lines={lines}
      avatar={<BotPortrait id={bot.id} size={26} />}
      typing={typing ? t('{name} écrit…', { name: bot.name }) : null}
      onSend={(text) => {
        add(true, text);
        track('bot-chat');
        mark(`bot-chat-${bot.id}`);
        if (/merci|gg|bien jou|bravo|thank|well played|good game|\bwp\b/i.test(text)) track('bot-polite');
        // Le bot finit d'ecrire son message en cours, puis repond (chaque message a sa reponse, dans l'ordre)
        say(botReply(bot, text, viewRef.current, mem.current), text);
      }}
    />
  );
}
