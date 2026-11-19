import { CARDS } from "../content/cards";
import { PAIRS } from "../content/pairs";
import { CENTER_IDS } from "./centers";
import type {
  Card,
  CenterId,
  Profile,
  Response,
  TraitPair,
  TraitResponse,
} from "./types";

export function dominantCenter(card: Card): CenterId {
  let best: CenterId = Object.keys(card.centers)[0] ?? "manual";
  let bestWeight = -1;
  for (const [id, weight] of Object.entries(card.centers)) {
    if ((weight ?? 0) > bestWeight) {
      best = id;
      bestWeight = weight ?? 0;
    }
  }
  return best;
}

/**
 * Politique de sélection en deux temps :
 *
 * 1. Couverture (≤ 12 cartes, moins dès qu'un intérêt se dessine) :
 *    on va chercher les domaines jamais vus.
 * 2. UCB ensuite : on sonde le domaine qui a le meilleur score
 *    "moyenne + bonus d'incertitude". Le bonus empêche qu'un seul swipe
 *    contradictoire fasse abandonner un domaine prometteur — c'est ce qui
 *    distingue un algorithme qui apprend d'un algorithme qui surréagit.
 *
 * Intérêt découvert = approfondissement : un domaine confirmé reste dans le
 * tirage en priorité haute (`DEEPEN_PRIORITY`). Un domaine rejeté en sort.
 */
export function nextCard(
  profile: Profile,
  responses: Response[],
  cards: Card[] = CARDS,
  rand: () => number = Math.random,
): Card | null {
  const seen = new Set(responses.map((r) => r.cardId));
  const unseen = cards.filter((c) => !seen.has(c.id));
  if (unseen.length === 0) return null;

  const cardById = new Map(cards.map((c) => [c.id, c]));
  const recentCenters = new Set(
    responses
      .slice(-2)
      .map((r) => cardById.get(r.cardId))
      .filter((c): c is Card => Boolean(c))
      .map(dominantCenter),
  );

  const phase1 = isCoveragePhase(profile, responses.length);
  const priorities = centerPriorities(profile, responses.length);

  let best: Card | null = null;
  let bestScore = -Infinity;

  for (const card of unseen) {
    let score = 0;
    let untouched = 0;

    for (const [centerId, weight] of Object.entries(card.centers) as [
      CenterId,
      number,
    ][]) {
      const priority = priorities.get(centerId);
      if (priority === undefined) continue;
      score += weight * priority;
      if (profile.domains[centerId].nEff < 0.6) untouched += 1;
    }

    if (score <= 0) continue;

    if (phase1) score += untouched * 0.25;

    const diversity = recentCenters.has(dominantCenter(card))
      ? phase1
        ? 0.5
        : 0.85
      : 1;

    score = score * diversity + rand() * 0.04;

    if (score > bestScore) {
      best = card;
      bestScore = score;
    }
  }

  if (best) return best;

  return (
    unseen.find((c) =>
      Object.keys(c.centers).some((id) => {
        const d = profile.domains[id];
        return d && !d.confirmed && !d.rejected;
      }),
    ) ??
    unseen[0] ??
    null
  );
}

/** Longueur maximale de la phase de couverture. */
const COVERAGE_MAX = 12;
/** Constante d'exploration UCB. */
const UCB_C = 0.10;
/** En dessous de ce nEff, un domaine n'a pas encore de moyenne fiable. */
const FOCUS_MIN_NEFF = 1;
/** Rang de focus d'un domaine pas encore assez vu : derrière tout domaine aimé. */
const UNKNOWN_FOCUS_MEAN = 0.45;
/**
 * Priorité d'un domaine confirmé : au-dessus de tout domaine ouvert, pour
 * l'approfondir. La pénalité de diversité (même domaine que les cartes
 * précédentes) laisse passer une carte d'exploration de temps en temps.
 */
const DEEPEN_PRIORITY = 1;

/**
 * Un signal net : un domaine ouvert avec au moins 2 cartes aimées
 * et une moyenne qui monte.
 */
function hasStrongSignal(profile: Profile): boolean {
  return CENTER_IDS.some((id) => {
    const d = profile.domains[id];
    return (
      !d.rejected &&
      (d.confirmed || (d.likedCards.length >= 2 && d.mean >= 0.6))
    );
  });
}

/**
 * La couverture dure au plus `COVERAGE_MAX` cartes, et s'arrête plus tôt
 * dès qu'un intérêt se dessine : inutile de finir le tour des 30 domaines
 * avant de creuser ce que le jeune aime déjà.
 */
export function isCoveragePhase(profile: Profile, answered: number): boolean {
  return answered < COVERAGE_MAX && !hasStrongSignal(profile);
}

/**
 * Priorité de sondage de chaque domaine encore ouvert.
 * Phase 1 (couverture) : domaines jamais vus d'abord, nuancé par la moyenne.
 * Ensuite : UCB resserré sur le focus.
 * Partagé par le deck fixe (`nextCard`) et le swipe adaptatif (`pickTarget`).
 */
export function centerPriorities(
  profile: Profile,
  answered: number,
): Map<CenterId, number> {
  const phase1 = isCoveragePhase(profile, answered);
  const priorities = new Map<CenterId, number>();

  // Intérêt découvert = approfondissement.
  for (const id of CENTER_IDS) {
    if (profile.domains[id].confirmed) priorities.set(id, DEEPEN_PRIORITY);
  }

  const active = CENTER_IDS.filter((id) => {
    const d = profile.domains[id];
    return !d.confirmed && !d.rejected;
  });

  // Le set de focus se resserre : 30 -> 12 -> 6 domaines.
  // C'est le comportement "Tinder" : plus on apprend, plus on montre
  // ce qui ressemble au profil, sans jamais couper l'exploration.
  // Un domaine à peine vu garde sa moyenne a priori (0,5) : on le classe
  // derrière les domaines aimés, sinon il squatterait le focus.
  const focusSize = phase1 ? 30 : answered < 25 ? 12 : 6;
  const focusRank = (id: CenterId) => {
    const d = profile.domains[id];
    return d.nEff >= FOCUS_MIN_NEFF ? d.mean : Math.min(d.mean, UNKNOWN_FOCUS_MEAN);
  };
  const focus = new Set(
    [...active].sort((a, b) => focusRank(b) - focusRank(a)).slice(0, focusSize),
  );

  for (const id of active) {
    const domain = profile.domains[id];

    if (phase1) {
      // Couverture : les domaines jamais vus passent devant, mais un domaine
      // aimé n'est plus pénalisé par rapport à un domaine rejeté.
      priorities.set(
        id,
        (domain.nEff < 0.6 ? 2 : 0) +
          (1 - domain.confidence) +
          1.5 * (domain.mean - 0.5),
      );
      continue;
    }

    // UCB : exploitation de la moyenne + exploration des domaines encore
    // incertains. c = 0,10 : le bonus reste inférieur à l'écart entre un
    // domaine aimé et un domaine neutre. Un domaine à peine vu est exploité
    // sur un a priori prudent (la plupart des domaines ne plaisent pas).
    const bonus =
      UCB_C * Math.sqrt(Math.log(answered + 2) / (domain.nEff + 0.5));

    priorities.set(id, (focusRank(id) + bonus) * (focus.has(id) ? 1 : 0.35));
  }

  return priorities;
}

export function nextTraitPair(
  traitResponses: TraitResponse[],
  pairs: TraitPair[] = PAIRS,
): TraitPair | null {
  const seen = new Set(traitResponses.map((r) => r.pairId));
  return pairs.find((p) => !seen.has(p.id)) ?? null;
}

export function remainingInterestCards(
  responses: Response[],
  cards: Card[] = CARDS,
): number {
  const seen = new Set(responses.map((r) => r.cardId));
  return cards.filter((c) => !seen.has(c.id)).length;
}
