import { completeJsonDetailed, llmBackend } from "../../../lib/llm";
import {
  NarrativeJsonSchema,
  NarrativeSchema,
  validateNarrative,
} from "../../../lib/dossier/narrative";
import type { DossierFacts } from "../../../lib/dossier/types";

export const maxDuration = 60;

const SYSTEM = `Tu écris un dossier de restitution pour un jeune de 17 à 25 ans
accompagné par une mission locale ou un centre d'orientation.

Règles absolues :
- Tu ne dois JAMAIS inventer d'entreprise, d'école, d'offre, de salaire ou de formation.
- Tu utilises uniquement les faits fournis. Si une information manque, tu ne l'inventes pas.
- Chaque affirmation importante doit citer un id de preuve, d'offre ou de formation fourni.
- Tu ne fais aucune déduction sur la santé, le handicap, l'origine, la famille, la religion,
  l'orientation sexuelle, les opinions politiques ou la situation administrative.
- Tu ne diagnostiques pas de personnalité. Tu parles de préférences de travail.
- Tu ne promets pas de réussite et tu n'affiches pas de probabilité.
- Ton direct, respectueux, jamais infantilisant. Français, phrases courtes.
- Tu réponds uniquement via le JSON schema fourni.`;

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
    system: SYSTEM,
    prompt: `Voici les faits du dossier, en JSON :\n\n${JSON.stringify(body.facts, null, 2)}\n\nRédige la narrative du dossier.`,
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
