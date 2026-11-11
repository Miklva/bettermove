-- Schema BetterMove (idempotent : rejoue a chaque demarrage)
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Donnees de l'app (profil, succes, reglages...) : une ligne par cle du localStorage
CREATE TABLE IF NOT EXISTS user_data (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key        TEXT NOT NULL,
  value      JSONB NOT NULL,
  updated_at BIGINT NOT NULL,
  PRIMARY KEY (user_id, key)
);

-- Parties : une ligne par partie, pour garder tout l'historique
CREATE TABLE IF NOT EXISTS games (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id         TEXT NOT NULL,
  data       JSONB NOT NULL,
  source     TEXT,
  result     TEXT,
  played_at  TIMESTAMPTZ,
  deleted    BOOLEAN NOT NULL DEFAULT false,
  updated_at BIGINT NOT NULL,
  PRIMARY KEY (user_id, id)
);
CREATE INDEX IF NOT EXISTS games_user_played ON games (user_id, played_at DESC);

-- Communaute : messages du salon general
CREATE TABLE IF NOT EXISTS chat_messages (
  id         BIGSERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  username   TEXT NOT NULL,
  text       TEXT NOT NULL,
  censored   BOOLEAN NOT NULL DEFAULT false,
  deleted    BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chat_messages_created ON chat_messages (created_at DESC);
-- Un salon par langue (les anciens messages restent dans le salon francais)
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS room TEXT NOT NULL DEFAULT 'fr';
CREATE INDEX IF NOT EXISTS chat_messages_room ON chat_messages (room, id);

-- Support : copie de chaque demande (meme si l'envoi du mail echoue)
CREATE TABLE IF NOT EXISTS support_messages (
  id         BIGSERIAL PRIMARY KEY,
  user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  name       TEXT,
  email      TEXT,
  category   TEXT,
  subject    TEXT NOT NULL,
  message    TEXT NOT NULL,
  context    JSONB,
  mailed     BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Langue du joueur (fr par defaut) : la reponse du support part dans cette langue
ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS lang TEXT;

-- Social : presence, amis, sourdines, messages prives, defis et parties en ligne
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS friendships (
  requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  addressee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'pending',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (requester_id, addressee_id)
);

CREATE TABLE IF NOT EXISTS mutes (
  user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  muted_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, muted_id)
);

CREATE TABLE IF NOT EXISTS direct_messages (
  id         BIGSERIAL PRIMARY KEY,
  from_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text       TEXT NOT NULL,
  censored   BOOLEAN NOT NULL DEFAULT false,
  read_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dm_pair ON direct_messages (LEAST(from_id, to_id), GREATEST(from_id, to_id), id);

CREATE TABLE IF NOT EXISTS online_games (
  id              BIGSERIAL PRIMARY KEY,
  white_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  black_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  initial_ms      INTEGER,
  increment_ms    INTEGER NOT NULL DEFAULT 0,
  moves           TEXT NOT NULL DEFAULT '',
  white_ms        INTEGER,
  black_ms        INTEGER,
  turn_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status          TEXT NOT NULL DEFAULT 'active',
  result          TEXT,
  reason          TEXT,
  draw_offer      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS challenges (
  id           BIGSERIAL PRIMARY KEY,
  from_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  initial_ms   INTEGER,
  increment_ms INTEGER NOT NULL DEFAULT 0,
  color        TEXT NOT NULL DEFAULT 'random',
  status       TEXT NOT NULL DEFAULT 'pending',
  game_id      BIGINT REFERENCES online_games(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Probleme du jour : un resultat par joueur et par jour
CREATE TABLE IF NOT EXISTS daily_results (
  day        TEXT NOT NULL,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  puzzle_id  TEXT,
  solved     BOOLEAN NOT NULL,
  first_try  BOOLEAN NOT NULL,
  seconds    INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (day, user_id)
);

-- Photo de profil (data URL JPEG/PNG/WebP, 256 px) et date de mise a jour
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_at BIGINT;

-- Puzzle Rush : un score par partie terminee
CREATE TABLE IF NOT EXISTS rush_scores (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mode       TEXT NOT NULL,
  score      INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rush_mode_score ON rush_scores (mode, score DESC);

-- Elo en ligne (parties "Contre le monde" entre vrais joueurs)
ALTER TABLE users ADD COLUMN IF NOT EXISTS online_rating REAL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS online_games INTEGER NOT NULL DEFAULT 0;
ALTER TABLE online_games ADD COLUMN IF NOT EXISTS rated BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE online_games ADD COLUMN IF NOT EXISTS white_rating INTEGER;
ALTER TABLE online_games ADD COLUMN IF NOT EXISTS black_rating INTEGER;
ALTER TABLE online_games ADD COLUMN IF NOT EXISTS white_delta INTEGER;
ALTER TABLE online_games ADD COLUMN IF NOT EXISTS black_delta INTEGER;

-- Probleme du jour : fautes, indices et chrono mesures par le serveur (classement du jour)
ALTER TABLE daily_results ADD COLUMN IF NOT EXISTS mistakes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE daily_results ADD COLUMN IF NOT EXISTS hints INTEGER NOT NULL DEFAULT 0;
ALTER TABLE daily_results ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE daily_results ADD COLUMN IF NOT EXISTS done BOOLEAN NOT NULL DEFAULT true;

-- Chat prive d'une partie en ligne "Contre le monde" (les amis ont deja les messages prives)
CREATE TABLE IF NOT EXISTS game_messages (
  id         BIGSERIAL PRIMARY KEY,
  game_id    BIGINT NOT NULL REFERENCES online_games(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text       TEXT NOT NULL,
  censored   BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS game_messages_game ON game_messages (game_id, id);

-- Revanche en fin de partie en ligne : les deux joueurs doivent accepter
ALTER TABLE online_games ADD COLUMN IF NOT EXISTS rematch_w BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE online_games ADD COLUMN IF NOT EXISTS rematch_b BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE online_games ADD COLUMN IF NOT EXISTS rematch_declined TEXT;
ALTER TABLE online_games ADD COLUMN IF NOT EXISTS rematch_game_id BIGINT;
-- Moment de la derniere proposition de revanche (la pop-up chez l'adversaire expire apres 2 minutes)
ALTER TABLE online_games ADD COLUMN IF NOT EXISTS rematch_at TIMESTAMPTZ;

-- Elo en jeu de chaque joueur, calcule au debut d'une partie classee
ALTER TABLE online_games ADD COLUMN IF NOT EXISTS stakes JSONB;

-- Securite : version de session (changer le mot de passe ou supprimer le compte deconnecte partout)
ALTER TABLE users ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 0;
-- Pseudos uniques sans tenir compte de la casse (ignore si des doublons existent deja)
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower ON users (lower(username));
EXCEPTION WHEN unique_violation THEN
  RAISE NOTICE 'Pseudos en double (casse) : index users_username_lower non cree';
END $$;
-- RGPD : les demandes au support sont effacees apres 2 ans (voir la politique de confidentialite)
DELETE FROM support_messages WHERE created_at < now() - interval '2 years';
-- Support : demande traitee (page Admin)
ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS handled BOOLEAN NOT NULL DEFAULT false;
-- RGPD : un compte inactif depuis 3 ans est supprime (annonce dans la politique de confidentialite)
DELETE FROM users WHERE COALESCE(last_seen, created_at) < now() - interval '3 years';

-- Evenements : reglages globaux (date de debut de l'evenement de lancement...)
CREATE TABLE IF NOT EXISTS app_meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
-- Lancement : 30 jours a partir du premier demarrage (modifiable par LAUNCH_EVENT_START)
INSERT INTO app_meta (key, value) VALUES ('launch_start', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
  ON CONFLICT (key) DO NOTHING;

-- Parrainage : qui a invite qui (un filleul n'a qu'un parrain)
CREATE TABLE IF NOT EXISTS referrals (
  referee_id  INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  referrer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event       TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS referrals_referrer ON referrals (referrer_id);

-- Recompenses donnees par le serveur (evenements) : recuperees par l'app du joueur
CREATE TABLE IF NOT EXISTS pending_rewards (
  id         BIGSERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  coins      INTEGER NOT NULL DEFAULT 0,
  items      JSONB NOT NULL DEFAULT '[]',
  reason     TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  claimed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS pending_rewards_user ON pending_rewards (user_id) WHERE claimed_at IS NULL;
-- Parrainage : code d'invitation personnel (aleatoire, non devinable), cree a la premiere demande
ALTER TABLE users ADD COLUMN IF NOT EXISTS invite_code TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS users_invite_code ON users (invite_code);

-- Adresse e-mail (facultative) : uniquement pour recuperer le compte. Jamais affichee aux autres joueurs.
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS users_email_lower ON users (lower(email)) WHERE email IS NOT NULL;
-- Liens envoyes par mail (confirmation d'adresse, mot de passe oublie) : seul le hachage du jeton est garde
CREATE TABLE IF NOT EXISTS auth_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL,
  email      TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS auth_tokens_user ON auth_tokens (user_id, kind);
DELETE FROM auth_tokens WHERE expires_at < now() - interval '1 day';

-- Support : reponses envoyees au joueur depuis la page Admin (mail BetterMove)
CREATE TABLE IF NOT EXISTS support_replies (
  id         BIGSERIAL PRIMARY KEY,
  support_id BIGINT NOT NULL REFERENCES support_messages(id) ON DELETE CASCADE,
  author     TEXT NOT NULL,
  message    TEXT NOT NULL,
  mailed     BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS support_replies_support ON support_replies (support_id);

-- Mesure d'audience anonyme : visiteurs uniques par jour (empreinte hachee avec un sel quotidien oublie)
CREATE TABLE IF NOT EXISTS visits (
  day     DATE NOT NULL,
  visitor TEXT NOT NULL,
  logged  BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (day, visitor)
);
DELETE FROM visits WHERE day < current_date - 395;

-- Audience (toujours anonyme) : pages vues, type d'appareil, navigateur, systeme, langue, site d'origine et page d'entree.
-- Rattache a l'empreinte du jour (sel oublie le lendemain) : aucun suivi d'un jour a l'autre.
ALTER TABLE visits ADD COLUMN IF NOT EXISTS hits INTEGER;
ALTER TABLE visits ADD COLUMN IF NOT EXISTS first_path TEXT;
ALTER TABLE visits ADD COLUMN IF NOT EXISTS referrer TEXT;
ALTER TABLE visits ADD COLUMN IF NOT EXISTS lang TEXT;
ALTER TABLE visits ADD COLUMN IF NOT EXISTS device TEXT;
ALTER TABLE visits ADD COLUMN IF NOT EXISTS browser TEXT;
ALTER TABLE visits ADD COLUMN IF NOT EXISTS os TEXT;
ALTER TABLE visits ADD COLUMN IF NOT EXISTS first_at TIMESTAMPTZ;
ALTER TABLE visits ADD COLUMN IF NOT EXISTS last_at TIMESTAMPTZ;
CREATE TABLE IF NOT EXISTS visit_pages (
  day     DATE NOT NULL,
  visitor TEXT NOT NULL,
  path    TEXT NOT NULL,
  n       INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (day, visitor, path)
);
DELETE FROM visit_pages WHERE day < current_date - 395;

-- Discussions sous les problemes : questions (parent_id NULL) et reponses
CREATE TABLE IF NOT EXISTS puzzle_comments (
  id          BIGSERIAL PRIMARY KEY,
  puzzle_id   TEXT NOT NULL,
  puzzle_ref  TEXT,
  parent_id   BIGINT REFERENCES puzzle_comments(id) ON DELETE CASCADE,
  user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  username    TEXT NOT NULL,
  text        TEXT NOT NULL,
  censored    BOOLEAN NOT NULL DEFAULT false,
  deleted     BOOLEAN NOT NULL DEFAULT false,
  -- Reponse lue par l'auteur de la question (pop-up deja montree)
  asker_read  BOOLEAN NOT NULL DEFAULT false,
  -- Vu dans le panneau admin
  admin_seen  BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS puzzle_comments_puzzle ON puzzle_comments (puzzle_id);
CREATE INDEX IF NOT EXISTS puzzle_comments_parent ON puzzle_comments (parent_id);
