export const RIASEC = ["R", "I", "A", "S", "E", "C"] as const;
export type Riasec = (typeof RIASEC)[number];

export const TRAITS = [
  "socialEnergy",
  "structure",
  "openness",
  "cooperation",
  "pace",
] as const;
export type TraitId = (typeof TRAITS)[number];

export type CenterId = string;

export type CenterMeta = {
  id: CenterId;
  label: string;
  short: string;
  definition?: string;
  jobCount?: number;
  riasec: Partial<Record<Riasec, number>>;
};

export type Card = {
  id: string;
  text: string;
  hint?: string;
  emoji?: string;
  /** Poids 0..1 par centre. La somme doit rester ≈ 1. */
  centers: Partial<Record<CenterId, number>>;
  tags?: string[];
  /** Absent = carte de la banque fixe (content/cards.ts). */
  source?: CardSource;
  /** Compétence ROME visée par une carte générée. Cachée au jeune, tracée. */
  target?: CardTarget;
};

/**
 * - "generated" : texte écrit par le LLM
 * - "template"  : LLM indisponible, texte construit depuis le libellé ROME
 */
export type CardSource = "generated" | "template";

/**
 * - "explorer" : sonder une zone ROME pas encore vue
 * - "creuser"  : approfondir une carte où le jeune a dit "déjà fait"
 */
export type TargetMode = "explorer" | "creuser";

export type CardTarget = {
  mode: TargetMode;
  /** Code OGR de la macro-compétence ROME. */
  macro: number;
  /** Libellé ROME de la macro (pour la restitution et le quiz). */
  label: string;
  /** Compétence fine visée en mode "creuser", si elle existe. */
  focus?: string;
  /** Centre d'intérêt sondé (mode "explorer") ou centre de la carte parente. */
  center: CenterId;
  /** Carte qui a déclenché le mode "creuser". */
  parentId?: string;
};

export type TraitPair = {
  id: string;
  trait: TraitId;
  prompt: string;
  left: string;
  right: string;
  /** Contribution du choix gauche au trait, -1..1 */
  leftValue: number;
  /** Contribution du choix droit au trait, -1..1 */
  rightValue: number;
};

export type SwipeDirection = "left" | "right";

export type SwipeReason =
  | "pas-mon-truc"
  | "jamais-essaye"
  | "pas-capable"
  | "pas-les-moyens"
  | "pas-pres"
  | "deja-souvent"
  | "deja-une-fois"
  | "jamais-fait-mais-tente";

export type Response = {
  cardId: string;
  direction: SwipeDirection;
  reason?: SwipeReason;
  latencyMs?: number;
  ts: number;
};

export type TraitResponse = {
  pairId: string;
  direction: SwipeDirection;
  latencyMs?: number;
  ts: number;
};

export type Confirmation = {
  centerId: CenterId;
  accepted: boolean;
  ts: number;
};

export type DomainState = {
  alpha: number;
  beta: number;
  /** Nombre effectif d'observations pondérées. */
  nEff: number;
  mean: number;
  sd: number;
  lower80: number;
  upper80: number;
  /** 0..1, largeur de l'intervalle. */
  confidence: number;
  confirmed: boolean;
  rejected: boolean;
  likedCards: string[];
  dislikedCards: string[];
};

export type TraitState = {
  sum: number;
  n: number;
  /** -1..1 */
  mean: number;
  /** 0..1 */
  confidence: number;
};

export type Profile = {
  domains: Record<CenterId, DomainState>;
  traits: Record<TraitId, TraitState>;
  theta: Record<Riasec, number>;
  code: string;
  /** 0..1 — les deux premiers types sont-ils adjacents ? */
  consistency: number;
  /** 0..1 — le profil est-il tranché ou plat ? */
  differentiation: number;
  confirmed: CenterId[];
  rejected: CenterId[];
  answered: number;
};

export type JobCompetence = {
  code: string;
  label: string;
  principal?: boolean;
};

export type Job = {
  code: string;
  label: string;
  definition: string;
  access: string;
  level: number | null;
  centers: Record<CenterId, number>;
  riasec: Record<Riasec, number>;
  contexts: string[];
  competences: {
    savoirFaire: JobCompetence[];
    savoirEtre: JobCompetence[];
    savoirs: JobCompetence[];
  };
  mobilities: string[];
};

export type JobMatch = {
  job: Job;
  /** 0..1 */
  score: number;
  /** 0..1 */
  interest: number;
  /** 0..1 */
  context: number;
  direction: CenterId;
  evidence: string[];
  friction: string[];
};

export type Direction = {
  centerId: CenterId;
  title: string;
  subtitle: string;
  score: number;
  jobs: JobMatch[];
};
