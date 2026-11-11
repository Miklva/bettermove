import { useCallback, useEffect, useRef, useState } from 'react';
import { LocalGamePage } from './pages/LocalGamePage';
import { BotPage } from './pages/BotPage';
import { PuzzlePage } from './pages/PuzzlePage';
import { LessonsPage } from './pages/LessonsPage';
import { AchievementsPage } from './pages/AchievementsPage';
import { CoachPage } from './pages/CoachPage';
import { ShopPage } from './pages/ShopPage';
import { CommunityPage } from './pages/CommunityPage';
import { HomePage } from './pages/HomePage';
import { SupportPage } from './pages/SupportPage';
import { OnlineGamePage } from './pages/OnlineGamePage';
import { online, social, type Notifications } from './social/api';
import { useSync } from './sync/AccountModal';
import { COINS_EVENT, useShop } from './shop/store';
import { useAchievements } from './achievements/store';
import { TIER_XP, type Achievement } from './achievements/list';
import { sounds } from './lib/sounds';
import { levelFromXp } from './rating/xp';
import { ReviewPage } from './review/ReviewPage';
import type { ReviewRequest } from './review/ImportPanel';
import { usePlayerProfile, isPuzzleProvisional } from './rating/profile';
import { provisionalHelp } from './rating/elo';
import { load, save } from './lib/storage';
import { SettingsProvider, useSettings } from './settings/settings';
import { SettingsModal } from './settings/SettingsModal';
import { Modal } from './components/Modal';
import { AccountButton, AccountModal } from './sync/AccountModal';
import { ResetPasswordModal } from './sync/ResetPassword';
import { LevelModal, markWelcomeSeen, WelcomeModal, welcomeSeen, WelcomeNext } from './onboarding/Onboarding';
import { SpotlightTour, type TourStep } from './onboarding/SpotlightTour';
import { Credits } from './components/Credits';
import { RoadmapModal } from './components/Roadmap';
import { seoFor } from './seo/all';
import { ALL_LESSONS, CHAPTERS } from './lessons/courses';
import { GuidesPage } from './pages/GuidesPage';
import { getLevel, isFreshProfile, LEVELS, setLevel, type Level } from './onboarding/level';
import { openLessonNext } from './pages/LessonsPage';
import { Avatar, reconcileAvatar } from './profile/avatar';
import { isAdmin } from './sync/client';
import { OPEN_ACCOUNT_EVENT, talk, type TalkReply } from './puzzles/talk';
import { RushPage } from './pages/RushPage';
import { TipsPage } from './pages/TipsPage';
import { TeacherPage } from './pages/TeacherPage';
import { ProfilePage } from './pages/ProfilePage';
import { searchWorldNext, WorldPage } from './pages/WorldPage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import * as I from './components/NavIcons';
import { AdminPage } from './pages/AdminPage';
import { RepertoirePage } from './pages/RepertoirePage';
import { currentPath, hrefOf, navigate, pathOf, usePath, useSegments } from './router';
import { listGames } from './review/store';
import { LevelsPage } from './pages/LevelsPage';
import { LegalPage } from './pages/LegalPage';
import { EventsPage } from './pages/EventsPage';
import { earn, grant as grantItem } from './shop/store';
import { itemById } from './shop/items';
import { API_BASE, apiCall } from './sync/client';
import { XP_EVENT } from './economy/rewards';
import { claimableCount } from './economy/quests';
import { PERIOD_EVENT } from './achievements/events';
import { pendingLevels, useClaimed } from './rewards/levels';

import { lang, t, tServer } from './i18n';
type Mode = 'home' | 'levels' | 'teacher' | 'profile' | 'tips' | 'world' | 'leaderboard' | 'admin' | 'local' | 'bots' | 'puzzles' | 'rush' | 'repertoire' | 'lessons' | 'review' | 'coach' | 'achievements' | 'shop' | 'community' | 'support' | 'online' | 'legal' | 'events' | 'guides';

/** Navigation regroupee : chaque groupe ouvre sa derniere page, ses pages sont listees juste en dessous */
interface NavItem {
  id: Mode;
  label: string;
  icon: I.IconType;
  /** Raccourci vers une autre page (ex. defier un ami -> Communaute) */
  goto?: Mode;
}
interface NavGroup {
  id: string;
  label: string;
  icon: I.IconType;
  items: NavItem[];
}

const NAV: NavGroup[] = [
  {
    id: 'play',
    label: 'Jouer',
    icon: I.Pawn,
    items: [
      { id: 'bots', label: 'Contre un bot', icon: I.Bot },
      { id: 'world', label: 'Contre le monde', icon: I.Globe },
      { id: 'local', label: '1v1 sur cet écran', icon: I.Users },
      { id: 'online', label: 'Contre un ami', icon: I.Swords, goto: 'community' },
    ],
  },
  {
    id: 'learn',
    label: 'Apprendre',
    icon: I.GraduationCap,
    items: [
      { id: 'lessons', label: 'Cours', icon: I.BookOpen },
      { id: 'teacher', label: 'Contre le professeur', icon: I.Presentation },
      { id: 'puzzles', label: 'Problèmes', icon: I.Puzzle },
      { id: 'rush', label: 'Puzzle Rush', icon: I.Zap },
      { id: 'repertoire', label: 'Répertoire', icon: I.Library },
    ],
  },
  {
    id: 'progress',
    label: 'Progresser',
    icon: I.TrendingUp,
    items: [
      { id: 'review', label: 'Historique', icon: I.History },
      { id: 'coach', label: 'Suivi personnalisé', icon: I.Target },
      { id: 'tips', label: 'Astuces', icon: I.Lightbulb },
      { id: 'achievements', label: 'Succès', icon: I.Trophy },
      { id: 'levels', label: 'Niveaux', icon: I.Gift },
    ],
  },
  {
    id: 'community',
    label: 'Communauté',
    icon: I.MessageCircle,
    items: [
      { id: 'community', label: 'Salon', icon: I.MessageCircle },
      { id: 'events', label: 'Événements', icon: I.CalendarDays },
      { id: 'leaderboard', label: 'Classement', icon: I.Medal },
    ],
  },
  { id: 'shop', label: 'Boutique', icon: I.ShoppingBag, items: [{ id: 'shop', label: 'Boutique', icon: I.ShoppingBag }] },
];

/** Adresse de chaque page (les sous-onglets et elements ajoutent des segments apres) */
const ROUTES: Record<Mode, string[]> = {
  home: [],
  bots: ['jouer', 'bot'],
  world: ['jouer', 'monde'],
  local: ['jouer', 'local'],
  online: ['partie'],
  lessons: ['apprendre', 'cours'],
  teacher: ['apprendre', 'professeur'],
  puzzles: ['apprendre', 'problemes'],
  rush: ['apprendre', 'rush'],
  repertoire: ['apprendre', 'repertoire'],
  review: ['progresser', 'historique'],
  coach: ['progresser', 'suivi'],
  tips: ['progresser', 'astuces'],
  achievements: ['progresser', 'succes'],
  levels: ['progresser', 'niveaux'],
  community: ['communaute', 'salon'],
  leaderboard: ['communaute', 'classement'],
  events: ['communaute', 'evenements'],
  shop: ['boutique'],
  profile: ['profil'],
  admin: ['admin'],
  support: ['aide'],
  legal: ['infos'],
  guides: ['guides'],
};
/** Adresses courtes ou alternatives */
const ALIASES: [string[], Mode][] = [
  [['jouer'], 'bots'],
  [['apprendre'], 'lessons'],
  [['progresser'], 'review'],
  [['communaute'], 'community'],
  [['communaute', 'messages'], 'community'],
];
const TITLES: Partial<Record<Mode, string>> = { home: 'Accueil', online: 'Partie en ligne', profile: 'Profil', admin: 'Administration', support: 'Aide', legal: 'Informations légales', guides: 'Guides' };

/** Page correspondant a l'URL (prefixe le plus long), null si inconnue */
function modeOf(segs: string[]): Mode | null {
  if (!segs.length) return 'home';
  let best: Mode | null = null;
  let len = 0;
  const all: [string[], Mode][] = [...(Object.entries(ROUTES) as [Mode, string[]][]).map(([m, r]) => [r, m] as [string[], Mode]), ...ALIASES];
  for (const [r, m] of all)
    if (r.length > len && r.every((x, i) => segs[i] === x)) {
      best = m;
      len = r.length;
    }
  return best;
}

const groupOf = (m: Mode) => NAV.find((g) => g.items.some((i) => i.id === m))?.id ?? null;

export default function App() {
  return (
    <SettingsProvider>
      <Shell />
    </SettingsProvider>
  );
}

function Shell() {
  // La page affichee vient de l'URL : chaque page, onglet, partie et profil a son lien
  const segs = useSegments();
  const routed = modeOf(segs);
  const mode: Mode = routed ?? 'home';
  useEffect(() => {
    // Lien de parrainage /invite/<code> : on verifie le code (et qui invite), puis accueil
    if (segs[0] === 'invite') {
      const code = decodeURIComponent(segs[1] ?? '').toUpperCase().slice(0, 12);
      if (/^[A-Z0-9]{6,12}$/.test(code))
        apiCall<{ username: string; active: boolean }>(`/events/invite/${code}`)
          .then((r) => {
            if (!r.active) return;
            localStorage.setItem('bettermove.ref', JSON.stringify({ code, name: r.username, at: new Date().toISOString() }));
            window.dispatchEvent(new Event('bettermove-ref'));
          })
          .catch(() => undefined);
      navigate('/', true);
      return;
    }
    // Liens recus par mail : confirmation d'adresse et nouveau mot de passe (le jeton est retire de l'adresse)
    if (segs[0] === 'compte' && (segs[1] === 'confirmer' || segs[1] === 'reinitialiser')) {
      const token = segs[2] ?? '';
      if (segs[1] === 'reinitialiser') setResetToken(token);
      else
        apiCall('/auth/verify-email', { method: 'POST', body: JSON.stringify({ token }) })
          .then(() => setToast(t("✅ Adresse e-mail confirmée : tu pourras récupérer ton compte en cas d’oubli.")))
          .catch((e) => setToast(e instanceof Error ? `Confirmation impossible : ${e.message}` : 'Confirmation impossible'));
      navigate('/', true);
      return;
    }
    // Adresse inconnue : accueil ; adresse courte (/jouer, /communaute...) : adresse complete
    if (!routed) navigate('/', true);
    else if (segs.length < ROUTES[routed].length) navigate(pathOf(ROUTES[routed]), true);
  }, [routed, segs.length]);
  const setMode = (m: Mode) => {
    if (m === 'online') {
      if (onlineGame !== null) navigate(pathOf(['partie', onlineGame]));
      return;
    }
    if (m !== mode) window.scrollTo(0, 0);
    navigate(pathOf(ROUTES[m]));
  };
  const [helpOpen, setHelpOpen] = useState(false);
  const [creditsOpen, setCreditsOpen] = useState(false);
  const [roadmapOpen, setRoadmapOpen] = useState(false);
  // Ferme le menu d'aide au clic en dehors
  useEffect(() => {
    if (!helpOpen) return;
    const close = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.help-wrap')) setHelpOpen(false);
    };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [helpOpen]);
  const player = usePlayerProfile();
  const { settings, update } = useSettings();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountMode, setAccountMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [resetToken, setResetToken] = useState<string | null>(null);
  // Invitation de parrainage en attente (visite de /invite/<pseudo>, pas encore de compte)
  const readRef = () => {
    try {
      return (JSON.parse(localStorage.getItem('bettermove.ref') ?? 'null') as { name: string } | null)?.name ?? null;
    } catch {
      return null;
    }
  };
  const [inviter, setInviter] = useState<string | null>(() => (sessionStorage.getItem('bettermove.refHidden') ? null : readRef()));
  // Fenetre d'invitation : montree une fois par session, avant l'accueil des nouveaux arrivants
  const [invitePopupSeen, setInvitePopupSeen] = useState(() => sessionStorage.getItem('bettermove.invitePopup') === '1');
  const [accountFromInvite, setAccountFromInvite] = useState(false);
  useEffect(() => {
    const on = () => {
      setAccountMode('login');
      setAccountOpen(true);
    };
    window.addEventListener(OPEN_ACCOUNT_EVENT, on);
    return () => window.removeEventListener(OPEN_ACCOUNT_EVENT, on);
  }, []);
  const closeInvitePopup = (signup: boolean) => {
    sessionStorage.setItem('bettermove.invitePopup', '1');
    setInvitePopupSeen(true);
    if (signup) {
      setAccountFromInvite(true);
      setAccountMode('register');
      setAccountOpen(true);
    }
  };
  useEffect(() => {
    const on = () => setInviter(sessionStorage.getItem('bettermove.refHidden') ? null : readRef());
    // Le lien /invite a pu etre lu juste avant (effet precedent) : on relit une fois
    on();
    window.addEventListener('bettermove-ref', on);
    return () => window.removeEventListener('bettermove-ref', on);
  }, []);
  // Partie en ligne ouverte (defi entre amis)
  const [onlineGame, setOnlineGame] = useState<number | null>(null);
  // Page profil (/profil = le mien, /profil/<pseudo> = un autre joueur)
  // /profil/stat/<stat>/<periode> = detail d'une de mes stats, /profil/<pseudo>/stat/... pour un autre joueur
  const profileName = mode === 'profile' && segs[1] && segs[1] !== 'stat' ? segs[1] : null;
  const openProfile = (name: string | null) => {
    navigate(pathOf(name ? ['profil', name] : ['profil']));
    window.scrollTo(0, 0);
  };
  // Partie en ligne : /partie/<id>
  const routeGame = mode === 'online' && segs[1] && /^\d+$/.test(segs[1]) ? Number(segs[1]) : null;
  useEffect(() => {
    if (routeGame !== null) setOnlineGame(routeGame);
  }, [routeGame]);
  const playOnline = (id: number) => {
    setOnlineGame(id);
    navigate(pathOf(['partie', id]));
  };
  // /partie sans numero : la partie en cours, sinon la Communaute
  useEffect(() => {
    if (mode === 'online' && routeGame === null)
      navigate(pathOf(onlineGame !== null ? ['partie', onlineGame] : ROUTES.community), true);
  }, [mode, routeGame, onlineGame]);
  // Titre de l'onglet, description et adresse canonique (referencement) selon la page affichee
  useEffect(() => {
    const path = currentPath().replace(/\/+$/, '') || '/';
    // Page de referencement la plus proche (/jouer/bot/hugo -> /jouer/bot) ; l'accueil seulement pour /
    const near = seoFor(path, lang());
    const page = near.key !== '/' || path === '/' ? near : null;
    const rawLabel = TITLES[mode] ?? NAV.flatMap((g) => g.items).find((i) => i.id === mode)?.label;
    const label = rawLabel ? t(rawLabel) : undefined;
    document.title = page ? page.title : label ? `${label} · BetterMove` : 'BetterMove';
    const desc = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (desc) desc.content = (page ?? seoFor('/', lang())).description;
    const canon = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (canon) canon.href = `${window.location.origin}${(page ?? seoFor('/', lang())).path}`;
  }, [mode, segs.join('/')]);
  // Notifications sociales : badge de l'onglet Communaute, defis recus, defis acceptes
  const sync = useSync();
  // Partie en ligne en cours (page rechargee, autre appareil) : on la retrouve
  useEffect(() => {
    if (!sync.user || sync.status !== 'synced') return;
    online
      .current()
      .then((r) => {
        if (r.game) setOnlineGame(r.game.id);
      })
      .catch(() => undefined);
  }, [sync.user, sync.status]);
  // Photo de profil : alignement navigateur / serveur a la connexion
  useEffect(() => {
    if (sync.user && sync.status === 'synced') void reconcileAvatar(sync.user);
  }, [sync.user, sync.status]);
  const [notif, setNotif] = useState<Notifications | null>(null);
  const [challengePop, setChallengePop] = useState<{ id: number; from: string } | null>(null);
  // Revanche proposee par un adversaire alors qu'on n'est plus sur la partie : pop-up accepter / refuser
  const [rematchPop, setRematchPop] = useState<{ gameId: number; from: string } | null>(null);
  // Reponse a une question posee sous un probleme
  const [talkPop, setTalkPop] = useState<TalkReply | null>(null);
  const talkShown = useRef(new Set<number>());
  const closeTalkPop = (open: boolean) => {
    const cur = talkPop;
    setTalkPop(null);
    if (!cur) return;
    void talk.read([cur.id]).catch(() => undefined);
    if (open && cur.ref) navigate(`/apprendre/problemes/${cur.ref}`);
  };
  const routeGameRef = useRef<number | null>(null);
  routeGameRef.current = routeGame;
  const seenNotif = useRef<{ challenges: Set<number>; games: Set<number>; rematch: Set<number>; init: boolean }>({
    challenges: new Set(),
    games: new Set(),
    rematch: new Set(),
    init: false,
  });
  useEffect(() => {
    if (!sync.user || sync.status === 'offline' || sync.status === 'checking') return;
    let stop = false;
    const tick = async () => {
      try {
        const n = await social.notifications();
        if (stop) return;
        setNotif(n);
        // Reponse a ma question sous un probleme (aussi celles recues pendant l'absence)
        const reply = (n.puzzleReplies ?? []).find((r) => !talkShown.current.has(r.id));
        if (reply) {
          talkShown.current.add(reply.id);
          setTalkPop((cur) => cur ?? reply);
          sounds.success();
        }
        const seen = seenNotif.current;
        // Premier passage : on memorise l'existant sans notifier
        if (!seen.init) {
          n.challenges.forEach((c) => seen.challenges.add(c.id));
          n.acceptedGames.forEach((g) => seen.games.add(g));
          seen.init = true;
          return;
        }
        // Proposition de revanche (sur la page de la partie, c'est la page elle-meme qui affiche la pop-up)
        const offers = n.rematchOffers ?? [];
        const offer = offers.find((o) => !seen.rematch.has(o.gameId) && routeGameRef.current !== o.gameId);
        if (offer) {
          seen.rematch.add(offer.gameId);
          setRematchPop(offer);
          sounds.success();
        }
        setRematchPop((cur) => (cur && !offers.some((o) => o.gameId === cur.gameId) ? null : cur));
        const fresh = n.challenges.find((c) => !seen.challenges.has(c.id));
        if (fresh) {
          seen.challenges.add(fresh.id);
          setChallengePop(fresh);
          sounds.start();
        }
        // Un defi que j'ai envoye vient d'etre accepte : on rejoint la partie
        const accepted = n.acceptedGames.find((g) => !seen.games.has(g) && n.activeGames.includes(g));
        if (accepted) {
          seen.games.add(accepted);
          playOnline(accepted);
        }
      } catch {
        /* serveur sans la partie sociale : on ignore */
      }
    };
    tick();
    const id = window.setInterval(tick, 4000);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sync.user, sync.status]);
  const socialBadge = notif ? notif.unreadDm + notif.friendRequests + notif.challenges.length : 0;
  const shop = useShop();
  // Pieces gagnees : on regroupe les gains rapproches en une seule notification
  const [coinPop, setCoinPop] = useState<{ amount: number; reason: string; id: number } | null>(null);
  useEffect(() => {
    let pending: { amount: number; reason: string } | null = null;
    let timer: number | null = null;
    const on = (e: Event) => {
      const d = (e as CustomEvent<{ amount: number; reason: string }>).detail;
      pending = { amount: (pending?.amount ?? 0) + d.amount, reason: d.reason };
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        setCoinPop({ ...pending!, id: Date.now() });
        pending = null;
      }, 500);
    };
    window.addEventListener(COINS_EVENT, on);
    return () => window.removeEventListener(COINS_EVENT, on);
  }, []);
  useEffect(() => {
    if (!coinPop) return;
    const id = window.setTimeout(() => setCoinPop(null), 2600);
    return () => window.clearTimeout(id);
  }, [coinPop]);


  // Accueil : choix du niveau a la premiere visite, visite guidee, changement de niveau
  const [onboard, setOnboard] = useState<null | 'welcome' | 'about' | 'level' | 'change' | { next: Level }>(() => {
    const fresh = !getLevel() && isFreshProfile(player.profile);
    // Nouvel arrivant : un mot de bienvenue, puis le choix du niveau
    if (fresh && !welcomeSeen()) return 'welcome';
    return fresh ? 'level' : null;
  });
  const closeWelcome = () => {
    markWelcomeSeen();
    setOnboard(onboard === 'welcome' && !getLevel() ? 'level' : null);
  };
  const chooseLevel = (l: Level, change: boolean) => {
    const info = LEVELS.find((x) => x.id === l)!;
    setLevel(l);
    player.setStartRatings(info.bots, info.puzzles);
    setOnboard(change ? null : { next: l });
    if (change) setToast(t('Niveau mis à jour : {title}', { title: info.title }));
  };
  const [lessonsKey, setLessonsKey] = useState(0);
  // Lien direct vers une lecon (/apprendre/cours/fourchette) : elle s'ouvre, l'adresse reste celle de la lecon
  const lessonRoute = mode === 'lessons' ? segs[2] : undefined;
  useEffect(() => {
    if (lessonRoute && ALL_LESSONS.some((l) => l.id === lessonRoute)) {
      openLessonNext(lessonRoute);
      setLessonsKey((k) => k + 1);
    }
  }, [lessonRoute]);
  // Visite guidee sur les vraies pages (etape en cours, null = pas de visite)
  const [tour, setTour] = useState<number | null>(null);
  const novice = ['none', 'beginner'].includes(getLevel()?.level ?? 'none');
  const firstChapter = CHAPTERS.find((c) => c.id === (novice ? 'initiation' : 'tactics')) ?? CHAPTERS[0];
  const firstLesson = firstChapter.lessons[0];
  const sub = (id: Mode, extra: string[] = []) => [`[data-tour=sub-${id}]`, ...extra];
  const tourSteps: TourStep<Mode>[] = [
    {
      mode: 'home',
      targets: ['[data-tour=home-next]'],
      title: t("🏠 Ton accueil"),
      text: t("Chaque jour, l’essentiel est ici : ta prochaine étape, le problème du jour et tes quêtes. Le logo BetterMove te ramène toujours ici."),
    },
    {
      mode: 'bots',
      targets: ['[data-tour=nav-play]', '[data-tour=subnav]'],
      title: t("♟️ Jouer"),
      text: t("Tout ce qui se joue sur un échiquier. Chaque espace a ses sous-onglets juste en dessous."),
      chips: [
        {
          label: t("🤖 Contre un bot"),
          step: {
            mode: 'bots',
            targets: sub('bots', ['.bot-grid']),
            title: t("🤖 Contre un bot"),
            text: t("De 400 à 2700 Elo, chacun avec son caractère : ils jouent et discutent comme des humains. Bats-les pour débloquer les suivants."),
          },
        },
        {
          label: t("🌍 Contre le monde"),
          step: {
            mode: 'world',
            targets: sub('world'),
            title: t("🌍 Contre le monde"),
            text: t("Une partie classée contre un vrai joueur BetterMove de ton niveau, tiré au hasard. Il faut un compte (gratuit)."),
          },
        },
        {
          label: t("👥 1v1 sur cet écran"),
          step: {
            mode: 'world',
            targets: sub('local'),
            title: t("👥 1v1 sur cet écran"),
            text: t("Deux joueurs, un seul appareil : choisis la cadence, le plateau peut se retourner à chaque coup."),
          },
        },
        {
          label: t("⚔️ Contre un ami"),
          step: {
            mode: 'world',
            targets: sub('online'),
            title: t("⚔️ Contre un ami"),
            text: t("Défie un ami depuis la Communauté. Revanche en un clic, et chat avec émojis pendant la partie."),
          },
        },
      ],
    },
    {
      mode: 'lessons',
      targets: ['[data-tour=nav-learn]', '[data-tour=subnav]'],
      title: t("🎓 Apprendre"),
      text: t("Pour acquérir de nouvelles connaissances, à ton niveau."),
      chips: [
        {
          label: t("📚 Cours"),
          step: {
            mode: 'lessons',
            targets: sub('lessons'),
            title: t("📚 Cours"),
            text: t("Initiation, tactiques, mats, finales et ouvertures, leçon par leçon. 3 étoiles partout débloquent l’approfondissement."),
          },
        },
        {
          label: t("👨\u200d🏫 Contre le professeur"),
          step: {
            mode: 'lessons',
            targets: sub('teacher'),
            title: t("👨\u200d🏫 Contre le professeur"),
            text: t("Une vraie partie où chaque coup est commenté : tu comprends pourquoi un coup est bon ou mauvais."),
          },
        },
        {
          label: t("🧩 Problèmes"),
          step: {
            mode: 'puzzles',
            targets: sub('puzzles'),
            title: t("🧩 Problèmes"),
            text: t("Des milliers de positions à ton niveau, par thème. En cas d’erreur, l’app t’explique ce qui n’allait pas."),
          },
        },
        {
          label: t("⚡ Puzzle Rush"),
          step: {
            mode: 'rush',
            targets: sub('rush'),
            title: t("⚡ Puzzle Rush"),
            text: t("Un maximum de problèmes contre la montre : 3 erreurs et c’est fini. Bats ton record !"),
          },
        },
        {
          label: t("📖 Répertoire"),
          step: {
            mode: 'repertoire',
            targets: sub('repertoire'),
            title: t("📖 Répertoire"),
            text: t("Choisis tes ouvertures et révise-les coup par coup : l’app joue l’adversaire jusqu’à ce que tu les connaisses par cœur."),
          },
        },
      ],
    },
    {
      mode: 'review',
      targets: ['[data-tour=nav-progress]', '[data-tour=subnav]'],
      title: t("📈 Progresser"),
      text: t("Pour mesurer tes progrès et apprendre de tes propres parties."),
      chips: [
        {
          label: t("📜 Historique"),
          step: {
            mode: 'review',
            targets: sub('review'),
            title: t("📜 Historique"),
            text: t("Toutes tes parties (bots, en ligne, chess.com, Lichess), tes statistiques et l’analyse coup par coup avec Stockfish."),
          },
        },
        {
          label: t("🎯 Suivi personnalisé"),
          step: {
            mode: 'coach',
            targets: sub('coach'),
            title: t("🎯 Suivi personnalisé"),
            text: t("Stockfish relit tes dernières parties et repère les erreurs qui reviennent. Détaillé juste après !"),
          },
        },
        {
          label: t("💡 Astuces"),
          step: {
            mode: 'tips',
            targets: sub('tips'),
            title: t("💡 Astuces"),
            text: t("Les bons réflexes à connaître, mis en avant selon les erreurs que tu fais le plus."),
          },
        },
        {
          label: t("🏆 Succès"),
          step: {
            mode: 'achievements',
            targets: sub('achievements'),
            title: t("🏆 Succès"),
            text: t("Plus de 250 défis à débloquer, avec un jeu de mots chacun. Ils rapportent XP et pièces."),
          },
        },
        {
          label: t("🎁 Niveaux"),
          step: {
            mode: 'levels',
            targets: sub('levels'),
            title: t("🎁 Niveaux"),
            text: t("Chaque niveau gagné offre une récompense, jusqu’à des skins animés exclusifs."),
          },
        },
      ],
    },
    {
      mode: 'coach',
      targets: ['[data-tour=sub-coach]', '.coach-head'],
      title: t("🎯 Le suivi personnalisé, ton meilleur allié"),
      text: t("C’est le cœur de BetterMove. Stockfish relit tes parties (bots, chess.com, Lichess) et trouve les erreurs qui reviennent : pièces laissées en prise, tactiques ratées, finales mal jouées… Tu obtiens tes priorités et des exercices tirés de tes propres parties. Plus tu joues, plus il est précis."),
    },
    {
      mode: 'community',
      targets: ['[data-tour=nav-community]', '[data-tour=subnav]'],
      title: t("💬 Communauté"),
      text: t("Pour discuter, se défier et se comparer."),
      chips: [
        {
          label: t("💬 Salon"),
          step: {
            mode: 'community',
            targets: sub('community'),
            title: t("💬 Salon"),
            text: t("Le chat de tous les joueurs. Clique sur un pseudo pour voir son profil, l’ajouter en ami, lui écrire ou le défier."),
          },
        },
        {
          label: t("🎉 Événements"),
          step: {
            mode: 'events',
            targets: sub('events'),
            title: t("🎉 Événements"),
            text: t("Des événements limités dans le temps, avec des récompenses exclusives. En ce moment : le parrainage du lancement."),
          },
        },
        {
          label: t("🏆 Classement"),
          step: {
            mode: 'leaderboard',
            targets: sub('leaderboard'),
            title: t("🏆 Classement"),
            text: t("Les meilleurs joueurs BetterMove, en ligne, contre les bots et en problèmes."),
          },
        },
      ],
    },
    {
      mode: 'shop',
      targets: ['[data-tour=nav-shop]', '[data-tour=coins]'],
      title: t("🛒 Boutique"),
      text: t("Parties, cours, quêtes et succès rapportent des pièces 🪙. Dépense-les en skins de pièces, plateaux, sons et émojis."),
    },
    {
      mode: 'home',
      targets: ['[data-tour=level]', '.account-btn', '[data-tour=help]', '[data-tour=settings]'],
      title: t("⭐ Ton espace"),
      text: t("Ton niveau et ses récompenses, ton compte pour sauvegarder ta progression, l’aide ❓ (pour revoir cette visite) et les réglages ⚙️."),
    },
    {
      mode: 'lessons',
      targets: [`[data-tour=chapter-${firstChapter.id}] .chapter-head`, `[data-tour=chapter-${firstChapter.id}] .path-node:first-child`],
      title: t("📚 Et maintenant, les cours"),
      text: novice
        ? t("On te conseille de commencer par l’initiation : le plateau, les pièces et le but du jeu, en quelques minutes.")
        : t("Commence par les armes tactiques : fourchette, clouage, enfilade… La base de la plupart des parties gagnées."),
    },
  ];
  const startTour = () => {
    setOnboard(null);
    setAccountOpen(false);
    setHelpOpen(false);
    setTour(0);
  };
  const startInitiation = () => {
    openLessonNext('init-board');
    setLessonsKey((k) => k + 1);
    setOnboard(null);
    setAccountOpen(false);
    setMode('lessons');
  };
  // Donnees modifiees depuis un autre appareil : on propose de recharger
  const [remoteChanged, setRemoteChanged] = useState(false);
  useEffect(() => {
    const on = () => setRemoteChanged(true);
    window.addEventListener('bettermove-remote', on);
    return () => window.removeEventListener('bettermove-remote', on);
  }, []);
  const [toast, setToast] = useState<string | null>(null);
  // Mesure d'audience anonyme (sans cookie) : une ligne par page vue, sans pseudo ni numero dans l'adresse.
  // Au premier affichage seulement : le site d'origine (le serveur n'en garde que le nom de domaine).
  const hitPath = usePath();
  const firstHit = useRef(true);
  useEffect(() => {
    const segs = hitPath.split('/').filter(Boolean);
    const page = '/' + (['profil', 'partie', 'invite'].includes(segs[0]) ? segs.slice(0, 1) : segs.slice(0, 2)).join('/');
    const body: Record<string, string> = { page, lang: navigator.language ?? '' };
    if (firstHit.current) body.ref = document.referrer;
    firstHit.current = false;
    fetch(`${API_BASE}/visits/hit`, {
      method: 'POST',
      credentials: 'include',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => undefined);
  }, [hitPath]);
  // Message laisse avant un rechargement (inscription avec e-mail, mot de passe change)
  useEffect(() => {
    const show = () => {
      const n = sessionStorage.getItem('bettermove.notice');
      if (n) {
        sessionStorage.removeItem('bettermove.notice');
        setToast(n);
      }
    };
    show();
    window.addEventListener('bettermove-notice', show);
    return () => window.removeEventListener('bettermove-notice', show);
  }, []);
  const [reviewRequest, setReviewRequest] = useState<ReviewRequest | null>(null);
  const [achQueue, setAchQueue] = useState<Achievement[]>([]);
  const onUnlock = useCallback((list: Achievement[]) => {
    setAchQueue((q) => [...q, ...list]);
    sounds.success();
  }, []);
  const ach = useAchievements(player, onUnlock);
  // XP donnee depuis n'importe quelle page (parties en ligne, quetes, coffre...) : appliquee au profil
  const grantRef = useRef(player.grantXp);
  grantRef.current = player.grantXp;
  useEffect(() => {
    const on = (e: Event) => grantRef.current(Number((e as CustomEvent).detail) || 0);
    window.addEventListener(XP_EVENT, on);
    return () => window.removeEventListener(XP_EVENT, on);
  }, []);
  // Recompenses d'evenement (parrainage...) en attente sur le serveur : fenetre avec un bouton "Recuperer"
  type PendingReward = { id: number; coins: number; items: string[]; reason: string };
  const [eventGift, setEventGift] = useState<{ rewards: PendingReward[]; claimed: boolean } | null>(null);
  const giftShown = useRef<Set<number>>(new Set());
  // Invitation d'abord, puis (compte cree ou "plus tard") l'accueil habituel : bienvenue, niveau, visite
  const invitePopup = !!inviter && !sync.user && !invitePopupSeen;
  const onboardPaused = invitePopup || (accountOpen && accountFromInvite) || !!eventGift;
  useEffect(() => {
    if (!sync.user) return;
    let stop = false;
    const check = () =>
      apiCall<{ rewards: PendingReward[] }>('/events/rewards')
        .then(({ rewards }) => {
          // Fenetre fermee sans recuperer : on ne la remontre pas avant le prochain chargement
          const fresh = rewards.filter((r) => !giftShown.current.has(r.id));
          if (stop || !fresh.length) return;
          rewards.forEach((r) => giftShown.current.add(r.id));
          setInviter(null);
          setEventGift({ rewards, claimed: false });
          sounds.success();
        })
        .catch(() => undefined);
    void check();
    const id = window.setInterval(check, 20_000);
    window.addEventListener('bettermove-claim', check);
    return () => {
      stop = true;
      clearInterval(id);
      window.removeEventListener('bettermove-claim', check);
    };
  }, [sync.user]);
  const claimGift = async () => {
    try {
      const { rewards } = await apiCall<{ rewards: PendingReward[] }>('/events/rewards/claim', { method: 'POST' });
      for (const r of rewards) {
        if (r.coins) earn(r.coins, r.reason, true);
        for (const id of r.items ?? []) grantItem(id);
      }
      sounds.success();
      setEventGift({ rewards: rewards.length ? rewards : eventGift?.rewards ?? [], claimed: true });
    } catch {
      setToast(t("Récupération impossible pour le moment, réessaie dans un instant."));
    }
  };
  // Parrainage refuse a l'inscription : on explique pourquoi (une seule fois)
  useEffect(() => {
    if (!sync.user) return;
    let res: { status: string; name: string } | null = null;
    try {
      res = JSON.parse(localStorage.getItem('bettermove.refResult') ?? 'null');
    } catch {
      res = null;
    }
    if (!res) return;
    localStorage.removeItem('bettermove.refResult');
    const why: Record<string, string> = {
      inactive: t('le parrainage n’est pas ouvert en ce moment'),
      unknown: t('ce code d’invitation n’existe pas'),
      self: t('tu ne peux pas être ton propre parrain'),
      already: t('ce compte a déjà un parrain'),
      error: t('le serveur n’a pas pu l’enregistrer'),
    };
    if (res.status !== 'ok' && why[res.status]) setToast(t('Parrainage non pris en compte : {why}. Voir Communauté › Événements.', { why: why[res.status] }));
  }, [sync.user]);
  // Quete terminee ailleurs que sur l'accueil : petite notification
  const claimable = useRef(-1);
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const hasAccount = !!sync.user;
  useEffect(() => {
    claimable.current = claimableCount(hasAccount);
    const on = () => {
      const n = claimableCount(hasAccount);
      if (n > claimable.current && modeRef.current !== 'home') setToast(t("🎯 Quête terminée ! Récupère ta récompense sur l’accueil."));
      claimable.current = n;
    };
    window.addEventListener(PERIOD_EVENT, on);
    return () => window.removeEventListener(PERIOD_EVENT, on);
  }, [hasAccount]);
  useEffect(() => {
    if (!achQueue.length) return;
    const id = window.setTimeout(() => setAchQueue((q) => q.slice(1)), achQueue.length > 3 ? 1400 : 3500);
    return () => window.clearTimeout(id);
  }, [achQueue]);
  // Analyse d'une partie : /progresser/historique/<id> (parties enregistrees dans ce navigateur)
  const reviewRef = useRef<ReviewRequest | null>(null);
  const openReview = (r: ReviewRequest) => {
    reviewRef.current = r;
    setReviewRequest(r);
    navigate(pathOf([...ROUTES.review, r.id]));
  };
  const closeReview = () => navigate(pathOf(ROUTES.review));
  const reviewId = mode === 'review' ? segs[2] : undefined;
  const activeReview: ReviewRequest | null = (() => {
    if (!reviewId) return null;
    if (reviewRequest?.id === reviewId) return reviewRequest;
    if (reviewRef.current?.id === reviewId) return reviewRef.current;
    const g = listGames().find((x) => x.id === reviewId);
    return g ? { id: g.id, pgn: g.pgn, userColor: g.userColor, source: g.source } : null;
  })();
  useEffect(() => {
    if (reviewId && !activeReview) {
      setToast(t("Partie introuvable dans ce navigateur"));
      navigate(pathOf(ROUTES.review), true);
    }
  }, [reviewId, activeReview]);

  const [lastInGroup, setLastInGroup] = useState<Record<string, Mode>>(() => load('bettermove.navLast', {}));
  useEffect(() => {
    save('bettermove.mode', mode);
    const g = groupOf(mode);
    // 1v1 sur ecran : pas retenu (le bouton Jouer rouvrirait sa fenetre de reglages)
    if (g && mode !== 'online' && mode !== 'local')
      setLastInGroup((l) => {
        const next = { ...l, [g]: mode };
        save('bettermove.navLast', next);
        return next;
      });
  }, [mode]);

  // Passage de niveau : petite notification
  const lv = levelFromXp(player.profile.xp);
  useClaimed();
  const rewardsReady = pendingLevels(lv.level).length;
  const [lastLevel, setLastLevel] = useState(lv.level);
  useEffect(() => {
    if (lv.level > lastLevel)
      setToast(pendingLevels(lv.level).includes(lv.level) ? t('🎉 Niveau {n} : un cadeau t’attend (clique sur ton niveau)', { n: lv.level }) : t('🎉 Niveau {n} atteint !', { n: lv.level }));
    setLastLevel(lv.level);
  }, [lv.level, lastLevel]);

  useEffect(() => {
    if (!toast) return;
    // Assez de temps pour lire les messages longs
    const id = window.setTimeout(() => setToast(null), Math.max(2200, toast.length * 45));
    return () => window.clearTimeout(id);
  }, [toast]);

  return (
    <div className="app">
      <header className="topbar">
        <button className={`brand ${mode === 'home' ? 'active' : ''}`} onClick={() => setMode('home')} title={t("Accueil")}>
          <span className="logo" aria-hidden>
            ♞
          </span>
          <span>{t("Better")}<b>{t("Move")}</b>
          </span>
        </button>
        <nav className="modes">
          {NAV.map((g) => {
            const active = groupOf(mode) === g.id;
            return (
              <button
                key={g.id}
                data-tour={`nav-${g.id}`}
                className={`mode ${active ? 'active' : ''}`}
                title={t(g.label)}
                ref={(el) => {
                  // Le groupe actif reste visible quand la barre defile (petits ecrans)
                  if (el && active) el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
                }}
                onClick={() => {
                  if (active && g.id === 'progress' && mode === 'review') closeReview();
                  // Le groupe rouvre la derniere page visitee dans ce groupe
                  const last = lastInGroup[g.id];
                  const target = last && last !== 'local' && g.items.some((i) => i.id === last && !i.goto) ? last : g.items[0].id;
                  setMode(active ? mode : target);
                }}
              >
                <span className="mode-icon" aria-hidden>
                  <g.icon size={19} strokeWidth={2} />
                </span>{' '}
                <span className="mode-label">{t(g.label)}</span>
                {g.id === 'community' && socialBadge > 0 && <span className="badge">{socialBadge}</span>}
                {g.id === 'progress' && rewardsReady > 0 && <span className="badge phone-only">{rewardsReady}</span>}
              </button>
            );
          })}
        </nav>
        <div className="top-actions">
          <button className="coin-chip" data-tour="coins" onClick={() => setMode('shop')} title={t("Tes pièces : ouvre la boutique")}>
            <I.Coins size={16} strokeWidth={2.2} aria-hidden /> {shop.coins}
          </button>
          <button
            data-tour="level"
            className={`level-chip ${mode === 'levels' ? 'active' : ''}`}
            onClick={() => setMode('levels')}
            title={t('{xp} XP · {into}/{needed} vers le niveau {next} · récompenses de niveau', { xp: player.profile.xp, into: lv.into, needed: lv.needed, next: lv.level + 1 })}
          >{t("Niv. {n}", { n: lv.level })}
            <i style={{ width: `${Math.round(lv.progress * 100)}%` }} />
            {rewardsReady > 0 && <span className="badge">{rewardsReady}</span>}
          </button>
          {(() => {
            const r = mode === 'puzzles' ? player.profile.puzzles : player.profile.bots;
            return (
              <span
                className="elo-chip"
                title={
                  mode === 'puzzles'
                    ? t('Ton Elo en problèmes') + (isPuzzleProvisional(player.profile) ? `\n${provisionalHelp()}` : '')
                    : t("Ton Elo contre les bots")
                }
              >
                {mode === 'puzzles' ? <I.Puzzle size={15} strokeWidth={2.2} aria-hidden /> : <I.Pawn size={15} strokeWidth={2.2} aria-hidden />}
                {Math.round(r.rating)}
                {mode === 'puzzles' && isPuzzleProvisional(player.profile) ? '?' : ''}
              </span>
            );
          })()}
          <button
            className="icon-btn sound-toggle"
            onClick={() => update({ sound: !settings.sound })}
            title={settings.sound ? t("Couper le son") : t("Activer le son")}
          >
            {settings.sound ? <I.Volume2 size={19} aria-hidden /> : <I.VolumeX size={19} aria-hidden />}
          </button>
          <AccountButton onClick={() => setAccountOpen(true)} />
          {sync.user && isAdmin() && (
            <button className={`icon-btn ${mode === 'admin' ? 'active' : ''}`} onClick={() => setMode('admin')} title={t("Administration")}>
              <I.Wrench size={19} aria-hidden />
              {!!notif?.adminTalk && <span className="badge">{notif.adminTalk}</span>}
            </button>
          )}
          <div className="help-wrap">
            <button data-tour="help" className={`icon-btn help-btn ${mode === 'support' ? 'active' : ''}`} onClick={() => setHelpOpen(!helpOpen)} title={t("Aide")} aria-label={t("Aide et paramètres")}>
              <span className="desk-only" aria-hidden>
                <I.CircleHelp size={20} />
              </span>
              <span className="phone-only" aria-hidden>
                <I.Menu size={22} />
              </span>
            </button>
            {helpOpen && (
              <>
                <div className="help-menu card">
                  <button
                    className="menu-item phone-only"
                    onClick={() => {
                      setHelpOpen(false);
                      setSettingsOpen(true);
                    }}
                  ><I.Settings size={17} aria-hidden /> {t("Paramètres")}</button>
                  <button className="menu-item phone-only" onClick={() => update({ sound: !settings.sound })}>
                    {settings.sound ? <I.VolumeX size={17} aria-hidden /> : <I.Volume2 size={17} aria-hidden />} {settings.sound ? t("Couper le son") : t("Activer le son")}
                  </button>
                  <button
                    className="menu-item"
                    onClick={() => {
                      setHelpOpen(false);
                      startTour();
                    }}
                  ><I.Compass size={17} aria-hidden /> {t("Visite de l’application")}</button>
                  <button
                    className="menu-item"
                    onClick={() => {
                      setHelpOpen(false);
                      setOnboard('about');
                    }}
                  ><I.Info size={17} aria-hidden /> {t("Le projet BetterMove")}</button>
                  <button
                    className="menu-item"
                    onClick={() => {
                      setHelpOpen(false);
                      startInitiation();
                    }}
                  ><I.Sprout size={17} aria-hidden /> {t("Parcours d’initiation")}</button>
                  <button
                    className="menu-item"
                    onClick={() => {
                      setHelpOpen(false);
                      setMode('support');
                    }}
                  ><I.LifeBuoy size={17} aria-hidden /> {t("Contacter le support")}</button>
                  <button
                    className="menu-item"
                    onClick={() => {
                      setHelpOpen(false);
                      setRoadmapOpen(true);
                    }}
                  ><I.Sparkles size={17} aria-hidden /> {t("Prochainement")}</button>
                  <button
                    className="menu-item"
                    onClick={() => {
                      setHelpOpen(false);
                      navigate('/guides');
                    }}
                  ><I.BookText size={17} aria-hidden /> {t("Guides")}</button>
                  <button
                    className="menu-item"
                    onClick={() => {
                      setHelpOpen(false);
                      setCreditsOpen(true);
                    }}
                  ><I.Clapperboard size={17} aria-hidden /> {t("Crédits")}</button>
                </div>
              </>
            )}
          </div>
          <button className="icon-btn settings-btn" data-tour="settings" onClick={() => setSettingsOpen(true)} title={t("Paramètres")}>
            <I.Settings size={19} aria-hidden />
          </button>
        </div>
      </header>
      {(() => {
        // Sous-onglets du groupe actif (seulement s'il en a plusieurs)
        const g = NAV.find((x) => x.id === groupOf(mode));
        if (!g || g.items.length < 2) return null;
        return (
          <nav className="subnav" data-tour="subnav">
            {g.items.map((i) => (
              <button
                key={i.id}
                data-tour={`sub-${i.id}`}
                className={`subtab ${mode === i.id ? 'active' : ''}`}
                onClick={() => {
                  if (i.id === 'review' && mode === 'review') closeReview();
                  if (i.id === 'online' && onlineGame !== null && mode !== 'online') setMode('online');
                  else if (i.id === 'online' && onlineGame === null && sync.user)
                    // Pas de partie connue ici : on verifie sur le serveur avant d'aller a la Communaute
                    online
                      .current()
                      .then((r) => (r.game ? playOnline(r.game.id) : setMode('community')))
                      .catch(() => setMode('community'));
                  else setMode(i.goto && !(i.id === 'online' && onlineGame !== null) ? i.goto : i.id);
                }}
                title={i.goto ? t("Défie un ami depuis la Communauté") : undefined}
              >
                <i.icon size={16} strokeWidth={2} aria-hidden /> {t(i.label)}
              </button>
            ))}
            {/* Telephone : le chiffre utile a cet onglet (Elo, niveau), retire de la barre du haut */}
            {(mode === 'bots' || mode === 'puzzles' || mode === 'rush') && (
              <span className="subnav-stat phone-only">
                {mode === 'bots' ? <I.Pawn size={14} strokeWidth={2.2} aria-hidden /> : <I.Puzzle size={14} strokeWidth={2.2} aria-hidden />} {Math.round((mode === 'bots' ? player.profile.bots : player.profile.puzzles).rating)}
                {mode !== 'bots' && isPuzzleProvisional(player.profile) ? '?' : ''}
              </span>
            )}
            {g.id === 'progress' && (
              <button className="subnav-stat level-chip phone-only" onClick={() => setMode('levels')}>
                {t("Niv. {n}", { n: lv.level })}
                <i style={{ width: `${Math.round(lv.progress * 100)}%` }} />
                {rewardsReady > 0 && <span className="badge">{rewardsReady}</span>}
              </button>
            )}
          </nav>
        );
      })()}

      <main>
        {mode === 'local' && <LocalGamePage notify={setToast} onReview={openReview} />}
        {mode === 'bots' && <BotPage notify={setToast} player={player} onReview={openReview} />}
        {mode === 'puzzles' && <PuzzlePage notify={setToast} player={player} />}
        {mode === 'rush' && <RushPage player={player} />}
        {mode === 'teacher' && (
          <TeacherPage
            onReview={openReview}
            onGoto={(g) => (g.kind === 'online' && g.gameId ? playOnline(g.gameId) : setMode(g.kind === 'bot' ? 'bots' : 'local'))}
          />
        )}
        {mode === 'world' && (
          <WorldPage player={player} onPlay={playOnline} onBot={() => setMode('bots')} onAccount={() => setAccountOpen(true)} />
        )}
        {mode === 'leaderboard' && <LeaderboardPage onOpen={openProfile} />}
        {mode === 'profile' && (
          <ProfilePage
            key={profileName ?? '__me'}
            username={profileName}
            player={player}
            onAccount={() => setAccountOpen(true)}
            onOpen={openProfile}
          />
        )}
        {mode === 'tips' && <TipsPage onCoach={() => setMode('coach')} />}
        {mode === 'admin' && <AdminPage onOpen={openProfile} />}
        {mode === 'repertoire' && <RepertoirePage notify={setToast} />}
        {mode === 'lessons' && <LessonsPage key={lessonsKey} player={player} />}
        {mode === 'coach' && (
          <CoachPage
            player={player}
            onNavigate={(m) => {
              setMode(m);
            }}
          />
        )}
        {mode === 'home' && <HomePage player={player} onNavigate={(m) => setMode(m)} socialBadge={socialBadge} />}
        {mode === 'shop' && <ShopPage />}
        {mode === 'community' && <CommunityPage onAccount={() => setAccountOpen(true)} onPlay={playOnline} onProfile={openProfile} />}
        {mode === 'online' && routeGame !== null && (
          <OnlineGamePage
            key={routeGame}
            gameId={routeGame}
            onExit={() => setMode('community')}
            onPlay={playOnline}
            onNewGame={(tc) => {
              searchWorldNext(tc);
              setMode('world');
            }}
            onReview={openReview}
          />
        )}
        {mode === 'support' && <SupportPage />}
        {mode === 'legal' && <LegalPage onSupport={() => setMode('support')} />}
        {mode === 'guides' && <GuidesPage />}
        {mode === 'events' && (
          <EventsPage
            onAccount={() => {
              setAccountMode('register');
              setAccountOpen(true);
            }}
            onProfile={openProfile}
          />
        )}
        {mode === 'levels' && <LevelsPage player={player} unlocked={ach.unlocked} />}
        {mode === 'achievements' && <AchievementsPage ctx={ach.ctx} unlocked={ach.unlocked} />}
        {mode === 'review' && <ReviewPage
            request={activeReview}
            onRequest={(r) => (r ? openReview(r) : closeReview())}
            notify={setToast}
            player={player}
            onNavigate={(t) => setMode(t === 'coach' ? 'coach' : t)}
          />}
      </main>
      <footer className="site-footer">
        <span>{t("♞ BetterMove · logiciel libre (GPL-3.0)")}</span>
        <a href={hrefOf('/guides')} onClick={(e) => { e.preventDefault(); navigate('/guides'); window.scrollTo(0, 0); }}>{t("Guides")}</a>
        <a href={hrefOf('/infos/mentions-legales')} onClick={(e) => { e.preventDefault(); navigate('/infos/mentions-legales'); window.scrollTo(0, 0); }}>{t("Mentions légales")}</a>
        <a href={hrefOf('/infos/confidentialite')} onClick={(e) => { e.preventDefault(); navigate('/infos/confidentialite'); window.scrollTo(0, 0); }}>{t("Confidentialité")}</a>
        <a href={hrefOf('/infos/conditions')} onClick={(e) => { e.preventDefault(); navigate('/infos/conditions'); window.scrollTo(0, 0); }}>{t("Conditions d’utilisation")}</a>
        <a href={hrefOf('/infos/licences')} onClick={(e) => { e.preventDefault(); navigate('/infos/licences'); window.scrollTo(0, 0); }}>{t("Licences et code source")}</a>
        <a href={hrefOf('/aide')} onClick={(e) => { e.preventDefault(); setMode('support'); }}>{t("Contact")}</a>
      </footer>

      {challengePop && (
        <div className="challenge-pop card">
          <span>
            ⚔️ {t("{name} te défie !", { name: challengePop.from })}</span>
          <button
            className="btn primary small-btn"
            onClick={async () => {
              try {
                const r = await social.acceptChallenge(challengePop.id);
                playOnline(r.gameId);
              } catch (e) {
                setToast(e instanceof Error ? tServer(e.message) : t('Défi expiré'));
              }
              setChallengePop(null);
            }}
          >{t("Jouer")}</button>
          <button
            className="btn small-btn"
            onClick={() => {
              setChallengePop(null);
              setMode('community');
            }}
          >{t("Voir")}</button>
          <button className="icon-btn" onClick={() => setChallengePop(null)} aria-label={t("Fermer")}>
            ×
          </button>
        </div>
      )}
      {talkPop && (
        <Modal title={t("💬 Réponse à ta question")} onClose={() => closeTalkPop(false)}>
          <p className="muted small">{t("Ta question sur le problème {id} :", { id: talkPop.puzzleId })}</p>
          <blockquote className="talk-quote">{talkPop.question}</blockquote>
          <p>
            <b>{talkPop.from}</b> {t("a répondu :")}
          </p>
          <blockquote className="talk-quote answer">{talkPop.text}</blockquote>
          <div className="row">
            {talkPop.ref && (
              <button className="btn primary" onClick={() => closeTalkPop(true)}>{t("Voir le problème")}</button>
            )}
            <button className="btn" onClick={() => closeTalkPop(false)}>{t("Merci !")}</button>
          </div>
        </Modal>
      )}
      {rematchPop && (
        <Modal title={t("🔁 Revanche ?")} onClose={() => setRematchPop(null)}>
          <p>
            {t("{name} te propose une revanche : même cadence, couleurs inversées.", { name: rematchPop.from })}</p>
          <div className="row">
            <button
              className="btn"
              onClick={async () => {
                const id = rematchPop.gameId;
                setRematchPop(null);
                await online.declineRematch(id).catch(() => {});
              }}
            >{t("Refuser")}</button>
            <button
              className="btn primary"
              onClick={async () => {
                const id = rematchPop.gameId;
                setRematchPop(null);
                try {
                  const g = await online.rematch(id);
                  if (g.rematch?.gameId) playOnline(g.rematch.gameId);
                } catch (e) {
                  setToast(e instanceof Error ? e.message : 'Revanche impossible');
                }
              }}
            >{t("Accepter la revanche")}</button>
          </div>
        </Modal>
      )}
      {coinPop && (
        <div key={coinPop.id} className="coin-pop">
          <b>+{coinPop.amount} 🪙</b> <span>{coinPop.reason}</span>
        </div>
      )}
      {achQueue[0] && (
        <button
          key={achQueue[0].id}
          className={`ach-toast t${achQueue[0].tier}`}
          onClick={() => {
            setMode('achievements');
            setAchQueue([]);
          }}
        >
          <span className="ach-toast-icon">{achQueue[0].icon}</span>
          <span>
            <small>{t("Succès débloqué")}{achQueue.length > 1 ? ` (+${achQueue.length - 1})` : ''}</small>
            <strong>{achQueue[0].title}</strong>
          </span>
          <span className="ach-toast-xp">+{TIER_XP[achQueue[0].tier]}{" "}{t("XP")}</span>
        </button>
      )}

      {resetToken && (
        <ResetPasswordModal
          token={resetToken}
          onClose={() => setResetToken(null)}
          onForgot={() => {
            setResetToken(null);
            setAccountMode('forgot');
            setAccountOpen(true);
          }}
        />
      )}
      {accountOpen && (
        <AccountModal
          initialMode={accountMode}
          onClose={() => {
            setAccountOpen(false);
            setAccountMode('login');
            setAccountFromInvite(false);
          }}
          onProfile={() => {
            setAccountOpen(false);
            openProfile(null);
          }}
          onInitiation={startInitiation}
          onTour={() => {
            setAccountOpen(false);
            startTour();
          }}
        />
      )}
      {/* Arrivee par un lien de parrainage : l'invitation passe avant l'accueil des nouveaux */}
      {invitePopup && (
        <Modal title={t("🎁 Tu es invité !")} onClose={() => closeInvitePopup(false)}>
          <div className="onboard invite-pop">
            <div className="invite-pop-avatar">
              <Avatar name={inviter!} size={64} />
            </div>
            <p className="welcome-lead">
              {t("{name} t’invite à le rejoindre sur BetterMove pour progresser aux échecs.", { name: inviter })}</p>
            <p>{t("Crée ton compte gratuit maintenant : vous recevez tous les deux un cadeau de bienvenue.")}</p>
            <div className="gift-items">
              <span className="gift-chip coins">+100 🪙</span>
              <span className="gift-chip">{t("♞ Pièces « Parrainage »")}</span>
              <span className="gift-chip">{t("🏁 Plateau « Parrainage »")}</span>
            </div>
            <p className="muted small">{t("Skins exclusifs, disponibles uniquement pendant l’événement de lancement.")}</p>
            <button className="btn primary big gift-claim" onClick={() => closeInvitePopup(true)}>{t("Créer mon compte et recevoir mes cadeaux")}</button>
            <button className="link-btn small muted center" onClick={() => closeInvitePopup(false)}>{t("Plus tard (l’invitation reste valable)")}</button>
          </div>
        </Modal>
      )}
      {!onboardPaused && (
        <>
      {(onboard === 'level' || onboard === 'change') && (
        <LevelModal
          change={onboard === 'change'}
          onChoose={(l) => chooseLevel(l, onboard === 'change')}
          onClose={() => {
            // Fermer l'accueil sans choisir : niveau intermediaire par defaut, sans toucher a l'Elo
            if (onboard === 'level') setLevel('intermediate');
            setOnboard(null);
          }}
          onAccount={() => {
            setOnboard(null);
            setAccountOpen(true);
          }}
        />
      )}
      {onboard && typeof onboard === 'object' && (
        <WelcomeNext level={onboard.next} onTour={() => startTour()} onClose={() => setOnboard(null)} />
      )}
      {creditsOpen && <Credits onClose={() => setCreditsOpen(false)} />}
      {roadmapOpen && (
        <RoadmapModal
          onClose={() => setRoadmapOpen(false)}
          onIdea={() => {
            setRoadmapOpen(false);
            setMode('support');
          }}
        />
      )}
      {tour !== null && (
        <SpotlightTour
          steps={tourSteps}
          step={tour}
          onStep={setTour}
          onEnd={() => setTour(null)}
          onMode={setMode}
          finalActions={
            <>
              <button
                className="btn primary big"
                onClick={() => {
                  setTour(null);
                  openLessonNext(firstLesson.id);
                  setLessonsKey((k) => k + 1);
                  setMode('lessons');
                }}
              >{t("▶ Commencer « {title} »", { title: firstLesson.title })}
              </button>
              <button className="btn ghost" onClick={() => setTour(null)}>{t("J’explore seul")}</button>
            </>
          }
        />
      )}
      {(onboard === 'welcome' || onboard === 'about') && (
        <WelcomeModal onStart={() => closeWelcome()} />
      )}
        </>
      )}
      {eventGift && (() => {
        const coins = eventGift.rewards.reduce((t, r) => t + r.coins, 0);
        const items = [...new Set(eventGift.rewards.flatMap((r) => r.items ?? []))];
        return (
          <Modal title={eventGift.claimed ? t("✅ Récompense récupérée") : t("🎁 Récompense de parrainage")} onClose={() => setEventGift(null)}>
            <div className="onboard event-gift">
              {eventGift.rewards.map((r) => (
                <p key={r.id}>{r.reason}</p>
              ))}
              <div className="gift-items">
                {coins > 0 && <span className="gift-chip coins">+{coins} 🪙</span>}
                {items.map((id) => (
                  <span key={id} className="gift-chip">
                    {itemById(id)?.type === 'board' ? t("🏁 Plateau") : t("♞ Pièces")} « {itemById(id)?.name ?? id} »
                  </span>
                ))}
              </div>
              {!eventGift.claimed ? (
                <button className="btn primary big gift-claim" onClick={claimGift}>{t("🎁 Récupérer")}</button>
              ) : (
                <>
                  <p className="muted small">{items.length ? t("Tes skins exclusifs sont dans la Boutique, prêts à être équipés.") : t("Les pièces sont dans ton porte-monnaie.")}</p>
                  <div className="row">
                    {items.length > 0 && (
                      <button
                        className="btn primary"
                        onClick={() => {
                          setEventGift(null);
                          setMode('shop');
                        }}
                      >{t("🛒 Équiper mes skins")}</button>
                    )}
                    <button
                      className="btn"
                      onClick={() => {
                        setEventGift(null);
                        setMode('events');
                      }}
                    >{t("🎉 Inviter d’autres amis")}</button>
                  </div>
                </>
              )}
            </div>
          </Modal>
        );
      })()}
      {inviter && !sync.user && !invitePopup && !accountOpen && !onboard && (
        <div className="invite-banner">
          <span>
            🎁 {t("{name} t’invite sur BetterMove ! Crée ton compte pour recevoir 100 🪙 et 2 skins exclusifs.", { name: inviter })}
          </span>
          <button
            className="btn primary"
            onClick={() => {
              setAccountMode('register');
              setAccountOpen(true);
            }}
          >{t("Créer mon compte")}</button>
          <button
            className="icon-btn"
            aria-label={t("Plus tard")}
            onClick={() => {
              // Masque le bandeau sans perdre l'invitation : elle reste valable a l'inscription
              sessionStorage.setItem('bettermove.refHidden', '1');
              setInviter(null);
            }}
          >
            ×
          </button>
        </div>
      )}
      {remoteChanged && (
        <div className="remote-banner">{t("Nouvelles données depuis un autre appareil.")}<button className="btn primary" onClick={() => window.location.reload()}>{t("Recharger")}</button>
          <button className="icon-btn" onClick={() => setRemoteChanged(false)} aria-label={t("Fermer")}>
            ×
          </button>
        </div>
      )}
      {settingsOpen && (
        <SettingsModal
          onClose={() => setSettingsOpen(false)}
          onResetRating={() => {
            player.resetRating();
            setToast(t("Classement réinitialisé"));
          }}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
