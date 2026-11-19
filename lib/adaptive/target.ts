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
import { getMacro, poolFor, swipeTargets, type Macro } from "./skills";

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

/**
 * Une carte "creuser" pose une question de VÉCU ("c'est toi qui… ?") :
 * oui = vécu, non = pas vécu (ni rejet, ni intérêt). Les autres cartes
 * posent une question d'INTÉRÊT ("ça te tente ?"), précisée par "déjà fait".
 */
export function statusOf(
  response: Response,
  card?: Card,
): Exclude<MacroStatus, "en-attente"> {
  if (card?.target?.mode === "creuser") {
    return response.direction === "right" ? "vecu" : "inconnu";
  }
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
    const status = statusOf(response, card);
    const isCreuser = card.target?.mode === "creuser";
    if (card.target) {
      // Un "non" sur une carte creuser ne dégrade pas ce que la carte parente a appris.
      const previous = macros.get(card.target.macro);
      const keepPrevious = isCreuser && status === "inconnu" && previous && previous !== "en-attente";
      if (!keepPrevious) macros.set(card.target.macro, status);
    }

    const lived = status === "vecu";
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
  /**
   * Short-list sans lien lexical avec la carte parente : seul un LLM peut y
   * trouver la bonne compétence. Sans LLM, ce plan est abandonné.
   */
  loose?: boolean;
};

export function pickTarget({
  profile,
  responses,
  cards,
  rand = Math.random,
  allowLoose = true,
}: {
  profile: Profile;
  responses: Response[];
  /** Toutes les cartes connues : banque + générées (jouées ou en file). */
  cards: Card[];
  rand?: () => number;
  /** false quand aucun LLM ne pourra choisir dans une short-list floue. */
  allowLoose?: boolean;
}): TargetPlan | null {
  const cov = coverage(responses, cards);

  if (cov.creuserCount < MAX_CREUSER) {
    for (const parent of cov.aCreuser) {
      const plan = creuserPlan(parent, cov, cards, allowLoose);
      if (plan) return plan;
    }
  }

  return explorerPlan(profile, responses, cards, cov, rand);
}

function creuserPlan(
  parent: Card,
  cov: Coverage,
  cards: Card[],
  allowLoose: boolean,
): TargetPlan | null {
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

  // 1. Correspondance de mots entre la carte et les libellés ROME
  //    ("Gérer la caisse d'une asso" -> "Gérer une caisse").
  // 2. Puis les viviers de ses 2 centres principaux, en alternance.
  const lexical = lexicalMatches(parent.text).filter((m) => !cov.macros.has(m.code));
  if (lexical.length === 0 && !allowLoose) return null;
  const pools = [
    lexical,
    ...centers.map((c) => poolFor(c).filter((m) => !cov.macros.has(m.code))),
  ];
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
    loose: lexical.length === 0,
  };
}

// Racines (5 lettres, sans accents) trop vagues pour relier une carte à ROME.
const STOP = new Set([
  "avec", "pour", "dans", "sans", "chez", "tout", "toute", "comme", "entre",
  "plusi", "petit", "autre", "pays", "gens", "perso", "quelq", "truc", "plus",
  "ville", "quart", "jours", "march", "trava", "aider", "tenir", "faire",
  "avoir", "etre", "meme", "vieux", "seul", "zero",
]);

const normalize = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Racine grossière : 5 premières lettres ("réparer" ~ "réparation"). */
const stems = (s: string) =>
  normalize(s)
    .split(/[^a-z]+/)
    .filter((w) => w.length >= 4)
    .map((w) => w.slice(0, 5))
    .filter((w) => !STOP.has(w));

/**
 * IDF des racines sur les libellés ROME ciblables : un mot présent partout
 * ("réaliser", "gérer") ne prouve rien, un mot rare ("caisse") beaucoup.
 */
let idfCache: Map<string, number> | null = null;
function idf(): Map<string, number> {
  if (idfCache) return idfCache;
  const targets = swipeTargets();
  const df = new Map<string, number>();
  for (const m of targets) {
    const words = new Set([m.label, ...m.children.map((c) => c.label)].flatMap(stems));
    for (const w of words) df.set(w, (df.get(w) ?? 0) + 1);
  }
  idfCache = new Map([...df].map(([w, n]) => [w, Math.log(targets.length / n)]));
  return idfCache;
}

/** Seuil : environ un mot rare partagé avec le libellé, ou deux avec les compétences fines. */
const LEXICAL_MIN = 4;

/** Macros dont le libellé (×2) ou les compétences fines partagent des mots rares avec le texte. */
export function lexicalMatches(text: string, limit = 3): Macro[] {
  const wanted = new Set(stems(text));
  if (wanted.size === 0) return [];
  const weights = idf();
  return swipeTargets()
    .map((m) => {
      const label = new Set(stems(m.label));
      const children = new Set(m.children.flatMap((c) => stems(c.label)));
      let score = 0;
      for (const w of wanted) {
        const weight = weights.get(w) ?? 0;
        if (label.has(w)) score += 2 * weight;
        else if (children.has(w)) score += weight;
      }
      return { m, score };
    })
    .filter((x) => x.score >= LEXICAL_MIN)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.m);
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
