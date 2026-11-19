"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useTransform,
  type PanInfo,
} from "framer-motion";
import { CARDS } from "../../content/cards";
import { CENTER_BY_ID, CENTER_IDS } from "../../lib/centers";
import { cardTone } from "../../lib/presentation";
import { useRestart } from "../../lib/useRestart";
import { useSession } from "../../lib/store";
import { useMounted } from "../../lib/useMounted";
import type { Card, SwipeDirection, SwipeReason } from "../../lib/types";

const TARGET = 35;

const LEFT_REASONS: { id: SwipeReason; label: string }[] = [
  { id: "pas-mon-truc", label: "Pas mon truc" },
  { id: "jamais-essaye", label: "Jamais essayé" },
  { id: "pas-capable", label: "Peur de pas y arriver" },
  { id: "pas-les-moyens", label: "Pas les moyens" },
  { id: "pas-pres", label: "Pas près de chez moi" },
];

// Après un oui : "déjà fait" ouvre une carte "creuser" (swipe adaptatif).
const RIGHT_REASONS: { id: SwipeReason; label: string }[] = [
  { id: "deja-souvent", label: "Déjà fait souvent" },
  { id: "deja-une-fois", label: "Déjà fait une fois" },
  { id: "jamais-fait-mais-tente", label: "Jamais fait, mais ça me tente" },
];

export default function DeckPage() {
  const router = useRouter();
  const mounted = useMounted();
  const restart = useRestart();

  const responses = useSession((s) => s.responses);
  const currentCardId = useSession((s) => s.currentCardId);
  const pending = useSession((s) => s.pendingConfirmation);
  const lastResponse = useSession((s) => s.lastResponse);
  const ensureCard = useSession((s) => s.ensureCard);
  const swipeCard = useSession((s) => s.swipeCard);
  const setReason = useSession((s) => s.setReason);
  const resolvePending = useSession((s) => s.resolvePending);
  const startStyle = useSession((s) => s.startStyle);
  const generated = useSession((s) => s.generated);

  const shownAt = useRef(0);

  useEffect(() => {
    ensureCard();
  }, [ensureCard]);

  useEffect(() => {
    shownAt.current = Date.now();
  }, [currentCardId]);

  const profile = useSession.getState().getProfile();

  const allCards = [...CARDS, ...generated];
  const card = allCards.find((c) => c.id === currentCardId) ?? null;
  const tone = card ? cardTone(card) : null;

  const activeDomains = CENTER_IDS.filter(
    (id) => !profile.domains[id].confirmed && !profile.domains[id].rejected,
  );
  const avgConfidence =
    activeDomains.length === 0
      ? 1
      : activeDomains.reduce(
          (sum, id) => sum + profile.domains[id].confidence,
          0,
        ) / activeDomains.length;

  const lastCardResponse =
    lastResponse?.kind === "card" ? responses[lastResponse.index] : null;
  const showReasons = !pending && Boolean(lastCardResponse) && responses.length > 0;
  const reasons =
    lastCardResponse?.direction === "right" ? RIGHT_REASONS : LEFT_REASONS;

  const pendingCenter = pending ? CENTER_BY_ID[pending] : null;
  const pendingCards =
    pending && profile
      ? profile.domains[pending].likedCards
          .map((id) => allCards.find((c) => c.id === id)?.text)
          .filter((x): x is string => Boolean(x))
          .slice(0, 3)
      : [];

  function commit(direction: SwipeDirection, reason?: SwipeReason) {
    if (!card || pending) return;
    swipeCard(direction, reason, Date.now() - shownAt.current);
  }

  function goStyle() {
    startStyle();
    router.push("/style");
  }

  if (!mounted) {
    return (
      <main className="grid min-h-dvh place-items-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-ink border-t-transparent" />
      </main>
    );
  }

  if (!card) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 py-8">
        <Header
          count={responses.length}
          confidence={avgConfidence}
          onBack={() => router.push("/")}
          onReset={restart}
        />
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <div className="grid h-20 w-20 place-items-center rounded-full bg-mint text-4xl">
            ✳
          </div>
          <h1 className="mt-6 text-4xl font-black leading-none tracking-tight">
            On a assez
            <br />
            de matière.
          </h1>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-ink/60">
            Tu as répondu à {responses.length} cartes. On va maintenant voir
            comment tu fonctionnes, puis te proposer trois directions.
          </p>
          <button
            onClick={goStyle}
            className="hard-shadow mt-8 rounded-full bg-ink px-7 py-4 text-base font-bold text-paper"
          >
            Continuer →
          </button>
          <Link
            href="/result"
            className="mt-4 text-sm font-semibold text-ink/50 underline underline-offset-4"
          >
            Voir directement mes résultats
          </Link>
          <button
            onClick={restart}
            className="mt-3 text-xs font-semibold text-ink/35 underline underline-offset-4"
          >
            Recommencer depuis le début
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex h-dvh w-full max-w-md flex-col overflow-hidden px-5 pb-5 pt-6">
      <Header
        count={responses.length}
        confidence={avgConfidence}
        onBack={() => router.push("/")}
        onReset={restart}
      />

      <div className="mt-4 flex items-center justify-between text-[11px] font-bold uppercase tracking-widest text-ink/40">
        <span>Ça te tente ?</span>
        <span>{responses.length >= 20 ? "tu peux t'arrêter quand tu veux" : "glisse la carte"}</span>
      </div>

      <div className="relative mt-3 min-h-0 flex-1">
        <div className="absolute inset-x-5 bottom-3 top-3 rotate-2 rounded-[30px] border-2 border-ink/25 bg-sand/60" />
        <div className="absolute inset-x-2 bottom-4 top-1.5 -rotate-1 rounded-[30px] border-2 border-ink/30 bg-paper" />

        <AnimatePresence mode="popLayout" initial={false}>
          <SwipeCard
            key={card.id}
            card={card}
            tone={tone!}
            onSwipe={commit}
            disabled={Boolean(pending)}
          />
        </AnimatePresence>
      </div>

      <div className="mt-4">
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            aria-label="Pas pour moi"
            onClick={() => commit("left")}
            disabled={Boolean(pending)}
            className="hard-shadow-sm flex h-16 items-center justify-center rounded-full border-2 border-ink bg-paper text-2xl transition-transform active:translate-y-0.5 active:shadow-none"
          >
            ✕
          </button>
          <button
            type="button"
            aria-label="Ça me tente"
            onClick={() => commit("right")}
            disabled={Boolean(pending)}
            className="hard-shadow-sm flex h-16 items-center justify-center rounded-full border-2 border-ink bg-ink text-2xl text-paper transition-transform active:translate-y-0.5 active:shadow-none"
          >
            ♥
          </button>
        </div>

        <AnimatePresence>
          {showReasons && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="mt-3"
            >
              <p className="mb-2 text-center text-[11px] font-bold uppercase tracking-widest text-ink/40">
                {lastCardResponse?.direction === "right"
                  ? "Tu l'as déjà fait ? (optionnel)"
                  : "Pourquoi ? (optionnel)"}
              </p>
              <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
                {reasons.map((reason) => {
                  const active = lastCardResponse?.reason === reason.id;
                  return (
                    <button
                      key={reason.id}
                      onClick={() => setReason(reason.id)}
                      className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                        active
                          ? "border-ink bg-ink text-paper"
                          : "border-ink/20 bg-paper text-ink/60 hover:border-ink/50"
                      }`}
                    >
                      {reason.label}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {responses.length >= 20 && (
          <button
            onClick={goStyle}
            className="mt-3 w-full text-center text-xs font-semibold text-ink/40 underline underline-offset-4"
          >
            J&apos;ai assez répondu · passer à la suite
          </button>
        )}
      </div>

      <AnimatePresence>
        {pendingCenter && (
          <ConfirmationOverlay
            title={pendingCenter.short}
            label={pendingCenter.label}
            evidence={pendingCards}
            onResolve={(accepted) => resolvePending(accepted)}
          />
        )}
      </AnimatePresence>
    </main>
  );
}

function Header({
  count,
  confidence,
  onBack,
  onReset,
}: {
  count: number;
  confidence: number;
  onBack: () => void;
  onReset: () => void;
}) {
  const pct = Math.min(100, Math.round((count / TARGET) * 100));
  const countLabel = count >= TARGET ? `${count} réponses` : `${count}/${TARGET}`;
  return (
    <header>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <button
            onClick={onBack}
            aria-label="Retour"
            className="grid h-9 w-9 place-items-center rounded-full border border-ink/20 text-sm text-ink/60"
          >
            ←
          </button>
          <button
            onClick={onReset}
            aria-label="Recommencer"
            title="Recommencer"
            className="grid h-9 w-9 place-items-center rounded-full border border-ink/20 text-base text-ink/45 hover:text-ink"
          >
            ↺
          </button>
        </div>
        <span className="text-xs font-black uppercase tracking-[0.2em]">
          Déclic
        </span>
        <span className="text-right text-xs font-bold text-ink/40">
          {countLabel}
        </span>
      </div>

      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-ink/10">
        <div
          className="h-full rounded-full bg-ink transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-widest text-ink/35">
        <span>on apprend à te connaître</span>
        <span>{Math.round(confidence * 100)} % de confiance</span>
      </div>
    </header>
  );
}

function SwipeCard({
  card,
  tone,
  onSwipe,
  disabled,
}: {
  card: Card;
  tone: { bg: string; ink: string };
  onSwipe: (direction: SwipeDirection) => void;
  disabled: boolean;
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-220, 220], [-13, 13]);
  const nopeOpacity = useTransform(x, [-120, -40], [1, 0]);
  const yesOpacity = useTransform(x, [40, 120], [0, 1]);

  function handleDragEnd(_: unknown, info: PanInfo) {
    if (disabled) return;
    if (info.offset.x > 95) onSwipe("right");
    else if (info.offset.x < -95) onSwipe("left");
  }

  return (
    <motion.div
      drag={disabled ? false : "x"}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.7}
      onDragEnd={handleDragEnd}
      style={{ x, rotate }}
      initial={{ scale: 0.96, y: 12, opacity: 0 }}
      animate={{ scale: 1, y: 0, opacity: 1 }}
      exit={{ scale: 0.96, y: 12, opacity: 0 }}
      transition={{ type: "spring", stiffness: 320, damping: 28 }}
      className="hard-shadow absolute inset-0 flex touch-none select-none flex-col overflow-hidden rounded-[30px] border-2 border-ink"
    >
      <div
        className="flex items-center justify-between border-b-2 border-ink px-5 py-3"
        style={{ backgroundColor: tone.bg, color: tone.ink }}
      >
        <span className="text-[10px] font-black uppercase tracking-[0.18em]">
          {cardBadge(card)}
        </span>
        <span className="text-lg">{card.emoji}</span>
      </div>

      <div
        className="relative flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-6 text-center"
        style={{ backgroundColor: tone.bg, color: tone.ink }}
      >
        <motion.span
          style={{ opacity: nopeOpacity }}
          className="absolute left-5 top-5 -rotate-12 rounded-lg border-2 border-accent px-3 py-1 text-sm font-black uppercase tracking-widest text-accent"
        >
          Non
        </motion.span>
        <motion.span
          style={{ opacity: yesOpacity }}
          className="absolute right-5 top-5 rotate-12 rounded-lg border-2 border-ink bg-mint px-3 py-1 text-sm font-black uppercase tracking-widest text-ink"
        >
          Oui
        </motion.span>

        <div className="grid h-24 w-24 shrink-0 place-items-center rounded-full border-2 border-ink/10 bg-paper/55 text-5xl shadow-inner">
          {card.emoji}
        </div>

        <div>
          <p className="text-2xl font-black leading-[1.05] tracking-[-0.03em] sm:text-3xl">
            {card.text}
          </p>
          {card.hint && (
            <p className="mt-3 text-sm font-medium opacity-60">{card.hint}</p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between border-t-2 border-ink/80 bg-paper px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-ink/40">
        <span>← pas pour moi</span>
        <span>ça me tente →</span>
      </div>
    </motion.div>
  );
}

function ConfirmationOverlay({
  title,
  label,
  evidence,
  onResolve,
}: {
  title: string;
  label: string;
  evidence: string[];
  onResolve: (accepted: boolean) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/70 p-4 backdrop-blur-sm sm:items-center"
    >
      <motion.div
        initial={{ y: 60, scale: 0.96 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: 40, scale: 0.97 }}
        transition={{ type: "spring", stiffness: 300, damping: 26 }}
        className="w-full max-w-md overflow-hidden rounded-[30px] border-2 border-ink bg-paper"
      >
        <div className="bg-mint px-6 pb-5 pt-6">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-ink/60">
            Match confirmé ?
          </p>
          <h2 className="mt-2 text-4xl font-black leading-none tracking-tight">
            {title}
          </h2>
          <p className="mt-2 text-sm font-semibold text-ink/60">{label}</p>
        </div>

        <div className="px-6 py-5">
          <p className="text-xs font-bold uppercase tracking-widest text-ink/40">
            Ce qui nous fait dire ça
          </p>
          <ul className="mt-3 space-y-2">
            {evidence.map((text) => (
              <li
                key={text}
                className="flex items-start gap-2 text-sm font-medium text-ink/75"
              >
                <span className="mt-0.5 text-accent">✓</span>
                <span>{text}</span>
              </li>
            ))}
          </ul>

          <p className="mt-5 text-xs leading-relaxed text-ink/45">
            C&apos;est toi qui valides. L&apos;algorithme propose, tu confirmes —
            et tu pourras changer d&apos;avis.
          </p>

          <div className="mt-5 grid gap-2">
            <button
              onClick={() => onResolve(true)}
              className="hard-shadow-sm rounded-full border-2 border-ink bg-ink px-5 py-3.5 text-sm font-bold text-paper"
            >
              Oui, c&apos;est moi
            </button>
            <button
              onClick={() => onResolve(false)}
              className="rounded-full border border-ink/25 px-5 py-3 text-sm font-semibold text-ink/60"
            >
              Pas vraiment
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/** Le jeune voit quand une carte a été écrite pour lui (adaptativité visible). */
function cardBadge(card: Card): string {
  if (card.target?.mode === "creuser") return "On creuse un peu";
  if (card.target) return "Carte rien que pour toi";
  return "Ta prochaine carte";
}
