import { completeJsonDetailed, llmBackend } from "../../../lib/llm";
import {
  NarrativeJsonSchema,
  NarrativeSchema,
  validateNarrative,
} from "../../../lib/dossier/narrative";
import {
  DOSSIER_SYSTEM_PROMPT,
  buildDossierPrompt,
} from "../../../lib/dossier/prompts";
import type { DossierFacts } from "../../../lib/dossier/types";

export const maxDuration = 60;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    facts?: DossierFacts;
  } | null;

  if (!body?.facts) {
    return Response.json(
      { narrative: null, backend: llmBackend(), error: "facts manquants" },
      { status: 400 },
    );
  }

  const result = await completeJsonDetailed({
    system: DOSSIER_SYSTEM_PROMPT,
    prompt: buildDossierPrompt(body.facts),
    schema: NarrativeSchema,
    jsonSchema: NarrativeJsonSchema,
    effort: "low",
    timeoutMs: 45_000,
  });

  if (!result.data) {
    return Response.json({
      narrative: null,
      backend: result.backend,
      error: result.error ?? "pas de narrative",
    });
  }

  return Response.json({
    narrative: validateNarrative(result.data, body.facts),
    backend: result.backend,
  });
}
