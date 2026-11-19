"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { interviewId } from "../../lib/interview";
import { levelLabel, matchesKey, type JobSuggestion, type SkillMatch } from "../../lib/matches";
import { useMounted } from "../../lib/useMounted";
import { useSession } from "../../lib/store";

/**
 * « Mes matchs » : la mémoire des skill matches (chaque « déjà fait ») et les
 * métiers ROME qui s'appuient dessus, choisis et présentés par l'IA. Un métier
 * mène à « On creuse » (étape 2), puis au dossier.
 */
export default function MatchsPage() {
  const router = useRouter();
  const mounted = useMounted();

  const skillMatches = useSession((s) => s.skillMatches);
  const jobs = useSession((s) => s.jobs);
  const jobsLoading = useSession((s) => s.jobsLoading);
  const interviews = useSession((s) => s.interviews);
  const markMatchesSeen = useSession((s) => s.markMatchesSeen);
  const resolvePendingSkills = useSession((s) => s.resolvePendingSkills);
  const loadJobs = useSession((s) => s.loadJobs);
  const startJobInterview = useSession((s) => s.startJobInterview);

  const key = matchesKey(skillMatches);

  useEffect(() => {
    markMatchesSeen();
    resolvePendingSkills();
  }, [markMatchesSeen, resolvePendingSkills]);

  // Recalcule les métiers quand un match (ou sa compétence ROME) change.
  useEffect(() => {
    if (key) void loadJobs();
  }, [key, loadJobs]);

  function creuser(job: JobSuggestion) {
    startJobInterview(job);
    router.push("/creuser");
  }

  if (!mounted) {
    return (
      <main className="grid min-h-dvh place-items-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-ink border-t-transparent" />
      </main>
    );
  }

  const byCard = new Map(skillMatches.map((m) => [m.cardId, m]));
  const list = jobs?.list ?? [];
  const stale = jobs?.key !== key;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-8 pt-6">
      <header className="flex items-center justify-between">
        <button
          onClick={() => router.push("/deck")}
          aria-label="Retour aux cartes"
          className="grid h-9 w-9 place-items-center rounded-full border border-ink/20 text-sm text-ink/60"
        >
          ←
        </button>
        <span className="text-xs font-black uppercase tracking-[0.2em]">Mes matchs</span>
        <span className="w-9" />
      </header>

      {skillMatches.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <div className="grid h-20 w-20 place-items-center rounded-full bg-mint text-4xl">★</div>
          <h1 className="mt-6 text-3xl font-black leading-none tracking-tight">Pas encore de match</h1>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-ink/60">
            Quand tu dis « déjà fait » sur une carte, c&apos;est un skill match : il atterrit ici,
            avec les métiers qui s&apos;appuient dessus.
          </p>
          <Link
            href="/deck"
            className="hard-shadow mt-8 rounded-full bg-ink px-7 py-4 text-base font-bold text-paper"
          >
            Retour aux cartes
          </Link>
        </div>
      ) : (
        <>
          <section className="mt-6">
            <h1 className="text-3xl font-black leading-none tracking-tight">Des métiers pour toi</h1>
            <p className="mt-2 text-sm text-ink/60">
              À partir de ce que tu as déjà fait. Choisis-en un pour en parler.
            </p>

            <div className="mt-5 space-y-3">
              {list.length === 0 && (jobsLoading || stale) && <JobsLoading />}
              {list.length === 0 && !jobsLoading && !stale && (
                <p className="rounded-2xl bg-sand px-4 py-3 text-sm text-ink/70">
                  Pas de métier à proposer pour l&apos;instant. Continue à swiper : chaque « déjà
                  fait » affine la liste.
                </p>
              )}
              {list.map((job, i) => (
                <JobCard
                  key={job.code}
                  job={job}
                  index={i}
                  matches={job.cardIds.map((id) => byCard.get(id)).filter((m): m is SkillMatch => Boolean(m))}
                  status={interviewStatus(interviews, job.code)}
                  onCreuser={() => creuser(job)}
                />
              ))}
              {list.length > 0 && (jobsLoading || stale) && (
                <p className="text-center text-xs font-semibold text-ink/45">Mise à jour avec tes nouveaux matchs…</p>
              )}
            </div>
          </section>

          <section className="mt-8">
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-ink/45">
              Tes skill matchs · {skillMatches.length}
            </h2>
            <ul className="mt-3 space-y-2">
              {[...skillMatches].reverse().map((m) => (
                <li key={m.cardId} className="flex items-start gap-3 rounded-2xl border border-ink/15 bg-paper px-3 py-2.5">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-mint/60 text-lg">
                    {m.emoji ?? "★"}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold leading-snug">{m.text}</p>
                    <p className="mt-0.5 text-xs text-ink/50">
                      {m.reason === "deja-souvent" ? "Déjà fait souvent" : "Déjà fait"}
                      {m.skill && <> · {m.skill.label}</>}
                      {m.skillStatus === "pending" && <> · on analyse la compétence…</>}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <Link
            href="/deck"
            className="mt-8 rounded-full border-2 border-ink px-6 py-3.5 text-center text-sm font-bold"
          >
            Continuer à swiper
          </Link>
          <Link
            href="/result"
            className="mt-3 rounded-full bg-ink px-6 py-3.5 text-center text-sm font-bold text-paper"
          >
            Voir mes résultats →
          </Link>
        </>
      )}
    </main>
  );
}

type InterviewStatus = "none" | "started" | "done";

function interviewStatus(
  interviews: { id: string; finishedAt?: number }[],
  jobCode: string,
): InterviewStatus {
  const interview = interviews.find((i) => i.id === interviewId(jobCode));
  if (!interview) return "none";
  return interview.finishedAt ? "done" : "started";
}

function JobCard({
  job,
  index,
  matches,
  status,
  onCreuser,
}: {
  job: JobSuggestion;
  index: number;
  matches: SkillMatch[];
  status: InterviewStatus;
  onCreuser: () => void;
}) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className="hard-shadow-sm overflow-hidden rounded-[24px] border-2 border-ink bg-paper"
    >
      <div className="px-5 pb-4 pt-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-xl font-black leading-tight tracking-tight">{job.label}</h3>
          {status === "done" && (
            <span className="shrink-0 rounded-full bg-mint px-2.5 py-1 text-[10px] font-black uppercase tracking-wider">
              Raconté ✓
            </span>
          )}
        </div>
        <p className="mt-1 text-xs font-semibold text-ink/50">{levelLabel(job.level)}</p>
        <p className="mt-3 text-sm font-medium leading-relaxed text-ink/80">{job.pitch}</p>
        {matches.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {matches.map((m) => (
              <span key={m.cardId} className="rounded-full bg-sand px-2.5 py-1 text-xs font-semibold text-ink/70">
                {m.emoji ? `${m.emoji} ` : ""}
                {m.text}
              </span>
            ))}
          </div>
        )}
      </div>
      <button
        onClick={onCreuser}
        className="flex w-full items-center justify-between border-t-2 border-ink bg-ink px-5 py-3 text-sm font-bold text-paper"
      >
        <span>
          {status === "none" && "On creuse ce métier"}
          {status === "started" && "Reprendre le récit"}
          {status === "done" && "Revoir mon récit"}
        </span>
        <span aria-hidden>→</span>
      </button>
    </motion.article>
  );
}

function JobsLoading() {
  return (
    <div className="rounded-[24px] border-2 border-dashed border-ink/25 px-5 py-6 text-center">
      <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-ink border-t-transparent" />
      <p className="mt-4 text-sm font-semibold text-ink/60">
        On cherche des métiers qui collent à ce que tu as déjà fait…
      </p>
    </div>
  );
}
