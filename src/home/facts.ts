// Anecdotes et conseils affiches sur l'accueil (un de chaque par jour, le meme pour tout le monde).

export const FACTS: string[] = [
  'L’expression « échec et mat » vient du persan « shāh māt », souvent traduit par « le roi est mort ».',
  'Le nombre de parties d’échecs possibles est estimé à environ 10^120 (le « nombre de Shannon »), bien plus que le nombre d’atomes de l’univers observable (environ 10^80).',
  'Au premier coup, les Blancs ont 20 choix : 16 coups de pion et 4 coups de cavalier. Après un coup de chaque camp, il existe déjà 400 positions possibles.',
  'Il y a des siècles, la dame était l’une des pièces les plus faibles : elle n’avançait que d’une case en diagonale. Elle est devenue la plus puissante à la fin du XVe siècle.',
  'Le mat le plus rapide possible se joue en deux coups : 1.f3 e5 2.g4 Dh4#. On l’appelle le « mat du fou »… en pensant aux Blancs.',
  'Le système de classement Elo porte le nom de son inventeur, Arpad Elo, un professeur de physique hongro-américain.',
  'Le record du classement Elo est détenu par Magnus Carlsen : 2882 points, atteint en 2014.',
  'En 1997, l’ordinateur Deep Blue d’IBM a battu le champion du monde Garry Kasparov dans un match en six parties.',
  'La FIDE, la Fédération internationale des échecs, a été fondée à Paris en 1924.',
  'Le premier match Karpov-Kasparov pour le titre mondial (1984-1985) a été arrêté après 48 parties, sans vainqueur.',
  'L’incrément de temps (quelques secondes ajoutées à chaque coup) a été inventé par Bobby Fischer. On parle encore de « cadence Fischer ».',
  'Bobby Fischer a aussi imaginé le Chess960 : la position de départ des pièces est tirée au sort parmi 960 possibilités.',
  'Le design classique des pièces de tournoi s’appelle « Staunton », du nom du champion anglais Howard Staunton. Il date de 1849.',
  'Le mot « gambit » vient de l’italien « gambetto », le croc-en-jambe : on offre du matériel pour faire trébucher l’adversaire.',
  '« Zugzwang » est un mot allemand : la situation où tout coup empire ta position, alors que tu aimerais passer ton tour.',
  'La Défense scandinave (1.e4 d5) est l’une des plus anciennes ouvertures connues : on la trouve déjà dans un poème catalan de la fin du XVe siècle.',
  'Un cavalier a besoin de 6 coups pour aller du coin a1 au coin opposé h8.',
  'Le roque est le seul coup où deux pièces bougent en même temps : le roi et une tour.',
  'En 2021, Abhimanyu Mishra est devenu grand maître à 12 ans et 4 mois, un record de précocité.',
  'Le fou s’appelle « alfil » en espagnol, un mot qui vient de l’arabe « al-fil » : l’éléphant. Dans les échecs anciens, cette pièce était un éléphant.',
  'Le cavalier est la seule pièce qui peut sauter par-dessus les autres. Il change de couleur de case à chaque coup.',
  'En partie lente, un joueur a le droit de réclamer la nulle après 50 coups de chaque camp sans prise ni mouvement de pion.',
  'La position se répète trois fois ? Le joueur au trait peut réclamer la nulle : c’est la triple répétition.',
  'Avec un roi et un cavalier seuls, ou un roi et un fou seuls, il est impossible de mater : la partie est nulle par matériel insuffisant.',
];

export const TIPS: string[] = [
  'Avant chaque coup, demande-toi : que menace l’adversaire avec son dernier coup ?',
  'Un cavalier au bord de l’échiquier contrôle deux fois moins de cases qu’au centre. « Cavalier au bord, cavalier mort. »',
  'Dans l’ouverture, développe tes cavaliers et tes fous avant de sortir la dame.',
  'Roque tôt : ton roi est à l’abri et ta tour entre dans le jeu.',
  'Cherche toujours les coups forcés d’abord : échecs, prises, menaces.',
  'Une tour est faite pour les colonnes ouvertes, où aucun pion ne la bloque.',
  'En finale, ton roi devient une pièce d’attaque : amène-le au centre.',
  'Quand tu as l’avantage matériel, échange les pièces, pas les pions.',
  'Un pion passé doit avancer. Soutiens-le, et place ta tour derrière lui.',
  'Pas d’idée ? Améliore ta pièce la moins active.',
  'Une pièce non défendue est une cible : vérifie lesquelles des tiennes le sont.',
  'Deux pièces adverses alignées ? Il y a peut-être un clouage ou une enfilade à trouver.',
  'Gère ton temps : joue vite les coups évidents pour garder des minutes pour les positions critiques.',
  'Après une défaite, analyse la partie : c’est là qu’on progresse le plus.',
  'Ne joue pas un coup parce qu’il « menace quelque chose ». Vérifie d’abord qu’il ne laisse rien en prise.',
];

/** Index stable pour la journee */
export function pickForDay<T>(list: T[], day: string, salt = 0): T {
  let h = salt;
  for (const ch of day) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return list[h % list.length];
}
