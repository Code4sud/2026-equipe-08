"use client";

import Link from "next/link";
import { useMemo } from "react";
import { CARDS } from "../../content/cards";
import { JOBS } from "../../lib/jobs";
import { DEMO } from "../../lib/demo";
import { CENTER_BY_ID, CENTER_IDS } from "../../lib/centers";
import { toDossierUser } from "../../lib/interview";
import { buildDirections, matchJobs, profileHeadline } from "../../lib/match";
import {
  RIASEC_COLOR,
  RIASEC_INK,
  RIASEC_LABEL,
  jobLevel,
  matchLevel,
  shortCenter,
} from "../../lib/presentation";
import { topDomains, unknownDomains } from "../../lib/score";
import { useRestart } from "../../lib/useRestart";
import { useSession } from "../../lib/store";
import { TRAIT_META, traitSummary } from "../../lib/traits";
import { useMounted } from "../../lib/useMounted";
import { RIASEC, TRAITS, type Riasec } from "../../lib/types";

export default function ResultPage() {
  const mounted = useMounted();
  const restart = useRestart();

  const responses = useSession((s) => s.responses);
  const generated = useSession((s) => s.generated);
  const interviews = useSession((s) => s.interviews);
  const cv = useSession((s) => s.cv);

  const realProfile = useSession.getState().getProfile();

  const isDemo = responses.length === 0;
  const profile = isDemo ? DEMO.profile : realProfile;

  const matches = useMemo(
    () => matchJobs(profile, JOBS, [...CARDS, ...generated], JOBS.length),
    [profile, generated],
  );
  const directions = useMemo(
    () => buildDirections(matches, profile),
    [matches, profile],
  );

  const headline = profileHeadline(profile);
  const confirmed = profile.confirmed;
  const rejected = profile.rejected;
  const unknowns = unknownDomains(profile, 4);
  const top = topDomains(profile, 3);
  const hasTraits = TRAITS.some((trait) => profile.traits[trait].n > 0);
  const radarTheta = Object.fromEntries(
    RIASEC.map((key) => [key, Math.min(1, profile.theta[key] * 3)]),
  ) as Record<Riasec, number>;

  function download() {
    const payload = {
      version: "declic-0.1",
      generatedAt: new Date().toISOString(),
      rome: "ROME 4.0 v62",
      note: "Affinité de profil, pas une probabilité de réussite.",
      profile: {
        code: profile.code,
        theta: profile.theta,
        confirmed: profile.confirmed,
        rejected: profile.rejected,
        domains: Object.fromEntries(
          CENTER_IDS.map((id) => [id, profile.domains[id]]),
        ),
        traits: profile.traits,
      },
      // Étape 2 (« Creuser ») : champs `user` du contrat docs/DOSSIER.md,
      // expériences racontées comprises (compétences ROME prouvées).
      user: toDossierUser(cv, interviews),
      interviews: interviews.map((i) => ({
        skill: { code: i.macro, label: i.skill },
        proof: { parent: i.parentText, question: i.proofText },
        questionSource: i.questionSource,
        qa: i.questions.map((question, k) => ({ question, answer: i.answers[k] ?? "" })),
        finished: Boolean(i.finishedAt),
      })),
      directions: directions.map((d) => ({
        center: d.centerId,
        title: d.title,
        jobs: d.jobs.map((m) => ({
          code: m.job.code,
          label: m.job.label,
          score: Number(m.score.toFixed(3)),
          interest: Number(m.interest.toFixed(3)),
          context: Number(m.context.toFixed(3)),
          evidence: m.evidence,
          friction: m.friction,
        })),
      })),
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "declic-dossier.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!mounted) {
    return (
      <main className="grid min-h-dvh place-items-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-ink border-t-transparent" />
      </main>
    );
  }

  if (directions.length === 0) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-5 text-center">
        <div className="grid h-20 w-20 place-items-center rounded-full bg-sand text-4xl">
          ?
        </div>
        <h1 className="mt-6 text-3xl font-black tracking-tight">
          Pas encore assez de cartes
        </h1>
        <p className="mt-3 text-sm text-ink/60">
          Fais au moins une vingtaine de choix pour qu&apos;on puisse te
          proposer des directions.
        </p>
        <Link
          href="/deck"
          className="hard-shadow mt-8 rounded-full bg-ink px-7 py-4 text-base font-bold text-paper"
        >
          Commencer →
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pb-16 pt-6">
      <header className="no-print flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Link
            href="/"
            aria-label="Accueil"
            className="grid h-9 w-9 place-items-center rounded-full border border-ink/20 text-sm text-ink/60"
          >
            ←
          </Link>
          <button
            onClick={restart}
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
        <div className="flex items-center gap-2">
          <button
            onClick={download}
            className="rounded-full border border-ink/20 px-3 py-1.5 text-[11px] font-bold text-ink/60"
          >
            Dossier
          </button>
          <button
            onClick={() => window.print()}
            className="rounded-full border border-ink/20 px-3 py-1.5 text-[11px] font-bold text-ink/60"
          >
            Imprimer
          </button>
        </div>
      </header>

      {isDemo && (
        <div className="no-print mt-5 rounded-2xl border-2 border-accent/30 bg-accent/10 p-4">
          <p className="text-sm font-bold">Tu regardes un exemple de profil.</p>
          <p className="mt-1 text-xs leading-relaxed text-ink/60">
            Le tien sera calculé à partir de tes cartes, de tes confirmations et
            de ta façon de travailler.
          </p>
          <Link
            href="/deck"
            className="mt-3 inline-flex rounded-full bg-ink px-4 py-2 text-xs font-bold text-paper"
          >
            Faire le mien →
          </Link>
        </div>
      )}

      <section className="hard-shadow mt-5 overflow-hidden rounded-[32px] border-2 border-ink bg-ink text-paper">
        <div className="grid gap-6 p-6 sm:grid-cols-[1fr_240px] sm:items-center">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-paper/45">
              Ton profil
            </p>

            <div className="mt-3 flex items-end gap-2">
              {profile.code.split("").map((letter) => {
                const r = letter as Riasec;
                return (
                  <div key={letter} className="text-center">
                    <div
                      className="grid h-16 w-14 place-items-center rounded-xl text-2xl font-black"
                      style={{
                        backgroundColor: RIASEC_COLOR[r],
                        color: RIASEC_INK[r],
                      }}
                    >
                      {letter}
                    </div>
                    <span className="mt-1 block text-[10px] font-bold uppercase tracking-wider text-paper/45">
                      {RIASEC_LABEL[r]}
                    </span>
                  </div>
                );
              })}
            </div>

            <h1 className="mt-5 text-3xl font-black leading-none tracking-tight">
              {profile.code
                .split("")
                .map((letter) => RIASEC_LABEL[letter as Riasec])
                .join(" · ")}
            </h1>
            <p className="mt-3 text-[10px] font-black uppercase tracking-[0.2em] text-paper/35">
              Tes domaines forts
            </p>
            <p className="mt-1 text-sm font-semibold leading-relaxed text-paper/80">
              {headline || "Ton profil se dessine"}
            </p>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-paper/55">
              Trois directions, pas un verdict. Chaque piste est appuyée par les
              cartes que tu as choisies et par des compétences ROME.
            </p>
          </div>

          <div className="-mx-2 sm:mx-0">
            <Radar theta={radarTheta} />
            <p className="mt-1 text-center text-[9px] font-bold uppercase tracking-widest text-paper/30">
              profil relatif
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-paper/15 px-6 py-4">
          {confirmed.length > 0 ? (
            confirmed.map((id) => (
              <span
                key={id}
                className="rounded-full bg-mint px-3 py-1 text-xs font-bold text-ink"
              >
                ✓ {shortCenter(id)}
              </span>
            ))
          ) : (
            top.map((id) => (
              <span
                key={id}
                className="rounded-full border border-paper/25 px-3 py-1 text-xs font-semibold text-paper/70"
              >
                {shortCenter(id)} · à confirmer
              </span>
            ))
          )}
          {rejected.slice(0, 3).map((id) => (
            <span
              key={id}
              className="rounded-full border border-paper/15 px-3 py-1 text-xs font-semibold text-paper/35 line-through"
            >
              {shortCenter(id)}
            </span>
          ))}
        </div>
      </section>

      {(profile.differentiation < 0.35 || profile.consistency < 0.5) && (
        <div className="mt-4 rounded-2xl border border-ink/15 bg-sand/60 p-4 text-sm leading-relaxed text-ink/65">
          {profile.differentiation < 0.35 && (
            <p>
              <strong className="text-ink">Profil encore ouvert.</strong> Tes
              domaines sont proches les uns des autres : on te propose des
              pistes à explorer, pas un verdict.
            </p>
          )}
          {profile.consistency < 0.5 && (
            <p className={profile.differentiation < 0.35 ? "mt-2" : ""}>
              <strong className="text-ink">Deux dominantes en tension.</strong>{" "}
              C&apos;est intéressant : c&apos;est exactement le genre de chose
              qu&apos;on creuse en entretien.
            </p>
          )}
        </div>
      )}

      <section className="mt-10">
        <SectionTitle
          kicker="01"
          title="Comment tu fonctionnes"
          subtitle="Cinq spectres, pas des étiquettes. Ce sont des préférences de travail."
        />
        {!hasTraits ? (
          <div className="mt-4 rounded-2xl border-2 border-ink bg-sand/60 p-5">
            <p className="text-lg font-black">
              On ne connaît pas encore ta façon de travailler.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-ink/60">
              15 choix entre deux situations, 60 secondes. C&apos;est ce qui
              permet de distinguer deux métiers qui te plaisent autant l&apos;un
              que l&apos;autre, mais dans des environnements très différents.
            </p>
            <Link
              href="/style"
              className="hard-shadow-sm mt-4 inline-flex rounded-full bg-ink px-5 py-3 text-sm font-bold text-paper"
            >
              Répondre en 60 s →
            </Link>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {TRAITS.map((trait) => {
              const state = profile.traits[trait];
              const meta = TRAIT_META[trait];
              const known = state.confidence >= 0.2;
              const position = 50 + state.mean * 50;

              return (
                <div
                  key={trait}
                  className="rounded-2xl border border-ink/15 bg-paper p-4"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <div>
                      <p className="text-sm font-black">{meta.label}</p>
                      <p className="text-[11px] text-ink/45">
                        {meta.workImplication}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs font-bold text-ink/55">
                      {known ? traitSummary(trait, state.mean) : "à découvrir"}
                    </span>
                  </div>

                  <div className="mt-4">
                    <div className="relative h-2 rounded-full bg-ink/10">
                      <div
                        className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-paper bg-ink shadow"
                        style={{ left: `${known ? position : 50}%` }}
                      />
                    </div>
                    <div className="mt-2 flex justify-between text-[10px] font-bold uppercase tracking-wider text-ink/35">
                      <span>{meta.low}</span>
                      <span>{meta.high}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-12">
        <SectionTitle
          kicker="02"
          title="Trois directions"
          subtitle="Les métiers sont des pistes concrètes, classées par affinité de profil — pas par probabilité de réussite."
        />

        <div className="mt-5 space-y-9">
          {directions.map((direction, index) => {
            const domain = profile.domains[direction.centerId];
            const meta = CENTER_BY_ID[direction.centerId];
            const evidence = direction.jobs[0]?.evidence ?? [];

            return (
              <div key={direction.centerId}>
                <div className="flex items-start gap-3">
                  <span className="text-4xl font-black leading-none text-accent/35">
                    0{index + 1}
                  </span>
                  <div className="flex-1">
                    <h3 className="text-2xl font-black leading-tight tracking-tight">
                      {direction.title}
                    </h3>
                    <p className="mt-0.5 text-sm text-ink/50">
                      {meta?.label}
                    </p>
                  </div>
                  {domain?.confirmed && (
                    <span className="rounded-full bg-mint px-2.5 py-1 text-[10px] font-black uppercase tracking-wider">
                      confirmé
                    </span>
                  )}
                </div>

                <div className="mt-3 rounded-2xl border border-ink/10 bg-sand/40 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-ink/40">
                    Pourquoi cette direction
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-ink/65">
                    {evidence.length > 0
                      ? `Tu as choisi : ${evidence.join(" · ")}.`
                      : `Ce domaine ressort dans tes réponses (${Math.round((domain?.mean ?? 0.5) * 100)} % d'affinité).`}
                  </p>
                </div>

                <div className="mt-3 space-y-2">
                  {direction.jobs.map((match) => (
                    <JobRow key={match.job.code} match={match} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-12">
        <SectionTitle
          kicker="03"
          title="Ce qu'on ne sait pas encore"
          subtitle="Un bon profil dit aussi ses angles morts. C'est ce qui rend l'entretien utile."
        />

        <div className="mt-4 flex flex-wrap gap-2">
          {unknowns.map((id) => (
            <span
              key={id}
              className="rounded-full border border-dashed border-ink/25 px-3 py-1.5 text-xs font-semibold text-ink/50"
            >
              {shortCenter(id)}
            </span>
          ))}
          {unknowns.length === 0 && (
            <span className="text-sm text-ink/50">
              Tous les domaines ont été explorés. Les zones grises sont
              maintenant dans la finesse, pas dans la couverture.
            </span>
          )}
        </div>

        <div className="mt-4 rounded-2xl border-2 border-ink bg-ink p-5 text-paper">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-paper/45">
            À poser en entretien
          </p>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-paper/75">
            <li>
              1. Quel métier de {shortCenter(top[0] ?? "manual")} je pourrais
              tester une journée ?
            </li>
            <li>
              2. Quelles formations courtes existent près de chez moi, sans
              déménager ?
            </li>
            <li>
              3. Est-ce qu&apos;une immersion ou un mini-stage est possible
              avant de choisir ?
            </li>
          </ul>
        </div>
      </section>

      <footer className="no-print mt-12 border-t border-ink/15 pt-6">
        <p className="text-xs leading-relaxed text-ink/40">
          Déclic n&apos;est pas un test psychologique et ne prédit pas ta
          réussite. Aucune déduction sur la santé, l&apos;origine, la famille ou
          la religion. Tu valides ce qui est retenu, tu peux tout supprimer.
          Données ROME 4.0 v62 · France Travail · Licence Ouverte.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={restart}
            className="rounded-full border border-ink/25 px-4 py-2 text-xs font-bold text-ink/60"
          >
            Recommencer
          </button>
          <button
            onClick={download}
            className="rounded-full border border-ink/25 px-4 py-2 text-xs font-bold text-ink/60"
          >
            Télécharger le dossier
          </button>
          <Link
            href="/deck"
            className="rounded-full bg-ink px-4 py-2 text-xs font-bold text-paper"
          >
            Affiner mon profil
          </Link>
        </div>
      </footer>
    </main>
  );
}

function SectionTitle({
  kicker,
  title,
  subtitle,
}: {
  kicker: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-accent">
        {kicker}
      </p>
      <h2 className="mt-1 text-3xl font-black leading-none tracking-tight">
        {title}
      </h2>
      <p className="mt-2 max-w-lg text-sm leading-relaxed text-ink/50">
        {subtitle}
      </p>
    </div>
  );
}

function JobRow({ match }: { match: ReturnType<typeof matchJobs>[number] }) {
  const badge = matchLevel(match.score);
  const job = match.job;
  const competences = job.competences.savoirFaire.slice(0, 4);
  const savoirEtre = job.competences.savoirEtre.slice(0, 3);

  return (
    <details className="group rounded-2xl border border-ink/15 bg-paper open:border-ink/40">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold leading-tight">
            {job.label}
          </p>
          <p className="mt-1 text-[11px] text-ink/40">
            {job.code} · {jobLevel(job.level)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${badge.className}`}
          >
            {badge.label}
          </span>
          <span className="text-lg leading-none text-ink/30 transition-transform group-open:rotate-45">
            +
          </span>
        </div>
      </summary>

      <div className="space-y-4 border-t border-ink/10 px-4 py-4 text-sm">
        <p className="leading-relaxed text-ink/70">{job.definition}</p>

        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-ink/35">
            Pourquoi ça matche
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <ScoreBar label="Intérêts" value={match.interest} />
            <ScoreBar label="Contexte" value={match.context} />
          </div>
          {match.evidence.length > 0 && (
            <p className="mt-2 text-xs leading-relaxed text-ink/50">
              Preuves : {match.evidence.join(" · ")}
            </p>
          )}
        </div>

        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-ink/35">
            Compétences ROME
          </p>
          <ul className="mt-2 space-y-1">
            {competences.map((c) => (
              <li
                key={c.code}
                className="flex items-start gap-2 text-xs leading-relaxed text-ink/65"
              >
                <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-accent" />
                {c.label}
              </li>
            ))}
          </ul>
          {savoirEtre.length > 0 && (
            <p className="mt-2 text-xs text-ink/45">
              Savoir-être : {savoirEtre.map((s) => s.label).join(" · ")}
            </p>
          )}
        </div>

        {match.friction.length > 0 && (
          <div className="rounded-xl bg-accent/10 px-3 py-2.5">
            <p className="text-[10px] font-black uppercase tracking-widest text-accent">
              Ce qui pourrait accrocher
            </p>
            <p className="mt-1 text-xs leading-relaxed text-ink/65">
              {match.friction.join(" · ")}
            </p>
          </div>
        )}

        <p className="text-[11px] leading-relaxed text-ink/40">
          Accès : {job.access}
        </p>
      </div>
    </details>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-sand/50 px-2.5 py-2">
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-ink/40">
          {label}
        </span>
        <span className="text-[11px] font-black text-ink/60">
          {Math.round(value * 100)}
        </span>
      </div>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-ink/10">
        <div
          className="h-full rounded-full bg-ink/50"
          style={{ width: `${Math.round(value * 100)}%` }}
        />
      </div>
    </div>
  );
}

function Radar({ theta }: { theta: Record<Riasec, number> }) {
  const size = 260;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 88;
  const angles = RIASEC.map(
    (_, i) => -Math.PI / 2 + (i * Math.PI * 2) / 6,
  );

  const point = (index: number, value: number) => {
    const r = radius * (0.12 + 0.88 * value);
    return [
      cx + r * Math.cos(angles[index]),
      cy + r * Math.sin(angles[index]),
    ] as const;
  };

  const polygon = RIASEC.map((key, i) =>
    point(i, Math.max(0.06, Math.min(1, theta[key]))).join(","),
  ).join(" ");

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="mx-auto h-auto w-full max-w-[260px]"
      role="img"
      aria-label={`Profil Holland ${RIASEC.map((k) => `${k}:${Math.round(theta[k] * 100)}`).join(", ")}`}
    >
      {[0.25, 0.5, 0.75, 1].map((scale) => (
        <polygon
          key={scale}
          points={RIASEC.map((_, i) => {
            const r = radius * scale;
            return `${cx + r * Math.cos(angles[i])},${cy + r * Math.sin(angles[i])}`;
          }).join(" ")}
          fill="none"
          stroke="rgba(247,242,232,0.14)"
          strokeWidth="1"
        />
      ))}

      {RIASEC.map((_, i) => (
        <line
          key={i}
          x1={cx}
          y1={cy}
          x2={cx + radius * Math.cos(angles[i])}
          y2={cy + radius * Math.sin(angles[i])}
          stroke="rgba(247,242,232,0.14)"
          strokeWidth="1"
        />
      ))}

      <polygon
        points={polygon}
        fill="rgba(255,90,54,0.32)"
        stroke="#FF5A36"
        strokeWidth="2"
        strokeLinejoin="round"
      />

      {RIASEC.map((key, i) => {
        const [x, y] = point(i, Math.max(0.06, Math.min(1, theta[key])));
        const lx = cx + (radius + 22) * Math.cos(angles[i]);
        const ly = cy + (radius + 22) * Math.sin(angles[i]);
        return (
          <g key={key}>
            <circle cx={x} cy={y} r="3.5" fill={RIASEC_COLOR[key]} />
            <text
              x={lx}
              y={ly}
              textAnchor={
                Math.abs(lx - cx) < 6 ? "middle" : lx > cx ? "start" : "end"
              }
              dominantBaseline="middle"
              fill="rgba(247,242,232,0.72)"
              fontSize="10"
              fontWeight="800"
            >
              {key} · {RIASEC_LABEL[key]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
