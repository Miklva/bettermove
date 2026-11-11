// Photo de profil : initiales par defaut, ou photo importee (recadree en carre, compressee).
import { t } from '../i18n';
// Stockee dans le navigateur, et envoyee au serveur quand on est connecte (pour la Communaute).
import { useEffect, useState, useSyncExternalStore } from 'react';
import { apiCall } from '../sync/client';
import { useSync } from '../sync/AccountModal';

const KEY = 'bettermove.avatar.v1';
const listeners = new Set<() => void>();

function read(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

let current = read();

function emit() {
  current = read();
  listeners.forEach((f) => f());
}

export function getAvatar() {
  return current;
}

export function useMyAvatar() {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => current,
  );
}

function storeLocal(data: string | null) {
  try {
    if (data) localStorage.setItem(KEY, data);
    else localStorage.removeItem(KEY);
  } catch {
    /* quota plein : on garde au moins en memoire */
  }
  emit();
}

/** Change la photo (null = revenir aux initiales). Envoie au serveur si connecte. */
export async function setAvatar(data: string | null, logged: boolean) {
  storeLocal(data);
  bump();
  if (logged) await apiCall('/auth/avatar', { method: 'PUT', body: JSON.stringify({ image: data }) });
}

/** Recadre une image au centre et la reduit en JPEG 256 px */
export function fileToAvatar(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) return reject(new Error(t('Ce fichier n’est pas une image')));
    if (file.size > 15 * 1024 * 1024) return reject(new Error('Image trop lourde (15 Mo max)'));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.naturalWidth, img.naturalHeight);
      const sx = (img.naturalWidth - side) / 2;
      const sy = (img.naturalHeight - side) / 2;
      const c = document.createElement('canvas');
      c.width = c.height = 256;
      const ctx = c.getContext('2d');
      if (!ctx) return reject(new Error('Canvas indisponible'));
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, sx, sy, side, side, 0, 0, 256, 256);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.86));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Image illisible'));
    };
    img.src = url;
  });
}

/** Au moment de la connexion : la photo du serveur l'emporte, sinon on envoie la locale */
let reconciledFor: string | null = null;
export async function reconcileAvatar(user: string) {
  if (reconciledFor === user) return;
  reconciledFor = user;
  try {
    const r = await apiCall<{ image: string | null }>('/auth/avatar');
    if (r.image) {
      if (r.image !== current) storeLocal(r.image);
    } else if (current) {
      await apiCall('/auth/avatar', { method: 'PUT', body: JSON.stringify({ image: current }) });
      bump();
    }
  } catch {
    reconciledFor = null;
  }
}

// ---------------------------------------------------------------------------
// Affichage

export function hue(name: string) {
  let h = 0;
  for (const ch of name.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

export function initials(name: string) {
  const parts = name
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(/[\s._-]+/)
    .filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (parts[0]?.[0] ?? '?').toUpperCase();
}

// Photos des autres joueurs : on evite de redemander celles qui n'existent pas
const missing = new Set<string>();
let version = Date.now();
function bump() {
  version = Date.now();
  missing.clear();
}

export function Initials({ name, size }: { name: string; size: number }) {
  const h = hue(name);
  return (
    <span
      className="avatar initials"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        background: `linear-gradient(135deg, hsl(${h} 60% 52%), hsl(${(h + 40) % 360} 55% 38%))`,
      }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

/** Avatar d'un joueur quelconque : sa photo sur le serveur, sinon ses initiales */
export function Avatar({ name, size = 32, src }: { name: string; size?: number; src?: string | null }) {
  const key = name.toLowerCase();
  const [failed, setFailed] = useState(() => !src && missing.has(key));
  useEffect(() => setFailed(!src && missing.has(key)), [key, src]);
  const url = src ?? (name ? `/api/avatar/${encodeURIComponent(name)}?v=${version}` : null);
  if (!url || failed) return <Initials name={name || '?'} size={size} />;
  return (
    <img
      className="avatar"
      src={url}
      width={size}
      height={size}
      alt=""
      loading="lazy"
      onError={() => {
        if (!src) missing.add(key);
        setFailed(true);
      }}
    />
  );
}

/** Mon avatar : photo locale, sinon initiales du pseudo */
export function MyAvatar({ size = 32 }: { size?: number }) {
  const photo = useMyAvatar();
  const s = useSync();
  const name = s.user ?? 'Toi';
  if (photo) return <img className="avatar" src={photo} width={size} height={size} alt="" />;
  return <Initials name={name} size={size} />;
}
