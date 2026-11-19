"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CV_QUESTIONS,
  fallbackQuestions,
  type CvQuestion,
  type Interview,
  type QuestionSource,
} from "../../lib/interview";
import { useDictation } from "../../lib/useDictation";
import { useMounted } from "../../lib/useMounted";
import { useSession } from "../../lib/store";

/**
 * Étape 2 — « Creuser » : 3 questions ouvertes sur UNE expérience prouvée,
 * puis au plus 3 questions CV encore sans réponse. Une question par écran,
 * réponse écrite ou dictée (Whisper, 100 % local). « Revenir aux cartes » à
 * tout moment : tout est enregistré au fil de l'eau, reprise au même écran.
 */

type Step =
  | { kind: "project"; index: number; text: string }
  | { kind: "cv"; question: CvQuestion };

export default function CreuserPage() {
  const router = useRouter();
  const mounted = useMounted();

  const activeInterview = useSession((s) => s.activeInterview);
  const interviews = useSession((s) => s.interviews);
  const cv = useSession((s) => s.cv);
  const setInterviewQuestions = useSession((s) => s.setInterviewQuestions);
  const answerInterview = useSession((s) => s.answerInterview);
  const setInterviewStep = useSession((s) => s.setInterviewStep);
  const finishInterview = useSession((s) => s.finishInterview);
  const leaveInterview = useSession((s) => s.leaveInterview);
  const setCvAnswer = useSession((s) => s.setCvAnswer);
  const skipCv = useSession((s) => s.skipCv);

  const interview = interviews.find((i) => i.cardId === activeInterview) ?? null;
  const [done, setDone] = useState<{ cvAsked: boolean } | null>(null);

  useQuestions(interview, setInterviewQuestions);

  /** Quitter à tout moment : les réponses sont déjà enregistrées. */
  function leave() {
    leaveInterview();
    router.push("/deck");
  }

  if (!mounted) return <Spinner />;

  if (done) return <Done cvAsked={done.cvAsked} />;

  if (!interview) {
    return (
      <Shell onBack={() => router.push("/deck")}>
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <p className="text-2xl font-black tracking-tight">Rien à creuser pour l&apos;instant</p>
          <p className="mt-3 max-w-xs text-sm text-ink/60">
            Quand tu diras « déjà fait » puis « oui, c&apos;est moi » sur une carte, tu
            pourras raconter ton expérience ici.
          </p>
          <Link
            href="/deck"
            className="hard-shadow mt-8 rounded-full bg-ink px-7 py-4 text-base font-bold text-paper"
          >
            Retour aux cartes
          </Link>
        </div>
      </Shell>
    );
  }

  if (interview.questions.length === 0) {
    return (
      <Shell onBack={leave} onLeave={leave}>
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-ink border-t-transparent" />
          <p className="mt-6 text-sm font-semibold text-ink/60">On prépare tes questions…</p>
        </div>
      </Shell>
    );
  }

  const cvQuestions = interview.cvFields
    .map((field) => CV_QUESTIONS.find((q) => q.field === field))
    .filter((q): q is CvQuestion => Boolean(q));
  const steps: Step[] = [
    ...interview.questions.map((text, index) => ({ kind: "project" as const, index, text })),
    ...cvQuestions.map((question) => ({ kind: "cv" as const, question })),
  ];
  const stepIndex = Math.min(interview.step, steps.length - 1);
  const step = steps[stepIndex];
  const answer =
    step.kind === "project" ? interview.answers[step.index] ?? "" : cv[step.question.field] ?? "";
  const cardId = interview.cardId;

  function setAnswer(value: string) {
    if (step.kind === "project") answerInterview(cardId, step.index, value);
    else setCvAnswer(step.question.field, value);
  }

  function next({ skipped }: { skipped: boolean }) {
    if (skipped && step.kind === "cv") skipCv(step.question.field);
    if (stepIndex < steps.length - 1) {
      setInterviewStep(cardId, stepIndex + 1);
      return;
    }
    finishInterview(cardId);
    setDone({ cvAsked: cvQuestions.length > 0 });
  }

  const firstCv = step.kind === "cv" && step.question === cvQuestions[0];

  return (
    <Shell
      onBack={() => (stepIndex > 0 ? setInterviewStep(cardId, stepIndex - 1) : leave())}
      onLeave={leave}
      progress={(stepIndex + 1) / steps.length}
      label={`${stepIndex + 1}/${steps.length}`}
    >
      <div className="mt-6">
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-ink/45">
          {step.kind === "project" ? "Ton expérience" : "Pour ton CV"}
        </p>
        {step.kind === "project" && (
          <p className="mt-1 truncate text-xs font-semibold text-ink/50">
            « {interview.parentText} » · {interview.skill}
          </p>
        )}
        {firstCv && (
          <p className="mt-3 rounded-2xl bg-sand px-4 py-3 text-xs leading-relaxed text-ink/70">
            Dernière ligne droite : {cvQuestions.length === 1 ? "une info" : `${cvQuestions.length} infos`}{" "}
            pour ton CV. Tout reste sur ton téléphone, et tu peux passer ce que tu veux.
          </p>
        )}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={stepIndex}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.18 }}
          className="mt-4 flex min-h-0 flex-1 flex-col"
        >
          <h1 className="text-2xl font-black leading-tight tracking-tight">
            {step.kind === "project" ? step.text : step.question.text}
          </h1>
          {step.kind === "cv" && step.question.hint && (
            <p className="mt-2 text-sm text-ink/55">{step.question.hint}</p>
          )}

          {step.kind === "cv" && step.question.chips && (
            <div className="mt-4 flex flex-wrap gap-2">
              {step.question.chips.map((chip) => {
                const active = answer.trim().toLowerCase() === chip.label.toLowerCase();
                return (
                  <button
                    key={chip.value}
                    type="button"
                    onClick={() => setAnswer(chip.label)}
                    className={`rounded-full border px-3.5 py-2 text-sm font-semibold transition-colors ${
                      active
                        ? "border-ink bg-ink text-paper"
                        : "border-ink/25 bg-paper text-ink/70 hover:border-ink/60"
                    }`}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>
          )}

          <AnswerBox
            value={answer}
            onChange={setAnswer}
            numeric={step.kind === "cv" && step.question.numeric}
            short={step.kind === "cv" && step.question.field !== "experience"}
          />
        </motion.div>
      </AnimatePresence>

      <div className="mt-4 grid grid-cols-[1fr_2fr] gap-3">
        <button
          type="button"
          onClick={() => next({ skipped: !answer.trim() })}
          className="h-14 rounded-full border-2 border-ink bg-paper text-sm font-bold"
        >
          Passer
        </button>
        <button
          type="button"
          onClick={() => next({ skipped: false })}
          disabled={!answer.trim()}
          className="hard-shadow-sm h-14 rounded-full border-2 border-ink bg-ink text-sm font-bold text-paper disabled:opacity-40 disabled:shadow-none"
        >
          {stepIndex === steps.length - 1 ? "Terminer" : "Suivant →"}
        </button>
      </div>
    </Shell>
  );
}

/** Charge les questions du projet (LLM côté serveur, repli local sinon). */
function useQuestions(
  interview: Interview | null,
  setQuestions: (cardId: string, questions: string[], source: QuestionSource) => void,
) {
  const cardId = interview?.cardId;
  const needed = Boolean(interview && interview.questions.length === 0);

  useEffect(() => {
    if (!needed || !interview) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/questions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            parentText: interview.parentText,
            proofText: interview.proofText,
            macro: interview.macro,
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { questions: string[]; source: QuestionSource };
        if (!cancelled) setQuestions(interview.cardId, data.questions, data.source);
      } catch (error) {
        console.warn("[creuser] questions indisponibles, repli", error);
        if (!cancelled) setQuestions(interview.cardId, fallbackQuestions(interview.parentText), "template");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- une seule requête par entretien
  }, [cardId, needed]);
}

function AnswerBox({
  value,
  onChange,
  numeric,
  short,
}: {
  value: string;
  onChange: (value: string) => void;
  numeric?: boolean;
  short?: boolean;
}) {
  // Le texte dicté arrive après coup : on l'ajoute à la réponse à jour.
  const latest = useRef(value);
  useEffect(() => {
    latest.current = value;
  }, [value]);
  const dictation = useDictation((text) => {
    const current = latest.current.trim();
    onChange(current ? `${current} ${text}` : text);
  });

  const busy = dictation.status === "transcribing";
  const recording = dictation.status === "recording";

  return (
    <div className="mt-4 flex min-h-0 flex-1 flex-col">
      {short ? (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          inputMode={numeric ? "numeric" : "text"}
          placeholder="Ta réponse"
          className="w-full rounded-2xl border-2 border-ink/20 bg-paper px-4 py-3.5 text-base font-medium outline-none focus:border-ink"
        />
      ) : (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Écris ou dicte ta réponse. Pas besoin de belles phrases."
          className="min-h-32 w-full flex-1 resize-none rounded-2xl border-2 border-ink/20 bg-paper px-4 py-3.5 text-base font-medium leading-relaxed outline-none focus:border-ink"
        />
      )}

      {dictation.supported && (
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={dictation.toggle}
            disabled={busy}
            aria-label={recording ? "Arrêter la dictée" : "Dicter ma réponse"}
            className={`flex h-12 shrink-0 items-center gap-2 rounded-full border-2 border-ink px-4 text-sm font-bold transition-colors disabled:opacity-50 ${
              recording ? "bg-accent text-paper" : "bg-mint text-ink"
            }`}
          >
            <span className={recording ? "animate-pulse" : ""}>{recording ? "■" : "🎙"}</span>
            {recording ? `Stop · ${dictation.seconds} s` : "Dicter"}
          </button>
          <p className="text-xs leading-snug text-ink/50">
            {recording && "Je t'écoute… appuie sur Stop quand tu as fini."}
            {busy &&
              (dictation.progress > 0 && dictation.progress < 1
                ? `Première fois : on prépare la dictée (${Math.round(dictation.progress * 100)} %)…`
                : "J'écris ce que tu as dit…")}
            {dictation.status === "error" && dictation.error}
            {(dictation.status === "idle" || dictation.status === "loading") &&
              "La dictée tourne sur ton téléphone : ta voix n'est envoyée nulle part."}
          </p>
        </div>
      )}
    </div>
  );
}

function Shell({
  children,
  onBack,
  onLeave,
  progress,
  label,
}: {
  children: React.ReactNode;
  onBack: () => void;
  /** « Revenir aux cartes » : toujours visible, rien n'est perdu. */
  onLeave?: () => void;
  progress?: number;
  label?: string;
}) {
  return (
    <main className="mx-auto flex h-dvh w-full max-w-md flex-col overflow-hidden px-5 pb-5 pt-6">
      <header>
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={onBack}
            aria-label="Retour"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-ink/20 text-sm text-ink/60"
          >
            ←
          </button>
          <span className="text-xs font-black uppercase tracking-[0.2em]">On creuse</span>
          {onLeave ? (
            <button
              onClick={onLeave}
              className="shrink-0 rounded-full border border-ink/20 px-3 py-2 text-xs font-bold text-ink/60 hover:text-ink"
            >
              Revenir aux cartes
            </button>
          ) : (
            <span className="w-9" />
          )}
        </div>
        {progress !== undefined && (
          <div className="mt-4 flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink/10">
              <div
                className="h-full rounded-full bg-ink transition-all duration-500"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
            <span className="text-xs font-bold text-ink/40">{label}</span>
          </div>
        )}
      </header>
      {children}
    </main>
  );
}

function Done({ cvAsked }: { cvAsked: boolean }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-5 text-center">
      <div className="grid h-20 w-20 place-items-center rounded-full bg-mint text-4xl">✓</div>
      <h1 className="mt-6 text-4xl font-black leading-none tracking-tight">C&apos;est noté.</h1>
      <p className="mt-4 max-w-xs text-sm leading-relaxed text-ink/60">
        {cvAsked
          ? "Ton expérience et tes infos sont enregistrées. On s'en servira pour écrire ton CV."
          : "Ton expérience est enregistrée. Elle viendra enrichir ton CV."}
      </p>
      <Link
        href="/deck"
        className="hard-shadow mt-8 rounded-full bg-ink px-7 py-4 text-base font-bold text-paper"
      >
        Continuer à swiper →
      </Link>
      <Link
        href="/result"
        className="mt-4 text-sm font-semibold text-ink/50 underline underline-offset-4"
      >
        Voir mes résultats
      </Link>
    </main>
  );
}

function Spinner() {
  return (
    <main className="grid min-h-dvh place-items-center">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-ink border-t-transparent" />
    </main>
  );
}
