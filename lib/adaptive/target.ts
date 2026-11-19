import { dominantCenter, centerPriorities } from "../select";
import type {
  Card,
  CardSource,
  CenterId,
  Profile,
  Response,
  SwipeReason,
  TargetMode,
} from "../types";
import { getMacro, poolFor, type Macro } from "./skills";

/**
 * Swipe adaptatif : le CODE choisit de quoi on parle, le LLM n'écrit que la
 * phrase. Tout ce fichier est pur et testable (pas de réseau, pas de LLM).
 */

/** Nombre maximum de cartes "creuser" par session. */
export const MAX_CREUSER = 6;
/** Taille de la short-list de compétences proposée au LLM en mode creuser. */
const CREUSER_CANDIDATES = 8;

const LIVED: SwipeReason[] = ["deja-souvent", "deja-une-fois"];
const NOT_A_REJECTION: SwipeReason[] = [
  "jamais-essaye",
  "pas-capable",
  "pas-les-moyens",
  "pas-pres",
];

// ---------------------------------------------------------------------------
// Couverture : ce que le swipe a appris sur chaque compétence ROME visée
// ---------------------------------------------------------------------------

/**
 * - vecu       : "déjà fait" → candidate pour le quiz (preuve à recueillir)
 * - attire     : oui, sans expérience déclarée
 * - inconnu    : "jamais essayé" / barrière d'accès → PAS un rejet
 * - rejete     : "pas mon truc" ou non sans raison
 * - en-attente : carte générée, pas encore jouée
 */
export type MacroStatus = "vecu" | "attire" | "inconnu" | "rejete" | "en-attente";

export type Coverage = {
  macros: Map<number, MacroStatus>;
  /** Nombre de cartes générées par enjeu ROME (diversité). */
  enjeux: Map<string, number>;
  /** Cartes "déjà fait" pas encore creusées, la plus récente d'abord. */
  aCreuser: Card[];
  creuserCount: number;
};

export function statusOf(response: Response): Exclude<MacroStatus, "en-attente"> {
  if (response.direction === "right") {
    return response.reason && LIVED.includes(response.reason) ? "vecu" : "attire";
  }
  return response.reason && NOT_A_REJECTION.includes(response.reason)
    ? "inconnu"
    : "rejete";
}

export function coverage(responses: Response[], cards: Card[]): Coverage {
  const cardById = new Map(cards.map((c) => [c.id, c]));
  const macros = new Map<number, MacroStatus>();
  const enjeux = new Map<string, number>();
  const creused = new Set<string>();
  let creuserCount = 0;

  for (const card of cards) {
    if (!card.target) continue;
    macros.set(card.target.macro, "en-attente");
    const enjeu = getMacro(card.target.macro)?.enjeu;
    if (enjeu) enjeux.set(enjeu, (enjeux.get(enjeu) ?? 0) + 1);
    if (card.target.mode === "creuser") {
      creuserCount += 1;
      if (card.target.parentId) creused.add(card.target.parentId);
    }
  }

  const aCreuser: Card[] = [];
  for (const response of responses) {
    const card = cardById.get(response.cardId);
    if (!card) continue;
    if (card.target) macros.set(card.target.macro, statusOf(response));

    const lived = statusOf(response) === "vecu";
    const isCreuser = card.target?.mode === "creuser";
    if (lived && !isCreuser && !creused.has(card.id)) aCreuser.unshift(card);
  }

  return { macros, enjeux, aCreuser, creuserCount };
}

// ---------------------------------------------------------------------------
// Choix de la cible
// ---------------------------------------------------------------------------

export type TargetPlan = {
  mode: TargetMode;
  center: CenterId;
  /**
   * Compétences admissibles. Une seule quand le code a tranché ; plusieurs
   * quand la carte parente vient de la banque fixe (le LLM choisit alors
   * DANS cette liste, le serveur vérifie). Le repli sans LLM prend la 1re.
   */
  candidates: Macro[];
  /** Compétence fine à approfondir (mode creuser sur une carte générée). */
  focus?: string;
  parent?: Card;
};

export function pickTarget({
  profile,
  responses,
  cards,
  rand = Math.random,
}: {
  profile: Profile;
  responses: Response[];
  /** Toutes les cartes connues : banque + générées (jouées ou en file). */
  cards: Card[];
  rand?: () => number;
}): TargetPlan | null {
  const cov = coverage(responses, cards);

  if (cov.creuserCount < MAX_CREUSER) {
    for (const parent of cov.aCreuser) {
      const plan = creuserPlan(parent, cov, cards);
      if (plan) return plan;
    }
  }

  return explorerPlan(profile, responses, cards, cov, rand);
}

function creuserPlan(parent: Card, cov: Coverage, cards: Card[]): TargetPlan | null {
  // Carte générée : on reste sur la même compétence et on descend d'un cran.
  if (parent.target) {
    const macro = getMacro(parent.target.macro);
    if (!macro) return null;
    const usedFocus = new Set(
      cards.map((c) => c.target?.focus).filter((f): f is string => Boolean(f)),
    );
    const focus = macro.children.find((c) => !usedFocus.has(c.label))?.label;
    return {
      mode: "creuser",
      center: parent.target.center,
      candidates: [macro],
      focus,
      parent,
    };
  }

  // Carte de la banque : short-list tirée des viviers de ses 2 centres principaux.
  const centers = (Object.entries(parent.centers) as [CenterId, number][])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([id]) => id);

  const pools = centers.map((c) => poolFor(c).filter((m) => !cov.macros.has(m.code)));
  const candidates: Macro[] = [];
  for (let i = 0; candidates.length < CREUSER_CANDIDATES; i++) {
    let added = false;
    for (const pool of pools) {
      const m = pool[i];
      if (m && !candidates.some((x) => x.code === m.code)) {
        candidates.push(m);
        added = true;
      }
    }
    if (!added && pools.every((p) => i >= p.length)) break;
  }
  if (candidates.length === 0) return null;

  return {
    mode: "creuser",
    center: centers[0] ?? dominantCenter(parent),
    candidates: candidates.slice(0, CREUSER_CANDIDATES),
    parent,
  };
}

function explorerPlan(
  profile: Profile,
  responses: Response[],
  cards: Card[],
  cov: Coverage,
  rand: () => number,
): TargetPlan | null {
  const priorities = centerPriorities(profile, responses.length);
  const cardById = new Map(cards.map((c) => [c.id, c]));
  const last = responses.at(-1);
  const lastCenter = last && cardById.get(last.cardId);
  const recent = lastCenter ? dominantCenter(lastCenter) : null;

  const ranked = [...priorities.entries()]
    .map(([id, p]) => [id, p * (id === recent ? 0.6 : 1) + rand() * 0.05] as const)
    .sort((a, b) => b[1] - a[1]);

  for (const [center] of ranked) {
    const unseen = poolFor(center).filter((m) => !cov.macros.has(m.code));
    if (unseen.length === 0) continue;

    // Diversité : parmi les 8 meilleures, l'enjeu ROME le moins vu gagne.
    const head = unseen.slice(0, 8);
    let best = head[0];
    for (const m of head) {
      if ((cov.enjeux.get(m.enjeu) ?? 0) < (cov.enjeux.get(best.enjeu) ?? 0)) best = m;
    }
    return { mode: "explorer", center, candidates: [best] };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Construction de la carte
// ---------------------------------------------------------------------------

export type CardDraft = { text: string; hint?: string; emoji?: string };

/**
 * Les poids de centres ne viennent JAMAIS du LLM : moitié le centre sondé
 * (ou la carte parente), moitié le vecteur ROME de la compétence.
 */
export function cardCenters(plan: TargetPlan, macro: Macro): Card["centers"] {
  const raw: Record<string, number> = {};
  const add = (centers: Card["centers"], factor: number) => {
    for (const [id, w] of Object.entries(centers)) {
      raw[id] = (raw[id] ?? 0) + (w ?? 0) * factor;
    }
  };

  if (plan.mode === "creuser" && plan.parent) add(plan.parent.centers, 0.5);
  else add({ [plan.center]: 1 }, 0.5);
  add(macro.centers, 0.5);

  const kept = Object.entries(raw).filter(([, w]) => w >= 0.05);
  const total = kept.reduce((a, [, w]) => a + w, 0);
  return Object.fromEntries(kept.map(([id, w]) => [id, Math.round((w / total) * 100) / 100]));
}

export function buildCard(
  plan: TargetPlan,
  macro: Macro,
  draft: CardDraft,
  source: CardSource,
): Card {
  const id =
    plan.mode === "creuser"
      ? `gen-creuser-${macro.code}-${plan.parent?.id ?? "x"}`
      : `gen-explorer-${macro.code}`;

  return {
    id,
    text: draft.text,
    hint: draft.hint,
    emoji: draft.emoji,
    centers: cardCenters(plan, macro),
    tags: ["adaptatif", plan.mode],
    source,
    target: {
      mode: plan.mode,
      macro: macro.code,
      label: macro.label,
      focus: plan.focus,
      center: plan.center,
      parentId: plan.parent?.id,
    },
  };
}
