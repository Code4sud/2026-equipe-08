/**
 * Politique de la question « Tu l'as déjà fait ? ».
 *
 * Elle ne doit pas tomber après chaque « oui » : c'est une question qui coupe
 * le rythme du swipe. On ne la pose que quand le vécu peut vraiment servir :
 * - assez de « oui » pour que le profil ait un signal ;
 * - la carte appartient à un domaine qui monte (ou déjà confirmé) ;
 * - pas de confirmation de domaine en attente, pas de carte « creuser » ;
 * - au maximum 3 fois, et jamais après 2 entretiens (le CV a assez de matière).
 */

export const FIRST_EXPERIENCE_ASK = 4;
export const EXPERIENCE_ASK_EVERY = 5;
export const MAX_EXPERIENCE_ASKS = 3;
export const MAX_EXPERIENCE_INTERVIEWS = 2;
export const MIN_EXPERIENCE_DOMAIN_MEAN = 0.58;

export type ExperienceAskInput = {
  direction: "left" | "right";
  isCreuser: boolean;
  pending: boolean;
  /** Nombre de « oui » sur des cartes d'intérêt, carte courante incluse. */
  rightInterests: number;
  experienceAsks: number;
  interviewsCount: number;
  domainMean: number;
  domainConfirmed: boolean;
};

export function shouldAskExperience({
  direction,
  isCreuser,
  pending,
  rightInterests,
  experienceAsks,
  interviewsCount,
  domainMean,
  domainConfirmed,
}: ExperienceAskInput): boolean {
  if (direction !== "right") return false;
  if (isCreuser) return false;
  if (pending) return false;
  if (experienceAsks >= MAX_EXPERIENCE_ASKS) return false;
  if (interviewsCount >= MAX_EXPERIENCE_INTERVIEWS) return false;

  const threshold =
    FIRST_EXPERIENCE_ASK + experienceAsks * EXPERIENCE_ASK_EVERY;
  if (rightInterests < threshold) return false;

  return domainConfirmed || domainMean >= MIN_EXPERIENCE_DOMAIN_MEAN;
}
