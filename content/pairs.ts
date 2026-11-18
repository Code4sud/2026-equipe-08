import type { TraitPair } from "../lib/types";

/**
 * 15 paires de choix forcés — 3 par spectre.
 * Même geste que les cartes d'intérêts : gauche = option gauche,
 * droite = option droite. Les pôles sont inversés d'une paire à l'autre
 * pour éviter le straight-lining.
 *
 * Aucun item ne mesure une santé mentale. Le 5e spectre est un rythme
 * de travail préféré, pas une stabilité émotionnelle.
 */
export const PAIRS: TraitPair[] = [
  // --- Énergie sociale ----------------------------------------------------
  {
    id: "social-1",
    trait: "socialEnergy",
    prompt: "Le samedi soir, tu préfères…",
    left: "Un truc calme avec 1–2 potes",
    right: "Un plan avec beaucoup de monde",
    leftValue: -1,
    rightValue: 1,
  },
  {
    id: "social-2",
    trait: "socialEnergy",
    prompt: "Dans un nouveau groupe…",
    left: "Tu vas parler aux gens",
    right: "Tu attends qu'on vienne vers toi",
    leftValue: 1,
    rightValue: -1,
  },
  {
    id: "social-3",
    trait: "socialEnergy",
    prompt: "En réunion ou en cours…",
    left: "Tu prends la parole facilement",
    right: "Tu écoutes et tu parles si on te demande",
    leftValue: 1,
    rightValue: -1,
  },

  // --- Structure ----------------------------------------------------------
  {
    id: "structure-1",
    trait: "structure",
    prompt: "Pour un projet…",
    left: "Tu fais un plan avant de commencer",
    right: "Tu commences et tu vois",
    leftValue: 1,
    rightValue: -1,
  },
  {
    id: "structure-2",
    trait: "structure",
    prompt: "Ton espace de travail…",
    left: "C'est le bazar, mais tu t'y retrouves",
    right: "Chaque chose a sa place",
    leftValue: -1,
    rightValue: 1,
  },
  {
    id: "structure-3",
    trait: "structure",
    prompt: "Une consigne floue…",
    left: "Tu demandes un cadre précis",
    right: "Tu improvises",
    leftValue: 1,
    rightValue: -1,
  },

  // --- Ouverture ----------------------------------------------------------
  {
    id: "openness-1",
    trait: "openness",
    prompt: "Un truc que tu ne connais pas…",
    left: "Tu testes direct",
    right: "Tu préfères ce que tu maîtrises",
    leftValue: 1,
    rightValue: -1,
  },
  {
    id: "openness-2",
    trait: "openness",
    prompt: "Un boulot…",
    left: "Avec des repères stables",
    right: "Qui change tout le temps",
    leftValue: -1,
    rightValue: 1,
  },
  {
    id: "openness-3",
    trait: "openness",
    prompt: "Une soirée…",
    left: "Rencontrer des gens très différents",
    right: "Retrouver les mêmes personnes",
    leftValue: 1,
    rightValue: -1,
  },

  // --- Coopération --------------------------------------------------------
  {
    id: "cooperation-1",
    trait: "cooperation",
    prompt: "Un désaccord…",
    left: "Tu cherches un compromis",
    right: "Tu défends ton point",
    leftValue: 1,
    rightValue: -1,
  },
  {
    id: "cooperation-2",
    trait: "cooperation",
    prompt: "Un projet en groupe…",
    left: "Tu veux qu'on avance ensemble",
    right: "Tu veux être le meilleur",
    leftValue: 1,
    rightValue: -1,
  },
  {
    id: "cooperation-3",
    trait: "cooperation",
    prompt: "Quelqu'un galère à côté de toi…",
    left: "Tu continues ta route",
    right: "Tu t'arrêtes pour l'aider",
    leftValue: -1,
    rightValue: 1,
  },

  // --- Rythme -------------------------------------------------------------
  {
    id: "pace-1",
    trait: "pace",
    prompt: "Une journée de boulot…",
    left: "Ça bouge, il y a de l'urgence",
    right: "Un rythme régulier, prévisible",
    leftValue: 1,
    rightValue: -1,
  },
  {
    id: "pace-2",
    trait: "pace",
    prompt: "Un imprévu arrive…",
    left: "Tu gères dans l'instant",
    right: "Tu préfères que ça se calme avant de décider",
    leftValue: 1,
    rightValue: -1,
  },
  {
    id: "pace-3",
    trait: "pace",
    prompt: "Tu préfères…",
    left: "Un rythme stable",
    right: "Des pics de pression",
    leftValue: -1,
    rightValue: 1,
  },
];
