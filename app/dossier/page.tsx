"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { RIASEC } from "../../lib/types";
import type { Riasec } from "../../lib/types";
import {
  RIASEC_COLOR,
  RIASEC_LABEL,
  matchLevel,
} from "../../lib/presentation";
import { useSession } from "../../lib/store";
import { useMounted } from "../../lib/useMounted";
import {
  buildDossier,
  profileFromSession,
} from "../../lib/dossier/build";
import { DEMO_SESSION, loadDemoUser } from "../../lib/dossier/demo";
import {
  applyNarrative,
  buildFacts,
} from "../../lib/dossier/narrative";
import type {
  Dossier,
  DossierEmail,
  DossierJob,
  DossierOffer,
  DossierSession,
  DossierTraining,
  Narrative,
} from "../../lib/dossier/types";

type Backend = "mock" | "cli" | "api";
type AiState = "idle" | "loading" | "ok" | "error";

export default function DossierPage() {
  const mounted = useMounted();

  const responses = useSession((s) => s.responses);
  const generated = useSession((s) => s.generated);
  const traitResponses = useSession((s) => s.traitResponses);
  const confirmations = useSession((s) => s.confirmations);

  const liveSession = useMemo<DossierSession>(
    () => ({ responses, generated, traitResponses, confirmations }),
    [responses, generated, traitResponses, confirmations],
  );
  const isDemoSession = responses.length === 0;
  const session = isDemoSession ? DEMO_SESSION : liveSession;

  const profile = useMemo(() => profileFromSession(session), [session]);
  const user = useMemo(() => loadDemoUser(), []);
  const base = useMemo(
    () => buildDossier({ session, profile, user }),
    [session, profile, user],
  );

  const [narrative, setNarrative] = useState<Narrative | null>(null);
  const dossier = useMemo(
    () => (narrative ? applyNarrative(base, narrative) : base),
    [base, narrative],
  );

  const [backend, setBackend] = useState<Backend>("mock");
  const [claudeFound, setClaudeFound] = useState(false);
  const [claudeBin, setClaudeBin] = useState("");
  const [aiState, setAiState] = useState<AiState>("idle");
  const [aiError, setAiError] = useState<string | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<DossierEmail | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/config", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    })
      .then((response) => response.json())
      .then((data: { backend?: Backend; claudeFound?: boolean; claudeBin?: string }) => {
        if (cancelled) return;
        setBackend(data.backend ?? "mock");
        setClaudeFound(Boolean(data.claudeFound));
        setClaudeBin(data.claudeBin ?? "");
      })
      .catch(() => {
        // pas de config : on reste en mode démo.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function generate() {
    setAiState("loading");
    setAiError(null);
    try {
      const facts = buildFacts(base);
      const response = await fetch("/api/dossier", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ facts }),
      });
      const data = (await response.json()) as {
        narrative?: Narrative | null;
        error?: string;
      };
      if (data.narrative) {
        setNarrative(data.narrative);
        setAiState("ok");
      } else {
        setAiError(data.error ?? "Claude n'a pas répondu.");
        setAiState("error");
      }
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "Erreur inconnue");
      setAiState("error");
    }
  }

  function downloadJson() {
    const payload = {
      ...dossier,
      generatedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "declic-dossier.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function openEmail(email: DossierEmail) {
    setSelectedEmail(email);
  }

  const selectedOffer = selectedEmail
    ? dossier.directions
        .flatMap((direction) => direction.jobs)
        .flatMap((job) => job.offers)
        .find((offer) => offer.id === selectedEmail.offerId)
    : undefined;

  if (!mounted) {
    return (
      <main className="grid min-h-dvh place-items-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-ink border-t-transparent" />
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-5 pb-24 pt-6">
      <header className="no-print flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link
            href="/"
            aria-label="Accueil"
            className="grid h-9 w-9 place-items-center rounded-full border border-ink/20 text-sm text-ink/60"
          >
            ←
          </Link>
          <Link
            href="/demo"
            className="rounded-full border border-ink/20 px-3 py-2 text-[11px] font-bold text-ink/55"
          >
            Mode démo
          </Link>
        </div>
        <span className="text-xs font-black uppercase tracking-[0.2em]">
          Dossier
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="rounded-full border border-ink/20 px-3 py-2 text-[11px] font-bold text-ink/60"
          >
            Imprimer
          </button>
          <button
            onClick={downloadJson}
            className="rounded-full bg-ink px-3 py-2 text-[11px] font-bold text-paper"
          >
            JSON
          </button>
        </div>
      </header>

      {isDemoSession && (
        <div className="mt-5 rounded-2xl border-2 border-accent/30 bg-accent/10 px-4 py-3 text-xs leading-relaxed text-ink/65">
          <strong className="text-ink">Profil de démonstration.</strong> La
          session fournie par l&apos;équipe swipe est chargée. Charge ton propre
          parcours depuis le <Link href="/demo" className="underline">mode démo</Link>.
        </div>
      )}

      <section className="hard-shadow mt-5 overflow-hidden rounded-[32px] border-2 border-ink bg-ink text-paper">
        <div className="grid gap-6 p-6 sm:grid-cols-[1fr_230px] sm:items-center">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-paper/45">
              Dossier de restitution
            </p>
            <h1 className="mt-2 text-3xl font-black leading-none tracking-tight">
              {dossier.user.firstName}, {dossier.user.age} ans
            </h1>
            <p className="mt-2 text-sm font-semibold text-paper/70">
              {dossier.user.city} · {dossier.user.studiesLevel} ·{" "}
              {dossier.user.currentStatus}
            </p>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-paper/60">
              {dossier.synthesis.summary}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {dossier.profile.confirmed.map((id) => (
                <span
                  key={id}
                  className="rounded-full bg-mint px-3 py-1 text-[11px] font-bold text-ink"
                >
                  ✓ {dossier.charts.domains.find((d) => d.id === id)?.label ?? id}
                </span>
              ))}
              {dossier.profile.code.split("").map((letter) => (
                <span
                  key={letter}
                  className="grid h-8 w-8 place-items-center rounded-lg text-sm font-black"
                  style={{
                    backgroundColor: RIASEC_COLOR[letter as Riasec],
                    color: "#141414",
                  }}
                >
                  {letter}
                </span>
              ))}
            </div>
          </div>
          <div className="-mx-2 sm:mx-0">
            <Radar theta={dossier.charts.radar} />
            <p className="mt-1 text-center text-[9px] font-bold uppercase tracking-widest text-paper/30">
              profil relatif
            </p>
          </div>
        </div>
      </section>

      <AiBanner
        backend={backend}
        claudeFound={claudeFound}
        claudeBin={claudeBin}
        enabled={user.aiEnabled}
        state={aiState}
        error={aiError}
        onGenerate={generate}
      />

      <section className="mt-9">
        <SectionTitle
          kicker="01"
          title={dossier.actionPlan.headline}
          subtitle="Le dossier complet est en dessous. Commence par ces trois actions."
        />
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {dossier.actionPlan.steps.map((step, index) => (
            <div
              key={step.id}
              className="flex flex-col rounded-2xl border-2 border-ink bg-paper p-4"
            >
              <span className="text-3xl font-black leading-none text-accent/50">
                0{index + 1}
              </span>
              <h3 className="mt-2 text-base font-black leading-tight">
                {step.title}
              </h3>
              <p className="mt-2 flex-1 text-xs leading-relaxed text-ink/60">
                {step.detail}
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold">
                {step.contact?.email && (
                  <a
                    href={`mailto:${step.contact.email}`}
                    className="rounded-full bg-ink px-3 py-1.5 text-paper"
                  >
                    Écrire
                  </a>
                )}
                {step.contact?.url && (
                  <a
                    href={step.contact.url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border border-ink/20 px-3 py-1.5 text-ink/60"
                  >
                    Voir
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <SectionTitle
          kicker="02"
          title="Ton profil, sans jargon"
          subtitle="Ce qui ressort, ce qui pourrait accrocher, et ce qu'on ne sait pas encore."
        />
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-ink/15 bg-paper p-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-ink/35">
              Points forts
            </p>
            <ul className="mt-3 space-y-2">
              {dossier.synthesis.strengths.map((strength) => (
                <li key={strength.label} className="flex items-start gap-2 text-sm font-semibold">
                  <span className="mt-0.5 text-accent">✓</span>
                  {strength.label}
                </li>
              ))}
            </ul>
            {dossier.synthesis.watchouts.length > 0 && (
              <>
                <p className="mt-5 text-[10px] font-black uppercase tracking-widest text-ink/35">
                  À vérifier
                </p>
                <ul className="mt-2 space-y-1 text-sm text-ink/60">
                  {dossier.synthesis.watchouts.map((watchout) => (
                    <li key={watchout}>· {watchout}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
          <div className="rounded-2xl border border-ink/15 bg-sand/40 p-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-ink/35">
              Ce qu&apos;on ne sait pas encore
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {dossier.synthesis.unknowns.map((unknown) => (
                <span
                  key={unknown}
                  className="rounded-full border border-dashed border-ink/25 px-3 py-1.5 text-xs font-semibold text-ink/55"
                >
                  {unknown}
                </span>
              ))}
            </div>
            <p className="mt-4 text-xs leading-relaxed text-ink/50">
              C&apos;est exactement ce qu&apos;on creuse en entretien. Le dossier
              n&apos;est pas un verdict : c&apos;est une base de discussion.
            </p>
          </div>
        </div>
      </section>

      <section className="mt-11">
        <SectionTitle
          kicker="03"
          title="Trois directions"
          subtitle="Chaque piste est appuyée par tes cartes, les compétences ROME et un chemin de formation."
        />
        <div className="mt-6 space-y-10">
          {dossier.directions.map((direction, index) => (
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
                    {direction.subtitle}
                  </p>
                </div>
                {dossier.profile.confirmed.includes(direction.centerId) && (
                  <span className="rounded-full bg-mint px-2.5 py-1 text-[10px] font-black uppercase tracking-wider">
                    confirmé
                  </span>
                )}
              </div>

              <div className="mt-3 rounded-2xl border border-ink/10 bg-sand/40 px-4 py-3">
                <p className="text-sm leading-relaxed text-ink/65">
                  {direction.why}
                </p>
                {direction.watchout && (
                  <p className="mt-2 text-xs leading-relaxed text-ink/45">
                    À vérifier : {direction.watchout}
                  </p>
                )}
              </div>

              <div className="mt-3 space-y-2">
                {direction.jobs.map((job) => (
                  <JobCard
                    key={`${direction.centerId}-${job.code}`}
                    job={job}
                    emails={dossier.emails}
                    onWrite={openEmail}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <SectionTitle
          kicker="04"
          title="Formations qui pourraient te plaire"
          subtitle="Durée, prérequis, alternance, établissements et débouchés. Données de démonstration Nice à vérifier sur ONISEP."
        />
        <div className="mt-4 space-y-3">
          {dossier.trainings.map((training) => (
            <TrainingCard key={training.id} training={training} />
          ))}
        </div>
      </section>

      <section className="mt-12" id="cv">
        <SectionTitle
          kicker="05"
          title="Ton CV, prêt à relire"
          subtitle="Un brouillon rempli avec tes données. Relis, modifie, puis imprime ou copie dans ton CV."
        />
        <CvSheet dossier={dossier} />
        <button
          onClick={() => window.print()}
          className="no-print mt-3 rounded-full border border-ink/20 px-4 py-2 text-xs font-bold text-ink/60"
        >
          Imprimer le dossier + CV
        </button>
      </section>

      <section className="mt-12">
        <SectionTitle
          kicker="06"
          title="Emails prêts à envoyer"
          subtitle="Un brouillon par piste. Aucun envoi automatique : tu copies, tu relis, tu envoies depuis ta boîte."
        />
        <div className="mt-4 space-y-2">
          {dossier.emails.map((email) => {
            const offer = dossier.directions
              .flatMap((direction) => direction.jobs)
              .flatMap((job) => job.offers)
              .find((o) => o.id === email.offerId);
            return (
              <button
                key={email.id}
                onClick={() => openEmail(email)}
                className="flex w-full items-center justify-between gap-3 rounded-2xl border border-ink/15 bg-paper px-4 py-3 text-left transition-colors hover:border-ink/40"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{email.subject}</p>
                  <p className="mt-0.5 text-xs text-ink/45">
                    {offer?.company ?? "Entreprise"} · {offer?.city ?? "Nice"}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-ink px-3 py-1.5 text-[10px] font-bold text-paper">
                  Ouvrir
                </span>
              </button>
            );
          })}
          {dossier.emails.length === 0 && (
            <p className="text-sm text-ink/50">
              Pas d&apos;offre de démonstration pour ces pistes. Le modèle
              d&apos;email reste disponible depuis les métiers.
            </p>
          )}
        </div>
      </section>

      <section className="mt-12">
        <SectionTitle
          kicker="07"
          title="Tes affinités en un coup d'œil"
          subtitle="Des barres d'affinité de profil, pas des probabilités de réussite."
        />
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <ChartBars
            title="Domaines"
            rows={dossier.charts.domains.map((d) => ({
              label: d.label,
              value: d.score,
              detail: `${Math.round(d.confidence * 100)} % de confiance`,
            }))}
          />
          <ChartBars
            title="Métiers"
            rows={dossier.charts.matchBars.map((m) => ({
              label: m.label,
              value: m.value,
            }))}
          />
        </div>
      </section>

      <footer className="mt-12 border-t border-ink/15 pt-6">
        <p className="text-[11px] leading-relaxed text-ink/40">
          Sources : ROME 4.0 v62 · offres et formations de démonstration Nice ·
          rédaction locale éventuelle par Claude.{" "}
          {dossier.sources.map((source) => source.label).join(" · ")}
        </p>
        <ul className="mt-3 space-y-1 text-[11px] leading-relaxed text-ink/35">
          {dossier.disclaimers.map((disclaimer) => (
            <li key={disclaimer}>· {disclaimer}</li>
          ))}
        </ul>
        <div className="no-print mt-4 flex flex-wrap gap-2">
          <Link
            href="/demo"
            className="rounded-full border border-ink/25 px-4 py-2 text-xs font-bold text-ink/60"
          >
            Modifier le profil de démo
          </Link>
          <Link
            href="/"
            className="rounded-full border border-ink/25 px-4 py-2 text-xs font-bold text-ink/60"
          >
            Accueil
          </Link>
        </div>
      </footer>

      {selectedEmail && (
        <EmailCompose
          key={selectedEmail.id}
          email={selectedEmail}
          offer={selectedOffer}
          onClose={() => setSelectedEmail(null)}
        />
      )}
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
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink/50">
        {subtitle}
      </p>
    </div>
  );
}

function AiBanner({
  backend,
  claudeFound,
  claudeBin,
  enabled,
  state,
  error,
  onGenerate,
}: {
  backend: Backend;
  claudeFound: boolean;
  claudeBin: string;
  enabled: boolean;
  state: AiState;
  error: string | null;
  onGenerate: () => void;
}) {
  if (backend === "mock") {
    return (
      <div className="mt-4 rounded-2xl border border-ink/15 bg-sand/50 px-4 py-3 text-xs leading-relaxed text-ink/60">
        <strong className="text-ink">Mode démonstration sans IA.</strong> Le
        dossier est complet et déterministe. Pour la rédaction Claude locale,
        lance l&apos;app avec <code className="rounded bg-ink/10 px-1">LLM_BACKEND=cli</code>.
      </div>
    );
  }

  if (backend === "cli" && !claudeFound) {
    return (
      <div className="mt-4 rounded-2xl border border-accent/30 bg-accent/10 px-4 py-3 text-xs leading-relaxed text-ink/65">
        <strong className="text-ink">Claude introuvable.</strong> Installe
        Claude Code ou définis <code className="rounded bg-ink/10 px-1">CLAUDE_BIN</code> dans
        <code className="rounded bg-ink/10 px-1">.env.local</code>. Le dossier
        fonctionne sans IA.
      </div>
    );
  }

  if (!enabled) {
    return (
      <div className="mt-4 rounded-2xl border border-ink/15 bg-sand/50 px-4 py-3 text-xs leading-relaxed text-ink/60">
        <strong className="text-ink">IA désactivée dans le mode démo.</strong>{" "}
        Active-la depuis <Link href="/demo" className="underline">le panneau de démo</Link>{" "}
        pour laisser Claude rédiger la synthèse et les emails.
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-2xl border border-ink/15 bg-paper px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs leading-relaxed text-ink/60">
          <strong className="text-ink">
            {state === "ok" ? "Claude a rédigé le dossier." : "Claude local disponible."}
          </strong>{" "}
          {claudeBin && (
            <span className="text-ink/35">
              ({claudeBin.split("/").slice(-1)[0]})
            </span>
          )}
        </div>
        <button
          onClick={onGenerate}
          disabled={state === "loading"}
          className="rounded-full bg-ink px-4 py-2 text-xs font-bold text-paper disabled:opacity-50"
        >
          {state === "loading"
            ? "Rédaction en cours…"
            : state === "ok"
              ? "Relancer Claude"
              : state === "error"
                ? "Réessayer Claude"
                : "Générer avec Claude"}
        </button>
      </div>
      {state === "loading" && (
        <p className="mt-2 text-xs text-ink/45">
          Claude rédige la synthèse, les conseils et les emails. Le dossier
          déterministe reste affiché en attendant.
        </p>
      )}
      {error && (
        <div className="mt-2 rounded-xl bg-accent/10 px-3 py-2 text-xs leading-relaxed text-ink/65">
          <p className="font-bold text-accent">Claude n&apos;a pas répondu.</p>
          <p className="mt-1 break-words text-ink/55">{error.slice(0, 400)}</p>
          <p className="mt-1 text-ink/45">
            En local : lance <code className="rounded bg-ink/10 px-1">claude</code>,
            connecte-toi, puis réessaie. Sur Vercel, le mode mock reste actif.
          </p>
        </div>
      )}
    </div>
  );
}

function JobCard({
  job,
  emails,
  onWrite,
}: {
  job: DossierJob;
  emails: DossierEmail[];
  onWrite: (email: DossierEmail) => void;
}) {
  const badge = matchLevel(job.match.score);
  return (
    <details className="group rounded-2xl border border-ink/15 bg-paper open:border-ink/40">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold leading-tight">{job.label}</p>
          <p className="mt-1 text-[11px] text-ink/40">
            {job.code} · {job.level}
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

        <div className="grid grid-cols-2 gap-2">
          <ScoreBar label="Intérêts" value={job.match.interest} />
          <ScoreBar label="Contexte" value={job.match.context} />
        </div>

        {job.evidence.length > 0 && (
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-ink/35">
              Tes preuves
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {job.evidence.map((text) => (
                <span
                  key={text}
                  className="rounded-full bg-mint/60 px-2.5 py-1 text-[11px] font-semibold text-ink/70"
                >
                  {text}
                </span>
              ))}
            </div>
          </div>
        )}

        {job.friction.length > 0 && (
          <div className="rounded-xl bg-accent/10 px-3 py-2.5">
            <p className="text-[10px] font-black uppercase tracking-widest text-accent">
              Ce qui pourrait accrocher
            </p>
            <p className="mt-1 text-xs leading-relaxed text-ink/65">
              {job.friction.join(" · ")}
            </p>
          </div>
        )}

        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-ink/35">
            Compétences ROME
          </p>
          <ul className="mt-2 space-y-1">
            {job.competences.savoirFaire.slice(0, 4).map((competence) => (
              <li
                key={competence.code}
                className="flex items-start gap-2 text-xs leading-relaxed text-ink/65"
              >
                <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-accent" />
                {competence.label}
              </li>
            ))}
          </ul>
        </div>

        {job.trainings.length > 0 && (
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-ink/35">
              Comment y aller
            </p>
            <div className="mt-2 space-y-2">
              {job.trainings.map((training) => (
                <TrainingCard key={training.id} training={training} compact />
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-ink/35">
            Offres près de chez toi
          </p>
          {job.offers.length === 0 ? (
            <p className="mt-2 text-xs text-ink/45">
              Pas d&apos;offre de démonstration pour ce métier. Garde la piste
              pour une candidature spontanée.
            </p>
          ) : (
            <div className="mt-2 space-y-2">
              {job.offers.map((offer) => {
                const email = emails.find((e) => e.offerId === offer.id);
                return (
                  <div
                    key={offer.id}
                    className="rounded-xl border border-ink/10 px-3 py-2.5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-bold">{offer.company}</p>
                        <p className="mt-0.5 text-[11px] text-ink/45">
                          {offer.contract} · {offer.city}
                          {offer.salary ? ` · ${offer.salary}` : ""}
                        </p>
                      </div>
                      {email && (
                        <button
                          onClick={() => onWrite(email)}
                          className="rounded-full bg-ink px-3 py-1.5 text-[10px] font-bold text-paper"
                        >
                          Écrire
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <p className="text-[11px] leading-relaxed text-ink/40">
          Accès : {job.access}
        </p>
      </div>
    </details>
  );
}

function TrainingCard({
  training,
  compact = false,
}: {
  training: DossierTraining;
  compact?: boolean;
}) {
  return (
    <details className="group rounded-xl border border-ink/10 bg-sand/25">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 [&::-webkit-details-marker]:hidden">
        <div>
          <p className="text-xs font-bold leading-tight">{training.title}</p>
          <p className="mt-0.5 text-[10px] text-ink/45">
            {training.diplomaLevel} · {training.durationMonths} mois ·{" "}
            {training.alternance ? "alternance" : "voie scolaire"}
          </p>
        </div>
        <span className="text-base leading-none text-ink/30 transition-transform group-open:rotate-45">
          +
        </span>
      </summary>
      <div className="space-y-3 border-t border-ink/10 px-3 py-3 text-xs">
        {!compact && <p className="leading-relaxed text-ink/60">{training.why}</p>}
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-ink/35">
            Prérequis
          </p>
          <p className="mt-1 text-ink/60">{training.prerequisites.join(" · ")}</p>
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-ink/35">
            Où
          </p>
          <ul className="mt-1 space-y-1">
            {training.establishments.map((establishment) => (
              <li key={establishment.name}>
                <a
                  href={establishment.url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-ink/70 underline underline-offset-2"
                >
                  {establishment.name}
                </a>{" "}
                <span className="text-ink/40">· {establishment.city}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-ink/35">
            Débouchés
          </p>
          <p className="mt-1 text-ink/60">
            {training.debouches.map((d) => d.label).join(" · ")}
          </p>
        </div>
        <p className="text-[10px] text-ink/40">
          {training.cost ?? "Coût à vérifier"} · {training.nextStep}
        </p>
      </div>
    </details>
  );
}

function CvSheet({ dossier }: { dossier: Dossier }) {
  const cv = dossier.cv;
  return (
    <div className="mt-4 rounded-2xl border-2 border-ink bg-white p-6 text-ink shadow-sm print:border-0 print:shadow-none">
      <div className="border-b-2 border-ink pb-4">
        <h3 className="text-2xl font-black tracking-tight">{cv.title}</h3>
        <p className="mt-1 text-sm font-semibold text-ink/60">
          {cv.contact.name} · {cv.contact.city}
        </p>
        <p className="mt-1 text-xs text-ink/45">
          {[cv.contact.email, cv.contact.phone].filter(Boolean).join(" · ")}
        </p>
      </div>
      <p className="mt-4 text-sm leading-relaxed text-ink/70">{cv.summary}</p>
      <div className="mt-5 space-y-5">
        {cv.sections.map((section) => (
          <div key={section.heading} className="break-inside-avoid">
            <h4 className="text-[10px] font-black uppercase tracking-[0.18em] text-accent">
              {section.heading}
            </h4>
            <ul className="mt-2 space-y-2">
              {section.items.map((item, index) => (
                <li key={`${section.heading}-${index}`} className="text-sm">
                  <p className="font-bold">{item.title}</p>
                  {item.detail && (
                    <p className="text-xs leading-relaxed text-ink/55">
                      {item.detail}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="mt-5 text-[10px] text-ink/35">
        Brouillon généré à partir de tes réponses. Relis et adapte avant
        d&apos;envoyer.
      </p>
    </div>
  );
}

function EmailCompose({
  email,
  offer,
  onClose,
}: {
  email: DossierEmail;
  offer?: DossierOffer;
  onClose: () => void;
}) {
  const [to, setTo] = useState(email.to ?? "");
  const [subject, setSubject] = useState(email.subject);
  const [body, setBody] = useState(email.body);
  const [copied, setCopied] = useState(false);

  const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(
    to,
  )}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${subject}\n\n${body}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/60 p-3 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Nouveau message"
    >
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-ink/20 bg-white shadow-2xl">
        <div className="flex items-center justify-between bg-[#f2f6fc] px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-[#0b57d0] text-sm font-black text-white">
              ✉
            </span>
            <div>
              <p className="text-sm font-bold text-[#202124]">Nouveau message</p>
              {offer && (
                <p className="text-[11px] text-[#5f6368]">
                  {offer.company} · {offer.title}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="grid h-8 w-8 place-items-center rounded-full text-lg text-[#5f6368] hover:bg-black/5"
          >
            ×
          </button>
        </div>

        <div className="divide-y divide-[#e0e0e0]">
          <label className="flex items-center gap-3 px-4 py-2 text-sm">
            <span className="w-12 text-xs text-[#5f6368]">À</span>
            <input
              value={to}
              onChange={(event) => setTo(event.target.value)}
              placeholder="email de l'entreprise"
              className="w-full bg-transparent py-1 text-sm outline-none"
            />
          </label>
          <label className="flex items-center gap-3 px-4 py-2 text-sm">
            <span className="w-12 text-xs text-[#5f6368]">Objet</span>
            <input
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              className="w-full bg-transparent py-1 text-sm font-semibold outline-none"
            />
          </label>
        </div>

        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          className="min-h-[300px] w-full resize-y bg-white px-4 py-4 text-sm leading-relaxed text-[#202124] outline-none"
        />

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e0e0e0] px-4 py-3">
          <div className="flex items-center gap-2">
            <a
              href={gmailUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-full bg-[#0b57d0] px-5 py-2 text-sm font-bold text-white"
            >
              Ouvrir dans Gmail
            </a>
            <button
              onClick={copy}
              className="rounded-full border border-[#c4c7c5] px-4 py-2 text-sm font-semibold text-[#444746]"
            >
              {copied ? "Copié ✓" : "Copier"}
            </button>
          </div>
          <p className="text-[10px] text-[#5f6368]">
            Rien n&apos;est envoyé automatiquement.
          </p>
        </div>
      </div>
    </div>
  );
}

function Radar({ theta }: { theta: Record<Riasec, number> }) {
  const size = 230;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 76;
  const angles = RIASEC.map((_, index) => -Math.PI / 2 + (index * Math.PI * 2) / 6);

  const point = (index: number, value: number) => {
    const r = radius * (0.12 + 0.88 * value);
    return [cx + r * Math.cos(angles[index]), cy + r * Math.sin(angles[index])] as const;
  };

  const polygon = RIASEC.map((key, index) =>
    point(index, Math.max(0.06, Math.min(1, theta[key]))).join(","),
  ).join(" ");

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="mx-auto h-auto w-full max-w-[230px]"
      role="img"
      aria-label="Profil Holland"
    >
      {[0.25, 0.5, 0.75, 1].map((scale) => (
        <polygon
          key={scale}
          points={RIASEC.map((_, index) => {
            const r = radius * scale;
            return `${cx + r * Math.cos(angles[index])},${cy + r * Math.sin(angles[index])}`;
          }).join(" ")}
          fill="none"
          stroke="rgba(247,242,232,0.14)"
        />
      ))}
      {RIASEC.map((_, index) => (
        <line
          key={index}
          x1={cx}
          y1={cy}
          x2={cx + radius * Math.cos(angles[index])}
          y2={cy + radius * Math.sin(angles[index])}
          stroke="rgba(247,242,232,0.14)"
        />
      ))}
      <polygon
        points={polygon}
        fill="rgba(255,90,54,0.3)"
        stroke="#FF5A36"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {RIASEC.map((key, index) => {
        const [x, y] = point(index, Math.max(0.06, Math.min(1, theta[key])));
        const lx = cx + (radius + 20) * Math.cos(angles[index]);
        const ly = cy + (radius + 20) * Math.sin(angles[index]);
        return (
          <g key={key}>
            <circle cx={x} cy={y} r="3" fill={RIASEC_COLOR[key]} />
            <text
              x={lx}
              y={ly}
              textAnchor={Math.abs(lx - cx) < 6 ? "middle" : lx > cx ? "start" : "end"}
              dominantBaseline="middle"
              fill="rgba(247,242,232,0.7)"
              fontSize="9"
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

function ChartBars({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; value: number; detail?: string }[];
}) {
  return (
    <div className="rounded-2xl border border-ink/15 bg-paper p-4">
      <p className="text-[10px] font-black uppercase tracking-widest text-ink/35">
        {title}
      </p>
      <div className="mt-3 space-y-2.5">
        {rows.map((row) => (
          <div key={row.label}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-xs font-semibold text-ink/70">
                {row.label}
              </span>
              <span className="text-[10px] font-bold text-ink/40">
                {Math.round(row.value * 100)}
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink/10">
              <div
                className="h-full rounded-full bg-accent/70"
                style={{ width: `${Math.round(row.value * 100)}%` }}
              />
            </div>
            {row.detail && (
              <p className="mt-0.5 text-[9px] text-ink/35">{row.detail}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
