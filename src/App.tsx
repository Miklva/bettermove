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
import { PROVISIONAL_HELP } from './rating/elo';
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
import { CHAPTERS } from './lessons/courses';
import { getLevel, isFreshProfile, LEVELS, setLevel, type Level } from './onboarding/level';
import { openLessonNext } from './pages/LessonsPage';
import { Avatar, reconcileAvatar } from './profile/avatar';
import { isAdmin } from './sync/client';
import { RushPage } from './pages/RushPage';
import { TipsPage } from './pages/TipsPage';
import { TeacherPage } from './pages/TeacherPage';
import { ProfilePage } from './pages/ProfilePage';
import { searchWorldNext, WorldPage } from './pages/WorldPage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { AdminPage } from './pages/AdminPage';
import { RepertoirePage } from './pages/RepertoirePage';
import { navigate, pathOf, useSegments } from './router';
import { listGames } from './review/store';
import { LevelsPage } from './pages/LevelsPage';
import { LegalPage } from './pages/LegalPage';
import { EventsPage } from './pages/EventsPage';
import { earn, grant as grantItem } from './shop/store';
import { itemById } from './shop/items';
import { apiCall } from './sync/client';
import { XP_EVENT } from './economy/rewards';
import { claimableCount } from './economy/quests';
import { PERIOD_EVENT } from './achievements/events';
import { pendingLevels, useClaimed } from './rewards/levels';

type Mode = 'home' | 'levels' | 'teacher' | 'profile' | 'tips' | 'world' | 'leaderboard' | 'admin' | 'local' | 'bots' | 'puzzles' | 'rush' | 'repertoire' | 'lessons' | 'review' | 'coach' | 'achievements' | 'shop' | 'community' | 'support' | 'online' | 'legal' | 'events';

/** Navigation regroupee : chaque groupe ouvre sa derniere page, ses pages sont listees juste en dessous */
interface NavItem {
  id: Mode;
  label: string;
  icon: string;
  /** Raccourci vers une autre page (ex. defier un ami -> Communaute) */
  goto?: Mode;
}
interface NavGroup {
  id: string;
  label: string;
  icon: string;
  items: NavItem[];
}

const NAV: NavGroup[] = [
  {
    id: 'play',
    label: 'Jouer',
    icon: '♟️',
    items: [
      { id: 'bots', label: 'Contre un bot', icon: '🤖' },
      { id: 'world', label: 'Contre le monde', icon: '🌍' },
      { id: 'local', label: '1v1 sur cet écran', icon: '👥' },
      { id: 'online', label: 'Contre un ami', icon: '⚔️', goto: 'community' },
    ],
  },
  {
    id: 'learn',
    label: 'Apprendre',
    icon: '🎓',
    items: [
      { id: 'lessons', label: 'Cours', icon: '📚' },
      { id: 'teacher', label: 'Contre le professeur', icon: '👨‍🏫' },
      { id: 'puzzles', label: 'Problèmes', icon: '🧩' },
      { id: 'rush', label: 'Puzzle Rush', icon: '⚡' },
      { id: 'repertoire', label: 'Répertoire', icon: '📖' },
    ],
  },
  {
    id: 'progress',
    label: 'Progresser',
    icon: '📈',
    items: [
      { id: 'review', label: 'Historique', icon: '📜' },
      { id: 'coach', label: 'Suivi personnalisé', icon: '🎯' },
      { id: 'tips', label: 'Astuces', icon: '💡' },
      { id: 'achievements', label: 'Succès', icon: '🏆' },
      { id: 'levels', label: 'Niveaux', icon: '🎁' },
    ],
  },
  {
    id: 'community',
    label: 'Communauté',
    icon: '💬',
    items: [
      { id: 'community', label: 'Salon', icon: '💬' },
      { id: 'events', label: 'Événements', icon: '🎉' },
      { id: 'leaderboard', label: 'Classement', icon: '🏆' },
    ],
  },
  { id: 'shop', label: 'Boutique', icon: '🛒', items: [{ id: 'shop', label: 'Boutique', icon: '🛒' }] },
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
};
/** Adresses courtes ou alternatives */
const ALIASES: [string[], Mode][] = [
  [['jouer'], 'bots'],
  [['apprendre'], 'lessons'],
  [['progresser'], 'review'],
  [['communaute'], 'community'],
  [['communaute', 'messages'], 'community'],
];
const TITLES: Partial<Record<Mode, string>> = { home: 'Accueil', online: 'Partie en ligne', profile: 'Profil', admin: 'Administration', support: 'Aide', legal: 'Informations légales' };

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
          .then(() => setToast('✅ Adresse e-mail confirmée : tu pourras récupérer ton compte en cas d’oubli.'))
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
  // Titre de l'onglet du navigateur
  useEffect(() => {
    const label = TITLES[mode] ?? NAV.flatMap((g) => g.items).find((i) => i.id === mode)?.label;
    document.title = label && mode !== 'home' ? `${label} · BetterMove` : 'BetterMove';
  }, [mode]);
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
    if (change) setToast(`Niveau mis à jour : ${info.title}`);
  };
  const [lessonsKey, setLessonsKey] = useState(0);
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
      title: '🏠 Ton accueil',
      text: 'Chaque jour, l’essentiel est ici : ta prochaine étape, le problème du jour et tes quêtes. Le logo BetterMove te ramène toujours ici.',
    },
    {
      mode: 'bots',
      targets: ['[data-tour=nav-play]', '[data-tour=subnav]'],
      title: '♟️ Jouer',
      text: 'Tout ce qui se joue sur un échiquier. Chaque espace a ses sous-onglets juste en dessous.',
      chips: [
        {
          label: '🤖 Contre un bot',
          step: {
            mode: 'bots',
            targets: sub('bots', ['.bot-grid']),
            title: '🤖 Contre un bot',
            text: 'De 400 à 2700 Elo, chacun avec son caractère : ils jouent et discutent comme des humains. Bats-les pour débloquer les suivants.',
          },
        },
        {
          label: '🌍 Contre le monde',
          step: {
            mode: 'world',
            targets: sub('world'),
            title: '🌍 Contre le monde',
            text: 'Une partie classée contre un vrai joueur BetterMove de ton niveau, tiré au hasard. Il faut un compte (gratuit).',
          },
        },
        {
          label: '👥 1v1 sur cet écran',
          step: {
            mode: 'world',
            targets: sub('local'),
            title: '👥 1v1 sur cet écran',
            text: 'Deux joueurs, un seul appareil : choisis la cadence, le plateau peut se retourner à chaque coup.',
          },
        },
        {
          label: '⚔️ Contre un ami',
          step: {
            mode: 'world',
            targets: sub('online'),
            title: '⚔️ Contre un ami',
            text: 'Défie un ami depuis la Communauté. Revanche en un clic, et chat avec émojis pendant la partie.',
          },
        },
      ],
    },
    {
      mode: 'lessons',
      targets: ['[data-tour=nav-learn]', '[data-tour=subnav]'],
      title: '🎓 Apprendre',
      text: 'Pour acquérir de nouvelles connaissances, à ton niveau.',
      chips: [
        {
          label: '📚 Cours',
          step: {
            mode: 'lessons',
            targets: sub('lessons'),
            title: '📚 Cours',
            text: 'Initiation, tactiques, mats, finales et ouvertures, leçon par leçon. 3 étoiles partout débloquent l’approfondissement.',
          },
        },
        {
          label: '👨‍🏫 Contre le professeur',
          step: {
            mode: 'lessons',
            targets: sub('teacher'),
            title: '👨‍🏫 Contre le professeur',
            text: 'Une vraie partie où chaque coup est commenté : tu comprends pourquoi un coup est bon ou mauvais.',
          },
        },
        {
          label: '🧩 Problèmes',
          step: {
            mode: 'puzzles',
            targets: sub('puzzles'),
            title: '🧩 Problèmes',
            text: 'Des milliers de positions à ton niveau, par thème. En cas d’erreur, l’app t’explique ce qui n’allait pas.',
          },
        },
        {
          label: '⚡ Puzzle Rush',
          step: {
            mode: 'rush',
            targets: sub('rush'),
            title: '⚡ Puzzle Rush',
            text: 'Un maximum de problèmes contre la montre : 3 erreurs et c’est fini. Bats ton record !',
          },
        },
        {
          label: '📖 Répertoire',
          step: {
            mode: 'repertoire',
            targets: sub('repertoire'),
            title: '📖 Répertoire',
            text: 'Choisis tes ouvertures et révise-les coup par coup : l’app joue l’adversaire jusqu’à ce que tu les connaisses par cœur.',
          },
        },
      ],
    },
    {
      mode: 'review',
      targets: ['[data-tour=nav-progress]', '[data-tour=subnav]'],
      title: '📈 Progresser',
      text: 'Pour mesurer tes progrès et apprendre de tes propres parties.',
      chips: [
        {
          label: '📜 Historique',
          step: {
            mode: 'review',
            targets: sub('review'),
            title: '📜 Historique',
            text: 'Toutes tes parties (bots, en ligne, chess.com, Lichess), tes statistiques et l’analyse coup par coup avec Stockfish.',
          },
        },
        {
          label: '🎯 Suivi personnalisé',
          step: {
            mode: 'coach',
            targets: sub('coach'),
            title: '🎯 Suivi personnalisé',
            text: 'Stockfish relit tes dernières parties et repère les erreurs qui reviennent. Détaillé juste après !',
          },
        },
        {
          label: '💡 Astuces',
          step: {
            mode: 'tips',
            targets: sub('tips'),
            title: '💡 Astuces',
            text: 'Les bons réflexes à connaître, mis en avant selon les erreurs que tu fais le plus.',
          },
        },
        {
          label: '🏆 Succès',
          step: {
            mode: 'achievements',
            targets: sub('achievements'),
            title: '🏆 Succès',
            text: 'Plus de 250 défis à débloquer, avec un jeu de mots chacun. Ils rapportent XP et pièces.',
          },
        },
        {
          label: '🎁 Niveaux',
          step: {
            mode: 'levels',
            targets: sub('levels'),
            title: '🎁 Niveaux',
            text: 'Chaque niveau gagné offre une récompense, jusqu’à des skins animés exclusifs.',
          },
        },
      ],
    },
    {
      mode: 'coach',
      targets: ['[data-tour=sub-coach]', '.coach-head'],
      title: '🎯 Le suivi personnalisé, ton meilleur allié',
      text: 'C’est le cœur de BetterMove. Stockfish relit tes parties (bots, chess.com, Lichess) et trouve les erreurs qui reviennent : pièces laissées en prise, tactiques ratées, finales mal jouées… Tu obtiens tes priorités et des exercices tirés de tes propres parties. Plus tu joues, plus il est précis.',
    },
    {
      mode: 'community',
      targets: ['[data-tour=nav-community]', '[data-tour=subnav]'],
      title: '💬 Communauté',
      text: 'Pour discuter, se défier et se comparer.',
      chips: [
        {
          label: '💬 Salon',
          step: {
            mode: 'community',
            targets: sub('community'),
            title: '💬 Salon',
            text: 'Le chat de tous les joueurs. Clique sur un pseudo pour voir son profil, l’ajouter en ami, lui écrire ou le défier.',
          },
        },
        {
          label: '🎉 Événements',
          step: {
            mode: 'events',
            targets: sub('events'),
            title: '🎉 Événements',
            text: 'Des événements limités dans le temps, avec des récompenses exclusives. En ce moment : le parrainage du lancement.',
          },
        },
        {
          label: '🏆 Classement',
          step: {
            mode: 'leaderboard',
            targets: sub('leaderboard'),
            title: '🏆 Classement',
            text: 'Les meilleurs joueurs BetterMove, en ligne, contre les bots et en problèmes.',
          },
        },
      ],
    },
    {
      mode: 'shop',
      targets: ['[data-tour=nav-shop]', '[data-tour=coins]'],
      title: '🛒 Boutique',
      text: 'Parties, cours, quêtes et succès rapportent des pièces 🪙. Dépense-les en skins de pièces, plateaux, sons et émojis.',
    },
    {
      mode: 'home',
      targets: ['[data-tour=level]', '.account-btn', '[data-tour=help]', '[data-tour=settings]'],
      title: '⭐ Ton espace',
      text: 'Ton niveau et ses récompenses, ton compte pour sauvegarder ta progression, l’aide ❓ (pour revoir cette visite) et les réglages ⚙️.',
    },
    {
      mode: 'lessons',
      targets: [`[data-tour=chapter-${firstChapter.id}] .chapter-head`, `[data-tour=chapter-${firstChapter.id}] .path-node:first-child`],
      title: '📚 Et maintenant, les cours',
      text: novice
        ? 'On te conseille de commencer par l’initiation : le plateau, les pièces et le but du jeu, en quelques minutes.'
        : 'Commence par les armes tactiques : fourchette, clouage, enfilade… La base de la plupart des parties gagnées.',
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
      setToast('Récupération impossible pour le moment, réessaie dans un instant.');
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
      inactive: 'le parrainage n’est pas ouvert en ce moment',
      unknown: 'ce code d’invitation n’existe pas',
      self: 'tu ne peux pas être ton propre parrain',
      already: 'ce compte a déjà un parrain',
      error: 'le serveur n’a pas pu l’enregistrer',
    };
    if (res.status !== 'ok' && why[res.status]) setToast(`Parrainage non pris en compte : ${why[res.status]}. Voir Communauté › Événements.`);
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
      if (n > claimable.current && modeRef.current !== 'home') setToast('🎯 Quête terminée ! Récupère ta récompense sur l’accueil.');
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
      setToast('Partie introuvable dans ce navigateur');
      navigate(pathOf(ROUTES.review), true);
    }
  }, [reviewId, activeReview]);

  const [lastInGroup, setLastInGroup] = useState<Record<string, Mode>>(() => load('bettermove.navLast', {}));
  useEffect(() => {
    save('bettermove.mode', mode);
    const g = groupOf(mode);
    if (g && mode !== 'online')
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
      setToast(pendingLevels(lv.level).includes(lv.level) ? `🎉 Niveau ${lv.level} : un cadeau t’attend (clique sur ton niveau)` : `🎉 Niveau ${lv.level} atteint !`);
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
        <button className={`brand ${mode === 'home' ? 'active' : ''}`} onClick={() => setMode('home')} title="Accueil">
          <span className="logo" aria-hidden>
            ♞
          </span>
          <span>
            Better<b>Move</b>
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
                title={g.label}
                ref={(el) => {
                  // Le groupe actif reste visible quand la barre defile (petits ecrans)
                  if (el && active) el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
                }}
                onClick={() => {
                  if (active && g.id === 'progress' && mode === 'review') closeReview();
                  // Le groupe rouvre la derniere page visitee dans ce groupe
                  const last = lastInGroup[g.id];
                  const target = last && g.items.some((i) => i.id === last && !i.goto) ? last : g.items[0].id;
                  setMode(active ? mode : target);
                }}
              >
                <span className="mode-icon">{g.icon}</span> <span className="mode-label">{g.label}</span>
                {g.id === 'community' && socialBadge > 0 && <span className="badge">{socialBadge}</span>}
              </button>
            );
          })}
        </nav>
        <div className="top-actions">
          <button className="coin-chip" data-tour="coins" onClick={() => setMode('shop')} title="Tes pièces : ouvre la boutique">
            🪙 {shop.coins}
          </button>
          <button
            data-tour="level"
            className={`level-chip ${mode === 'levels' ? 'active' : ''}`}
            onClick={() => setMode('levels')}
            title={`${player.profile.xp} XP · ${lv.into}/${lv.needed} vers le niveau ${lv.level + 1} · récompenses de niveau`}
          >
            Niv. {lv.level}
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
                    ? `Ton Elo en problèmes${isPuzzleProvisional(player.profile) ? `\n${PROVISIONAL_HELP}` : ''}`
                    : 'Ton Elo contre les bots'
                }
              >
                {mode === 'puzzles' ? '🧩 ' : ''}
                {Math.round(r.rating)}
                {mode === 'puzzles' && isPuzzleProvisional(player.profile) ? '?' : ''}
              </span>
            );
          })()}
          <button
            className="icon-btn sound-toggle"
            onClick={() => update({ sound: !settings.sound })}
            title={settings.sound ? 'Couper le son' : 'Activer le son'}
          >
            {settings.sound ? '🔊' : '🔇'}
          </button>
          <AccountButton onClick={() => setAccountOpen(true)} />
          {sync.user && isAdmin() && (
            <button className={`icon-btn ${mode === 'admin' ? 'active' : ''}`} onClick={() => setMode('admin')} title="Administration">
              🛠️
            </button>
          )}
          <div className="help-wrap">
            <button data-tour="help" className={`icon-btn ${mode === 'support' ? 'active' : ''}`} onClick={() => setHelpOpen(!helpOpen)} title="Aide">
              ❓
            </button>
            {helpOpen && (
              <>
                <div className="help-menu card">
                  <button
                    className="menu-item"
                    onClick={() => {
                      setHelpOpen(false);
                      startTour();
                    }}
                  >
                    🧭 Visite de l’application
                  </button>
                  <button
                    className="menu-item"
                    onClick={() => {
                      setHelpOpen(false);
                      setOnboard('about');
                    }}
                  >
                    👋 Le projet BetterMove
                  </button>
                  <button
                    className="menu-item"
                    onClick={() => {
                      setHelpOpen(false);
                      startInitiation();
                    }}
                  >
                    🌱 Parcours d’initiation
                  </button>
                  <button
                    className="menu-item"
                    onClick={() => {
                      setHelpOpen(false);
                      setMode('support');
                    }}
                  >
                    🛟 Contacter le support
                  </button>
                  <button
                    className="menu-item"
                    onClick={() => {
                      setHelpOpen(false);
                      setRoadmapOpen(true);
                    }}
                  >
                    🔮 Prochainement
                  </button>
                  <button
                    className="menu-item"
                    onClick={() => {
                      setHelpOpen(false);
                      setCreditsOpen(true);
                    }}
                  >
                    🎬 Crédits
                  </button>
                </div>
              </>
            )}
          </div>
          <button className="icon-btn" data-tour="settings" onClick={() => setSettingsOpen(true)} title="Paramètres">
            ⚙️
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
                title={i.goto ? 'Défie un ami depuis la Communauté' : undefined}
              >
                {i.icon} {i.label}
              </button>
            ))}
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
        <span>♞ BetterMove · logiciel libre (GPL-3.0)</span>
        <a href="/infos/mentions-legales" onClick={(e) => { e.preventDefault(); navigate('/infos/mentions-legales'); window.scrollTo(0, 0); }}>Mentions légales</a>
        <a href="/infos/confidentialite" onClick={(e) => { e.preventDefault(); navigate('/infos/confidentialite'); window.scrollTo(0, 0); }}>Confidentialité</a>
        <a href="/infos/conditions" onClick={(e) => { e.preventDefault(); navigate('/infos/conditions'); window.scrollTo(0, 0); }}>Conditions d’utilisation</a>
        <a href="/infos/licences" onClick={(e) => { e.preventDefault(); navigate('/infos/licences'); window.scrollTo(0, 0); }}>Licences et code source</a>
        <a href="/aide" onClick={(e) => { e.preventDefault(); setMode('support'); }}>Contact</a>
      </footer>

      {challengePop && (
        <div className="challenge-pop card">
          <span>
            ⚔️ <b>{challengePop.from}</b> te défie !
          </span>
          <button
            className="btn primary small-btn"
            onClick={async () => {
              try {
                const r = await social.acceptChallenge(challengePop.id);
                playOnline(r.gameId);
              } catch (e) {
                setToast(e instanceof Error ? e.message : 'Défi expiré');
              }
              setChallengePop(null);
            }}
          >
            Jouer
          </button>
          <button
            className="btn small-btn"
            onClick={() => {
              setChallengePop(null);
              setMode('community');
            }}
          >
            Voir
          </button>
          <button className="icon-btn" onClick={() => setChallengePop(null)} aria-label="Fermer">
            ×
          </button>
        </div>
      )}
      {rematchPop && (
        <Modal title="🔁 Revanche ?" onClose={() => setRematchPop(null)}>
          <p>
            <b>{rematchPop.from}</b> te propose une revanche : même cadence, couleurs inversées.
          </p>
          <div className="row">
            <button
              className="btn"
              onClick={async () => {
                const id = rematchPop.gameId;
                setRematchPop(null);
                await online.declineRematch(id).catch(() => {});
              }}
            >
              Refuser
            </button>
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
            >
              Accepter la revanche
            </button>
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
            <small>Succès débloqué{achQueue.length > 1 ? ` (+${achQueue.length - 1})` : ''}</small>
            <strong>{achQueue[0].title}</strong>
          </span>
          <span className="ach-toast-xp">+{TIER_XP[achQueue[0].tier]} XP</span>
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
          onLevel={() => {
            setAccountOpen(false);
            setOnboard('change');
          }}
        />
      )}
      {/* Arrivee par un lien de parrainage : l'invitation passe avant l'accueil des nouveaux */}
      {invitePopup && (
        <Modal title="🎁 Tu es invité !" onClose={() => closeInvitePopup(false)}>
          <div className="onboard invite-pop">
            <div className="invite-pop-avatar">
              <Avatar name={inviter!} size={64} />
            </div>
            <p className="welcome-lead">
              <b>{inviter}</b> t’invite à le rejoindre sur BetterMove pour progresser aux échecs.
            </p>
            <p>Crée ton compte gratuit maintenant : vous recevez tous les deux un cadeau de bienvenue.</p>
            <div className="gift-items">
              <span className="gift-chip coins">+100 🪙</span>
              <span className="gift-chip">♞ Pièces « Parrainage »</span>
              <span className="gift-chip">🏁 Plateau « Parrainage »</span>
            </div>
            <p className="muted small">Skins exclusifs, disponibles uniquement pendant l’événement de lancement.</p>
            <button className="btn primary big gift-claim" onClick={() => closeInvitePopup(true)}>
              Créer mon compte et recevoir mes cadeaux
            </button>
            <button className="link-btn small muted center" onClick={() => closeInvitePopup(false)}>
              Plus tard (l’invitation reste valable)
            </button>
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
              >
                ▶ Commencer « {firstLesson.title} »
              </button>
              <button className="btn ghost" onClick={() => setTour(null)}>
                J’explore seul
              </button>
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
          <Modal title={eventGift.claimed ? '✅ Récompense récupérée' : '🎁 Récompense de parrainage'} onClose={() => setEventGift(null)}>
            <div className="onboard event-gift">
              {eventGift.rewards.map((r) => (
                <p key={r.id}>{r.reason}</p>
              ))}
              <div className="gift-items">
                {coins > 0 && <span className="gift-chip coins">+{coins} 🪙</span>}
                {items.map((id) => (
                  <span key={id} className="gift-chip">
                    {itemById(id)?.type === 'board' ? '🏁 Plateau' : '♞ Pièces'} « {itemById(id)?.name ?? id} »
                  </span>
                ))}
              </div>
              {!eventGift.claimed ? (
                <button className="btn primary big gift-claim" onClick={claimGift}>
                  🎁 Récupérer
                </button>
              ) : (
                <>
                  <p className="muted small">{items.length ? 'Tes skins exclusifs sont dans la Boutique, prêts à être équipés.' : 'Les pièces sont dans ton porte-monnaie.'}</p>
                  <div className="row">
                    {items.length > 0 && (
                      <button
                        className="btn primary"
                        onClick={() => {
                          setEventGift(null);
                          setMode('shop');
                        }}
                      >
                        🛒 Équiper mes skins
                      </button>
                    )}
                    <button
                      className="btn"
                      onClick={() => {
                        setEventGift(null);
                        setMode('events');
                      }}
                    >
                      🎉 Inviter d’autres amis
                    </button>
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
            🎁 <b>{inviter}</b> t’invite sur BetterMove ! Crée ton compte pour recevoir <b>100 🪙</b> et <b>2 skins exclusifs</b>.
          </span>
          <button
            className="btn primary"
            onClick={() => {
              setAccountMode('register');
              setAccountOpen(true);
            }}
          >
            Créer mon compte
          </button>
          <button
            className="icon-btn"
            aria-label="Plus tard"
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
        <div className="remote-banner">
          Nouvelles données depuis un autre appareil.
          <button className="btn primary" onClick={() => window.location.reload()}>
            Recharger
          </button>
          <button className="icon-btn" onClick={() => setRemoteChanged(false)} aria-label="Fermer">
            ×
          </button>
        </div>
      )}
      {settingsOpen && (
        <SettingsModal
          onClose={() => setSettingsOpen(false)}
          onResetRating={() => {
            player.resetRating();
            setToast('Classement réinitialisé');
          }}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
