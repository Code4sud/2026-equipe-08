import type { z } from "zod";
import { runClaudeCli } from "./cli";

/**
 * Couche LLM unique d'Orientis. Toutes les features passent par ici.
 *
 * LLM_BACKEND (dans .env.local) :
 *   - "mock" (défaut) : aucun appel, renvoie null → chaque feature a un repli
 *   - "cli"           : `claude -p` avec l'abonnement Claude de la machine (local uniquement)
 *   - "api"           : à venir — SDK Anthropic + ANTHROPIC_API_KEY (Vercel, jury)
 *
 * LLM_MODEL : modèle utilisé (défaut claude-opus-5-5).
 *
 * Contrat : renvoie un objet validé par `schema`, ou null (échec, timeout,
 * JSON invalide, mode mock). Ne lève jamais : l'appelant décide du repli.
 */

export type Effort = "low" | "medium" | "high";

export type CompleteJsonOptions<T> = {
  system: string;
  prompt: string;
  /** Validation stricte côté serveur, quel que soit le backend. */
  schema: z.ZodType<T>;
  /** Même contrat en JSON Schema, transmis au modèle. */
  jsonSchema: Record<string, unknown>;
  effort?: Effort;
  timeoutMs?: number;
};

export type Backend = "mock" | "cli" | "api";

/** Sonnet est un alias stable du CLI ; surchargez avec LLM_MODEL si besoin. */
export const DEFAULT_MODEL = "sonnet";

export function llmBackend(): Backend {
  const value = process.env.LLM_BACKEND;
  return value === "cli" || value === "api" ? value : "mock";
}

export type CompleteJsonResult<T> = {
  data: T | null;
  backend: Backend;
  error?: string;
};

/**
 * Version détaillée : le mode démo peut afficher pourquoi l'IA n'a pas répondu
 * (mock, CLI absent, session OAuth expirée, sortie hors schéma).
 */
export async function completeJsonDetailed<T>(
  opts: CompleteJsonOptions<T>,
): Promise<CompleteJsonResult<T>> {
  const backend = llmBackend();
  if (backend === "mock") {
    return { data: null, backend, error: "LLM_BACKEND=mock" };
  }

  if (backend === "api") {
    return {
      data: null,
      backend,
      error: "backend 'api' non branché (utiliser LLM_BACKEND=cli en local)",
    };
  }

  try {
    const raw = await runClaudeCli({
      system: opts.system,
      prompt: opts.prompt,
      jsonSchema: opts.jsonSchema,
      model: process.env.LLM_MODEL || DEFAULT_MODEL,
      effort: opts.effort ?? "low",
      timeoutMs: opts.timeoutMs ?? 30_000,
    });
    const parsed = opts.schema.safeParse(raw);
    if (!parsed.success) {
      return {
        data: null,
        backend,
        error: `sortie hors schéma : ${parsed.error.issues
          .slice(0, 3)
          .map((issue) => issue.message)
          .join(", ")}`,
      };
    }
    return { data: parsed.data, backend };
  } catch (error) {
    return {
      data: null,
      backend,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function completeJson<T>(
  opts: CompleteJsonOptions<T>,
): Promise<T | null> {
  return (await completeJsonDetailed(opts)).data;
}
