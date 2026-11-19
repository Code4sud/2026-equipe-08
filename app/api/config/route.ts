import { z } from "zod";
import {
  DEFAULT_MODEL,
  completeJsonDetailed,
  llmBackend,
} from "../../../lib/llm";
import { claudeBinInfo } from "../../../lib/llm/cli";

export const maxDuration = 60;

/**
 * POST /api/config
 * - sans body : renvoie l'état du backend et du binaire local
 * - { test: true } : lance un micro-appel `claude -p` et renvoie l'erreur réelle
 *
 * POST uniquement : avec Cache Components, un GET pourrait être prérendu
 * et ne plus refléter l'environnement de la machine de démo.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    test?: boolean;
  };
  const backend = llmBackend();
  const bin = claudeBinInfo();

  const info = {
    backend,
    model: process.env.LLM_MODEL || DEFAULT_MODEL,
    claudeBin: bin.path,
    claudeFound: bin.found,
  };

  if (!body.test) {
    return Response.json(info);
  }

  const result = await completeJsonDetailed({
    system: "Tu réponds uniquement avec le JSON demandé, sans texte autour.",
    prompt: 'Réponds avec {"ok":"yes"}.',
    schema: z.object({ ok: z.string() }),
    jsonSchema: {
      type: "object",
      properties: { ok: { type: "string" } },
      required: ["ok"],
      additionalProperties: false,
    },
    effort: "low",
    timeoutMs: 30_000,
  });

  return Response.json({
    ...info,
    ok: Boolean(result.data),
    error: result.error ?? null,
  });
}
