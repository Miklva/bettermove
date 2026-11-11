// Discussions sous les problemes (API /api/puzzle-talk)
import { apiCall } from '../sync/client';

export interface TalkMessage {
  id: number;
  parent: number | null;
  user: string;
  /** null si supprime */
  text: string | null;
  deleted: boolean;
  at: string;
}
export interface TalkQuestion extends TalkMessage {
  replies: TalkMessage[];
}
/** Reponse a une de mes questions, pas encore vue (pop-up) */
export interface TalkReply {
  id: number;
  from: string;
  text: string;
  question: string;
  puzzleId: string;
  ref: string | null;
  at: string;
}

const post = (body: unknown) => ({ method: 'POST', body: JSON.stringify(body) });
const enc = encodeURIComponent;

export const talk = {
  count: (pid: string) => apiCall<{ count: number }>(`/puzzle-talk/count/${enc(pid)}`),
  thread: (pid: string) => apiCall<{ questions: TalkQuestion[] }>(`/puzzle-talk/${enc(pid)}`),
  send: (pid: string, text: string, parent: number | null, ref?: string) =>
    apiCall<{ message: TalkMessage }>(`/puzzle-talk/${enc(pid)}`, post({ text, parent, ref })),
  remove: (id: number) => apiCall(`/puzzle-talk/message/${id}`, { method: 'DELETE' }),
  read: (ids: number[]) => apiCall('/puzzle-talk/notices/read', post({ ids })),
};

/** Ouvre la fenetre de connexion (ecoutee par App) */
export const OPEN_ACCOUNT_EVENT = 'bm-open-account';
export const openAccount = () => window.dispatchEvent(new Event(OPEN_ACCOUNT_EVENT));
