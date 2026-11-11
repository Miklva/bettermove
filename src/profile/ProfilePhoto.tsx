// Bloc "Photo de profil" de la fenetre Compte
import { useRef, useState } from 'react';
import { useSync } from '../sync/AccountModal';
import { fileToAvatar, MyAvatar, setAvatar, useMyAvatar } from './avatar';

import { t } from '../i18n';
export function ProfilePhoto() {
  const s = useSync();
  const photo = useMyAvatar();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const logged = !!s.user && s.status !== 'offline';

  const apply = async (data: string | null) => {
    setBusy(true);
    setMsg(null);
    try {
      await setAvatar(data, logged);
      setMsg({ ok: true, text: data ? t('Photo enregistrée') : t('Retour aux initiales') });
    } catch (e) {
      setMsg({ ok: false, text: t('Enregistrée sur ce navigateur, mais pas sur le serveur : {err}', { err: e instanceof Error ? e.message : t('erreur') }) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="profile-photo">
      <button className="profile-photo-pic" onClick={() => input.current?.click()} title={t("Changer la photo")} disabled={busy}>
        <MyAvatar size={84} />
        <span className="profile-photo-edit">📷</span>
      </button>
      <div className="profile-photo-body">
        <div className="tc-label">{t("Photo de profil")}</div>
        <div className="row">
          <button className="btn" disabled={busy} onClick={() => input.current?.click()}>
            {photo ? t("Changer la photo") : t("Importer une photo")}
          </button>
          {photo && (
            <button className="btn ghost" disabled={busy} onClick={() => void apply(null)}>{t("Retirer")}</button>
          )}
        </div>
        <p className="muted small">
          {photo ? '' : t("Sans photo, tes initiales s’affichent. ")}
          {logged
            ? t("Les autres joueurs la voient dans la Communauté et en partie.")
            : t("Connecte-toi pour que les autres joueurs la voient.")}
        </p>
        {msg && <p className={msg.ok ? 'muted small' : 'error small'}>{msg.text}</p>}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          try {
            await apply(await fileToAvatar(f));
          } catch (err) {
            setMsg({ ok: false, text: err instanceof Error ? err.message : t('Image illisible') });
          }
        }}
      />
    </div>
  );
}
