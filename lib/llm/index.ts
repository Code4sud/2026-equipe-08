import type { z } from "zod";
import { runClaudeCli } from "./cli";

/**
 * Couche LLM unique de Déclic. Toutes les features passent par ici.
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

export const DEFAULT_MODEL = "claude-opus-5-5";

export function llmBackend(): Backend {
  const value = process.env.LLM_BACKEND;
  return value === "cli" || value === "api" ? value : "mock";
}

export async function completeJson<T>(opts: CompleteJsonOptions<T>): Promise<T | null> {
  const backend = llmBackend();
  if (backend === "mock") return null;

  if (backend === "api") {
    // TODO(P1) : brancher @anthropic-ai/sdk ici (même signature).
    console.warn("[llm] backend 'api' pas encore branché, repli sans LLM");
    return null;
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
      console.warn("[llm] sortie hors schéma", parsed.error.issues.slice(0, 3));
      return null;
    }
    return parsed.data;
  } catch (error) {
    console.warn("[llm] échec", error instanceof Error ? error.message : error);
    return null;
  }
}
