// Boutique : pieces gagnees en jouant, objets a debloquer (pieces, plateaux, sons).
import { createElement, useState } from 'react';
import { ONLINE_EARN } from '../economy/rewards';
import { CHEST, DAILY_BONUS } from '../economy/quests';
import { EARN, ITEMS, type ItemType, type ShopItem } from '../shop/items';
import { buy, equip, owns, refund, refundInfo, useShop } from '../shop/store';
import { hasSound, previewSound, SOUND_KEYS, type SoundKey } from '../lib/sounds';
import { sounds } from '../lib/sounds';
import { useSettings } from '../settings/settings';
import { navigate, useRouteTab } from '../router';
import { Emote, emotesOfPack } from '../emotes/emotes';
import { rewardLevelOf } from '../rewards/levels';
import { SkinPreview } from '../shop/SkinPreview';
import { Modal } from '../components/Modal';

import { t, tmap } from '../i18n';
const TABS: { id: ItemType; label: string }[] = ([
  { id: 'pieces', label: '♟️ Pièces' },
  { id: 'board', label: '🟫 Plateaux' },
  { id: 'sounds', label: '🔊 Sons' },
  { id: 'emotes', label: '😀 Emojis de chat' },
] as { id: ItemType; label: string }[]).map((x) => tmap(x));

export function PiecesPreview({ id }: { id: string }) {
  return (
    <div className={`cg-wrap skin-preview skin-${id.replace('pieces-', '')}`}>
      {(['white', 'black'] as const).flatMap((c) =>
        ['king', 'queen', 'knight', 'pawn'].map((p) => createElement('piece', { key: c + p, className: `${c} ${p}` })),
      )}
    </div>
  );
}

export function BoardPreview({ light, dark, texture }: { light: string; dark: string; texture?: string }) {
  return (
    <div
      className={`board-preview ${texture ? `tex-${texture}` : ''}`}
      style={{ '--sq-light': light, '--sq-dark': dark } as React.CSSProperties}
    />
  );
}

const SOUND_INFO: Record<SoundKey, { label: string; when: string }> = tmap({
  move: { label: 'Coup simple', when: 'Chaque coup sans prise.' },
  'cap-p': { label: 'Tu prends un pion', when: 'Quand tu prends un pion (1 point).' },
  'cap-n': { label: 'Tu prends un cavalier ou un fou', when: 'Pièce mineure prise (3 points).' },
  'cap-r': { label: 'Tu prends une tour', when: 'Tour prise (5 points).' },
  'cap-q': { label: 'Tu prends la dame', when: 'La plus grosse prise du jeu (9 points).' },
  'lost-p': { label: 'On te prend un pion', when: 'L’adversaire prend un de tes pions.' },
  'lost-n': { label: 'On te prend un cavalier ou un fou', when: 'Tu perds une pièce mineure (3 points).' },
  'lost-r': { label: 'On te prend une tour', when: 'Tu perds une tour (5 points).' },
  'lost-q': { label: 'On te prend la dame', when: 'Tu perds ta dame (9 points) : aïe.' },
  brilliant: { label: 'Coup brillant !!', when: 'En review, sur un coup brillant (souvent un sacrifice gagnant).' },
  great: { label: 'Très bon coup !', when: 'En review, sur le seul bon coup de la position.' },
  best: { label: 'Meilleur coup', when: 'En review, quand tu joues le choix de Stockfish.' },
  book: { label: 'Coup théorique', when: 'En review, sur un coup connu de la théorie des ouvertures.' },
  miss: { label: 'Occasion manquée', when: 'En review, quand tu laisses passer un gain.' },
  mistake: { label: 'Erreur ?', when: 'En review, sur une erreur nette.' },
  blunder: { label: 'Gaffe ??', when: 'En review, sur une gaffe qui change le résultat.' },
  win: { label: 'Victoire', when: 'Quand tu gagnes une partie.' },
  loss: { label: 'Défaite', when: 'Quand tu perds une partie.' },
  draw: { label: 'Nulle', when: 'Quand la partie se termine sur une nulle.' },
  'msg-out': { label: 'Message envoyé', when: 'Quand tu envoies un message dans le chat d’une partie.' },
  'msg-in': { label: 'Message reçu', when: 'Quand ton adversaire t’écrit.' },
});

const PACK_FLAVOR: Record<string, Partial<Record<SoundKey, string>>> = tmap({
  'sounds-classic': {
    'lost-p': 'Bois plus grave, à peine marqué.',
    'lost-n': 'Bois grave et petite note qui baisse.',
    'lost-r': 'Note plus longue et plus basse.',
    'lost-q': 'Note grave qui s’étire, en deux temps.',
    'cap-p': 'Un claquement de bois, le même pour toutes les prises.',
    'cap-n': 'Même claquement que pour un pion.',
    'cap-r': 'Même claquement que pour un pion.',
    'cap-q': 'Même claquement que pour un pion.',
    brilliant: 'Petit arpège clair.',
    great: 'Même arpège que le coup brillant.',
    book: 'Bruit de page qu’on tourne.',
    blunder: 'Deux notes graves et grinçantes.',
  },
  'sounds-impact': {
    'lost-p': 'Choc sourd.',
    'lost-n': 'Choc sourd et grondement.',
    'lost-r': 'Grondement lourd en deux temps.',
    'lost-q': 'Effondrement : grondement et gros impact.',
    'cap-p': 'Choc sec et léger.',
    'cap-n': 'Choc plus sourd.',
    'cap-r': 'Impact lourd avec une basse.',
    'cap-q': 'Gros impact et grondement : la dame est tombée !',
    brilliant: 'Éclat suivi d’un accord montant.',
    great: 'Trois notes montantes.',
    best: 'Une note claire et courte.',
    book: 'Claquement feutré.',
    miss: 'Note grave qui retombe.',
    mistake: 'Choc sourd et note grinçante.',
    blunder: 'Effondrement dramatique.',
  },
  'sounds-arcade': {
    'lost-p': 'Un bip qui descend.',
    'lost-n': 'Deux bips qui descendent.',
    'lost-r': 'Trois bips qui descendent.',
    'lost-q': 'Quatre notes qui chutent, façon vie perdue.',
    'cap-p': 'Un bip.',
    'cap-n': 'Deux bips.',
    'cap-r': 'Trois bips.',
    'cap-q': 'Arpège de quatre notes, façon bonus de jeu vidéo.',
    brilliant: 'Fanfare 8 bits.',
    great: 'Petit power-up.',
    best: 'Bip aigu.',
    book: 'Bip doux.',
    miss: 'Bip grave.',
    mistake: 'Deux notes qui descendent.',
    blunder: 'Game over en quatre notes.',
  },
  'sounds-crystal': {
    'lost-p': 'Carillon grave et triste.',
    'lost-n': 'Deux carillons qui descendent.',
    'lost-r': 'Trois carillons qui descendent.',
    'lost-q': 'Longue cascade de carillons graves.',
    'cap-p': 'Carillon aigu et bref.',
    'cap-n': 'Carillon un peu plus grave.',
    'cap-r': 'Carillon grave avec une harmonique.',
    'cap-q': 'Grand carillon qui résonne longtemps.',
    brilliant: 'Cascade de clochettes.',
    great: 'Trois clochettes.',
    best: 'Clochette cristalline.',
    book: 'Note douce.',
    miss: 'Note suspendue.',
    mistake: 'Deux notes qui descendent doucement.',
    blunder: 'Accord mineur qui s’éteint.',
  },
});

function SoundDetails({ packId }: { packId: string }) {
  const [playing, setPlaying] = useState<SoundKey | null>(null);
  return (
    <div className="card sound-details">
      <div className="tc-label">{t("Les sons du pack, un par un")}</div>
      {SOUND_KEYS.map((k) => {
        const ok = hasSound(packId, k);
        return (
          <div key={k} className={`sound-row ${ok ? '' : 'off'}`}>
            <button
              className={`btn small-btn play-btn ${playing === k ? 'playing' : ''}`}
              disabled={!ok}
              onClick={() => {
                previewSound(packId, k);
                setPlaying(k);
                setTimeout(() => setPlaying((p) => (p === k ? null : p)), 700);
              }}
              aria-label={t('Écouter : {sound}', { sound: SOUND_INFO[k].label })}
            >
              ▶
            </button>
            <div>
              <strong>{SOUND_INFO[k].label}</strong>
              <span className="muted small">
                {SOUND_INFO[k].when} {ok ? PACK_FLAVOR[packId]?.[k] ?? '' : t("Pas de son dédié dans ce pack.")}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ShopPage() {
  const shop = useShop();
  const { settings, update } = useSettings();
  const [tab, setTab] = useState<ItemType>('pieces');
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'owned' | 'shop'>('all');
  const [sort, setSort] = useState<'default' | 'price' | 'priceDesc'>('default');
  // Lien direct vers un rayon : /boutique/pieces, /boutique/plateaux, /boutique/sons
  useRouteTab(1, tab, setTab, { pieces: 'pieces', board: 'plateaux', sounds: 'sons', emotes: 'emojis' });
  // Pack dont on affiche le detail des sons
  const [soundPack, setSoundPack] = useState('sounds-impact');
  // Skin essaye sur un vrai plateau
  const [preview, setPreview] = useState<ShopItem | null>(null);

  const equippedId = (it: ShopItem) =>
    it.type === 'pieces' ? shop.equipped.pieces : it.type === 'sounds' ? shop.equipped.sounds : `board-${settings.boardTheme}`;

  const equipItem = (it: ShopItem) => {
    if (it.type === 'emotes') return;
    if (it.type === 'board') update({ boardTheme: it.id.replace('board-', '') });
    else equip(it.type, it.id);
  };

  const purchase = (it: ShopItem) => {
    const err = buy(it.id);
    if (err) {
      setError(err);
      sounds.fail();
      return;
    }
    setError(null);
    sounds.success();
    equipItem(it);
  };

  // Remboursement (sous 24 h) : confirmation avant de rendre l'objet
  const [refunding, setRefunding] = useState<ShopItem | null>(null);
  const hoursLeft = (ms: number) => (ms >= 3600_000 ? `${Math.ceil(ms / 3600_000)} h` : `${Math.max(1, Math.ceil(ms / 60_000))} min`);
  const refundBtn = (it: ShopItem) => {
    const info = refundInfo(it.id);
    if (!info) return null;
    return (
      <button className="link small refund-link" onClick={() => setRefunding(it)} title={t("Remboursement possible pendant 24 h après l’achat")}>{t('↩ Rembourser ({time} restantes)', { time: hoursLeft(info.msLeft) })}</button>
    );
  };
  const isOn = (it: ShopItem) => equippedId(it) === it.id || (it.type === 'board' && settings.boardTheme === it.id.replace('board-', ''));
  const action = (it: ShopItem) => {
    const have = owns(it.id);
    return it.type === 'emotes' && have ? (
      <span className="equipped-tag">{t("✔ Dans ton chat")}</span>
    ) : isOn(it) ? (
      <span className="equipped-tag">{t("✔ Équipé")}</span>
    ) : have ? (
      <button className="btn" onClick={() => equipItem(it)}>{t("Équiper")}</button>
    ) : it.event ? (
      <button className="btn" onClick={() => navigate('/communaute/evenements')} title={t("Exclusif à l’événement de lancement : invite un ami")}>{t("🚀 Événement")}</button>
    ) : it.exclusive ? (
      <button className="btn" onClick={() => navigate('/progresser/niveaux')} title={t("Voir les récompenses de niveau")}>{t('🎁 Niveau {n}', { n: rewardLevelOf(it.id) ?? '?' })}
      </button>
    ) : (
      <button className={`btn ${shop.coins >= it.price ? 'primary' : ''}`} onClick={() => purchase(it)}>
        🪙 {it.price}
      </button>
    );
  };

  const all = ITEMS.filter((i) => i.type === tab);
  const list = all
    .filter((i) => (filter === 'owned' ? owns(i.id) : filter === 'shop' ? !owns(i.id) : true))
    .sort((a, b) => (sort === 'price' ? a.price - b.price : sort === 'priceDesc' ? b.price - a.price : 0));
  const ownedCount = all.filter((i) => owns(i.id)).length;
  const title = tab === 'pieces' ? t('Collections de pièces') : null;
  return (
    <div className="shop">
      <div className="card shop-hero">
        <div className="shop-coins">
          <span className="coin-big">🪙</span>
          <div>
            <div className="tc-label">{t("Tes pièces")}</div>
            <strong>{shop.coins}</strong>
          </div>
        </div>
        <div className="shop-earn small">
          <div className="tc-label">{t("Comment en gagner")}</div>
          <ul>
            <li>{t('Partie contre un bot : {win} la victoire (+{bonus} contre plus fort), {draw} la nulle, {loss} la défaite', { win: EARN.botWin, bonus: EARN.upsetBonus, draw: EARN.botDraw, loss: EARN.botLoss })}</li>
            <li>{t('Cours : {star} par nouvelle étoile, +{first} la première fois', { star: EARN.lessonStar, first: EARN.lessonFirst })}</li>
            <li>{t('Succès : {b} bronze, {s} argent, {g} or', { b: EARN.tier[1], s: EARN.tier[2], g: EARN.tier[3] })}</li>
            <li>{t('Suivi : {pos} par position maîtrisée, +{session} par séance (avec de l’XP)', { pos: EARN.coachPosition, session: EARN.coachSession })}</li>
            <li>{t('Problèmes : {n} par problème réussi sans aide', { n: EARN.puzzle })}</li>
            <li>{t('En ligne : {rated} la victoire classée ({friendly} en amical), +{first} la 1re victoire du jour', { rated: ONLINE_EARN.rated.win.coins, friendly: ONLINE_EARN.friendly.win.coins, first: ONLINE_EARN.firstWin.coins })}</li>
            <li>{t('Quêtes du jour (accueil) : 15 à 35 chacune, +{bonus} les 3 ; défi de la semaine : 120 à 150', { bonus: DAILY_BONUS.coins })}</li>
            <li>{t('Coffre du jour : {a} à {b} selon ta série de jours', { a: CHEST[0], b: CHEST[CHEST.length - 1] })}</li>
          </ul>
        </div>
      </div>

      <div className="chips">
        {TABS.map((t) => (
          <button key={t.id} className={`chip ${tab === t.id ? 'selected' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="shop-tools">
        <div className="chips small">
          {(
            [
              ['all', t('Tout ({n})', { n: all.length })],
              ['owned', t('Possédés ({n})', { n: ownedCount })],
              ['shop', t('À débloquer ({n})', { n: all.length - ownedCount })],
            ] as const
          ).map(([id, label]) => (
            <button key={id} className={`chip ${filter === id ? 'selected' : ''}`} onClick={() => setFilter(id)}>
              {label}
            </button>
          ))}
        </div>
        <select className="select" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
          <option value="default">{t("Ordre de la boutique")}</option>
          <option value="price">{t("Prix croissant")}</option>
          <option value="priceDesc">{t("Prix décroissant")}</option>
        </select>
      </div>
      {error && <p className="error card">{error}</p>}

      {title && <h3 className="shop-h">{title}</h3>}
      <div className="shop-grid">
        {list.map((it) => {
          const have = owns(it.id);
          const on = equippedId(it) === it.id || (it.type === 'board' && settings.boardTheme === it.id.replace('board-', ''));
          return (
            <div key={it.id} className={`card shop-item ${on ? 'equipped' : ''}`}>
              {(it.type === 'pieces' || it.type === 'board') && (
                <div className="shop-visual">
                  {it.type === 'pieces' ? <PiecesPreview id={it.id} /> : <BoardPreview light={it.light!} dark={it.dark!} texture={it.texture} />}
                  <button className="btn shop-visualize" onClick={() => setPreview(it)}>{t("👁 Visualiser")}</button>
                </div>
              )}
              {it.type === 'emotes' && (
                <div className="emote-preview">
                  {emotesOfPack(it.id).map((e) => (
                    <Emote key={e.id} def={e} size={34} />
                  ))}
                </div>
              )}
              {it.exclusive && <span className="shop-tag tag-excl">{it.event ? t("🚀 Événement") : t("🎁 Exclusif")}</span>}
              {it.tag && !have && <span className={`shop-tag tag-${it.tag === 'Animé' ? 'anim' : it.tag === 'Lisibilité' ? 'read' : 'new'}`}>{t(it.tag)}</span>}
              {it.type === 'sounds' && (
                <button className={`btn sound-demo ${soundPack === it.id ? 'selected' : ''}`} onClick={() => setSoundPack(it.id)}>{t("🎧 Écouter les sons")}</button>
              )}
              <div className="shop-item-body">
                <strong>{it.name}</strong>
                <span className="muted small">{it.desc}</span>
              </div>
              {action(it)}
              {refundBtn(it)}
            </div>
          );
        })}
      </div>
      {refunding && (
        <Modal title={t("Rembourser cet achat ?")} onClose={() => setRefunding(null)}>
          <p>
            <b>{refunding.name}</b>{" "}{t("sera retiré de ta collection (et déséquipé s’il est utilisé), et tu récupères")}{' '}
            <b>🪙 {refundInfo(refunding.id)?.amount ?? refunding.price}</b>.
          </p>
          <p className="muted small">{t("Un objet ne peut être remboursé qu’une seule fois, dans les 24 h qui suivent l’achat.")}</p>
          <div className="row">
            <button className="btn" onClick={() => setRefunding(null)}>{t("Garder")}</button>
            <button
              className="btn primary"
              onClick={() => {
                const err = refund(refunding.id);
                if (err) setError(err);
                else {
                  sounds.success();
                  // Plateau rembourse alors qu'il etait utilise : retour au plateau de base
                  if (refunding.type === 'board' && settings.boardTheme === refunding.id.replace('board-', '')) update({ boardTheme: 'bois' });
                }
                setRefunding(null);
              }}
            >{t("↩ Rembourser")}</button>
          </div>
        </Modal>
      )}
      {preview && <SkinPreview item={preview} onClose={() => setPreview(null)} action={action(preview)} />}
      {tab === 'sounds' && <SoundDetails packId={soundPack} />}
      {tab === 'emotes' && <p className="muted small">{t("Bouton 😀 dans le chat de tes parties (contre les bots et en ligne). Ton adversaire voit tous tes emojis, même s’il n’a pas le pack.")}</p>}
      {tab === 'board' && <p className="muted small">{t("Les 6 plateaux de base restent gratuits dans les paramètres ⚙️. Les plateaux texturés (bois, marbre, étoiles…) gardent des cases bien lisibles.")}</p>}

      {shop.ledger.length > 0 && (
        <div className="card ledger">
          <div className="tc-label">{t("Derniers mouvements")}</div>
          {shop.ledger.slice(0, 12).map((l, i) => (
            <div key={i} className="ledger-row small">
              <span>{l.reason}</span>
              <b className={l.amount > 0 ? 'plus' : 'minus'}>
                {l.amount > 0 ? '+' : ''}
                {l.amount} 🪙
              </b>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
