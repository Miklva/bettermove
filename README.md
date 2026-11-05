# BetterMove

App web pour progresser aux echecs : parties, bots, problemes, cours et review, le tout en mode jeu (XP, skins, sons).

## Lancer le projet

```bash
npm install
npm run dev
```

Puis ouvrir http://localhost:5173

Build de production : `npm run build` (resultat dans `dist/`).

## Etat actuel

- Accueil (clic sur le logo, page d'ouverture) : salutation, probleme du jour identique pour tous (difficulte croissante du lundi au dimanche, serie de jours, +10 pieces et +15 XP du premier coup, statistiques communes via le serveur), reprise rapide (bot, lecon, suivi, communaute), anecdote et conseil du jour.
- Onglet Historique : toutes les parties (bots, 1v1, importees chess.com / Lichess / PGN) avec filtres et recherche, et une page Statistiques (resultats, Elo moyen des adversaires, plus fort adversaire battu, series, ouvertures, cadences, courbe Elo). Un clic sur une partie ouvre la review.
- Accueil : a la premiere visite, choix du niveau (aucune connaissance, debutant, intermediaire, avance) qui fixe l Elo de depart (bots et problemes). Parcours d initiation (11 lecons : plateau, deplacement de chaque piece avec defis "ramasse les pions", echec/mat/pat, roque, prise en passant, valeur des pieces, bien commencer). Tutoriel, visite de l app et changement de niveau depuis le compte (bouton 👤).
- Boutique : pieces (monnaie) gagnees avec les parties contre les bots, les cours (par etoile), les succes (bronze 10, argent 25, or 60), le suivi (positions maitrisees, seances, avec XP) et les problemes. A depenser en skins de pieces, plateaux premium et packs de sons (prise selon la valeur de la piece prise, sons de review pour gaffes et beaux coups).
- Onglet Suivi : Stockfish relit les N dernieres parties (bots et imports), classe les erreurs recurrentes (pieces en prise, menaces ignorees, tactiques et mats manques, roi en danger, ouverture, finale, avantage gache, temps), mesure leur evolution (recent vs avant), donne des conseils, des exercices tires des propres positions du joueur, et un champ de notes libre.
- Review personnalisee : apres chaque analyse (bot, import, 1v1 si un camp est choisi), un bilan relie les erreurs de la partie aux points faibles du suivi, liste les tactiques manquees et subies, et propose exercices, problemes et lecons (dont celles de l ouverture jouee). A l import d un PGN on demande qui est le joueur (ou spectateur).
- Mode Review : analyse d'une partie par Stockfish (parties jouees dans l'app, PGN colle,
  import chess.com ou Lichess par pseudo). Chaque coup est classe (theorique, brillant, tres bon,
  meilleur, excellent, bon, imprecision, erreur, occasion manquee, gaffe) et explique.
  Fleche verte = meilleur coup, fleche rouge = menace adverse. Barre et graphe d'evaluation,
  precision, moments cles, navigation au clavier, sons. Les erreurs deviennent des exercices
  ("S'entrainer sur mes erreurs", et source "Mes erreurs" dans le mode Problemes).
  Livre d'ouvertures : public/data/openings.json (lichess-org/chess-openings, CC0).

- Mode Cours : 6 chapitres (tactiques, mats, finales, reflexes d ouverture, ouvertures Blancs, ouvertures Noirs), 27 lecons de base + 30 d approfondissement debloquees avec 3 etoiles sur chaque lecon du chapitre.
- Onglet Succes : 274 succes (victoires, mats, defaites, nulles, ouvertures, problemes et Rush, cours et repertoire, review, progression, bots, en ligne, social, boutique et style, insolite), bronze/argent/or avec XP, titres a jeux de mots, dont des succes secrets. Calcules depuis un journal des parties (src/achievements/facts.ts, parties en ligne incluses) et des compteurs d actions (src/achievements/events.ts : messages, achats, plein ecran, premoves...).
  Chaque lecon enchaine theorie illustree, quiz, exercices guides et entrainement a ton niveau,
  ou des defis contre Stockfish (mat roi + dame, roi + tour, regle du carre, opposition).
  Etoiles par lecon, XP et niveaux (gagnes aussi en problemes et contre les bots).
  Contenu dans src/lessons/courses.ts, advanced.ts (approfondissements) et openings.ts (repertoires).

- Mode Problemes : problemes Lichess classes par Elo (Glicko-2), bonus de rapidite, serie,
  indice, solution animee. Chaque coup est explique : pourquoi le bon coup marche (fourchette,
  clouage, enfilade, decouverte, sacrifice, mat du couloir...) et pourquoi un mauvais coup echoue
  (refutation de Stockfish, piece en prise, mat rate, evaluation avant/apres).
  24 595 problemes fournis, avec themes calcules (fourchette, clouage, mat du couloir...). Pour la base complete (6 millions, avec themes) :
  telecharger https://database.lichess.org/lichess_db_puzzle.csv.zst puis
  `npm run puzzles:import -- chemin/vers/lichess_db_puzzle.csv.zst`
  (option `--max-per-band 20000` pour une version plus legere).

- Mode Bots : 11 bots de 400 a 2700 Elo (Stockfish 19 dans le navigateur), choix de coups
  "humain" selon le niveau, temps de reflexion realiste, le bot abandonne quand c'est perdu
  et accepte ou refuse la nulle. Ton Elo (Glicko-2) debloque les bots plus forts.

- Plateau responsive (glisser-deposer ou clic, coups legaux, fleches au clic droit)
- Mode 1v1 local : pendules avec increment, pause, promotion, annulation de coup,
  nulle, abandon, detection de fin de partie (mat, pat, repetition, 50 coups,
  materiel insuffisant, temps), historique navigable, copie du PGN
- Partie sauvegardee automatiquement (reprise en pause apres rechargement)
- Parametres : mode clair / sombre / systeme, themes de plateau, coordonnees, coups possibles,
  animation, coups en avance (premoves) contre les bots, promotion auto en dame,
  confirmation d'abandon, son et volume, reinitialisation de l'Elo

- Revisions (Problemes > Revisions) : repetition espacee des positions ratees (erreurs des parties analysees,
  problemes rates, Puzzle Rush). Retour a J+1, J+3, J+7, J+14, J+30, puis memorisee.
- Puzzle Rush (Apprendre > Puzzle Rush) : 3 min, 5 min ou Survie, 3 erreurs max, difficulte croissante.
  Records locaux et classement serveur (`/api/rush`, table `rush_scores`).
- Repertoire d'ouvertures (Apprendre > Repertoire) : 16 ouvertures (`src/repertoire/lines.ts`), lignes perso,
  entrainement coup par coup avec repetition espacee par ligne, et dans l'Historique une carte qui indique
  ou tu es sorti de ta preparation.
- Contre le monde (Jouer > Contre le monde) : file d'attente par cadence (`/api/match`, en memoire),
  appariement au plus proche en Elo en ligne. Au bout de 30 s sans adversaire, le joueur choisit : bot de son
  niveau ou continuer a attendre (question reposee chaque minute).
- Une seule partie en ligne a la fois (file d'attente et defis refuses sinon). En revenant sur la page,
  la partie en cours s'ouvre. Une partie sans premier coup pendant 2 minutes est annulee automatiquement.
- Elo en ligne (`server/src/rating.js`) : parties "Contre le monde" uniquement (les defis entre amis restent
  amicaux). Elo classique, K = 40 sur les 10 premieres parties, puis 24, puis 16. Depart = Elo bots.
- Classement public (Communaute > Classement) : Elo en ligne, Elo bots, Elo problemes, Rush 3 min / 5 min / Survie, XP
  (`/api/leaderboard`).
- Administration (icone outils, visible des pseudos listes dans `ADMIN_USERS` du `.env`) : en ligne,
  comptes, joueurs actifs, parties par jour, Elo moyens, activite (`/api/admin/stats`).
- Astuces (Progresser > Astuces) : bibliotheque de rappels (`src/tips/library.ts`) relies aux familles
  d'erreurs du Suivi. Rappels "Pour toi" selon les erreurs recentes, reflexes marques acquis puis oublies,
  rappel du jour, astuces perso (ajout, modification, epinglage), synchronisees avec le compte.
- Fenetre de bienvenue a la premiere visite (but de l'app, projet communautaire, retours des joueurs), puis
  choix du niveau. Accessible ensuite par le menu Aide (Le projet BetterMove).
- Classement du probleme du jour (accueil et Communaute > Classement, avec hier et avant-hier) : resolu,
  puis le moins de fautes (un indice compte comme une faute), puis le temps. Chrono et fautes tenus par le
  serveur (`/api/daily/:day/start`, `/event`, fin) : recharger la page ne remet rien a zero.
- Page profil (Compte > Voir mon profil, ou clic sur un joueur dans la Communaute, le Classement, l'admin) :
  niveau et XP, Elo en ligne / bots / problemes avec rang et courbe, bots battus, Rush, probleme du jour,
  cours, succes, parties (V/N/D, par couleur, forme, sources), ouvertures, repertoire, parties en ligne
  (`/api/profile/:pseudo`). Sans compte, le profil est construit depuis le navigateur.
- Boutique : 42 collections de pieces (filtres CSS, dont 2 animees), 26 plateaux premium (dont 11 textures :
  bois, marbre, pierre, feutre, etoiles, neon, or), 14 packs de sons (packs synthetises decrits par
  quelques parametres dans `src/lib/sounds.ts`). Filtres Possedes / A debloquer et tri par prix.
- Jouer contre le professeur (Apprendre) : Blancs, Noirs ou les deux a tour de role, 4 niveaux. Apres chaque
  coup, Stockfish le classe (meilleur, imprecision, erreur, gaffe...) et l'explique ; fleches (coup rate,
  meilleur coup, reponse dangereuse, menace), cercles (pieces en danger, cibles), barre d'avantage.
  Indice en deux temps, reprise de coup, analyse de la partie a la fin. Barre et fleches desactivables.
  Anti-triche : mode indisponible tant qu'une partie est en cours (bot, 1v1 sur ecran, en ligne), `src/teacher/guard.ts`.
- Chat de partie : en ligne "Contre le monde" (pas entre amis, qui ont deja les messages prives), mots
  interdits masques, adversaire en sourdine ignore (`/api/online/:id/chat`). Contre les bots : chaque bot
  repond avec son caractere selon l'intention du message et la situation (`src/bots/chat.ts`), et reagit
  quand une dame tombe et a la fin de la partie.
- Fin de partie en ligne : "Rejouer" (revanche, couleurs inversees, meme cadence, les deux doivent accepter ;
  `POST /api/online/:id/rematch` et `/rematch/decline`) et "Nouvelle partie" (relance la recherche Contre le monde
  a la meme cadence).
- Proposition de revanche : l adversaire recoit une pop-up Accepter / Refuser, sur la page de la partie ou
  n importe ou dans l app (via `/api/social/notifications`, `rematchOffers`, valable 2 minutes).
- Parametre "Skins animes" (on par defaut) et "Frequence des animations" (Fluide 60 i/s, Equilibree ~20, Economie ~8). Dans la boutique,
  un skin ne s anime qu au survol de sa carte (sinon des centaines de pieces animees font ramer la page).
- Liens directs (`src/router.ts`, History API, nginx renvoie index.html) : `/jouer/bot/<bot>`, `/jouer/monde`,
  `/jouer/local`, `/partie/<id>`, `/apprendre/cours/<lecon>`, `/apprendre/professeur`, `/apprendre/problemes/<probleme>`
  ou `/revisions`, `/apprendre/rush/<3-min|5-min|survie>`, `/apprendre/repertoire/<blancs|noirs>`,
  `/progresser/historique/<partie>`, `/progresser/suivi`, `/progresser/astuces/<categorie>`, `/progresser/succes/<categorie>`,
  `/communaute/salon`, `/communaute/messages/<pseudo>`, `/communaute/classement/<tableau>`, `/boutique/<pieces|plateaux|sons>`,
  `/profil`, `/profil/<pseudo>`, `/aide`, `/admin`. Adresse inconnue : accueil.
- Recompenses de niveau (`/progresser/niveaux`, clic sur le badge Niv. du bandeau, `src/rewards/levels.ts`) : un cadeau
  par niveau jusqu'au 10, puis de plus en plus rares jusqu'au 100 (pieces, packs d'emojis, skins de pieces, plateaux et
  sons exclusifs qui ne s'achetent pas, succes aux paliers). Pastille sur le badge quand un cadeau attend.
  Paliers ajoutes (6, 11, 13, 17, 24, 27, 33, 38, 42, 48, 55, 65, 70, 80, 85, 90) : emojis Annotations / Tactiques /
  Annotations dorees / Eternite, plateaux Bronze, Argent, Platine (reflet anime), Rubis royal, Diamant (eclats animes),
  pieces Argent pur, Platine, Diamant (particules) ; niveau 100 "Mythique" : plateau et pieces Eternite (particules dorees).
- Emojis de chat (`src/emotes/emotes.tsx`) : packs en boutique (onglet Emojis) ou exclusifs de niveau, bouton 😀 dans le
  chat des parties ; envoyes sous la forme `:e:<id>:`, affiches en grand quand ils sont seuls ; les bots y reagissent.
- Profil : galerie de tous les bots (en couleur si battu, en noir et blanc sinon) ; chaque stat est cliquable et ouvre
  son detail (`/profil/stat/<stat>/<periode>`, `/profil/<pseudo>/stat/...`) : periode 1 jour a depuis le debut, chiffres,
  repartition sur 100 % et graphe (courbe d'Elo ou histogramme). Historique date : `timeline` de `/api/profile/:pseudo`.
- Boutique : bouton "Visualiser" au survol des skins de pieces et des plateaux, pour les essayer sur un vrai plateau jouable
  (`src/shop/SkinPreview.tsx`, positions depart / milieu / finale) sans les equiper.
- Remboursement d'un achat pendant 24 h (une seule fois par objet) : l'objet est retire et desequipe, les pieces rendues.
- Packs de sons : chaque pack a son propre coup simple, ses sons de victoire / defaite / nulle et de message envoye / recu
  (chat des parties), ecoutables un par un dans la boutique.
- Elo (`src/rating/elo.ts`, `server/src/rating.js`) : Elo simple partout. En ligne et en problemes, "?" = classement
  provisoire pendant 5 parties (K 80, 64, 48, 40, 32), puis K 16 (environ +/-8 contre un adversaire de meme niveau).
  Bots : jamais provisoire (K 16 des le depart). L'Elo en jeu (victoire / nulle / defaite) est affiche sur les bots, les
  problemes, la page Contre le monde et pendant une partie classee (`online_games.stakes`).
- Plein ecran dans les parties (bots, sur ecran, en ligne) : bouton "Plein ecran" (`src/components/FocusMode.tsx`), cache le
  bandeau, les onglets et l'interface du navigateur ; bouton "Quitter" ou Echap pour sortir.
- Chat des bots (`src/bots/chat.ts`) : une quarantaine de sujets reconnus (regles, ouvertures, blagues, gouts, triche,
  insultes, prenom...), reponses selon le caractere et le niveau du bot (fautes et style SMS pour les debutants, vrais
  conseils pour les forts), l'etat de la partie (phase, materiel, chances de gain), et les repetitions ou rafales.
  Le bot parle aussi tout seul sur les grands moments : gaffe, dame prise, echec, roque, promotion, finale.
  Frappe realiste (`typingPlan`) : lecture du message, vitesse de frappe propre a chaque bot, hesitations, longues
  reponses coupees en plusieurs bulles, reponses dans l'ordre sans couper un message en cours. Sujets en plus : calculs,
  explication du dernier coup, bonne chance, revanche, abandon, "echec !", gaffes, ecole, sport, films, jeux video...
- Jeu humain des bots (`src/engine/humanBot.ts`) : attention limitee au bas Elo (zone du dernier coup, coups en
  arriere et longs deplacements rates), biais par caractere (prises, echecs, dame sortie tot, roque, attaque, coups
  calmes, simplification, sacrifices), etat d'esprit (crispation apres une erreur, confiance, panique au temps, coups
  tordus quand perdu), difficulte de la position, gaffes "naturelles" et temps de reflexion selon l'emotion.
- Coups en avance multiples (`src/components/Board.tsx`) : file de premoves affichee sur le plateau, joues un par un
  des que c'est ton tour ; un coup devenu illegal annule toute la file ; clic droit pour annuler.
- Fin de partie : les skins du gagnant (plateau et pieces) envahissent le plateau rangee par rangee (1 par seconde) depuis son roi, les pieces touchees sont contaminees
  (`src/game/conquest.ts`). Bots : skin signature par bot ; en ligne : skins equipes de l'adversaire (`skins` dans la vue).
- Photo de profil (fenetre Compte) : initiales par defaut, ou photo importee (recadree en carre,
  256 px). Envoyee au serveur quand on est connecte : visible dans la Communaute et en partie en ligne
  (`/api/avatar/:pseudo`). Les bots ont chacun un portrait illustre en SVG (`src/bots/portraits.tsx`).

Raccourcis : fleches gauche/droite pour naviguer dans les coups, F pour retourner le plateau.

## Structure

```
src/
  bots/         galerie des bots (nom, Elo, style, repliques)
  achievements/ journal des parties et catalogue des succes
  lessons/      contenu des cours et etapes (theorie, quiz, problemes, defis)
  components/   Board (chessground), GameLayout, barres joueur, liste des coups, modales
  engine/       Stockfish (Web Worker), choix de coups humain, hook du bot
  game/         logique de partie (useGame), regles, cadences, types
  puzzles/      base de problemes, explications automatiques, themes
  rating/       Glicko-2, XP et profil joueur
  shop/         boutique : catalogue, porte-monnaie, bonus de depart
  coach/        suivi personnalise : analyse des erreurs recurrentes
  history/      historique des parties et statistiques
  review/       analyse de partie, classification, explications, imports, deck d'erreurs
  settings/     parametres de l'app (contexte React + fenetre)
  lib/          sons, stockage local
  pages/        une page par mode de jeu
  themes/       skins de plateau
```

## Briques utilisees

- chess.js : regles du jeu
- Stockfish.js 19 lite (public/stockfish, GPL-3.0)
- @lichess-org/chessground : plateau (GPL-3.0)
- Problemes : Lichess open database (CC0), selection de depart issue de FeXd/puzzle-chess
- Pieces cburnett (Colin M.L. Burnett, GPL-2.0-or-later / BSD / GFDL au choix), fournies par chessground
- Livre d'ouvertures : lichess-org/chess-openings (CC0)
- Sons : synthetises dans le navigateur (src/lib/sounds.ts), aucun fichier audio tiers

Licence de BetterMove : GPL-3.0-or-later (fichier LICENSE). Obligatoire car le site embarque chessground et
Stockfish (GPL) : le code source complet doit etre public (variable SOURCE_URL, page Infos > Licences).

## Economie : pieces et XP

- Parties en ligne (src/economy/rewards.ts) : classee 25 / 12 / 5 pieces (victoire / nulle / defaite) et 50 / 25 / 10 XP,
  amicale 10 / 6 / 3 et 25 / 15 / 5 XP (5 amicales recompensees par jour), +10 contre plus fort (100 Elo),
  +30 pieces +50 XP pour la 1re victoire du jour. 10 coups minimum. Une seule recompense par partie.
- Quetes du jour (src/economy/quests.ts, carte sur l'accueil) : 3 quetes tirees chaque jour (meme tirage pour un jour
  donne), 15 a 35 pieces et 30 a 70 XP chacune, +40 pieces +80 XP pour les 3. Defi de la semaine : 120 a 150 pieces.
  Progression : compteurs du jour et de la semaine (src/achievements/events.ts).
- Coffre du jour : 10, 15, 20, 25, 30, 40 puis 60 pieces selon la serie de jours d'affilee (XP = pieces x 2).
- Contre le professeur : 5 pieces 20 XP, 20 pieces 50 XP si gagnee (5 par jour). Review : 3 pieces 15 XP par partie
  analysee (10 par jour). 1v1 local : 10 XP pour 20 coups ou plus (5 par jour).

## Evenements (Communaute > Evenements)

Evenement de lancement (server/src/events.js) : 30 jours a partir de LAUNCH_EVENT_START (.env), sinon du premier
demarrage du serveur. Chaque joueur connecte a un lien /invite/<pseudo>. Un visiteur qui ouvre ce lien voit un bandeau ;
s'il cree son compte, les deux recoivent 100 pieces et les skins exclusifs Parrainage (pieces + plateau). Le parrain
gagne 100 pieces par ami (10 amis maximum), les skins des le premier. Les recompenses attendent dans la table
pending_rewards et l'app les recupere a la connexion (puis chaque minute) avec une fenetre "Cadeau d'evenement".
Classement des meilleurs parrains sur la page. Pour un nouvel evenement : l'ajouter dans events.js et EventsPage.tsx.

## Stockage des donnees et serveur

L'app fonctionne seule : tout est dans le localStorage du navigateur (cles bettermove.*).
Avec le serveur (Docker), chaque compte garde une copie durable dans PostgreSQL et on
retrouve sa progression sur n'importe quel navigateur (bouton 👤 en haut a droite).

Architecture :
  db   PostgreSQL 17 (volume pgdata : les donnees survivent aux redemarrages)
  api  Node + Express (server/) : comptes (mot de passe hache bcrypt, session cookie httpOnly)
       et synchronisation (tables users, user_data, games)
  web  nginx : sert le site construit et redirige /api vers l'API

Demarrage (Docker Desktop installe) :
  1. copier .env.example en .env et changer POSTGRES_PASSWORD et JWT_SECRET
  2. docker compose up -d --build
  3. ouvrir http://localhost:8080, creer un compte : la progression locale est envoyee

En developpement : docker compose up -d db api, puis npm run dev (Vite redirige /api vers le port 3001).
Sans serveur, l'app reste utilisable : le bouton 👤 indique "sauvegarde sur ce navigateur uniquement".

Ce qui est synchronise : profil (Elo, XP, lecons), parties, succes, reviews, deck d'erreurs, reglages.
Restent locaux : parties en cours, cache d'analyse Stockfish, onglet courant.
Les problemes (public/puzzles, monte en volume dans nginx) et le livre d'ouvertures sont des fichiers statiques.

Communaute (onglet Communaute) : salon commun, rafraichi toutes les 3 s. Mots interdits masques
(liste dans server/src/moderation.js + variable BANNED_WORDS), detection malgre accents, chiffres et separateurs ;
3 avertissements en 30 min = 10 min de sourdine ; pseudos contenant un mot interdit refuses.
Les moderateurs (ADMIN_USERS) peuvent supprimer n'importe quel message, chacun peut supprimer les siens.

Social (onglet Communaute, compte requis) : un clic sur un pseudo du salon ouvre un menu pour l'ajouter en ami,
lui envoyer un message prive, le defier (amis seulement) ou le mettre en sourdine (ses messages, MP et defis
sont masques). Panneau lateral : amis en ligne, demandes, defis recus et envoyes, parties en cours.
Les defis 1v1 se jouent en ligne : coups valides et pendules calculees par le serveur (server/src/online.js),
la partie terminee rejoint l'historique et peut etre analysee. Badge sur l'onglet pour les MP, demandes et defis.

Support (onglet Support) : chaque demande est enregistree (table support_messages) et se lit dans la page Admin
(marquer traitee, supprimer). Envoi par mail en plus si SUPPORT_TO et SMTP_* sont renseignes. Aucune adresse
mail n'apparait dans le site. Demandes effacees au bout de 2 ans.

Mot de passe oublie : chaque joueur peut lier une adresse e-mail (facultative) a son compte, a l'inscription
ou dans Compte > Mon adresse e-mail (mot de passe exige). L'adresse est confirmee par un lien (48 h). Ensuite
"Mot de passe oublie ?" envoie un lien a usage unique valable 1 h (/compte/reinitialiser/<jeton>), qui change
le mot de passe et deconnecte tous les appareils. Seul le hachage des jetons est stocke (table auth_tokens).
Necessite SMTP_* et SITE_URL dans .env ; en dev sans SMTP, les liens sont ecrits dans les logs de l'API.

Sauvegarde de la base :
  docker compose exec db pg_dump -U bettermove bettermove > sauvegarde.sql

## Mise en ligne (V1) : liste de controle

1. Code source public (obligation GPL) : creer un depot (GitHub, GitLab...) SANS le fichier .env ni public/puzzles
   (deja dans .gitignore), puis renseigner SOURCE_URL dans .env.
2. Hebergeur : VPS en Europe de preference (RGPD). Renseigner LEGAL_HOST_NAME / ADDRESS / PHONE dans .env
   (obligatoire, page Mentions legales). LEGAL_EDITOR vide = editeur anonyme (particulier non professionnel :
   donner son identite a l'hebergeur suffit). SITE_URL = adresse publique.
3. Secrets : JWT_SECRET de 32 caracteres minimum (openssl rand -hex 32), sinon l'API refuse de demarrer.
   POSTGRES_PASSWORD fort. Ne jamais publier .env.
4. HTTPS obligatoire : reverse proxy devant le port 8080 (Caddy le plus simple, certificat automatique) :
       bettermove.fr {
         reverse_proxy 127.0.0.1:8080
       }
   puis COOKIE_SECURE=true dans .env, et decommenter Strict-Transport-Security dans docker/security-headers.conf.
   Avec un proxy en plus de nginx (Caddy, Cloudflare...), mettre TRUST_PROXY=2 dans .env (vraie IP pour les limites).
5. Pare-feu : n'ouvrir que 80 et 443 (8080 et 3001 restent internes ; 3001 est deja limite a 127.0.0.1).
6. Administrateur : ADMIN_USERS=ton_pseudo, et creer ce compte tout de suite apres le premier demarrage
   (sinon quelqu'un d'autre pourrait prendre le pseudo avant toi).
7. Sauvegardes : pg_dump quotidien hors du serveur (crontab), par exemple
       0 4 * * * cd /chemin/bettermove && docker compose exec -T db pg_dump -U bettermove bettermove | gzip > /sauvegardes/bm-$(date +\%F).sql.gz
8. Problemes : lancer `npm run puzzles:import` sur le serveur (ou copier public/puzzles), monte en lecture seule dans nginx.
9. docker compose up -d --build, puis verifier : https://ton-site/api/health et les pages Infos (pied de page).

Securite deja en place : mots de passe bcrypt, cookie httpOnly + SameSite, sessions revoquees au changement de mot
de passe et a la suppression du compte, limites anti-abus (connexion, inscription, messages, support), en-tetes HTTP
(CSP, X-Frame-Options, nosniff, Permissions-Policy), requetes SQL parametrees, quotas de sauvegarde par compte,
journaux Docker en rotation. RGPD : export et suppression du compte dans 👤, effacement local, politique de
confidentialite, comptes inactifs depuis 3 ans supprimes automatiquement.

Limite connue : l'Elo bots, l'Elo problemes, l'XP, les pieces, les scores de Puzzle Rush et les resultats du probleme
du jour sont calcules dans le navigateur puis envoyes : un joueur bricoleur peut les falsifier (classements
concernes). Seul l'Elo en ligne est entierement calcule par le serveur (coups et pendules verifies).


## Mot de passe oublie

`docker compose exec api node src/reset-password.js <pseudo> <nouveau mot de passe>` (8 caracteres minimum).