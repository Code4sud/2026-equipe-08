/// <reference lib="webworker" />
import { env, pipeline, type AutomaticSpeechRecognitionPipeline } from "@huggingface/transformers";

// Pas de modèle servi par l'app : sinon transformers.js tente d'abord
// /models/… sur notre serveur (404) avant d'aller sur le Hub.
env.allowLocalModels = false;

/**
 * Dictée vocale 100 % locale : Whisper tourne dans ce Web Worker, sur
 * l'appareil. Aucun son ne quitte le navigateur. Le modèle (~75 Mo) est
 * téléchargé une fois depuis le Hub Hugging Face, puis mis en cache par le
 * navigateur.
 *
 * whisper-base en q8 : mesuré sur 14 s de français, transcription quasi
 * parfaite en ~3 s (CPU). whisper-small est parfait mais 3× plus lourd et
 * ~6× plus lent : trop pour un téléphone.
 */

const MODEL = "onnx-community/whisper-base";

export type WorkerRequest =
  | { type: "load" }
  | { type: "transcribe"; id: number; audio: Float32Array };

/** `id` relie un résultat à sa demande : un résultat tardif ne va pas dans la mauvaise réponse. */
export type WorkerResponse =
  | { type: "progress"; progress: number }
  | { type: "ready" }
  | { type: "result"; id: number; text: string }
  | { type: "error"; id?: number; message: string };

const ctx = self as unknown as DedicatedWorkerGlobalScope;
const post = (message: WorkerResponse) => ctx.postMessage(message);

let asr: Promise<AutomaticSpeechRecognitionPipeline> | null = null;

function load(): Promise<AutomaticSpeechRecognitionPipeline> {
  if (!asr) {
    // Progression agrégée sur tous les fichiers du modèle.
    const files = new Map<string, { loaded: number; total: number }>();
    asr = pipeline("automatic-speech-recognition", MODEL, {
      dtype: "q8",
      progress_callback: (info: { status: string; file?: string; loaded?: number; total?: number }) => {
        if (info.status !== "progress" || !info.file || !info.total) return;
        files.set(info.file, { loaded: info.loaded ?? 0, total: info.total });
        let loaded = 0;
        let total = 0;
        for (const f of files.values()) {
          loaded += f.loaded;
          total += f.total;
        }
        post({ type: "progress", progress: total > 0 ? loaded / total : 0 });
      },
    }) as Promise<AutomaticSpeechRecognitionPipeline>;
    asr.catch(() => {
      asr = null;
    });
  }
  return asr;
}

ctx.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  const id = request.type === "transcribe" ? request.id : undefined;
  try {
    const transcriber = await load();
    if (request.type === "load") {
      post({ type: "ready" });
      return;
    }
    const output = await transcriber(request.audio, {
      language: "french",
      task: "transcribe",
      chunk_length_s: 30,
      stride_length_s: 5,
    });
    const text = (Array.isArray(output) ? output.map((o) => o.text).join(" ") : output.text).trim();
    post({ type: "result", id: request.id, text });
  } catch (error) {
    post({ type: "error", id, message: error instanceof Error ? error.message : String(error) });
  }
};
