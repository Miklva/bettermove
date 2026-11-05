// Tableau de bord administrateur : statistiques du site (reserve aux pseudos de ADMIN_USERS)
import { useCallback, useEffect, useState } from 'react';
import { apiCall, HttpError } from '../sync/client';
import { Avatar } from '../profile/avatar';

interface Stats {
  users: number;
  new30: number;
  new7: number;
  avatars: number;
  active30: number;
  active1: number;
  games: number;
  games30: number;
  online: string[];
  queue: { total: number; byTc: Record<string, number> };
  signups: { day: string; n: number }[];
  gamesByDay: { day: string; n: number; players: number }[];
  onlineGames30: number;
  onlineLive: number;
  elo: { online: number | null; onlinePlayers: number; bestOnline: number | null; bots: number | null; puzzles: number | null; xp: number | null; profiles: number; bestBots: number | null; bestPuzzles: number | null };
  eloBuckets: { bucket: number; n: number }[];
  recent: { username: string; createdAt: string; lastSeen: string | null }[];
  rush: { runs: number; players: number; best: number | null };
  daily: { n: number; players: number; firstTry: number };
  chat: { n: number; authors: number };
  support: number;
  sources: { source: string; n: number }[];
}

const SOURCE_LABEL: Record<string, string> = {
  bot: 'Contre les bots',
  local: '1v1 sur écran',
  online: 'En ligne',
  'chess.com': 'Import chess.com',
  lichess: 'Import Lichess',
  pgn: 'Import PGN',
  autre: 'Autre',
};

const n0 = (v: number | null | undefined) => (v === null || v === undefined ? '–' : Math.round(v).toLocaleString('fr-FR'));
const shortDay = (d: string) => {
  const [, m, j] = d.split('-');
  return `${Number(j)}/${Number(m)}`;
};
const ago = (iso: string | null) => {
  if (!iso) return 'jamais';
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (m < 3) return 'en ligne';
  if (m < 60) return `il y a ${m} min`;
  const h = Math.round(m / 60);
  if (h < 48) return `il y a ${h} h`;
  return `il y a ${Math.round(h / 24)} j`;
};

/** Histogramme en barres verticales, une barre par jour */
function DayBars({ data, label, unit }: { data: { day: string; n: number }[]; label: string; unit: string }) {
  const max = Math.max(1, ...data.map((d) => d.n));
  const total = data.reduce((s, d) => s + d.n, 0);
  return (
    <div className="card admin-chart">
      <div className="admin-chart-head">
        <div className="tc-label">{label}</div>
        <b>
          {total.toLocaleString('fr-FR')} <span className="muted small">{unit} sur 30 jours</span>
        </b>
      </div>
      <div className="day-bars" role="img" aria-label={`${label} : ${total} ${unit} sur 30 jours`}>
        {data.map((d) => (
          <div key={d.day} className="day-bar" title={`${shortDay(d.day)} : ${d.n} ${unit}`}>
            <i style={{ height: `${(d.n / max) * 100}%` }} className={d.n ? '' : 'zero'} />
          </div>
        ))}
      </div>
      <div className="day-axis muted tiny">
        <span>{data[0] && shortDay(data[0].day)}</span>
        <span>{data[14] && shortDay(data[14].day)}</span>
        <span>aujourd’hui</span>
      </div>
    </div>
  );
}

function HBars({ rows, label }: { rows: { label: string; n: number }[]; label: string }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <div className="card">
      <div className="tc-label">{label}</div>
      {rows.length === 0 && <p className="muted small">Pas encore de données.</p>}
      <div className="hbars">
        {rows.map((r) => (
          <div key={r.label} className="hbar">
            <span className="hbar-label">{r.label}</span>
            <span className="hbar-track">
              <i style={{ width: `${(r.n / max) * 100}%` }} />
            </span>
            <b>{r.n.toLocaleString('fr-FR')}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

interface SupportMsg {
  id: number;
  name: string | null;
  email: string | null;
  category: string | null;
  subject: string;
  message: string;
  context: Record<string, unknown> | null;
  handled: boolean;
  account: string | null;
  createdAt: string;
  replies: { message: string; mailed: boolean; createdAt: string }[];
}

/** Demandes envoyees via la page Support : lues ici, marquees comme traitees ou supprimees */
function SupportInbox() {
  const [list, setList] = useState<SupportMsg[] | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [mailOn, setMailOn] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const reload = useCallback(() => {
    apiCall<{ messages: SupportMsg[]; mail: boolean }>('/admin/support')
      .then((r) => {
        setList(r.messages);
        setMailOn(r.mail);
      })
      .catch(() => setList([]));
  }, []);
  const send = async (id: number) => {
    setSending(true);
    setNote(null);
    try {
      await apiCall(`/admin/support/${id}/reply`, { method: 'POST', body: JSON.stringify({ message: draft }) });
      setDraft('');
      setNote({ ok: true, text: 'Réponse envoyée au joueur ✔' });
      reload();
    } catch (e) {
      setNote({ ok: false, text: e instanceof Error ? e.message : 'Envoi impossible' });
    } finally {
      setSending(false);
    }
  };
  useEffect(reload, [reload]);
  const act = async (id: number, kind: 'done' | 'undo' | 'delete') => {
    if (kind === 'delete' && !window.confirm('Supprimer définitivement cette demande ?')) return;
    await apiCall(`/admin/support/${id}`, kind === 'delete' ? { method: 'DELETE' } : { method: 'PUT', body: JSON.stringify({ handled: kind === 'done' }) });
    reload();
  };
  if (!list) return null;
  const todo = list.filter((m) => !m.handled).length;
  return (
    <section className="card admin-support">
      <h2>
        ✉️ Demandes au support <span className="muted small">{todo} à traiter · {list.length} au total</span>
      </h2>
      {!list.length && <p className="muted small">Aucune demande pour l’instant.</p>}
      <ul className="admin-support-list">
        {list.map((m) => (
          <li key={m.id} className={m.handled ? 'handled' : ''}>
            <button
              className="admin-support-head link-like"
              onClick={() => {
                setOpen(open === m.id ? null : m.id);
                setDraft('');
                setNote(null);
              }}
            >
              <b>#{m.id}</b> <span className="chip small">{m.category ?? 'Autre'}</span> {m.subject}
              {m.replies.length > 0 && <span className="chip small">↩ {m.replies.length}</span>}
              <span className="muted small"> · {m.account ?? m.name ?? 'Anonyme'} · {new Date(m.createdAt).toLocaleString('fr-FR')}</span>
            </button>
            {open === m.id && (
              <div className="admin-support-body">
                <p className="pre">{m.message}</p>
                <p className="muted small">{m.email ? <>E-mail du joueur : {m.email}</> : 'Pas d’e-mail laissé : réponse par mail impossible.'}</p>
                {m.replies.map((r, i) => (
                  <div key={i} className="admin-support-reply">
                    <span className="muted small">↩ Réponse du {new Date(r.createdAt).toLocaleString('fr-FR')}</span>
                    <p className="pre">{r.message}</p>
                  </div>
                ))}
                {m.email && (
                  <form
                    className="admin-support-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void send(m.id);
                    }}
                  >
                    <textarea
                      className="text-input"
                      rows={5}
                      maxLength={5000}
                      placeholder={`Ta réponse à ${m.account ?? m.name ?? 'ce joueur'} (envoyée par mail, signée « L’équipe BetterMove »)`}
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                    />
                    {!mailOn && <p className="error small">Envoi de mails non configuré sur le serveur (SMTP dans .env).</p>}
                    {note && <p className={note.ok ? 'success-text small' : 'error small'}>{note.text}</p>}
                    <button className="btn primary small" type="submit" disabled={sending || !mailOn || draft.trim().length < 2}>
                      {sending ? 'Envoi…' : '✉️ Envoyer la réponse'}
                    </button>
                  </form>
                )}
                {m.context && Object.keys(m.context).length > 0 && <pre className="admin-support-ctx">{JSON.stringify(m.context, null, 2)}</pre>}
                <div className="row">
                  <button className="btn small" onClick={() => act(m.id, m.handled ? 'undo' : 'done')}>
                    {m.handled ? '↩ Remettre à traiter' : '✔ Marquer comme traitée'}
                  </button>
                  <button className="btn small danger" onClick={() => act(m.id, 'delete')}>
                    🗑 Supprimer
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function AdminPage({ onOpen }: { onOpen: (name: string) => void }) {
  const [s, setS] = useState<Stats | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [at, setAt] = useState<Date | null>(null);

  const load = useCallback(() => {
    apiCall<Stats>('/admin/stats')
      .then((x) => {
        setS(x);
        setErr(null);
        setAt(new Date());
      })
      .catch((e) =>
        setErr(
          e instanceof HttpError && e.status === 403
            ? 'Réservé aux administrateurs.'
            : e instanceof HttpError && e.status === 404
              ? 'Page indisponible pour le moment.'
              : 'Serveur injoignable.',
        ),
      );
  }, []);

  useEffect(() => {
    load();
    const id = window.setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

  if (err && !s)
    return (
      <div className="admin">
        <div className="card">
          <h1>🛠️ Administration</h1>
          <p className="error">{err}</p>
        </div>
      </div>
    );
  if (!s)
    return (
      <div className="admin">
        <p className="muted center">Chargement des statistiques…</p>
      </div>
    );

  const kpis: { label: string; value: string; sub?: string; tone?: string }[] = [
    { label: 'En ligne maintenant', value: n0(s.online.length), sub: s.queue.total ? `${s.queue.total} cherche(nt) un adversaire` : 'actifs ces 3 dernières minutes', tone: 'live' },
    { label: 'Comptes au total', value: n0(s.users), sub: `${n0(s.avatars)} avec photo` },
    { label: 'Nouveaux comptes', value: n0(s.new30), sub: `30 jours · ${n0(s.new7)} sur 7 jours` },
    { label: 'Joueurs actifs', value: n0(s.active30), sub: `30 jours · ${n0(s.active1)} sur 24 h` },
    { label: 'Parties enregistrées', value: n0(s.games30), sub: `30 jours · ${n0(s.games)} au total` },
    { label: 'Elo en ligne moyen', value: n0(s.elo.online), sub: `${n0(s.elo.onlinePlayers)} joueurs classés · meilleur : ${n0(s.elo.bestOnline)}` },
    { label: 'Elo bots moyen', value: n0(s.elo.bots), sub: `meilleur : ${n0(s.elo.bestBots)}` },
    { label: 'Elo problèmes moyen', value: n0(s.elo.puzzles), sub: `meilleur : ${n0(s.elo.bestPuzzles)}` },
    { label: 'XP moyenne', value: n0(s.elo.xp), sub: `${n0(s.elo.profiles)} profils synchronisés` },
  ];

  return (
    <div className="admin">
      <div className="admin-head">
        <h1>🛠️ Administration</h1>
        <span className="muted small">
          {at && `Mis à jour à ${at.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} · actualisation toutes les 30 s`}
          <button className="btn ghost small-btn" onClick={load}>
            🔄
          </button>
        </span>
      </div>
      {err && <p className="error small">{err}</p>}

      <section className="admin-kpis">
        {kpis.map((k) => (
          <div key={k.label} className={`card admin-kpi ${k.tone ?? ''}`}>
            <span className="tc-label">{k.label}</span>
            <b>{k.value}</b>
            {k.sub && <span className="muted tiny">{k.sub}</span>}
          </div>
        ))}
      </section>

      <section className="admin-grid">
        <DayBars data={s.signups} label="Créations de comptes par jour" unit="comptes" />
        <DayBars data={s.gamesByDay} label="Parties jouées par jour (bots, écran, en ligne)" unit="parties" />
      </section>

      <section className="admin-grid three">
        <div className="card">
          <div className="tc-label">🟢 En ligne ({s.online.length})</div>
          {s.online.length === 0 && <p className="muted small">Personne en ce moment.</p>}
          <div className="admin-online">
            {s.online.map((u) => (
              <span key={u} className="admin-user">
                <Avatar name={u} size={22} /> {u}
              </span>
            ))}
          </div>
          {s.queue.total > 0 && (
            <p className="muted small">
              File « Contre le monde » :{' '}
              {Object.entries(s.queue.byTc)
                .map(([tc, n]) => `${tc} (${n})`)
                .join(', ')}
            </p>
          )}
        </div>
        <HBars
          label="Répartition de l’Elo bots"
          rows={s.eloBuckets.map((b) => ({ label: `${b.bucket}–${b.bucket + 199}`, n: b.n }))}
        />
        <HBars
          label="Origine des parties (30 jours)"
          rows={s.sources.map((x) => ({ label: SOURCE_LABEL[x.source] ?? x.source, n: x.n }))}
        />
      </section>

      <section className="admin-grid three">
        <div className="card admin-list">
          <div className="tc-label">Activité sur 30 jours</div>
          <ul>
            <li>
              <span>⚔️ Parties en ligne</span>
              <b>
                {n0(s.onlineGames30)}
                {s.onlineLive ? ` (${s.onlineLive} en cours)` : ''}
              </b>
            </li>
            <li>
              <span>⚡ Puzzle Rush</span>
              <b>
                {n0(s.rush.runs)} parties · {n0(s.rush.players)} joueurs · record {n0(s.rush.best)}
              </b>
            </li>
            <li>
              <span>🧩 Problème du jour</span>
              <b>
                {n0(s.daily.n)} essais · {n0(s.daily.players)} joueurs
                {s.daily.n ? ` · ${Math.round((s.daily.firstTry / s.daily.n) * 100)} % du 1er coup` : ''}
              </b>
            </li>
            <li>
              <span>💬 Messages du salon</span>
              <b>
                {n0(s.chat.n)} · {n0(s.chat.authors)} auteurs
              </b>
            </li>
            <li>
              <span>✉️ Demandes au support</span>
              <b>{n0(s.support)}</b>
            </li>
          </ul>
        </div>
        <div className="card admin-list span2">
          <div className="tc-label">Derniers inscrits</div>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Joueur</th>
                <th>Inscrit le</th>
                <th>Dernière visite</th>
              </tr>
            </thead>
            <tbody>
              {s.recent.map((r) => (
                <tr key={r.username}>
                  <td>
                    <button className="admin-user link-like" onClick={() => onOpen(r.username)}>
                      <Avatar name={r.username} size={22} /> {r.username}
                    </button>
                  </td>
                  <td>{new Date(r.createdAt).toLocaleDateString('fr-FR')}</td>
                  <td className={ago(r.lastSeen) === 'en ligne' ? 'live-text' : ''}>{ago(r.lastSeen)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <SupportInbox />
      <p className="muted tiny">
        Les Elo moyens et l’XP portent sur les comptes dont la progression est synchronisée. « Joueurs actifs » = visite, partie ou
        synchronisation dans la période.
      </p>
    </div>
  );
}
