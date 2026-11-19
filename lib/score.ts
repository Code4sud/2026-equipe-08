import { CARDS } from "../content/cards";
import { PAIRS } from "../content/pairs";
import {
  CENTER_IDS,
  consistency,
  differentiation,
  hollandCode,
  projectRiasec,
} from "./centers";
import type {
  Card,
  CenterId,
  DomainState,
  Profile,
  Response,
  Riasec,
  SwipeReason,
  TraitId,
  TraitPair,
  TraitResponse,
} from "./types";
import { RIASEC, TRAITS } from "./types";

const PRIOR = 1.2;
const LEFT_BASE = 0.8;
const CONFIRM_MEAN = 0.72;
const CONFIRM_LOWER = 0.6;
const CONFIRM_NEFF = 3.5;
const CONFIRM_LIKED = 4;
const REJECT_MEAN = 0.28;
const REJECT_UPPER = 0.4;
const PRIOR_REJECTS = new Set<SwipeReason>([
  "jamais-essaye",
  "pas-les-moyens",
  "pas-pres",
  "pas-capable",
]);

function freshDomain(): DomainState {
  return {
    alpha: PRIOR,
    beta: PRIOR,
    nEff: 0,
    mean: 0.5,
    sd: 0.26,
    lower80: 0.17,
    upper80: 0.83,
    confidence: 0,
    confirmed: false,
    rejected: false,
    likedCards: [],
    dislikedCards: [],
  };
}

export function createProfile(): Profile {
  const domains = Object.fromEntries(
    CENTER_IDS.map((id) => [id, freshDomain()]),
  ) as Record<CenterId, DomainState>;

  const traits = Object.fromEntries(
    TRAITS.map((t) => [t, { sum: 0, n: 0, mean: 0, confidence: 0 }]),
  ) as Profile["traits"];

  return recompute({
    domains,
    traits,
    theta: { R: 1 / 6, I: 1 / 6, A: 1 / 6, S: 1 / 6, E: 1 / 6, C: 1 / 6 },
    code: "RIASEC",
    consistency: 0.5,
    differentiation: 0,
    confirmed: [],
    rejected: [],
    answered: 0,
  });
}

function responseStrength(direction: "left" | "right", reason?: SwipeReason): number {
  if (direction === "right") {
    if (reason === "deja-souvent") return 1;
    if (reason === "deja-une-fois") return 0.95;
    if (reason === "jamais-fait-mais-tente") return 0.85;
    return 1;
  }

  if (reason === "pas-mon-truc") return 1.1;
  return LEFT_BASE;
}

function quality(latencyMs?: number): number {
  // Un swipe ultra-rapide est moins fiable, mais on ne le jette pas.
  if (latencyMs !== undefined && latencyMs < 180) return 0.75;
  return 1;
}

/**
 * Applique un swipe d'intérêt. Retourne un nouveau profil.
 * - droite : alpha += poids
 * - gauche : beta += poids × 0,8
 * - "jamais essayé" / barrière d'accès : aucun impact sur l'intérêt
 */
export function applyResponse(
  profile: Profile,
  card: Card,
  response: Response,
): Profile {
  const next = cloneProfile(profile);
  next.answered += 1;

  if (response.reason && PRIOR_REJECTS.has(response.reason)) {
    return recompute(next);
  }

  // Carte "creuser" (swipe adaptatif) : question de vécu, pas d'intérêt.
  // "Non, ce n'est pas moi" ne doit pas faire baisser l'intérêt pour le domaine.
  if (card.target?.mode === "creuser") {
    return recompute(next);
  }

  const strength =
    responseStrength(response.direction, response.reason) *
    quality(response.latencyMs);

  for (const [centerId, weight] of Object.entries(card.centers) as [
    CenterId,
    number,
  ][]) {
    const domain = next.domains[centerId];
    if (!domain || domain.confirmed || domain.rejected) continue;

    const evidence = weight * strength;
    if (response.direction === "right") {
      domain.alpha += evidence;
      if (!domain.likedCards.includes(card.id)) domain.likedCards.push(card.id);
    } else {
      domain.beta += evidence;
      if (!domain.dislikedCards.includes(card.id))
        domain.dislikedCards.push(card.id);
    }
    domain.nEff += evidence;
  }

  return recompute(next);
}

export function applyTraitResponse(
  profile: Profile,
  pair: TraitPair,
  response: TraitResponse,
): Profile {
  const next = cloneProfile(profile);
  const state = next.traits[pair.trait];

  const value =
    response.direction === "right" ? pair.rightValue : pair.leftValue;
  state.sum += value;
  state.n += 1;
  state.mean = state.sum / state.n;
  state.confidence = Math.min(1, state.n / 3);

  return recompute(next);
}

export function recompute(profile: Profile): Profile {
  const next: Profile = { ...profile, domains: { ...profile.domains } };

  for (const id of CENTER_IDS) {
    const d = { ...next.domains[id] };
    const total = d.alpha + d.beta;
    d.mean = d.alpha / total;

    const variance = (d.alpha * d.beta) / (total * total * (total + 1));
    d.sd = Math.sqrt(variance);
    d.lower80 = Math.max(0, d.mean - 1.28 * d.sd);
    d.upper80 = Math.min(1, d.mean + 1.28 * d.sd);
    d.confidence = Math.max(0, Math.min(1, 1 - d.sd / 0.28));

    if (!d.confirmed && !d.rejected && d.nEff >= CONFIRM_NEFF) {
      if (d.mean <= REJECT_MEAN && d.upper80 <= REJECT_UPPER) {
        d.rejected = true;
      }
    }

    next.domains[id] = d;
  }

  const scores = Object.fromEntries(
    CENTER_IDS.map((id) => [
      id,
      next.domains[id].confirmed ? 1 : next.domains[id].mean,
    ]),
  ) as Record<CenterId, number>;

  const theta = projectRiasec(scores);
  const confirmed = CENTER_IDS.filter((id) => next.domains[id].confirmed);
  const rejected = CENTER_IDS.filter((id) => next.domains[id].rejected);

  return {
    ...next,
    theta,
    code: hollandCode(theta),
    consistency: consistency(theta),
    differentiation: differentiation(theta),
    confirmed,
    rejected,
  };
}

export function computeProfile(
  responses: Response[],
  traitResponses: TraitResponse[] = [],
  /** Banque fixe + cartes générées par le swipe adaptatif. */
  cards: Card[] = CARDS,
): Profile {
  const cardById = new Map(cards.map((c) => [c.id, c]));
  const pairById = new Map(PAIRS.map((p) => [p.id, p]));

  let profile = createProfile();

  for (const response of responses) {
    const card = cardById.get(response.cardId);
    if (card) profile = applyResponse(profile, card, response);
  }

  for (const response of traitResponses) {
    const pair = pairById.get(response.pairId);
    if (pair) profile = applyTraitResponse(profile, pair, response);
  }

  return profile;
}

/**
 * Propose une confirmation explicite quand un domaine est solide.
 * L'algorithme ne verrouille jamais tout seul : c'est le jeune qui valide.
 */
export function proposeConfirmation(profile: Profile): CenterId | null {
  const candidates = CENTER_IDS.filter((id) => {
    const d = profile.domains[id];
    return (
      !d.confirmed &&
      !d.rejected &&
      d.mean >= CONFIRM_MEAN &&
      d.lower80 >= CONFIRM_LOWER &&
      d.nEff >= CONFIRM_NEFF &&
      d.likedCards.length >= CONFIRM_LIKED
    );
  });

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    const da = profile.domains[a];
    const db = profile.domains[b];
    return db.mean * db.confidence - da.mean * da.confidence;
  });

  return candidates[0];
}

export function resolveConfirmation(
  profile: Profile,
  centerId: CenterId,
  accepted: boolean,
): Profile {
  const next = cloneProfile(profile);
  const d = next.domains[centerId];

  if (accepted) {
    d.confirmed = true;
    d.rejected = false;
    // La validation explicite est une preuve forte : on la traduit
    // en observations supplémentaires, sans effacer l'historique.
    d.alpha = Math.max(d.alpha, 10);
    d.beta = Math.min(d.beta, 1);
    d.nEff = Math.max(d.nEff, 8);
  } else {
    d.rejected = true;
    d.confirmed = false;
    // Le domaine a été mal lu : on repart du prior et on arrête de le sonder.
    d.alpha = PRIOR;
    d.beta = PRIOR;
    d.nEff = 0;
  }

  return recompute(next);
}

export function cloneProfile(profile: Profile): Profile {
  return {
    ...profile,
    domains: Object.fromEntries(
      Object.entries(profile.domains).map(([id, d]) => [
        id,
        {
          ...d,
          likedCards: [...d.likedCards],
          dislikedCards: [...d.dislikedCards],
        },
      ]),
    ),
    traits: Object.fromEntries(
      Object.entries(profile.traits).map(([id, t]) => [id, { ...t }]),
    ) as Record<TraitId, (typeof profile.traits)[TraitId]>,
    confirmed: [...profile.confirmed],
    rejected: [...profile.rejected],
  };
}

export function topDomains(profile: Profile, n = 5): CenterId[] {
  return [...CENTER_IDS]
    .filter((id) => !profile.domains[id].rejected)
    .sort((a, b) => {
      const da = profile.domains[a];
      const db = profile.domains[b];
      if (da.confirmed !== db.confirmed) return da.confirmed ? -1 : 1;
      return db.mean - da.mean;
    })
    .slice(0, n);
}

export function unknownDomains(profile: Profile, n = 4): CenterId[] {
  return [...CENTER_IDS]
    .filter((id) => {
      const d = profile.domains[id];
      return !d.confirmed && !d.rejected && d.nEff < 2.5;
    })
    .sort((a, b) => profile.domains[a].nEff - profile.domains[b].nEff)
    .slice(0, n);
}

export function answeredCount(responses: Response[]): number {
  return responses.length;
}

export function isFinished(profile: Profile, responses: Response[]): boolean {
  if (responses.length >= 48) return true;
  if (responses.length < 28) return false;
  if (profile.confirmed.length + profile.rejected.length >= 8) return true;

  return CENTER_IDS.every((id) => {
    const d = profile.domains[id];
    return d.confirmed || d.rejected || d.nEff >= 4;
  });
}

export type { Profile as ProfileState };
export type { Riasec };
export { RIASEC };
