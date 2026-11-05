// Boutique : essayer un skin de pieces ou un plateau sur un vrai plateau (jouable), sans l'equiper
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Chess } from "chess.js";
import { Board } from "../components/Board";
import { useSettings } from "../settings/settings";
import { itemById } from "./items";
import { useShop } from "./store";
import { Modal } from "../components/Modal";
import { sounds } from "../lib/sounds";
import type { ShopItem } from "./items";

const POSITIONS = [
  {
    id: "start",
    label: "Départ",
    fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  },
  {
    id: "middle",
    label: "Milieu de partie",
    fen: "r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2PP1N2/PP3PPP/RNBQ1RK1 w - - 0 7",
  },
  {
    id: "end",
    label: "Finale",
    fen: "8/5pk1/6p1/3R4/1r6/6P1/5PK1/8 w - - 0 40",
  },
] as const;

function destsOf(c: Chess) {
  const d = new Map<string, string[]>();
  for (const m of c.moves({ verbose: true }))
    d.set(m.from, [...(d.get(m.from) ?? []), m.to]);
  return d;
}

interface Props {
  item: ShopItem;
  onClose: () => void;
  /** Bouton d'achat ou d'equipement (le meme que sur la carte de la boutique) */
  action: ReactNode;
}

export function SkinPreview({ item, onClose, action }: Props) {
  const [pos, setPos] = useState<(typeof POSITIONS)[number]["id"]>("middle");
  const [fen, setFen] = useState<string>(POSITIONS[1].fen);
  const [last, setLast] = useState("");
  const [white, setWhite] = useState(true);
  const [token, setToken] = useState(0);
  const [compare, setCompare] = useState(false);
  const shop = useShop();
  const { theme } = useSettings();
  const chess = useMemo(() => new Chess(fen), [fen]);
  // Le plateau se monte apres l'animation d'ouverture (sinon il mesure la fenetre encore reduite)
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setReady(true), 220);
    return () => clearTimeout(t);
  }, []);

  const load = (id: (typeof POSITIONS)[number]["id"]) => {
    setPos(id);
    setFen(POSITIONS.find((p) => p.id === id)!.fen);
    setLast("");
    setToken((t) => t + 1);
  };

  const onMove = (from: string, to: string) => {
    const c = new Chess(fen);
    try {
      const m = c.move({ from, to, promotion: "q" });
      if (m.captured) sounds.capture(m.captured);
      else sounds.move();
    } catch {
      setToken((t) => t + 1);
      return;
    }
    setFen(c.fen());
    setLast(from + to);
  };

  const isPieces = item.type === "pieces";
  const moved = last !== "";
  // Equipement actuel, pour la comparaison
  const equippedPieces = itemById(shop.equipped.pieces);
  const equippedName = isPieces ? (equippedPieces?.name ?? "Classique") : theme.name;
  const isEquipped = isPieces ? shop.equipped.pieces === item.id : theme.itemId === item.id;

  const board = (mine: boolean) => (
    <Board
      fen={fen}
      orientation={white ? "white" : "black"}
      turnColor={chess.turn() === "w" ? "white" : "black"}
      movableColor="both"
      dests={destsOf(chess)}
      lastMove={last}
      inCheck={chess.inCheck()}
      premovable={false}
      resetToken={token}
      onMove={onMove}
      skinOverride={!mine && isPieces ? item.id : undefined}
      themeOverride={
        !mine && !isPieces
          ? { light: item.light!, dark: item.dark!, texture: item.texture }
          : undefined
      }
    />
  );

  return (
    <Modal title={`Aperçu : ${item.name}`} onClose={onClose}>
      <div className={`skin-try ${compare ? "comparing" : ""}`}>
        <p className="muted small">
          {isPieces ? "Ces pièces sur ton plateau actuel." : "Ce plateau avec tes pièces actuelles."} Joue des coups pour voir le
          rendu en mouvement : rien n’est équipé tant que tu ne le décides pas.
        </p>
        <div className="skin-try-tools">
          <div className="chips small">
            {POSITIONS.map((p) => (
              <button key={p.id} className={`chip ${pos === p.id ? "selected" : ""}`} onClick={() => load(p.id)}>
                {p.label}
              </button>
            ))}
          </div>
          <div className="chips small">
            {!isEquipped && (
              <button
                className={`chip ${compare ? "selected" : ""}`}
                onClick={() => setCompare((c) => !c)}
                title="Afficher côte à côte cet objet et celui que tu utilises"
              >
                ⇆ Comparer avec le mien
              </button>
            )}
            <button className="chip" onClick={() => setWhite((w) => !w)} title="Retourner le plateau">
              🔄 Retourner
            </button>
            {moved && (
              <button className="chip" onClick={() => load(pos)} title="Annuler les coups joués et revenir à la position choisie">
                ↺ Annuler mes coups
              </button>
            )}
          </div>
        </div>
        {compare ? (
          <div className="skin-compare">
            <figure>
              <figcaption>
                <b>{item.name}</b> <span className="muted tiny">aperçu</span>
              </figcaption>
              <div className="skin-try-board">{ready && board(false)}</div>
            </figure>
            <figure>
              <figcaption>
                <b>{equippedName}</b> <span className="muted tiny">ton équipement actuel</span>
              </figcaption>
              <div className="skin-try-board">{ready && board(true)}</div>
            </figure>
          </div>
        ) : (
          <div className="skin-try-board">{ready && board(false)}</div>
        )}
        <div className="skin-try-foot">
          <div>
            <strong>{item.name}</strong>
            <span className="muted small"> · {item.desc}</span>
          </div>
          {action}
        </div>
      </div>
    </Modal>
  );
}
