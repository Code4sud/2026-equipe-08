import { z } from "zod";
import { suggestJobs } from "../../../lib/careers";
import { llmBackend } from "../../../lib/llm";
import type { JobSuggestion, MatchInput } from "../../../lib/matches";

/**
 * POST /api/jobs — métiers ROME proposés à partir des skill matches.
 * Entrée : les matchs (textes de cartes, compétence ROME, centres d'intérêt).
 * Jamais de texte libre du jeune.
 * Sortie : { jobs: JobSuggestion[], backend }.
 */

const bodySchema = z.object({
  matches: z
    .array(
      z.object({
        cardId: z.string().min(1).max(160),
        text: z.string().min(1).max(200),
        skill: z.number().int().optional(),
        centers: z.record(z.string(), z.number().min(0).max(1)),
      }),
    )
    .min(1)
    .max(40),
});

const cache = new Map<string, JobSuggestion[]>();
const CACHE_MAX = 200;

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "requête invalide" }, { status: 400 });

  const matches: MatchInput[] = parsed.data.matches;
  const backend = llmBackend();
  const key = `${backend}|${matches.map((m) => `${m.cardId}:${m.skill ?? ""}`).sort().join("|")}`;
  const cached = cache.get(key);
  if (cached) return Response.json({ jobs: cached, backend });

  const jobs = await suggestJobs(matches);
  if (jobs.some((j) => j.source === "generated")) {
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
    cache.set(key, jobs);
  }
  return Response.json({ jobs, backend });
}
