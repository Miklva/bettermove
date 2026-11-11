// Appels de l'API sociale (amis, sourdines, messages prives, defis) et des parties en ligne.
import { apiCall } from '../sync/client';
import { track } from '../achievements/events';
import type { TalkReply } from '../puzzles/talk';

const post = (body?: unknown) => ({ method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });
const enc = encodeURIComponent;

export type FriendState = 'none' | 'sent' | 'received' | 'friends';

export interface UserInfo {
  username: string;
  friend: FriendState;
  muted: boolean;
  self: boolean;
}
export interface Friends {
  friends: { username: string; online: boolean; lastSeen: string | null }[];
  incoming: string[];
  outgoing: string[];
}
export interface Conversation {
  username: string;
  last: string;
  lastFromMe: boolean;
  at: string;
  unread: number;
  online: boolean;
}
export interface Dm {
  id: number;
  mine: boolean;
  text: string;
  censored: boolean;
  at: string;
}
export interface Challenge {
  id: number;
  from: string;
  to: string;
  initial: number | null;
  increment: number;
  color: 'w' | 'b' | 'random';
}
export interface Challenges {
  incoming: Challenge[];
  outgoing: Challenge[];
  games: { id: number; opponent: string; color: 'w' | 'b' }[];
}
export interface Notifications {
  unreadDm: number;
  friendRequests: number;
  challenges: { id: number; from: string }[];
  activeGames: number[];
  acceptedGames: number[];
  /** Revanches proposees par un adversaire, en attente de ma reponse */
  rematchOffers?: { gameId: number; from: string }[];
  /** Reponses a mes questions sous les problemes, pas encore vues */
  puzzleReplies?: TalkReply[];
  /** Admin : messages non lus sous les problemes */
  adminTalk?: number;
}
export interface OnlineGame {
  id: number;
  white: string;
  black: string;
  you: 'w' | 'b' | null;
  moves: string[];
  fen: string;
  timed: boolean;
  initial: number | null;
  increment: number;
  clocks: { w: number; b: number; turn: 'w' | 'b' } | null;
  status: 'active' | 'over';
  result: string | null;
  reason: string | null;
  drawOffer: 'w' | 'b' | null;
  serverNow: number;
  /** Partie classee (Elo en ligne) : Elo des joueurs au debut, puis variations a la fin */
  rated?: boolean;
  ratings?: { w: number; b: number } | null;
  deltas?: { w: number; b: number } | null;
  /** Elo en jeu pour chaque joueur (parties classees) */
  stakes?: Record<'w' | 'b', { win: number; draw: number; loss: number; provisional: boolean }> | null;
  /** Skins equipes de chaque joueur */
  skins?: Record<'w' | 'b', { pieces: string | null; board: string | null }>;
  /** Revanche : qui l'a proposee, refus eventuel, et la nouvelle partie une fois acceptee */
  rematch?: { w: boolean; b: boolean; declinedBy: 'w' | 'b' | null; gameId: number | null };
}

/** Compte l'action pour les succes, puis rend la reponse telle quelle */
const tap = (name: string) => <T,>(r: T): T => {
  track(name);
  return r;
};

export const social = {
  user: (name: string) => apiCall<UserInfo>(`/social/users/${enc(name)}`),
  friends: () => apiCall<Friends>('/social/friends'),
  addFriend: (username: string) => apiCall<{ status: FriendState }>('/social/friends', post({ username })).then(tap('friend-add')),
  acceptFriend: (name: string) => apiCall(`/social/friends/${enc(name)}/accept`, post()).then(tap('friend-accept')),
  removeFriend: (name: string) => apiCall(`/social/friends/${enc(name)}`, { method: 'DELETE' }),
  mutes: () => apiCall<{ muted: string[] }>('/social/mutes'),
  mute: (username: string) => apiCall('/social/mutes', post({ username })).then(tap('mute')),
  unmute: (name: string) => apiCall(`/social/mutes/${enc(name)}`, { method: 'DELETE' }),
  conversations: () => apiCall<{ conversations: Conversation[] }>('/social/dm'),
  dms: (name: string, after = 0) => apiCall<{ messages: Dm[] }>(`/social/dm/${enc(name)}?after=${after}`),
  sendDm: (name: string, text: string) => apiCall<{ message: Dm }>(`/social/dm/${enc(name)}`, post({ text })).then(tap('dm')),
  challenges: () => apiCall<Challenges>('/social/challenges'),
  challenge: (username: string, initial: number | null, increment: number, color: 'w' | 'b' | 'random') =>
    apiCall<{ id: number }>('/social/challenges', post({ username, initial, increment, color })).then(tap('challenge')),
  acceptChallenge: (id: number) => apiCall<{ gameId: number }>(`/social/challenges/${id}/accept`, post()).then(tap('challenge-accept')),
  dropChallenge: (id: number) => apiCall(`/social/challenges/${id}`, { method: 'DELETE' }),
  notifications: () => apiCall<Notifications>('/social/notifications'),
};

export const online = {
  get: (id: number) => apiCall<OnlineGame>(`/online/${id}`),
  /** Partie en cours du joueur (null si aucune) */
  current: () => apiCall<{ game: { id: number; opponent: string; rated: boolean } | null }>('/online/current'),
  move: (id: number, uci: string) => apiCall<OnlineGame>(`/online/${id}/move`, post({ uci })),
  resign: (id: number) => apiCall<OnlineGame>(`/online/${id}/resign`, post()).then(tap('online-resign')),
  draw: (id: number) => apiCall<OnlineGame>(`/online/${id}/draw`, post()).then(tap('draw-offer')),
  declineDraw: (id: number) => apiCall<OnlineGame>(`/online/${id}/decline-draw`, post()),
  rematch: (id: number) => apiCall<OnlineGame>(`/online/${id}/rematch`, post()).then(tap('rematch')),
  declineRematch: (id: number) => apiCall<OnlineGame>(`/online/${id}/rematch/decline`, post()).then(tap('rematch-decline')),
};
