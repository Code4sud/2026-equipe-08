import { createHash } from "node:crypto";
import { completeJsonDetailed, llmBackend } from "../../../lib/llm";
import {
  CvJsonSchema,
  CvNarrativeSchema,
  EmailsJsonSchema,
  EmailsNarrativeSchema,
  SynthesisJsonSchema,
  SynthesisNarrativeSchema,
  validateCv,
  validateEmails,
  validateSynthesis,
} from "../../../lib/dossier/narrative";
import {
  CV_SYSTEM_PROMPT,
  EMAILS_SYSTEM_PROMPT,
  SYNTHESIS_SYSTEM_PROMPT,
  buildCvPrompt,
  buildEmailsPrompt,
  buildSynthesisPrompt,
} from "../../../lib/dossier/prompts";
import { DossierRequestSchema } from "../../../lib/dossier/schema";
import type {
  CvNarrative,
  DossierFacts,
  EmailsNarrative,
  NarrativeSections,
  SynthesisNarrative,
} from "../../../lib/dossier/types";

export const maxDuration = 60;

const MAX_BODY = 200_000;
const CACHE_MAX = 100;

type CachedSections = {
  synthesis?: SynthesisNarrative;
  cv?: CvNarrative;
  emails?: EmailsNarrative;
};

/** Cache mémoire par faits : la démo rejoue les mêmes dossiers instantanément. */
const cache = new Map<string, CachedSections>();

function hashFacts(facts: DossierFacts): string {
  return createHash("sha256").update(JSON.stringify(facts)).digest("hex");
}

function readCache(key: string): CachedSections | undefined {
  return cache.get(key);
}

function writeCache(key: string, sections: CachedSections): void {
  if (Object.keys(sections).length === 0) return;
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
  cache.set(key, sections);
}

export async function POST(request: Request) {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_BODY) {
    return Response.json(
      { narrative: null, backend: llmBackend(), error: "faits trop volumineux" },
      { status: 413 },
    );
  }

  const parsed = DossierRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return Response.json(
      {
        narrative: null,
        backend: llmBackend(),
        error: "faits invalides",
        issues: parsed.error.issues.slice(0, 5).map((issue) => issue.message),
      },
      { status: 400 },
    );
  }

  const facts = parsed.data.facts as DossierFacts;
  if (!facts.consents.ai) {
    return Response.json(
      {
        narrative: null,
        backend: llmBackend(),
        error: "consentement IA absent",
      },
      { status: 403 },
    );
  }

  const key = hashFacts(facts);
  const cached = readCache(key);
  if (cached) {
    return Response.json({
      narrative: {
        synthesis: cached.synthesis ?? null,
        cv: cached.cv ?? null,
        emails: cached.emails ?? null,
      } satisfies NarrativeSections,
      backend: llmBackend(),
      cached: true,
    });
  }

  const errors: string[] = [];

  const [synthesisResult, cvResult, emailsResult] = await Promise.allSettled([
    completeJsonDetailed({
      system: SYNTHESIS_SYSTEM_PROMPT,
      prompt: buildSynthesisPrompt(facts),
      schema: SynthesisNarrativeSchema,
      jsonSchema: SynthesisJsonSchema,
      effort: "low",
      timeoutMs: 45_000,
    }),
    completeJsonDetailed({
      system: CV_SYSTEM_PROMPT,
      prompt: buildCvPrompt(facts),
      schema: CvNarrativeSchema,
      jsonSchema: CvJsonSchema,
      effort: "low",
      timeoutMs: 45_000,
    }),
    completeJsonDetailed({
      system: EMAILS_SYSTEM_PROMPT,
      prompt: buildEmailsPrompt(facts),
      schema: EmailsNarrativeSchema,
      jsonSchema: EmailsJsonSchema,
      effort: "low",
      timeoutMs: 45_000,
    }),
  ]);

  let synthesis: SynthesisNarrative | null = null;
  let cv: CvNarrative | null = null;
  let emails: EmailsNarrative | null = null;

  if (synthesisResult.status === "fulfilled" && synthesisResult.value.data) {
    synthesis = validateSynthesis(synthesisResult.value.data, facts);
  } else if (synthesisResult.status === "fulfilled") {
    errors.push(`synthèse : ${synthesisResult.value.error ?? "pas de réponse"}`);
  } else {
    errors.push(`synthèse : ${String(synthesisResult.reason)}`);
  }

  if (cvResult.status === "fulfilled" && cvResult.value.data) {
    cv = validateCv(cvResult.value.data, facts);
    // Le CV généré est lié à l'offre envoyée : s'il n'a pas renvoyé l'id,
    // on le rattache à l'offre courante. Un changement d'offre côté client
    // empêchera ensuite la fusion.
    if (cv && facts.cvTarget.offerId) cv.targetOfferId = facts.cvTarget.offerId;
  } else if (cvResult.status === "fulfilled") {
    errors.push(`cv : ${cvResult.value.error ?? "pas de réponse"}`);
  } else {
    errors.push(`cv : ${String(cvResult.reason)}`);
  }

  if (emailsResult.status === "fulfilled" && emailsResult.value.data) {
    emails = validateEmails(emailsResult.value.data, facts);
  } else if (emailsResult.status === "fulfilled") {
    errors.push(`emails : ${emailsResult.value.error ?? "pas de réponse"}`);
  } else {
    errors.push(`emails : ${String(emailsResult.reason)}`);
  }

  if (!synthesis && !cv && !emails) {
    return Response.json({
      narrative: null,
      backend: llmBackend(),
      error: errors.join(" | ") || "pas de narrative",
    });
  }

  writeCache(key, {
    synthesis: synthesis ?? undefined,
    cv: cv ?? undefined,
    emails: emails ?? undefined,
  });

  return Response.json({
    narrative: { synthesis, cv, emails } satisfies NarrativeSections,
    backend: llmBackend(),
    errors: errors.length > 0 ? errors : undefined,
  });
}
