import { z } from "zod";
import { CARDS } from "../../../content/cards";
import { llmBackend } from "../../../lib/llm";
import type { SkillRef } from "../../../lib/matches";
import { resolveSkill } from "../../../lib/skillOf";

/**
 * POST /api/skill — compétence ROME prouvée par un « déjà fait » sur une carte
 * de la banque. Entrée : l'id de la carte (le texte vient du serveur).
 * Sortie : { skill: { code, label } | null, backend }.
 */

const bodySchema = z.object({ cardId: z.string().min(1).max(120) });
const BY_ID = new Map(CARDS.map((c) => [c.id, c]));

/** Cache mémoire : la même carte donne la même compétence. */
const cache = new Map<string, SkillRef | null>();

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  const card = parsed.success ? BY_ID.get(parsed.data.cardId) : undefined;
  if (!card) return Response.json({ error: "requête invalide" }, { status: 400 });

  const backend = llmBackend();
  const key = `${backend}|${card.id}`;
  if (cache.has(key)) return Response.json({ skill: cache.get(key), backend });

  const skill = await resolveSkill(card);
  cache.set(key, skill);
  return Response.json({ skill, backend });
}
