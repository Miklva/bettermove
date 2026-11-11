// Discussion sous un probleme : questions des joueurs qui ne comprennent pas la solution, reponses de la communaute.
import { useEffect, useState } from 'react';
import { Modal } from '../components/Modal';
import { useSync } from '../sync/AccountModal';
import { isAdmin } from '../sync/client';
import { t } from '../i18n';
import { openAccount, talk, type TalkQuestion } from './talk';
import type { Puzzle } from './db';

const MAX = 600;

function when(at: string) {
  const d = new Date(at);
  const min = Math.round((Date.now() - d.getTime()) / 60000);
  if (min < 1) return t('à l’instant');
  if (min < 60) return t('il y a {n} min', { n: min });
  if (min < 60 * 24) return t('il y a {n} h', { n: Math.round(min / 60) });
  return d.toLocaleDateString();
}

/** Bouton "Je ne comprends pas" + nombre de messages ; ouvre la discussion */
export function PuzzleTalkButton({ puzzle, className = '' }: { puzzle: Puzzle; className?: string }) {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    let stop = false;
    setCount(null);
    talk
      .count(puzzle.id)
      .then((r) => !stop && setCount(r.count))
      .catch(() => undefined);
    return () => {
      stop = true;
    };
  }, [puzzle.id, open]);
  return (
    <>
      <button className={`btn ghost talk-btn ${className}`} onClick={() => setOpen(true)}>
        💬 {count ? t('Discussion ({n})', { n: count }) : t('Je ne comprends pas')}
      </button>
      {open && <PuzzleTalk puzzle={puzzle} onClose={() => setOpen(false)} />}
    </>
  );
}

export function PuzzleTalk({ puzzle, onClose }: { puzzle: Puzzle; onClose: () => void }) {
  const sync = useSync();
  const me = sync.user;
  const [questions, setQuestions] = useState<TalkQuestion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [busy, setBusy] = useState(false);

  const reload = () =>
    talk
      .thread(puzzle.id)
      .then((r) => setQuestions(r.questions))
      .catch(() => setError(t('Discussion indisponible pour le moment.')));
  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puzzle.id]);

  const send = async (text: string, parent: number | null) => {
    if (!me) return openAccount();
    setBusy(true);
    setError(null);
    try {
      await talk.send(puzzle.id, text.trim(), parent, puzzle.ref);
      if (parent === null) setDraft('');
      else {
        setReplyDraft('');
        setReplyTo(null);
      }
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Envoi impossible'));
    } finally {
      setBusy(false);
    }
  };
  const remove = async (id: number) => {
    try {
      await talk.remove(id);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Suppression impossible'));
    }
  };
  const canDelete = (user: string) => !!me && (user === me || isAdmin());

  return (
    <Modal title={t('Discussion sur le problème')} onClose={onClose}>
      <div className="talk">
        <p className="muted small">
          {t('Tu ne comprends pas la solution ? Pose ta question : n’importe quel joueur peut te répondre, et tu recevras sa réponse en notification.')}
        </p>

        {questions === null && !error && <p className="muted">{t('Chargement…')}</p>}
        {questions && questions.length === 0 && <p className="muted">{t('Pas encore de question sur ce problème.')}</p>}
        {questions && questions.length > 0 && (
          <ul className="talk-list">
            {questions.map((q) => (
              <li key={q.id} className="talk-q">
                <div className="talk-msg">
                  <div className="talk-meta">
                    <b>{q.user}</b> <span className="muted small">{when(q.at)}</span>
                    {canDelete(q.user) && !q.deleted && (
                      <button className="link-like small talk-del" onClick={() => remove(q.id)}>{t('Supprimer')}</button>
                    )}
                  </div>
                  <p className={q.deleted ? 'muted' : ''}>{q.deleted ? t('Message supprimé') : q.text}</p>
                </div>
                {q.replies.length > 0 && (
                  <ul className="talk-replies">
                    {q.replies.map((r) => (
                      <li key={r.id} className="talk-msg reply">
                        <div className="talk-meta">
                          <b>{r.user}</b> <span className="muted small">{when(r.at)}</span>
                          {canDelete(r.user) && !r.deleted && (
                            <button className="link-like small talk-del" onClick={() => remove(r.id)}>{t('Supprimer')}</button>
                          )}
                        </div>
                        <p className={r.deleted ? 'muted' : ''}>{r.deleted ? t('Message supprimé') : r.text}</p>
                      </li>
                    ))}
                  </ul>
                )}
                {replyTo === q.id ? (
                  <form
                    className="talk-form reply"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (replyDraft.trim().length >= 3) void send(replyDraft, q.id);
                    }}
                  >
                    <textarea
                      autoFocus
                      value={replyDraft}
                      maxLength={MAX}
                      rows={3}
                      placeholder={t('Explique ce que tu as compris…')}
                      onChange={(e) => setReplyDraft(e.target.value)}
                    />
                    <div className="talk-actions">
                      <button type="button" className="btn ghost" onClick={() => setReplyTo(null)}>{t('Annuler')}</button>
                      <button className="btn primary" disabled={busy || replyDraft.trim().length < 3}>{t('Répondre')}</button>
                    </div>
                  </form>
                ) : (
                  !q.deleted && (
                    <button className="link-like small talk-reply-btn" onClick={() => (me ? setReplyTo(q.id) : openAccount())}>
                      ↩ {t('Répondre')}
                    </button>
                  )
                )}
              </li>
            ))}
          </ul>
        )}

        {error && <p className="error small">{error}</p>}

        {me ? (
          <form
            className="talk-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (draft.trim().length >= 3) void send(draft, null);
            }}
          >
            <label className="small" htmlFor="talk-q">{t('Ta question')}</label>
            <textarea
              id="talk-q"
              value={draft}
              maxLength={MAX}
              rows={3}
              placeholder={t('Ex. : pourquoi le fou en f7 et pas la dame ?')}
              onChange={(e) => setDraft(e.target.value)}
            />
            <div className="talk-actions">
              <span className="muted small">{draft.length}/{MAX}</span>
              <button className="btn primary" disabled={busy || draft.trim().length < 3}>{t('Poser ma question')}</button>
            </div>
          </form>
        ) : (
          <div className="talk-login">
            <p className="muted small">{t('Connecte-toi pour poser une question ou répondre.')}</p>
            <button className="btn primary" onClick={openAccount}>{t('Se connecter')}</button>
          </div>
        )}
      </div>
    </Modal>
  );
}
