import { z } from "zod";
import { getMacro } from "./adaptive/skills";
import { PROJECT_QUESTION_COUNT, fallbackQuestions, type QuestionSource } from "./interview";
import { completeJson } from "./llm";

/**
 * Questions ouvertes de l'étape 2, écrites par le LLM (serveur uniquement).
 *
 * Le LLM reçoit uniquement des TEXTES DE CARTES et la compétence ROME :
 * jamais une réponse du jeune (règle « récit libre jamais envoyé brut à
 * l'IA », docs/DOSSIER.md). Sans LLM ou si la sortie sort du cadre : questions
 * de repli (`fallbackQuestions`).
 */

export const QUESTIONS_SYSTEM_PROMPT = `Tu prépares un mini-entretien pour Orientis, une app qui aide des jeunes de 17 à 25 ans en décrochage, suivis en mission locale, à mettre des mots sur ce qu'ils savent faire. Beaucoup pensent qu'ils ne savent "rien faire".

Le jeune vient de dire qu'il a DÉJÀ vécu une situation précise. On te donne cette situation et la compétence du répertoire ROME (France Travail) qu'elle prouve. Tu écris ${PROJECT_QUESTION_COUNT} questions ouvertes pour lui faire raconter CETTE expérience, de quoi écrire ensuite une ligne de CV crédible.

Ordre :
1. le contexte (quand, où, dans quel cadre : potes, asso, quartier, petit job, en ligne…) ;
2. ce qu'il a fait LUI, concrètement, étape par étape ;
3. le résultat (ce que ça a donné, pour qui, un retour reçu).

Règles :
- Uniquement sur cette expérience. Pas de question sur sa vie, ses projets, ses études ou sa motivation.
- Une seule idée par question, 8 à 25 mots, registre parlé, tutoiement, sans jargon ROME ni intitulé de métier.
- Ouvertes : impossible d'y répondre par oui ou non.
- Ancre les questions dans la situation (reprends ses mots), et oriente au moins une question vers la compétence ROME sans la nommer.
- Bienveillant : jamais de jugement, jamais "pourquoi tu n'as pas…".
- Interdit : la santé, le handicap, l'origine, le pays, la religion, la famille du jeune, son argent, sa situation administrative, la politique, la sexualité. Ne demande aucun nom de personne.
- Écris de façon neutre en genre (évite les accords au masculin ou au féminin quand c'est possible).

Réponds uniquement avec l'objet JSON demandé.`;

const MIN_LEN = 12;
const MAX_LEN = 180;

const schema = z.object({ questions: z.array(z.string()).min(1).max(8) });

const jsonSchema = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: { type: "string" },
      minItems: PROJECT_QUESTION_COUNT,
      maxItems: PROJECT_QUESTION_COUNT,
    },
  },
  required: ["questions"],
  additionalProperties: false,
};

export type QuestionInput = {
  /** Carte où le jeune a dit « déjà fait ». */
  parentText: string;
  /** Question de vécu à laquelle il a répondu oui. */
  proofText: string;
  /** Code OGR de la macro-compétence ROME. */
  macro: number;
};

export function buildQuestionsPrompt({ parentText, proofText, macro }: QuestionInput): string {
  const m = getMacro(macro);
  const lines = [
    `Situation vécue (il a dit "déjà fait") : « ${parentText} »`,
    `Il a précisé : oui à « ${proofText} »`,
  ];
  if (m) {
    lines.push(`Compétence ROME prouvée : « ${m.label} »`);
    const children = m.children.slice(0, 8).map((c) => c.label);
    if (children.length > 0) lines.push("Compétences fines (pour orienter, sans les citer) :", ...children.map((c) => `- ${c}`));
  }
  return lines.join("\n");
}

/**
 * Gabarit seulement : une consigne ouverte (« Raconte étape par étape ce que
 * t'as fait ») vaut une question, elle n'a pas besoin de « ? ».
 */
const OPEN_MARKERS =
  /\b(comment|pourquoi|quand|où|quel|quelle|quels|quelles|qu'est-ce|quoi|raconte|décris|explique|parle)\b/iu;
const YES_NO_START =
  /^(est-ce que\s+)?(tu\s+|t'|tu$)?(as|es|peux|sais|veux|aimes|fais|vas|viens)\b/iu;
const IMPERATIVE = /^(raconte|décris|explique|parle|dis)\b/iu;

export function isUsableQuestion(q: string): boolean {
  const text = q.trim();
  if (text.length < MIN_LEN || text.length > MAX_LEN) return false;
  // Une question fermée (« T'as déjà réparé ? ») ne produit pas de récit.
  if (YES_NO_START.test(text) && !OPEN_MARKERS.test(text)) return false;
  // On accepte une consigne ouverte (« Raconte étape par étape… ») sans « ? ».
  if (!text.includes("?") && !IMPERATIVE.test(text)) return false;
  return true;
}

export async function writeQuestions(
  input: QuestionInput,
): Promise<{ questions: string[]; source: QuestionSource }> {
  const fallback = { questions: fallbackQuestions(input.parentText), source: "template" as const };

  const out = await completeJson({
    system: QUESTIONS_SYSTEM_PROMPT,
    prompt: buildQuestionsPrompt(input),
    schema,
    jsonSchema,
    effort: "low",
  });
  if (!out) return fallback;

  const questions = out.questions.map((q) => q.trim()).filter(isUsableQuestion);
  if (questions.length < PROJECT_QUESTION_COUNT - 1) return fallback;

  return { questions: questions.slice(0, PROJECT_QUESTION_COUNT), source: "generated" };
}
