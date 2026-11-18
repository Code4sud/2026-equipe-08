import type { Job, Profile, TraitId, TraitState } from "./types";
import { TRAITS } from "./types";

export const TRAIT_META: Record<
  TraitId,
  {
    label: string;
    low: string;
    high: string;
    question: string;
    workImplication: string;
  }
> = {
  socialEnergy: {
    label: "Énergie sociale",
    low: "Plutôt seul",
    high: "Plutôt avec du monde",
    question: "Tu recharges comment ?",
    workImplication: "contact avec le public, taille d'équipe, animation",
  },
  structure: {
    label: "Besoin de structure",
    low: "Improvisation",
    high: "Cadre clair",
    question: "Tu bosses comment ?",
    workImplication: "procédures, planning, routine, précision",
  },
  openness: {
    label: "Ouverture",
    low: "Repères stables",
    high: "Nouveauté",
    question: "Tu réagis comment au changement ?",
    workImplication: "variété, projets, changement, création",
  },
  cooperation: {
    label: "Coopération",
    low: "Compétition",
    high: "Entraide",
    question: "Tu fonctionnes comment avec les autres ?",
    workImplication: "travail collectif, soin, accompagnement, conflit",
  },
  pace: {
    label: "Rythme",
    low: "Régulier",
    high: "Sous pression",
    question: "Tu préfères quel rythme ?",
    workImplication: "urgences, pics d'activité, horaires décalés",
  },
};

const clean = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

type ContextRule = {
  trait: TraitId;
  patterns: string[];
  value: number;
};

/**
 * Règles expertes : contextes ROME -> spectres de travail.
 * Ce ne sont pas des "traits de personnalité" mais des exigences
 * d'environnement, dérivées de libellés officiels ROME.
 */
const CONTEXT_RULES: ContextRule[] = [
  // Énergie sociale
  {
    trait: "socialEnergy",
    patterns: ["en contact avec du public", "centres d'appels", "commerce de proximite", "accueil"],
    value: 0.8,
  },
  {
    trait: "socialEnergy",
    patterns: ["travail en autonomie et en situation isolee"],
    value: -0.9,
  },
  {
    trait: "socialEnergy",
    patterns: ["en milieu occupe", "travail en mode projet"],
    value: 0.3,
  },

  // Structure
  {
    trait: "structure",
    patterns: ["travail repetitif ou cadence imposee", "travail en horaires fixes"],
    value: 0.7,
  },
  {
    trait: "structure",
    patterns: ["travail selon un rythme irregulier", "polyactivite"],
    value: -0.5,
  },

  // Ouverture
  {
    trait: "openness",
    patterns: ["polyactivite", "travail en mode projet", "deplacements professionnels"],
    value: 0.6,
  },
  {
    trait: "openness",
    patterns: ["travail repetitif ou cadence imposee"],
    value: -0.6,
  },
  {
    trait: "openness",
    patterns: ["zone internationale", "zone europeenne", "partenaires internationaux"],
    value: 0.4,
  },

  // Coopération
  {
    trait: "cooperation",
    patterns: [
      "enfants",
      "patients",
      "personnes agees",
      "personnes vulnerables",
      "personnes en situation de handicap",
      "personnes medicalisees",
      "publics en situation d'illettrisme",
      "jeunes en insertion",
    ],
    value: 0.7,
  },
  {
    trait: "cooperation",
    patterns: ["travail avec des animaux"],
    value: 0.3,
  },
  {
    trait: "cooperation",
    patterns: ["travail en autonomie et en situation isolee"],
    value: -0.3,
  },

  // Rythme
  {
    trait: "pace",
    patterns: [
      "travail en horaires decales",
      "travail de nuit",
      "travail les week-ends",
      "travail le dimanche",
      "travail poste",
      "mobilisable en urgence",
      "travail en flux tendu",
      "travail saisonnier",
      "travail selon un rythme irregulier",
    ],
    value: 0.7,
  },
  {
    trait: "pace",
    patterns: ["travail en horaires fixes", "travail en journee"],
    value: -0.4,
  },
];

export function deriveJobContext(job: Job): Record<TraitId, number> {
  const out: Record<TraitId, number> = {
    socialEnergy: 0,
    structure: 0,
    openness: 0,
    cooperation: 0,
    pace: 0,
  };

  const contexts = job.contexts.map(clean);
  for (const rule of CONTEXT_RULES) {
    const hit = rule.patterns.some((p) => contexts.some((c) => c.includes(p)));
    if (hit) out[rule.trait] += rule.value;
  }

  for (const trait of TRAITS) {
    out[trait] = Math.max(-1, Math.min(1, out[trait]));
  }
  return out;
}

export function traitFit(state: TraitState, jobValue: number): number | null {
  if (state.confidence < 0.15) return null;
  // 1 quand le métier est exactement au niveau préféré, 0 quand il est à l'opposé.
  return 1 - Math.abs(state.mean - jobValue) / 2;
}

export function contextFit(profile: Profile, job: Job): number {
  const jobContext = deriveJobContext(job);
  let sum = 0;
  let total = 0;

  for (const trait of TRAITS) {
    const state = profile.traits[trait];
    const fit = traitFit(state, jobContext[trait]);
    if (fit === null) continue;
    sum += fit * state.confidence;
    total += state.confidence;
  }

  return total === 0 ? 0.5 : sum / total;
}

const PRACTICAL_FRICTIONS: { pattern: string; label: string }[] = [
  { pattern: "travail de nuit", label: "Horaires de nuit" },
  { pattern: "travail les week-ends", label: "Travail le week-end" },
  { pattern: "travail le dimanche", label: "Travail le dimanche" },
  { pattern: "travail en horaires decales", label: "Horaires décalés" },
  { pattern: "port et manipulation de charges", label: "Port de charges lourdes" },
  { pattern: "station debout prolongee", label: "Debout toute la journée" },
  { pattern: "en environnement bruyant", label: "Environnement bruyant" },
  { pattern: "en extérieur", label: "Travail en extérieur" },
  { pattern: "position penible", label: "Postures pénibles" },
  { pattern: "travail repetitif", label: "Tâches répétitives" },
];

export function frictionFor(profile: Profile, job: Job): string[] {
  const context = deriveJobContext(job);
  const frictions: { label: string; weight: number }[] = [];

  const compare = (
    trait: TraitId,
    predicate: (jobValue: number, userValue: number) => boolean,
    label: string,
  ) => {
    const state = profile.traits[trait];
    if (state.confidence < 0.2) return;
    if (predicate(context[trait], state.mean)) {
      frictions.push({ label, weight: Math.abs(context[trait] - state.mean) });
    }
  };

  compare(
    "socialEnergy",
    (j, u) => j > 0.4 && u < -0.2,
    "Beaucoup de contact avec du public",
  );
  compare(
    "socialEnergy",
    (j, u) => j < -0.3 && u > 0.2,
    "Travail plutôt seul",
  );
  compare(
    "structure",
    (j, u) => j > 0.4 && u < -0.2,
    "Cadre et procédures très structurés",
  );
  compare(
    "structure",
    (j, u) => j < -0.3 && u > 0.2,
    "Peu de cadre, beaucoup d'imprévu",
  );
  compare(
    "openness",
    (j, u) => j > 0.4 && u < -0.2,
    "Changement et polyvalence permanents",
  );
  compare(
    "openness",
    (j, u) => j < -0.3 && u > 0.2,
    "Tâches répétitives",
  );
  compare(
    "cooperation",
    (j, u) => j > 0.4 && u < -0.2,
    "Travail centré sur l'aide aux autres",
  );
  compare(
    "pace",
    (j, u) => j > 0.4 && u < -0.2,
    "Rythme irrégulier, pics de pression",
  );
  compare(
    "pace",
    (j, u) => j < -0.3 && u > 0.2,
    "Rythme très régulier",
  );

  const contexts = job.contexts.map(clean);
  for (const rule of PRACTICAL_FRICTIONS) {
    if (contexts.some((c) => c.includes(rule.pattern))) {
      frictions.push({ label: rule.label, weight: 0.5 });
    }
  }

  return [...new Set(frictions.sort((a, b) => b.weight - a.weight).map((f) => f.label))].slice(
    0,
    2,
  );
}

export function traitSummary(trait: TraitId, value: number): string {
  const meta = TRAIT_META[trait];
  if (value > 0.25) return meta.high;
  if (value < -0.25) return meta.low;
  return "À l'aise dans les deux";
}
