// Chat d'une partie en ligne "Contre le monde" (les amis ont deja les messages prives)
import { useEffect, useRef, useState } from 'react';
import { apiCall, HttpError } from '../sync/client';
import { GameChat, type ChatLine } from '../components/GameChat';
import { Avatar } from '../profile/avatar';

interface Msg {
  id: number;
  user: string;
  mine: boolean;
  text: string;
  censored: boolean;
}

export function OnlineChat({ gameId, opponent }: { gameId: number; opponent: string }) {
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [off, setOff] = useState<string | null>(null);
  const lastId = useRef(0);

  useEffect(() => {
    lastId.current = 0;
    setLines([]);
    let alive = true;
    const tick = async () => {
      try {
        const r = await apiCall<{ messages: Msg[] }>(`/online/${gameId}/chat?after=${lastId.current}`);
        if (!alive || !r.messages.length) return;
        lastId.current = r.messages[r.messages.length - 1].id;
        setLines((l) => [...l, ...r.messages.map((m) => ({ id: m.id, mine: m.mine, name: m.user, text: m.text, censored: m.censored }))].slice(-100));
      } catch (e) {
        if (e instanceof HttpError && e.status === 403) setOff(e.message);
      }
    };
    void tick();
    const id = window.setInterval(tick, 2000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [gameId]);

  return (
    <GameChat
      title={`Discussion avec ${opponent}`}
      lines={lines}
      avatar={<Avatar name={opponent} size={24} />}
      disabled={off}
      onSend={async (text) => {
        try {
          const r = await apiCall<{ message: Msg; warning: string | null }>(`/online/${gameId}/chat`, {
            method: 'POST',
            body: JSON.stringify({ text }),
          });
          if (r.message.id > lastId.current) {
            lastId.current = r.message.id;
            setLines((l) => [...l, { id: r.message.id, mine: true, name: r.message.user, text: r.message.text, censored: r.message.censored }]);
          }
          return { notice: r.warning };
        } catch (e) {
          return { error: e instanceof Error ? e.message : 'Envoi impossible' };
        }
      }}
    />
  );
}
