import { computeProfile, resolveConfirmation } from "./score";
import type { Response, SwipeDirection, TraitResponse } from "./types";

const CARD_PICKS: [string, SwipeDirection][] = [
  ["reparer-velo", "right"],
  ["bricoler", "right"],
  ["reparer-scooter", "right"],
  ["monter-meuble", "right"],
  ["peindre-mur", "right"],
  ["demonter-telephone", "right"],
  ["coder-jeu", "right"],
  ["creer-site", "right"],
  ["reparer-pc", "right"],
  ["installer-reseau", "right"],
  ["robot", "right"],
  ["planning", "right"],
  ["caisse-asso", "right"],
  ["verifier-erreurs", "right"],
  ["potager", "right"],
  ["jardin", "right"],
  ["randonnee", "right"],
  ["promener-chiens", "right"],
  ["proteger-riviere", "right"],
  ["conduire-scooter", "right"],
  ["baby-sitting", "left"],
  ["aider-personne-agee", "left"],
  ["cuisiner-famille", "left"],
  ["theatre", "left"],
  ["accueillir-evenement", "left"],
  ["vendre-vinted", "left"],
  ["refuge", "left"],
];

const responses: Response[] = CARD_PICKS.map(([cardId, direction], i) => ({
  cardId,
  direction,
  ts: i,
}));

const TRAIT_PICKS: [string, SwipeDirection][] = [
  ["social-1", "left"],
  ["social-2", "right"],
  ["social-3", "right"],
  ["structure-1", "left"],
  ["structure-2", "right"],
  ["structure-3", "left"],
  ["openness-1", "left"],
  ["openness-2", "right"],
  ["openness-3", "left"],
  ["cooperation-1", "right"],
  ["cooperation-2", "right"],
  ["cooperation-3", "left"],
  ["pace-1", "right"],
  ["pace-2", "right"],
  ["pace-3", "left"],
];

const traitResponses: TraitResponse[] = TRAIT_PICKS.map(
  ([pairId, direction], i) => ({
    pairId,
    direction,
    ts: i,
  }),
);

const base = computeProfile(responses, traitResponses);
const profile = resolveConfirmation(base, "manual", true);

/**
 * Persona de démonstration : le profil "manuel + tech, autonome et structuré".
 * Sert à montrer la restitution sans jouer 35 cartes devant le jury.
 */
export const DEMO = {
  profile,
  responses,
  traitResponses,
};
