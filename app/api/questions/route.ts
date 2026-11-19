import { z } from "zod";
import { getMacro } from "../../../lib/adaptive/skills";
import { PROJECT_QUESTION_COUNT } from "../../../lib/interview";
import { writeQuestions } from "../../../lib/interviewQuestions";
import { llmBackend } from "../../../lib/llm";

/**
 * POST /api/questions — questions ouvertes de l'étape 2 (« Creuser »).
 *
 * Entrée : les textes des deux cartes qui prouvent le vécu + le code ROME.
 * Jamais de réponse libre du jeune.
 * Sortie : { questions, source, backend }.
 */

const bodySchema = z.object({
  parentText: z.string().min(1).max(200),
  proofText: z.string().min(1).max(200),
  macro: z.number().int(),
});

/** Cache mémoire : la même preuve donne les mêmes questions (démo instantanée). */
const cache = new Map<string, string[]>();
const CACHE_MAX = 300;

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !getMacro(parsed.data.macro)) {
    return Response.json({ error: "requête invalide" }, { status: 400 });
  }

  const backend = llmBackend();
  const key = `${PROJECT_QUESTION_COUNT}|${parsed.data.macro}|${parsed.data.parentText}|${parsed.data.proofText}`;
  const cached = cache.get(key);
  if (cached) return Response.json({ questions: cached, source: "generated", backend });

  const { questions, source } = await writeQuestions(parsed.data);
  if (source === "generated") {
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
    cache.set(key, questions);
  }
  return Response.json({ questions, source, backend });
}
