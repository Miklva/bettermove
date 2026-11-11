// Chat de partie : contre un inconnu en ligne, ou contre un bot qui repond avec son caractere
import { sounds } from '../lib/sounds';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Emote, emoteById, emoteToken, myEmotes, renderChatText, soloEmote } from '../emotes/emotes';
import { owns, useShop } from '../shop/store';
import { navigate } from '../router';
import { track, trackMax } from '../achievements/events';

import { t } from '../i18n';
export interface SendResult {
  error?: string | null;
  notice?: string | null;
}

export interface ChatLine {
  id: string | number;
  mine: boolean;
  name: string;
  text: string;
  censored?: boolean;
}

const QUICK = ['Bonne partie !', 'Bien joué', 'Oups…', 'Merci !', 'GG'];

interface Props {
  title: string;
  lines: ChatLine[];
  /** Renvoie une erreur (message non envoye) ou un avertissement (message envoye) */
  onSend: (text: string) => Promise<SendResult | void> | SendResult | void;
  /** Avatar de l'interlocuteur */
  avatar?: ReactNode;
  typing?: string | null;
  disabled?: string | null;
  maxLength?: number;
}

export function GameChat({ title, lines, onSend, avatar, typing, disabled, maxLength = 200 }: Props) {
  const [text, setText] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState(true);
  const [seen, setSeen] = useState(0);
  const [picker, setPicker] = useState(false);
  useShop(); // la liste des emojis suit les achats
  const emotes = myEmotes();
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setSeen(lines.length);
      box.current?.scrollTo({ top: box.current.scrollHeight, behavior: 'smooth' });
    }
  }, [lines.length, typing, open]);

  // Son a chaque message recu (pas au chargement de l'historique)
  const heard = useRef<string | number | null | undefined>(undefined);
  const lastLine = lines[lines.length - 1];
  useEffect(() => {
    const id = lastLine?.id ?? null;
    if (heard.current !== undefined && id !== heard.current && lastLine && !lastLine.mine) {
      sounds.message(false);
      // Pastille "non lus" du bouton Discussion (telephone)
      window.dispatchEvent(new Event('bm-chat-line'));
    }
    heard.current = id;
  }, [lastLine]);

  const send = async (t: string) => {
    // Emojis d'un pack non possede : retires
    const v = t.replace(/:e:([a-z0-9-]+):/g, (m, id: string) => (owns(emoteById(id)?.pack ?? '') ? m : '')).trim();
    if (!v || disabled) return;
    setErr(null);
    const r = await onSend(v.slice(0, maxLength));
    if (r?.error) {
      setErr(r.error);
      return;
    }
    setText('');
    sounds.message(true);
    track('chat-msg');
    track('emote', (v.match(/:e:[a-z0-9-]+:/g) ?? []).length);
    trackMax('chat-long', v.length);
    if (r?.notice) setErr(r.notice);
  };

  const unread = open ? 0 : lines.slice(seen).filter((l) => !l.mine).length;

  return (
    <div className="card game-chat">
      <button className="game-chat-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="tc-label">💬 {title}</span>
        {unread > 0 && <span className="badge">{unread}</span>}
        <span className="muted tiny">{open ? t("Masquer") : t("Afficher")}</span>
      </button>
      {open && (
        <>
          <div className="game-chat-lines" ref={box}>
            {lines.length === 0 && !typing && <p className="muted tiny">{t("Dis bonjour à ton adversaire !")}</p>}
            {lines.map((l) => (
              <div key={l.id} className={`gc-line ${l.mine ? 'mine' : ''}`}>
                {!l.mine && avatar && <span className="gc-avatar">{avatar}</span>}
                <span className={`gc-bubble ${soloEmote(l.text) ? 'solo' : ''}`}>
                  {!l.mine && <b>{l.name}</b>}
                  {renderChatText(l.text)}
                  {l.censored && (
                    <span className="muted tiny" title={t("Des mots interdits ont été masqués")}>
                      {' '}
                      🛡️
                    </span>
                  )}
                </span>
              </div>
            ))}
            {typing && (
              <div className="gc-line">
                {avatar && <span className="gc-avatar">{avatar}</span>}
                <span className="gc-bubble typing">
                  <i />
                  <i />
                  <i />
                  <span className="muted tiny">{typing}</span>
                </span>
              </div>
            )}
          </div>
          {disabled ? (
            <p className="muted tiny">{disabled}</p>
          ) : (
            <>
              {picker && (
                <div className="gc-emotes">
                  {emotes.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      className="gc-emote"
                      title={e.label}
                      onClick={() => {
                        setPicker(false);
                        void send(emoteToken(e.id));
                      }}
                    >
                      <Emote def={e} size={30} />
                    </button>
                  ))}
                  <button type="button" className="gc-emote more" title={t("Plus d’emojis")} onClick={() => navigate('/boutique/emojis')}>
                    ＋
                  </button>
                </div>
              )}
              <div className="gc-quick">
                {QUICK.map((q) => t(q)).map((q) => (
                  <button key={q} className="chip small" onClick={() => void send(q)}>
                    {q}
                  </button>
                ))}
              </div>
              <form
                className="gc-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  void send(text);
                }}
              >
                <button
                  type="button"
                  className={`btn gc-emote-btn ${picker ? 'selected' : ''}`}
                  onClick={() => setPicker(!picker)}
                  aria-label={t("Emojis")}
                  title={t("Emojis")}
                >
                  😀
                </button>
                <input
                  className="text-input"
                  value={text}
                  maxLength={maxLength}
                  placeholder={t("Écris un message…")}
                  onChange={(e) => setText(e.target.value)}
                />
                <button className="btn primary" disabled={!text.trim()}>{t("Envoyer")}</button>
              </form>
            </>
          )}
          {err && <p className="error tiny">{err}</p>}
        </>
      )}
    </div>
  );
}
