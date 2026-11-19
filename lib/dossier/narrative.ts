import { z } from "zod";
import { CENTER_BY_ID } from "../centers";
import { statusLabel, studiesLabel } from "../presentation";
import { TRAIT_META, traitSummary } from "../traits";
import type {
  Dossier,
  DossierFacts,
  Narrative,
} from "./types";

export const NarrativeSchema = z.object({
  headline: z.string().max(140),
  summary: z.string().max(1400),
  strengths: z
    .array(
      z.object({
        label: z.string().max(100),
        evidenceIds: z.array(z.string().max(160)).max(5),
      }),
    )
    .max(5),
  directions: z
    .array(
      z.object({
        id: z.string().max(80),
        why: z.string().max(500),
        watchout: z.string().max(400),
      }),
    )
    .max(3),
  trainings: z
    .array(
      z.object({
        id: z.string().max(120),
        why: z.string().max(350),
      }),
    )
    .max(8),
  cv: z.object({
    title: z.string().max(120),
    summary: z.string().max(800),
    bullets: z.array(z.string().max(240)).max(8),
  }),
  emails: z
    .array(
      z.object({
        offerId: z.string().max(120),
        subject: z.string().max(140),
        body: z.string().max(1800),
      }),
    )
    .max(8),
  nextSteps: z
    .array(
      z.object({
        title: z.string().max(120),
        detail: z.string().max(400),
        evidenceIds: z.array(z.string().max(160)).max(5),
      }),
    )
    .max(4),
});

export const NarrativeJsonSchema = z.toJSONSchema(NarrativeSchema) as Record<
  string,
  unknown
>;

function collectFactIds(facts: DossierFacts): Set<string> {
  const ids = new Set<string>();
  for (const direction of facts.directions) {
    for (const evidence of direction.evidence) ids.add(evidence.id);
  }
  for (const training of facts.trainings) ids.add(training.id);
  for (const offer of facts.offers) ids.add(offer.id);
  return ids;
}

/**
 * L'IA ne peut citer que des faits fournis. On retire les références
 * inconnues et les sections qui ne correspondent à aucune direction/offre.
 */
export function validateNarrative(
  narrative: Narrative,
  facts: DossierFacts,
): Narrative {
  const ids = collectFactIds(facts);
  const directionIds = new Set(facts.directions.map((d) => d.id));
  const trainingIds = new Set(facts.trainings.map((t) => t.id));
  const offerIds = new Set(facts.offers.map((o) => o.id));

  const cleanEvidence = (list: string[]) =>
    list.filter((id) => ids.has(id));

  return {
    ...narrative,
    strengths: narrative.strengths
      .map((s) => ({ ...s, evidenceIds: cleanEvidence(s.evidenceIds) }))
      .filter((s) => s.label.trim().length > 0),
    directions: narrative.directions.filter((d) => directionIds.has(d.id)),
    trainings: narrative.trainings.filter((t) => trainingIds.has(t.id)),
    emails: narrative.emails.filter((e) => offerIds.has(e.offerId)),
    nextSteps: narrative.nextSteps.map((s) => ({
      ...s,
      evidenceIds: cleanEvidence(s.evidenceIds),
    })),
  };
}

export function buildFacts(dossier: Dossier): DossierFacts {
  const evidenceId = (centerId: string, index: number) =>
    `ev-${centerId}-${index + 1}`;

  return {
    profile: {
      code: dossier.profile.code,
      domains: dossier.charts.domains.map((d) => ({
        id: d.id,
        label: CENTER_BY_ID[d.id]?.short ?? d.label,
        score: Number(d.score.toFixed(3)),
        confirmed: dossier.profile.confirmed.includes(d.id),
      })),
      traits: Object.entries(dossier.profile.traits).map(([trait, state]) => ({
        label: TRAIT_META[trait as keyof typeof TRAIT_META].label,
        value: traitSummary(trait as keyof typeof TRAIT_META, state.mean),
        confidence: Number(state.confidence.toFixed(2)),
      })),
      strengths: dossier.synthesis.strengths.map((s) => s.label),
      unknowns: dossier.synthesis.unknowns,
    },
    directions: dossier.directions.map((direction) => ({
      id: direction.centerId,
      title: direction.title,
      jobs: direction.jobs.map((job) => ({
        code: job.code,
        label: job.label,
        level: job.level,
        competences: job.competences.savoirFaire
          .slice(0, 4)
          .map((c) => c.label),
      })),
      evidence: direction.evidence.map((text, index) => ({
        id: evidenceId(direction.centerId, index),
        text,
      })),
    })),
    trainings: dossier.trainings.map((training) => ({
      id: training.id,
      title: training.title,
      level: training.diplomaLevel,
      duration: `${training.durationMonths} mois`,
      establishments: training.establishments.map((e) => e.name),
    })),
    offers: dossier.emails.map((email) => {
      const offer = dossier.directions
        .flatMap((d) => d.jobs)
        .flatMap((j) => j.offers)
        .find((o) => o.id === email.offerId);
      return {
        id: email.offerId,
        title: offer?.title ?? "Offre",
        company: offer?.company ?? "Entreprise",
        city: offer?.city ?? dossier.user.city,
      };
    }),
    user: {
      age: dossier.user.age,
      studiesLevel: studiesLabel(dossier.user.studiesLevel),
      status: statusLabel(dossier.user.currentStatus),
      experience: dossier.experience.map((e) => ({
        title: e.title,
        detail: e.detail,
      })),
      mobilityKm: dossier.user.mobilityKm,
      city: dossier.user.city,
    },
  };
}

/**
 * Fusionne la narrative IA avec le dossier déterministe.
 * Tout champ absent ou invalide garde le texte de repli.
 */
export function applyNarrative(
  dossier: Dossier,
  narrative: Narrative,
): Dossier {
  const directions = dossier.directions.map((direction) => {
    const n = narrative.directions.find((d) => d.id === direction.centerId);
    return n
      ? {
          ...direction,
          why: n.why || direction.why,
          watchout: n.watchout || direction.watchout,
        }
      : direction;
  });

  const trainings = dossier.trainings.map((training) => {
    const n = narrative.trainings.find((t) => t.id === training.id);
    return n ? { ...training, why: n.why || training.why } : training;
  });

  const emails = dossier.emails.map((email) => {
    const n = narrative.emails.find((e) => e.offerId === email.offerId);
    return n
      ? { ...email, subject: n.subject || email.subject, body: n.body || email.body }
      : email;
  });

  const cvSections = [...dossier.cv.sections];
  if (narrative.cv.bullets.length > 0) {
    const existing = cvSections.findIndex((s) => s.heading === "Points forts");
    const section = {
      heading: "Points forts",
      items: narrative.cv.bullets.map((bullet) => ({ title: bullet })),
    };
    if (existing >= 0) cvSections[existing] = section;
    else cvSections.unshift(section);
  }

  const steps =
    narrative.nextSteps.length > 0
      ? narrative.nextSteps.map((step, index) => ({
          id: `ai-step-${index + 1}`,
          title: step.title,
          detail: step.detail,
          contact: dossier.actionPlan.steps[index]?.contact,
        }))
      : dossier.actionPlan.steps;

  return {
    ...dossier,
    actionPlan: {
      headline: narrative.headline || dossier.actionPlan.headline,
      steps,
    },
    synthesis: {
      ...dossier.synthesis,
      headline: narrative.headline || dossier.synthesis.headline,
      summary: narrative.summary || dossier.synthesis.summary,
      strengths:
        narrative.strengths.length > 0
          ? narrative.strengths
          : dossier.synthesis.strengths,
    },
    directions,
    trainings,
    cv: {
      ...dossier.cv,
      title: narrative.cv.title || dossier.cv.title,
      summary: narrative.cv.summary || dossier.cv.summary,
      sections: cvSections,
    },
    emails,
    sources: [
      ...dossier.sources.filter((s) => s.id !== "ai"),
      { id: "ai", label: "Rédaction Claude local" },
    ],
  };
}
