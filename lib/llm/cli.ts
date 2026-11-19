import { spawn } from "node:child_process";
import os from "node:os";

/**
 * Appelle `claude -p` (Claude Code en mode non interactif) avec
 * l'abonnement de la personne connectée sur la machine.
 *
 * - aucun outil (`--tools ""`), aucun serveur MCP, pas de session sauvegardée ;
 * - lancé depuis le dossier temporaire pour ne pas charger les fichiers
 *   d'instructions du repo ;
 * - sortie structurée via `--json-schema`, relue en JSON.
 *
 * Local uniquement : ne marche pas sur Vercel (pas de CLI, pas de compte).
 */
export async function runClaudeCli({
  system,
  prompt,
  jsonSchema,
  model,
  effort,
  timeoutMs,
}: {
  system: string;
  prompt: string;
  jsonSchema: Record<string, unknown>;
  model: string;
  effort: string;
  timeoutMs: number;
}): Promise<unknown> {
  const args = [
    "-p",
    "--output-format",
    "json",
    "--model",
    model,
    "--effort",
    effort,
    "--system-prompt",
    system,
    "--json-schema",
    JSON.stringify(jsonSchema),
    "--tools",
    "",
    "--strict-mcp-config",
    "--no-session-persistence",
  ];

  const stdout = await new Promise<string>((resolve, reject) => {
    const child = spawn(process.env.CLAUDE_BIN || "claude", args, {
      cwd: os.tmpdir(),
      stdio: ["pipe", "pipe", "pipe"],
    });
    let out = "";
    let err = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`claude -p : timeout après ${timeoutMs} ms`));
    }, timeoutMs);

    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(out);
      else reject(new Error(`claude -p : code ${code} ${err.slice(0, 300)}`));
    });

    child.stdin.end(prompt);
  });

  return extractJson(stdout);
}

/**
 * `--output-format json` renvoie une enveloppe ; la sortie structurée est
 * dans `structured_output` quand `--json-schema` est utilisé, sinon le texte
 * est dans `result`. On accepte les deux.
 */
export function extractJson(stdout: string): unknown {
  const envelope = JSON.parse(stdout) as {
    is_error?: boolean;
    result?: unknown;
    structured_output?: unknown;
  };
  if (envelope.is_error) throw new Error(`claude -p : ${String(envelope.result).slice(0, 300)}`);
  if (envelope.structured_output && typeof envelope.structured_output === "object") {
    return envelope.structured_output;
  }
  if (typeof envelope.result === "string") {
    const text = envelope.result.trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(text.slice(start, end + 1));
  }
  throw new Error("claude -p : aucune sortie JSON exploitable");
}
