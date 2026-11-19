import { z } from "zod";
import { getIndexedJob } from "../../../lib/careers";
import { PROJECT_QUESTION_COUNT } from "../../../lib/interview";
import { writeQuestions } from "../../../lib/interviewQuestions";
import { llmBackend } from "../../../lib/llm";

/**
 * POST /api/questions — questions ouvertes de l'étape 2 (« On creuse »),
 * autour d'un métier choisi dans « Mes matchs ».
 *
 * Entrée : le code ROME du métier + les textes des cartes vécues et leur
 * compétence ROME. Jamais de réponse libre du jeune.
 * Sortie : { questions, source, backend }.
 */

const bodySchema = z.object({
  jobCode: z.string().min(1).max(12),
  jobLabel: z.string().min(1).max(200),
  experiences: z
    .array(z.object({ text: z.string().min(1).max(200), skill: z.number().int().optional() }))
    .min(1)
    .max(8),
});

/** Cache mémoire : mêmes métier et expériences, mêmes questions (démo instantanée). */
const cache = new Map<string, string[]>();
const CACHE_MAX = 300;

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !getIndexedJob(parsed.data.jobCode)) {
    return Response.json({ error: "requête invalide" }, { status: 400 });
  }

  const backend = llmBackend();
  const { jobCode, experiences } = parsed.data;
  const key = `${PROJECT_QUESTION_COUNT}|${jobCode}|${experiences.map((e) => `${e.text}:${e.skill ?? ""}`).join("|")}`;
  const cached = cache.get(key);
  if (cached) return Response.json({ questions: cached, source: "generated", backend });

  const { questions, source } = await writeQuestions(parsed.data);
  if (source === "generated") {
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
    cache.set(key, questions);
  }
  return Response.json({ questions, source, backend });
}
