import { useEffect, useMemo, useRef, useState } from 'react';
import { useGame, DEFAULT_SETTINGS } from '../game/useGame';
import type { Color, TimeControl } from '../game/types';
import { TIME_CONTROLS } from '../game/timeControls';
import { tReason } from '../game/rules';
import { GameLayout, copyText } from '../components/GameLayout';
import { BotPortrait } from '../bots/portraits';
import { BotChat } from '../bots/BotChat';
import { MyAvatar } from '../profile/avatar';
import { Modal } from '../components/Modal';
import { BOTS, getBot, isUnlocked, type Bot } from '../bots/roster';
import { useBotPlayer } from '../engine/useBotPlayer';
import { engine } from '../engine/stockfish';
import type { PlayerProfile } from '../rating/profile';
import { stakes } from '../rating/elo';
import { StakesTag } from '../components/StakesTag';
import type { ReviewRequest } from '../review/ImportPanel';
import { saveGame } from '../review/store';
import { recordGame } from '../achievements/facts';
import { earn } from '../shop/store';
import { EARN } from '../shop/items';
import { load, save } from '../lib/storage';
import { useSettings } from '../settings/settings';
import { useRouteSync } from '../router';
import { BOT_SKINS } from '../game/conquest';
import { track } from '../achievements/events';

import { t } from '../i18n';
interface Props {
  notify: (msg: string) => void;
  player: PlayerProfile;
  onReview: (r: ReviewRequest) => void;
}

const BOT_TCS = TIME_CONTROLS.filter((t) => ['3+2', '5+0', '10+0', '15+10', 'none'].includes(t.id));
const RECORDED_KEY = 'bettermove.recordedGames';
type ColorChoice = 'w' | 'random' | 'b';

// Lancement direct d'une partie (depuis "Contre le monde" quand personne n'est disponible)
let pendingStart: { botId: string; tcId: string } | null = null;
export function startBotNext(botId: string, tcId: string) {
  pendingStart = { botId, tcId };
}

interface Outcome {
  score: number;
  before: number;
  after: number;
  rated: boolean;
  newlyUnlocked: Bot[];
}

export function BotPage({ notify, player, onReview }: Props) {
  const { settings } = useSettings();
  const g = useGame('bettermove.botGame.v1');
  const bot = g.settings.bot ? getBot(g.settings.bot.id) : null;
  const playerColor: Color = g.settings.bot?.color === 'w' ? 'b' : 'w';
  const { thinking, error, offerDraw } = useBotPlayer(g, bot);
  const { profile, recordBotGame } = player;
  const rating = Math.round(profile.bots.rating);

  const [screen, setScreen] = useState<'select' | 'game'>(() =>
    g.hadSavedGame && g.settings.bot && !g.result ? 'game' : 'select',
  );
  // Premier passage : le bot debloque le plus proche de ton niveau (pas Pip a 400 pour un joueur a 1100)
  const [selected, setSelected] = useState<string>(() => {
    const last = load<string | null>('bettermove.lastBot', null);
    if (last) return last;
    const open = BOTS.filter((b) => isUnlocked(b, rating, profile.beaten) && b.rating <= rating + 100);
    return (open.length ? open[open.length - 1] : BOTS[0]).id;
  });
  // Lien direct vers un bot : /jouer/bot/<id> (ecran de choix seulement)
  useRouteSync(2, selected, setSelected, (id) => id, (s) => BOTS.find((b) => b.id === s)?.id, screen === 'select');
  const [tcState, setTc] = useState<TimeControl>(() => {
    const id = load('bettermove.botTc', '10+0');
    return BOT_TCS.find((t) => t.id === id) ?? BOT_TCS[2];
  });
  const tc = tcState;
  const [colorChoice, setColorChoice] = useState<ColorChoice>('random');
  const [dialog, setDialog] = useState<null | 'resign' | 'over'>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [botSays, setBotSays] = useState<string | null>(null);
  const unlockedBefore = useRef<string[]>([]);

  // Chargement du moteur des l'arrivee sur la page
  useEffect(() => {
    engine.init().catch(() => notify(t('Impossible de charger Stockfish')));
  }, [notify]);

  const startGame = (b: Bot, color: ColorChoice, tcOverride?: TimeControl) => {
    const tc = tcOverride ?? tcState;
    const pc: Color = color === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : color;
    const botColor: Color = pc === 'w' ? 'b' : 'w';
    const you = t('Toi');
    save('bettermove.lastBot', b.id);
    save('bettermove.botTc', tc.id);
    unlockedBefore.current = BOTS.filter((x) => isUnlocked(x, rating, profile.beaten)).map((x) => x.id);
    g.newGame({
      ...DEFAULT_SETTINGS,
      timeControl: tc,
      whiteName: pc === 'w' ? you : b.name,
      blackName: pc === 'b' ? you : b.name,
      autoFlip: false,
      bot: { id: b.id, color: botColor },
    });
    setOutcome(null);
    setDialog(null);
    setBotSays(b.hello);
    setScreen('game');
  };

  // Partie lancee depuis "Contre le monde"
  useEffect(() => {
    const p = pendingStart;
    if (!p) return;
    pendingStart = null;
    const b = getBot(p.botId);
    const tc = BOT_TCS.find((x) => x.id === p.tcId) ?? tcState;
    setSelected(b.id);
    setTc(tc);
    startGame(b, 'random', tc);
    notify(t('Personne de disponible : partie contre {name}', { name: b.name }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fin de partie : mise a jour de l'Elo (une seule fois par partie)
  useEffect(() => {
    if (!g.result || !bot || !g.settings.bot) return;
    const id = g.settings.gameId ?? '';
    const recorded = load<string[]>(RECORDED_KEY, []);
    const score = g.result.winner === null ? 0.5 : g.result.winner === playerColor ? 1 : 0;
    setBotSays(score === 1 ? bot.onLose : score === 0 ? bot.onWin : t('Partie nulle, bien joué.'));
    if (recorded.includes(id)) return;
    if (g.moves.length >= 2)
      saveGame({
        id,
        pgn: g.pgn(),
        white: g.settings.whiteName,
        black: g.settings.blackName,
        result: g.result.winner === 'w' ? '1-0' : g.result.winner === 'b' ? '0-1' : '1/2-1/2',
        date: new Date().toLocaleDateString('fr-FR'),
        source: 'bot',
        userColor: playerColor,
        playedAt: new Date().toISOString(),
        userRating: rating,
        oppRating: bot.rating,
        timeControl: g.settings.timeControl.label,
        reason: g.result.reason,
        moves: Math.ceil(g.moves.length / 2),
      });
    if (g.moves.length >= 2) {
      const timed = g.settings.timeControl.initial !== null;
      recordGame({
        id,
        source: 'bot',
        userColor: playerColor,
        moves: g.moves.map((m) => ({ ...m, after: m.fen, clockAfter: timed ? m.clockAfter : undefined })),
        winner: g.result.winner,
        reasonText: g.result.reason,
        botId: bot.id,
        botRating: bot.rating,
        userRating: rating,
      });
    }
    save(RECORDED_KEY, [id, ...recorded].slice(0, 300));
    // Moins de 2 coups joues : partie annulee, non classee
    if (g.moves.length < 2) {
      setOutcome({ score, before: rating, after: rating, rated: false, newlyUnlocked: [] });
    } else {
      const { before, after } = recordBotGame(bot, playerColor, score);
      // Quetes : parties et victoires du jour / de la semaine
      track('bot-game');
      if (score === 1) {
        track('bot-win');
        track('win-any');
      }
      // Pieces : victoire (bonus si le bot est mieux classe), nulle, ou un peu pour l'effort
      earn(
        score === 1 ? EARN.botWin + (bot.rating > before ? EARN.upsetBonus : 0) : score === 0.5 ? EARN.botDraw : EARN.botLoss,
        t(score === 1 ? 'Victoire contre {name}' : score === 0.5 ? 'Nulle contre {name}' : 'Partie contre {name}', { name: bot.name }),
      );
      const beaten = score === 1 ? [...profile.beaten, bot.id] : profile.beaten;
      const newlyUnlocked = BOTS.filter(
        (x) => isUnlocked(x, after, beaten) && !unlockedBefore.current.includes(x.id),
      );
      setOutcome({ score, before, after, rated: true, newlyUnlocked: unlockedBefore.current.length ? newlyUnlocked : [] });
    }
    setDialog('over');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [g.result]);

  if (screen === 'select' || !bot) {
    return (
      <BotSelect
        rating={rating}
        beaten={profile.beaten}
        selected={selected}
        onSelect={setSelected}
        tc={tc}
        onTc={setTc}
        colorChoice={colorChoice}
        onColor={setColorChoice}
        onPlay={() => startGame(getBot(selected), colorChoice)}
        canResume={!!g.settings.bot && !g.result && g.moves.length > 0}
        onResume={() => setScreen('game')}
      />
    );
  }

  const botColor: Color = playerColor === 'w' ? 'b' : 'w';
  const ratingTag = (r: number) => <span className="bar-rating">({r})</span>;
  const st = stakes(profile.bots.rating, bot.rating);

  const actions = !g.result ? (
    <>
      <button
        className="btn"
        disabled={g.moves.length < 2 || thinking}
        onClick={() => {
          if (offerDraw()) notify(t('{name} accepte la nulle', { name: bot.name }));
          else notify(t('{name} refuse la nulle', { name: bot.name }));
        }}
      >{t("½ Nulle")}</button>
      <button
        className="btn danger"
        onClick={() => (settings.confirmResign ? setDialog('resign') : g.resign(playerColor, 'Tu as abandonné'))}
      >{t("🏳 Abandon")}</button>
      {g.hasClock && (
        <button className="btn" onClick={() => {
          if (!g.paused) track('pause');
          g.togglePause();
        }}>
          {g.paused ? t("▶ Reprendre") : t("⏸ Pause")}
        </button>
      )}
    </>
  ) : (
    <>
      <button className="btn primary" onClick={() => startGame(bot, playerColor === 'w' ? 'b' : 'w')}>{t("Revanche")}</button>
      <button className="btn" onClick={() => setScreen('select')}>{t("Autre bot")}</button>
    </>
  );

  return (
    <GameLayout
      g={g}
      notify={notify}
      userColor={playerColor}
      baseOrientation={playerColor}
      modeLabel={t('Contre {name}', { name: bot.name })}
      statusText={
        g.result
          ? undefined
          : g.paused
            ? t("Partie en pause")
            : g.turn === playerColor
              ? t("À toi de jouer")
              : t('{name} réfléchit…', { name: bot.name })
      }
      avatars={{
        [botColor]: <BotPortrait id={bot.id} size={34} />,
        [playerColor]: <MyAvatar size={34} />,
      }}
      barExtras={{
        [botColor]: (
          <>
            {ratingTag(bot.rating)}
            {thinking && <span className="thinking" aria-label={t("réfléchit")}><i /><i /><i /></span>}
          </>
        ),
        [playerColor]: (
          <>
            {ratingTag(rating)}
            {!g.result && <StakesTag s={st} />}
          </>
        ),
      }}
      statusExtra={
        <>
          {botSays && (
            <div className="bot-says">
              <BotPortrait id={bot.id} size={40} />
              <p>{botSays}</p>
            </div>
          )}
          {error && <p className="error">{error}</p>}
        </>
      }
      actions={actions}
      skins={{ [botColor]: BOT_SKINS[bot.id] }}
      sideExtra={
        <BotChat
          bot={bot}
          botColor={botColor}
          gameId={g.settings.gameId ?? 'bot'}
          moves={g.moves}
          result={g.result}
          botDiff={g.material.diff[botColor]}
        />
      }
    >
      {dialog === 'resign' && (
        <Modal title={t("Abandonner la partie ?")} onClose={() => setDialog(null)}>
          <p className="muted">
            {g.moves.length < 2 ? t("La partie sera annulée sans effet sur ton Elo.") : t("La défaite comptera pour ton Elo.")}
          </p>
          <div className="row">
            <button className="btn" onClick={() => setDialog(null)}>{t("Continuer")}</button>
            <button
              className="btn danger"
              onClick={() => {
                g.resign(playerColor, 'Tu as abandonné');
              }}
            >{t("Abandonner")}</button>
          </div>
        </Modal>
      )}

      {dialog === 'over' && g.result && outcome && (
        <Modal
          title={!outcome.rated ? t("Partie annulée") : outcome.score === 1 ? t("Victoire !") : outcome.score === 0 ? t("Défaite") : t("Partie nulle")}
          onClose={() => setDialog(null)}
        >
          <div className="over-score">
            {g.result.winner === 'w' ? '1 - 0' : g.result.winner === 'b' ? '0 - 1' : '½ - ½'}
          </div>
          <p className="muted center">{tReason(g.result.reason)}</p>
          {outcome.rated && <RatingChange before={outcome.before} after={outcome.after} />}
          {outcome.newlyUnlocked.length > 0 && (
            <div className="unlock">
              <strong>{outcome.newlyUnlocked.length > 1 ? t('Nouveaux bots débloqués :') : t('Nouveau bot débloqué :')}</strong>{' '}
              {outcome.newlyUnlocked.map((b) => b.name).join(', ')}
            </div>
          )}
          <div className="row">
            <button className="btn primary" onClick={() => startGame(bot, playerColor === 'w' ? 'b' : 'w')}>{t("Revanche")}</button>
            <button className="btn" onClick={() => setScreen('select')}>{t("Autre bot")}</button>
          </div>
          <button
            className="btn wide review-cta"
            disabled={g.moves.length < 2}
            onClick={() => onReview({ id: g.settings.gameId ?? `bot-${Date.now()}`, pgn: g.pgn(), userColor: playerColor, source: 'bot' })}
          >{t("🔍 Analyser la partie avec Stockfish")}</button>
          <button className="btn ghost wide" onClick={() => copyText(g.pgn(), notify)}>{t("Copier le PGN")}</button>
        </Modal>
      )}
    </GameLayout>
  );
}

function RatingChange({ before, after }: { before: number; after: number }) {
  const diff = Math.round(after) - Math.round(before);
  return (
    <div className={`rating-change ${diff > 0 ? 'up' : diff < 0 ? 'down' : ''}`}>
      <span className="muted">{t("Elo")}</span>
      <strong>{Math.round(after)}</strong>
      <span className="delta">
        {diff > 0 ? '+' : ''}
        {diff}
      </span>
    </div>
  );
}

interface SelectProps {
  rating: number;
  beaten: string[];
  selected: string;
  onSelect: (id: string) => void;
  tc: TimeControl;
  onTc: (t: TimeControl) => void;
  colorChoice: ColorChoice;
  onColor: (c: ColorChoice) => void;
  onPlay: () => void;
  canResume: boolean;
  onResume: () => void;
}

function BotSelect(p: SelectProps) {
  const sel = getBot(p.selected);
  const selUnlocked = isUnlocked(sel, p.rating, p.beaten);
  const next = useMemo(() => BOTS.find((b) => !isUnlocked(b, p.rating, p.beaten)), [p.rating, p.beaten]);

  return (
    <div className="bot-select">
      <div className="bot-hero card">
        <div>
          <div className="tc-label">{t("Ton classement contre les bots")}</div>
          <div className="big-rating">
            {p.rating}
          </div>
          {next && (
            <p className="muted small">{t('Prochain bot : {name} à {elo} Elo, ou en battant {prev}.', { name: next.name, elo: next.rating - 250, prev: BOTS[BOTS.indexOf(next) - 1].name })}
            </p>
          )}
        </div>
        {p.canResume && (
          <button className="btn primary" onClick={p.onResume}>{t("Reprendre la partie en cours")}</button>
        )}
      </div>

      <div className="bot-grid">
        {BOTS.map((b) => {
          const unlocked = isUnlocked(b, p.rating, p.beaten);
          return (
            <button
              key={b.id}
              className={`bot-card ${p.selected === b.id ? 'selected' : ''} ${unlocked ? '' : 'locked'}`}
              onClick={() => p.onSelect(b.id)}
            >
              <span className="bot-avatar big">
                <BotPortrait id={b.id} size={64} />
                {!unlocked && <span className="bot-lock">🔒</span>}
              </span>
              <span className="bot-name">{b.name}</span>
              <span className="bot-elo">{b.rating}</span>
              {unlocked && <StakesTag s={stakes(p.rating, b.rating)} />}
              <span className="bot-style">{b.style}</span>
              {p.beaten.includes(b.id) && <span className="beaten" title={t("Déjà battu")}>✓</span>}
            </button>
          );
        })}
      </div>

      <div className="card bot-panel">
        <div className="bot-detail">
          <span className="bot-avatar big">
            <BotPortrait id={sel.id} size={84} />
          </span>
          <div>
            <strong>
              {sel.name} · {sel.rating}
            </strong>
            <p className="muted small">{sel.description}</p>
          </div>
        </div>
        {selUnlocked && (
          <>
            <span className="label">{t("Elo en jeu pour toi")}</span>
            <StakesTag s={stakes(p.rating, sel.rating)} full />
          </>
        )}

        <span className="label">{t("Cadence")}</span>
        <div className="chips">
          {BOT_TCS.map((t) => (
            <button key={t.id} className={`chip ${p.tc.id === t.id ? 'selected' : ''}`} onClick={() => p.onTc(t)}>
              {t.label}
            </button>
          ))}
        </div>

        <span className="label">{t("Tu joues")}</span>
        <div className="chips">
          {(
            [
              ['w', t("Blancs")],
              ['random', t("Aléatoire")],
              ['b', t("Noirs")],
            ] as [ColorChoice, string][]
          ).map(([c, label]) => (
            <button key={c} className={`chip ${p.colorChoice === c ? 'selected' : ''}`} onClick={() => p.onColor(c)}>
              {label}
            </button>
          ))}
        </div>

        <button className="btn primary big" disabled={!selUnlocked} onClick={p.onPlay}>
          {selUnlocked
            ? t('Jouer contre {name}', { name: sel.name })
            : t('Bloqué : {elo} Elo ou battre {name}', { elo: sel.rating - 250, name: BOTS[BOTS.indexOf(sel) - 1].name })}
        </button>
      </div>
    </div>
  );
}
