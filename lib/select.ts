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
 * 1. Couverture (cartes 1–15) : on va chercher les domaines jamais vus.
 * 2. UCB (cartes 16+) : on sonde le domaine qui a le meilleur score
 *    "moyenne + bonus d'incertitude". Le bonus empêche qu'un seul swipe
 *    contradictoire fasse abandonner un domaine prometteur — c'est ce qui
 *    distingue un algorithme qui apprend d'un algorithme qui surréagit.
 *
 * Un domaine confirmé ou rejeté sort du tirage : plus de cartes dessus.
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

  const phase1 = responses.length < 15;
  const priorities = new Map<CenterId, number>();

  const active = CENTER_IDS.filter((id) => {
    const d = profile.domains[id];
    return !d.confirmed && !d.rejected;
  });

  // Le set de focus se resserre : 30 -> 12 -> 6 domaines.
  // C'est le comportement "Tinder" : plus on apprend, plus on montre
  // ce qui ressemble au profil, sans jamais couper l'exploration.
  const focusSize = responses.length < 15 ? 30 : responses.length < 25 ? 12 : 6;
  const focus = new Set(
    [...active]
      .sort((a, b) => profile.domains[b].mean - profile.domains[a].mean)
      .slice(0, focusSize),
  );

  for (const id of active) {
    const domain = profile.domains[id];

    if (phase1) {
      // Couverture : les domaines jamais vus passent devant.
      priorities.set(id, (domain.nEff < 0.6 ? 2 : 0) + (1 - domain.confidence));
      continue;
    }

    // UCB : exploitation de la moyenne + exploration des domaines
    // encore incertains. c = 0,38 règle le compromis.
    const bonus =
      0.38 *
      Math.sqrt(Math.log(responses.length + 2) / (domain.nEff + 0.5));

    priorities.set(
      id,
      (domain.mean + bonus) * (focus.has(id) ? 1 : 0.35),
    );
  }

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
