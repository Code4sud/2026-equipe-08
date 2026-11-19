/**
 * Affiche les prompts exacts envoyés à Claude, sans appeler l'IA.
 *
 *   npm run prompts
 *
 * Local uniquement : le dump du dossier contient les réponses d'entretien.
 * Pour voir les réponses réelles de Claude en plus des prompts :
 *   LLM_DEBUG_PROMPTS=1 LLM_BACKEND=cli npm run dev
 *   puis lire .llm-debug/prompts.jsonl
 */

import { CARDS } from "../content/cards";
import {
  CARD_SYSTEM_PROMPT,
  buildCardPrompt,
  type CardContext,
} from "../lib/adaptive/writer";
import { pickTarget } from "../lib/adaptive/target";
import { DEMO_SESSION, DEMO_USER } from "../lib/dossier/demo";
import { buildDossier, profileFromSession } from "../lib/dossier/build";
import { buildFacts } from "../lib/dossier/narrative";
import {
  DOSSIER_SYSTEM_PROMPT,
  buildDossierPrompt,
} from "../lib/dossier/prompts";
import {
  QUESTIONS_SYSTEM_PROMPT,
  buildQuestionsPrompt,
} from "../lib/interviewQuestions";
import type { Response } from "../lib/types";

const profile = profileFromSession(DEMO_SESSION);
const cards = [...CARDS, ...DEMO_SESSION.generated];
const responses = DEMO_SESSION.responses;

const cardById = new Map(cards.map((card) => [card.id, card]));
const textOf = (response: Response) => cardById.get(response.cardId)?.text;
const isInterest = (response: Response) =>
  cardById.get(response.cardId)?.target?.mode !== "creuser";

const context: CardContext = {
  recent: responses
    .slice(-8)
    .map(textOf)
    .filter((text): text is string => Boolean(text)),
  liked: responses
    .filter((response) => response.direction === "right" && isInterest(response))
    .slice(-6)
    .reverse()
    .map(textOf)
    .filter((text): text is string => Boolean(text)),
  disliked: responses
    .filter(
      (response) =>
        response.direction === "left" &&
        isInterest(response) &&
        (!response.reason || response.reason === "pas-mon-truc"),
    )
    .slice(-4)
    .map(textOf)
    .filter((text): text is string => Boolean(text)),
};

const plan = pickTarget({
  profile,
  responses,
  cards,
  rand: () => 0.5,
  allowLoose: false,
});

function section(title: string, body: string) {
  console.log(`\n\n${"=".repeat(90)}\n${title}\n${"=".repeat(90)}\n${body}`);
}

console.log(
  "ATTENTION : ce dump contient les réponses d'entretien du persona de démo. Local uniquement.",
);

section("1. CARTE ADAPTATIVE — SYSTEM", CARD_SYSTEM_PROMPT);
if (plan) {
  section("1. CARTE ADAPTATIVE — USER", buildCardPrompt(plan, context));
} else {
  section("1. CARTE ADAPTATIVE — USER", "(aucun plan de carte avec ce persona)");
}

const interview = DEMO_SESSION.interviews?.[0];
if (interview) {
  section("2. QUESTIONS ÉTAPE 2 — SYSTEM", QUESTIONS_SYSTEM_PROMPT);
  section(
    "2. QUESTIONS ÉTAPE 2 — USER",
    buildQuestionsPrompt({
      parentText: interview.parentText,
      proofText: interview.proofText,
      macro: interview.macro,
    }),
  );
}

const dossier = buildDossier({
  session: DEMO_SESSION,
  profile,
  user: DEMO_USER,
});
const facts = buildFacts(dossier);

section("3. DOSSIER (SYNTHÈSE + CV + EMAILS) — SYSTEM", DOSSIER_SYSTEM_PROMPT);
section("3. DOSSIER (SYNTHÈSE + CV + EMAILS) — USER", buildDossierPrompt(facts));
