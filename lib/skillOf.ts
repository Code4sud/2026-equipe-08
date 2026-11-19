import { z } from "zod";
import { poolFor, type Macro } from "./adaptive/skills";
import { lexicalMatches } from "./adaptive/target";
import { completeJson } from "./llm";
import type { SkillRef } from "./matches";
import type { Card, CenterId } from "./types";

/**
 * Compétence ROME prouvée par un « déjà fait » sur une carte de la banque
 * (serveur uniquement). Les cartes générées portent déjà la leur
 * (`card.target`).
 *
 * Short-list fermée : correspondance de mots avec les libellés ROME (avec le
 * garde-fou verbe / centre d'intérêt), puis viviers des 2 centres de la carte.
 * Le LLM choisit DANS la liste, ou répond qu'aucune ne colle. Sans LLM : le
 * lien par les mots s'il existe, sinon aucune compétence (mieux que deviner).
 */

const MAX_CANDIDATES = 8;

export function skillCandidates(card: Card): { candidates: Macro[]; lexical: Macro[] } {
  const lexical = lexicalMatches(card.text, 3, card.centers);
  const centers = (Object.entries(card.centers) as [CenterId, number][])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([id]) => id);
  const pools = [lexical, ...centers.map((c) => poolFor(c))];

  const candidates: Macro[] = [];
  for (let i = 0; candidates.length < MAX_CANDIDATES; i++) {
    let any = false;
    for (const pool of pools) {
      const m = pool[i];
      if (!m) continue;
      any = true;
      if (!candidates.some((c) => c.code === m.code)) candidates.push(m);
      if (candidates.length >= MAX_CANDIDATES) break;
    }
    if (!any) break;
  }
  return { candidates, lexical };
}

export const SKILL_SYSTEM_PROMPT = `Tu relies une expérience vécue par un jeune à une compétence du répertoire ROME (France Travail). On te donne la phrase de la carte (il a répondu "déjà fait") et une liste numérotée de compétences.

Renvoie dans "choice" le numéro de LA compétence que cette expérience prouve le plus directement. Si aucune ne correspond vraiment (lien vague ou forcé), renvoie 0. Mieux vaut 0 qu'un lien tiré par les cheveux.

Réponds uniquement avec l'objet JSON demandé.`;

const schema = z.object({ choice: z.number().int() });
const jsonSchema = {
  type: "object",
  properties: { choice: { type: "integer", description: "Numéro de la compétence, ou 0" } },
  required: ["choice"],
  additionalProperties: false,
};

export function buildSkillPrompt(card: Card, candidates: Macro[]): string {
  return [
    `Carte (déjà fait) : « ${card.text} »`,
    "Compétences :",
    ...candidates.map((m, i) => `${i + 1}. ${m.label}`),
  ].join("\n");
}

const toRef = (m: Macro): SkillRef => ({ code: m.code, label: m.label });

export async function resolveSkill(card: Card): Promise<SkillRef | null> {
  const { candidates, lexical } = skillCandidates(card);
  if (candidates.length === 0) return null;
  const fallback = lexical[0] ? toRef(lexical[0]) : null;

  const out = await completeJson({
    system: SKILL_SYSTEM_PROMPT,
    prompt: buildSkillPrompt(card, candidates),
    schema,
    jsonSchema,
    effort: "low",
  });
  if (!out) return fallback;
  if (out.choice === 0) return null;
  const chosen = candidates[out.choice - 1];
  return chosen ? toRef(chosen) : fallback;
}
