"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { WorkerRequest, WorkerResponse } from "./whisper.worker";

/**
 * Dictée vocale locale (Whisper dans un Web Worker).
 *
 * idle → (1er usage : loading, téléchargement du modèle) → recording →
 * transcribing → idle. Le texte reconnu est passé à `onText`.
 */

export type DictationStatus = "idle" | "loading" | "recording" | "transcribing" | "error";

const SAMPLE_RATE = 16_000;
/** Au-delà, on coupe : une réponse, pas un monologue. */
const MAX_RECORDING_MS = 120_000;

let sharedWorker: Worker | null = null;
let nextRequestId = 1;

function getWorker(): Worker {
  if (!sharedWorker) {
    sharedWorker = new Worker(new URL("./whisper.worker.ts", import.meta.url), { type: "module" });
  }
  return sharedWorker;
}

/** Enregistrement (webm/opus, mp4…) → PCM mono 16 kHz pour Whisper. */
async function toPcm(blob: Blob): Promise<Float32Array> {
  const AudioCtx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audioContext = new AudioCtx({ sampleRate: SAMPLE_RATE });
  try {
    const decoded = await audioContext.decodeAudioData(await blob.arrayBuffer());
    if (decoded.numberOfChannels === 1) return decoded.getChannelData(0);
    const left = decoded.getChannelData(0);
    const right = decoded.getChannelData(1);
    const mono = new Float32Array(left.length);
    for (let i = 0; i < left.length; i++) mono[i] = (left[i] + right[i]) / 2;
    return mono;
  } finally {
    void audioContext.close();
  }
}

export function useDictation(onText: (text: string) => void) {
  const [status, setStatus] = useState<DictationStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);

  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  /** Demande de transcription en cours pour CE champ (les autres sont ignorées). */
  const pendingId = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onTextRef = useRef(onText);
  useEffect(() => {
    onTextRef.current = onText;
  }, [onText]);

  const supported =
    typeof window !== "undefined" &&
    typeof Worker !== "undefined" &&
    typeof MediaRecorder !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia);

  // Messages du worker (un seul worker partagé, un seul écouteur actif).
  useEffect(() => {
    if (!supported) return;
    const worker = getWorker();
    const handle = (event: MessageEvent<WorkerResponse>) => {
      const message = event.data;
      if (message.type === "progress") setProgress(message.progress);
      if (message.type === "ready") setStatus((s) => (s === "loading" ? "idle" : s));
      if (message.type === "result") {
        if (message.id !== pendingId.current) return;
        pendingId.current = null;
        if (message.text) onTextRef.current(message.text);
        setStatus("idle");
      }
      if (message.type === "error") {
        if (message.id !== undefined && message.id !== pendingId.current) return;
        pendingId.current = null;
        setError("La dictée n'a pas marché. Tu peux écrire ta réponse.");
        setStatus("error");
      }
    };
    worker.addEventListener("message", handle);
    return () => worker.removeEventListener("message", handle);
  }, [supported]);

  useEffect(
    () => () => {
      if (timer.current) clearInterval(timer.current);
      if (stopTimeout.current) clearTimeout(stopTimeout.current);
      recorder.current?.stream.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  const stop = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    if (stopTimeout.current) clearTimeout(stopTimeout.current);
    if (recorder.current?.state === "recording") recorder.current.stop();
  }, []);

  const start = useCallback(async () => {
    if (!supported) return;
    setError(null);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("Micro refusé. Autorise-le dans ton navigateur, ou écris ta réponse.");
      setStatus("error");
      return;
    }

    // Le modèle se télécharge pendant que le jeune parle (1er usage).
    getWorker().postMessage({ type: "load" } satisfies WorkerRequest);

    const rec = new MediaRecorder(stream);
    chunks.current = [];
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.current.push(e.data);
    };
    rec.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      setStatus("transcribing");
      try {
        const audio = await toPcm(new Blob(chunks.current, { type: rec.mimeType }));
        const id = nextRequestId++;
        pendingId.current = id;
        getWorker().postMessage({ type: "transcribe", id, audio } satisfies WorkerRequest, [audio.buffer]);
      } catch {
        setError("Impossible de lire l'enregistrement. Tu peux écrire ta réponse.");
        setStatus("error");
      }
    };
    recorder.current = rec;
    rec.start();
    setSeconds(0);
    setStatus("recording");
    timer.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    stopTimeout.current = setTimeout(stop, MAX_RECORDING_MS);
  }, [stop, supported]);

  const toggle = useCallback(() => {
    if (status === "recording") stop();
    else if (status === "idle" || status === "error") void start();
  }, [start, status, stop]);

  return { supported, status, progress, error, seconds, toggle };
}
