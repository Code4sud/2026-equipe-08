"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useTransform,
  type PanInfo,
} from "framer-motion";
import { PAIRS } from "../../content/pairs";
import { TRAIT_META } from "../../lib/traits";
import { useRestart } from "../../lib/useRestart";
import { useSession } from "../../lib/store";
import { useMounted } from "../../lib/useMounted";

export default function StylePage() {
  const router = useRouter();
  const mounted = useMounted();
  const restart = useRestart();

  const traitResponses = useSession((s) => s.traitResponses);
  const currentPairId = useSession((s) => s.currentPairId);
  const ensurePair = useSession((s) => s.ensurePair);
  const swipePair = useSession((s) => s.swipePair);
  const startStyle = useSession((s) => s.startStyle);

  useEffect(() => {
    ensurePair();
  }, [ensurePair]);

  const pair = PAIRS.find((p) => p.id === currentPairId) ?? null;
  const progress = Math.min(100, (traitResponses.length / PAIRS.length) * 100);

  if (!mounted) {
    return (
      <main className="grid min-h-dvh place-items-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-ink border-t-transparent" />
      </main>
    );
  }

  if (!pair) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 py-8">
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.push("/deck")}
            className="grid h-9 w-9 place-items-center rounded-full border border-ink/20 text-sm text-ink/60"
          >
            ←
          </button>
          <span className="text-xs font-black uppercase tracking-[0.2em]">
            Orientis
          </span>
          <span className="w-9" />
        </div>

        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <div className="grid h-20 w-20 place-items-center rounded-full bg-mint text-4xl">
            ✳
          </div>
          <h1 className="mt-6 text-4xl font-black leading-none tracking-tight">
            On te connaît
            <br />
            un peu mieux.
          </h1>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-ink/60">
            Tes intérêts + ta façon de travailler. On peut maintenant croiser
            les deux avec les 30 domaines ROME et te proposer trois directions.
          </p>
          <button
            onClick={() => router.push("/result")}
            className="hard-shadow mt-8 rounded-full bg-ink px-7 py-4 text-base font-bold text-paper"
          >
            Voir mes résultats →
          </button>
          <button
            onClick={restart}
            className="mt-4 text-xs font-semibold text-ink/40 underline underline-offset-4"
          >
            Recommencer depuis le début
          </button>
        </div>
      </main>
    );
  }

  const meta = TRAIT_META[pair.trait];

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-5 pt-6">
      <header>
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.push("/deck")}
            aria-label="Retour"
            className="grid h-9 w-9 place-items-center rounded-full border border-ink/20 text-sm text-ink/60"
          >
            ←
          </button>
          <span className="text-xs font-black uppercase tracking-[0.2em]">
            Orientis
          </span>
          <span className="w-9 text-right text-xs font-bold text-ink/40">
            {traitResponses.length}/{PAIRS.length}
          </span>
        </div>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-ink/10">
          <div
            className="h-full rounded-full bg-accent transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-widest text-ink/35">
          <span>comment tu fonctionnes</span>
          <span>{meta.question}</span>
        </div>
      </header>

      <div className="relative mt-5 flex-1">
        <div className="absolute inset-x-6 top-5 h-[420px] rotate-2 rounded-[30px] border-2 border-ink/20 bg-sand/50" />
        <AnimatePresence mode="popLayout" initial={false}>
          <PairCard
            key={pair.id}
            prompt={pair.prompt}
            left={pair.left}
            right={pair.right}
            onChoose={(direction) =>
              swipePair(direction, undefined)
            }
          />
        </AnimatePresence>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <button
          onClick={() => swipePair("left")}
          className="hard-shadow-sm flex min-h-16 items-center justify-center rounded-2xl border-2 border-ink bg-paper px-4 py-3 text-sm font-bold leading-tight"
        >
          ← {pair.left}
        </button>
        <button
          onClick={() => swipePair("right")}
          className="hard-shadow-sm flex min-h-16 items-center justify-center rounded-2xl border-2 border-ink bg-ink px-4 py-3 text-sm font-bold leading-tight text-paper"
        >
          {pair.right} →
        </button>
      </div>

      <div className="mt-4 flex items-center justify-center gap-5 text-xs font-semibold text-ink/40">
        <button
          onClick={() => {
            startStyle();
            router.push("/result");
          }}
          className="underline underline-offset-4"
        >
          Passer cette partie
        </button>
        <button onClick={restart} className="underline underline-offset-4">
          Recommencer
        </button>
      </div>
    </main>
  );
}

function PairCard({
  prompt,
  left,
  right,
  onChoose,
}: {
  prompt: string;
  left: string;
  right: string;
  onChoose: (direction: "left" | "right") => void;
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-180, 180], [-10, 10]);
  const leftScale = useTransform(x, [-120, 0], [1.04, 1]);
  const rightScale = useTransform(x, [0, 120], [1, 1.04]);

  function handleDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.x > 80) onChoose("right");
    else if (info.offset.x < -80) onChoose("left");
  }

  return (
    <motion.div
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.7}
      onDragEnd={handleDragEnd}
      style={{ x, rotate }}
      initial={{ scale: 0.96, y: 12, opacity: 0 }}
      animate={{ scale: 1, y: 0, opacity: 1 }}
      exit={{ scale: 0.96, y: 12, opacity: 0 }}
      transition={{ type: "spring", stiffness: 320, damping: 28 }}
      className="hard-shadow relative flex min-h-[440px] touch-none select-none flex-col overflow-hidden rounded-[30px] border-2 border-ink bg-paper"
    >
      <div className="border-b-2 border-ink bg-accent px-6 py-4 text-paper">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-paper/70">
          Cette fois, choisis entre les deux
        </p>
        <h1 className="mt-1 text-2xl font-black leading-tight tracking-tight">
          {prompt}
        </h1>
      </div>

      <div className="grid flex-1 grid-cols-2">
        <motion.div
          style={{ scale: leftScale }}
          className="flex flex-col items-center justify-center gap-4 border-r-2 border-dashed border-ink/15 bg-[#CFE0FF] px-5 text-center"
        >
          <span className="text-2xl">←</span>
          <p className="text-xl font-black leading-tight tracking-tight">
            {left}
          </p>
        </motion.div>
        <motion.div
          style={{ scale: rightScale }}
          className="flex flex-col items-center justify-center gap-4 bg-[#DFF3A9] px-5 text-center"
        >
          <span className="text-2xl">→</span>
          <p className="text-xl font-black leading-tight tracking-tight">
            {right}
          </p>
        </motion.div>
      </div>

      <div className="flex items-center justify-between border-t-2 border-ink/15 px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-ink/35">
        <span>glisse vers la gauche</span>
        <span>glisse vers la droite</span>
      </div>
    </motion.div>
  );
}
