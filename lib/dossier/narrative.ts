import { z } from "zod";
import { JOBS } from "../jobs";
import { statusLabel, studiesLabel } from "../presentation";
import { TRAIT_META, traitSummary } from "../traits";
import { CENTER_BY_ID } from "../centers";
import { cleanSoftSkills, mergeCvNarrative, SOFT_SKILLS } from "./cv";
import type {
  CvNarrative,
  Dossier,
  DossierEmail,
  DossierFacts,
  EmailsNarrative,
  Narrative,
  NarrativeSections,
  SynthesisNarrative,
} from "./types";

// ---------------------------------------------------------------------------
// Schémas de sortie : trois sections, trois appels, trois replis indépendants.
// ---------------------------------------------------------------------------

const text = (max: number) => z.string().max(max);

export const SynthesisNarrativeSchema = z.object({
  headline: text(140),
  summary: text(1400),
  strengths: z
    .array(
      z.object({
        label: text(100),
        evidenceIds: z.array(text(160)).max(5),
      }),
    )
    .max(5),
  directions: z
    .array(
      z.object({
        id: text(80),
        why: text(500),
        watchout: text(400),
      }),
    )
    .max(3),
  trainings: z
    .array(
      z.object({
        id: text(120),
        why: text(350),
      }),
    )
    .max(8),
  nextSteps: z
    .array(
      z.object({
        title: text(120),
        detail: text(400),
        evidenceIds: z.array(text(160)).max(5),
      }),
    )
    .max(4),
});

export const CvNarrativeSchema = z.object({
  targetOfferId: text(120).optional(),
  title: text(120),
  summary: text(900),
  experiences: z
    .array(
      z.object({
        experienceId: text(160),
        bullets: z.array(text(240)).max(3),
        softSkills: z.array(text(80)).max(4),
      }),
    )
    .max(6),
  softSkills: z.array(text(80)).max(8),
  languages: z.array(text(80)).max(5),
  interests: z.array(text(120)).max(6),
});

export const EmailsNarrativeSchema = z.object({
  emails: z
    .array(
      z.object({
        offerId: text(120),
        subject: text(140),
        body: text(1800),
      }),
    )
    .max(8),
});

export const NarrativeSchema = z.object({
  synthesis: SynthesisNarrativeSchema,
  cv: CvNarrativeSchema,
  emails: EmailsNarrativeSchema,
});

export const SynthesisJsonSchema = z.toJSONSchema(SynthesisNarrativeSchema) as Record<
  string,
  unknown
>;
export const CvJsonSchema = z.toJSONSchema(CvNarrativeSchema) as Record<
  string,
  unknown
>;
export const EmailsJsonSchema = z.toJSONSchema(EmailsNarrativeSchema) as Record<
  string,
  unknown
>;
export const NarrativeJsonSchema = z.toJSONSchema(NarrativeSchema) as Record<
  string,
  unknown
>;

// ---------------------------------------------------------------------------
// Garde-fous de contenu (pas seulement les ids).
// ---------------------------------------------------------------------------

const FORBIDDEN =
  /\b(sant[ée]|handicap|maladie|m[ée]dical|origine|ethnie|race|religion|famille|parents?|fr[èe]res?|s[œo]urs?|grossesse|sexualit[ée]|politique|casier|administratif)\b/iu;
const SECOND_PERSON = /\b(tu|ton|ta|tes|toi)\b/iu;
const QUESTION_OR_INTERVIEW =
  /[?]|\b(raconte|dis-moi|comment t'as|qu'est-ce que tu|pourquoi tu|est-ce que tu)\b/iu;
// « Réalisation de réparer… » : la faute typique d'un LLM qui concatène
// un nom d'action et un infinitif. On préfère le repli déterministe.
const BAD_CV_GRAMMAR =
  /\b(de|d['’])\s+(réparer|faire|organiser|gérer|démonter|monter|installer|programmer|peindre|aider|accueillir|vendre|créer|planter|entretenir)\b/iu;
const EMAIL_ADDRESS = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/iu;
const PHONE_NUMBER = /\b0[1-9](?:[ .-]?\d{2}){4}\b/u;
const YEAR = /\b(19|20)\d{2}\b/u;

function cleanLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function safeCvText(value: string, max: number): string | null {
  const clean = cleanLine(value);
  if (!clean || clean.length > max) return null;
  if (FORBIDDEN.test(clean)) return null;
  if (SECOND_PERSON.test(clean)) return null;
  if (QUESTION_OR_INTERVIEW.test(clean)) return null;
  if (BAD_CV_GRAMMAR.test(clean)) return null;
  if (YEAR.test(clean)) return null;
  return clean;
}

function safeSummary(value: string, max: number): string | null {
  const clean = cleanLine(value);
  if (!clean || clean.length > max) return null;
  if (FORBIDDEN.test(clean)) return null;
  if (SECOND_PERSON.test(clean)) return null;
  return clean;
}

function safeSynthesisText(value: string, max: number): string | null {
  const clean = cleanLine(value);
  if (!clean || clean.length > max) return null;
  if (FORBIDDEN.test(clean)) return null;
  return clean;
}

function safeEmailBody(value: string, facts: DossierFacts): string | null {
  const clean = value.trim();
  if (!clean || clean.length > 1800) return null;
  if (FORBIDDEN.test(clean)) return null;
  if (SECOND_PERSON.test(clean)) return null;
  // L'IA ne reçoit ni email ni téléphone : elle ne doit pas en inventer.
  if (EMAIL_ADDRESS.test(clean)) return null;
  if (PHONE_NUMBER.test(clean)) return null;
  const knownContacts = new Set(
    facts.offers.map((offer) => offer.contact).filter(Boolean),
  );
  for (const contact of knownContacts) {
    if (contact && clean.includes(contact)) return null;
  }
  return clean;
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function mentionsOffer(value: string, facts: DossierFacts, offerId: string): boolean {
  const offer = facts.offers.find((candidate) => candidate.id === offerId);
  if (!offer) return false;
  const haystack = normalize(value);
  return (
    haystack.includes(normalize(offer.title)) ||
    haystack.includes(normalize(offer.company))
  );
}

function collectFactIds(facts: DossierFacts): Set<string> {
  const ids = new Set<string>();
  for (const direction of facts.directions) {
    for (const evidence of direction.evidence) ids.add(evidence.id);
  }
  for (const training of facts.trainings) ids.add(training.id);
  for (const offer of facts.offers) ids.add(offer.id);
  return ids;
}

function cleanEvidence(list: string[], ids: Set<string>): string[] {
  return list.filter((id) => ids.has(id));
}

export function validateSynthesis(
  narrative: SynthesisNarrative,
  facts: DossierFacts,
): SynthesisNarrative {
  const ids = collectFactIds(facts);
  const directionIds = new Set(facts.directions.map((d) => d.id));
  const trainingIds = new Set(facts.trainings.map((t) => t.id));

  return {
    headline: safeSynthesisText(narrative.headline, 140) ?? "",
    summary: safeSynthesisText(narrative.summary, 1400) ?? "",
    strengths: narrative.strengths
      .map((strength) => ({
        label: safeSynthesisText(strength.label, 100) ?? "",
        evidenceIds: cleanEvidence(strength.evidenceIds, ids),
      }))
      .filter((strength) => strength.label.length > 0),
    directions: narrative.directions
      .filter((direction) => directionIds.has(direction.id))
      .map((direction) => ({
        id: direction.id,
        why: safeSynthesisText(direction.why, 500) ?? "",
        watchout: safeSynthesisText(direction.watchout, 400) ?? "",
      }))
      .filter((direction) => direction.why.length > 0),
    trainings: narrative.trainings
      .filter((training) => trainingIds.has(training.id))
      .map((training) => ({
        id: training.id,
        why: safeSynthesisText(training.why, 350) ?? "",
      }))
      .filter((training) => training.why.length > 0),
    nextSteps: narrative.nextSteps
      .map((step) => ({
        title: safeSynthesisText(step.title, 120) ?? "",
        detail: safeSynthesisText(step.detail, 400) ?? "",
        evidenceIds: cleanEvidence(step.evidenceIds, ids),
      }))
      .filter((step) => step.title.length > 0 && step.detail.length > 0),
  };
}

export function validateCv(
  narrative: CvNarrative,
  facts: DossierFacts,
): CvNarrative {
  const experienceIds = new Set(facts.user.experience.map((item) => item.id));
  const offerIds = new Set(facts.offers.map((offer) => offer.id));

  return {
    targetOfferId:
      narrative.targetOfferId && offerIds.has(narrative.targetOfferId)
        ? narrative.targetOfferId
        : undefined,
    title: safeCvText(narrative.title, 120) ?? "",
    summary: safeSummary(narrative.summary, 900) ?? "",
    experiences: narrative.experiences
      .filter((experience) => experienceIds.has(experience.experienceId))
      .map((experience) => ({
        experienceId: experience.experienceId,
        bullets: experience.bullets
          .map((bullet) => safeCvText(bullet, 240))
          .filter((bullet): bullet is string => Boolean(bullet))
          .slice(0, 3),
        softSkills: cleanSoftSkills(experience.softSkills, 4),
      }))
      .filter((experience) => experience.bullets.length > 0),
    softSkills: cleanSoftSkills(narrative.softSkills, 8),
    languages: narrative.languages
      .map((language) => safeSummary(language, 80))
      .filter((language): language is string => Boolean(language))
      .slice(0, 5),
    interests: narrative.interests
      .map((interest) => safeSummary(interest, 120))
      .filter((interest): interest is string => Boolean(interest))
      .slice(0, 6),
  };
}

export function validateEmails(
  narrative: EmailsNarrative,
  facts: DossierFacts,
): EmailsNarrative {
  const offerIds = new Set(facts.offers.map((offer) => offer.id));

  return {
    emails: narrative.emails
      .filter((email) => offerIds.has(email.offerId))
      .map((email) => {
        const subject = cleanLine(email.subject);
        const body = safeEmailBody(email.body, facts);
        return body &&
          subject.length > 0 &&
          subject.length <= 140 &&
          !FORBIDDEN.test(subject) &&
          !SECOND_PERSON.test(subject) &&
          mentionsOffer(`${subject}\n${body}`, facts, email.offerId)
          ? { offerId: email.offerId, subject, body }
          : null;
      })
      .filter((email): email is EmailsNarrative["emails"][number] =>
        Boolean(email),
      ),
  };
}

/** Compatibilité : valide la narrative complète (tests, ancien point d'entrée). */
export function validateNarrative(
  narrative: Narrative,
  facts: DossierFacts,
): Narrative {
  return {
    synthesis: validateSynthesis(narrative.synthesis, facts),
    cv: validateCv(narrative.cv, facts),
    emails: validateEmails(narrative.emails, facts),
  };
}

// ---------------------------------------------------------------------------
// Faits envoyés à l'IA : pseudonymisés, sans récit brut.
// ---------------------------------------------------------------------------

function offerContext(dossier: Dossier) {
  const index = new Map<
    string,
    {
      offer: Dossier["directions"][number]["jobs"][number]["offers"][number];
      job: Dossier["directions"][number]["jobs"][number];
    }
  >();
  for (const direction of dossier.directions) {
    for (const job of direction.jobs) {
      for (const offer of job.offers) {
        // Une offre peut être rattachée à plusieurs métiers ROME. On garde le
        // premier, celui qui a servi à construire l'email déterministe.
        if (!index.has(offer.id)) index.set(offer.id, { offer, job });
      }
    }
  }
  return index;
}

export function buildFacts(dossier: Dossier): DossierFacts {
  const evidenceId = (centerId: string, index: number) =>
    `ev-${centerId}-${index + 1}`;
  const offers = offerContext(dossier);
  // Le CV ciblé d'abord, puis au plus 7 autres offres : un prompt d'emails
  // trop long coûte cher et sort du schéma (8 emails max).
  const offerIds = [
    ...new Set([
      ...(dossier.cv.target.offerId ? [dossier.cv.target.offerId] : []),
      ...dossier.emails.map((email) => email.offerId),
    ]),
  ].slice(0, 8);

  return {
    consents: { ai: dossier.user.aiEnabled },
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
        savoirEtre: job.competences.savoirEtre
          .slice(0, 4)
          .map((c) => c.label),
        friction: job.friction.slice(0, 3),
      })),
      evidence: direction.evidence.map((text, index) => ({
        id: evidenceId(direction.centerId, index),
        text,
      })),
      watchout: direction.watchout,
    })),
    trainings: dossier.trainings.slice(0, 10).map((training) => ({
      id: training.id,
      title: training.title,
      level: training.diplomaLevel,
      duration: `${training.durationMonths} mois`,
      establishments: training.establishments.map((e) => e.name),
      jobs: training.jobCodes
        .map((code) => JOBS.find((job) => job.code === code)?.label)
        .filter((label): label is string => Boolean(label)),
      debouches: training.debouches.map((d) => d.label),
      prerequisites: training.prerequisites,
      alternance: training.alternance,
      cost: training.cost,
      why: training.why,
    })),
    offers: offerIds
      .map((id) => {
        const context = offers.get(id);
        if (!context) return null;
        return {
          id,
          title: context.offer.title,
          company: context.offer.company,
          city: context.offer.city,
          jobCode: context.job.code,
          jobLabel: context.job.label,
          contract: context.offer.contract,
          salary: context.offer.salary,
          contact: context.offer.contact,
          url: context.offer.url,
          competences: context.job.competences.savoirFaire
            .slice(0, 5)
            .map((c) => c.label),
        };
      })
      .filter((offer): offer is NonNullable<typeof offer> => Boolean(offer)),
    cvTarget: dossier.cv.target,
    softSkills: [...SOFT_SKILLS],
    user: {
      age: dossier.user.age,
      studiesLevel: studiesLabel(dossier.user.studiesLevel),
      status: statusLabel(dossier.user.currentStatus),
      experience: dossier.experience
        .filter(
          (item) =>
            Boolean(item.proof) || (item.competences?.length ?? 0) > 0,
        )
        .slice(0, 10)
        .map((item) => ({
          id: item.id,
          title: item.title,
          proof: item.proof,
          competences: item.competences,
          source: item.source,
        })),
      mobilityKm: dossier.user.mobilityKm,
      city: dossier.user.city,
      contracts: dossier.user.contractTypes,
      availability: dossier.user.availableFrom,
      alternance: dossier.user.alternance,
      driverLicense: dossier.user.driverLicense,
    },
  };
}

// ---------------------------------------------------------------------------
// Fusion avec le dossier déterministe
// ---------------------------------------------------------------------------

function ensureSignature(body: string, email: DossierEmail, dossier: Dossier): string {
  const lower = body.toLowerCase();
  const name = `${dossier.user.firstName} ${dossier.user.lastName ?? ""}`.trim() || "[Prénom]";
  const contact =
    [dossier.user.email, dossier.user.phone].filter(Boolean).join(" · ") ||
    "[email] · [téléphone]";
  const hasName =
    lower.includes(name.toLowerCase()) ||
    /\[(ton )?pr[ée]nom\]/iu.test(body);
  const hasContact =
    (dossier.user.email ? body.includes(dossier.user.email) : false) ||
    (dossier.user.phone ? body.includes(dossier.user.phone) : false) ||
    /\[(ton )?(email|e-mail|t[ée]l[ée]phone)\]/iu.test(body);

  const missing: string[] = [];
  if (!hasName) missing.push(name);
  if (!hasContact) missing.push(contact);
  if (missing.length === 0) return body;
  return `${body.trim()}\n\n${missing.join("\n")}`;
}

/**
 * Fusionne les sections IA présentes. Une section absente ou invalide garde
 * le texte déterministe : le dossier ne casse jamais.
 */
export function applyNarrative(
  dossier: Dossier,
  narrative: NarrativeSections | null | undefined,
): Dossier {
  if (!narrative) return dossier;
  const synthesis = narrative.synthesis ?? null;
  const cv = narrative.cv ?? null;
  const emails = narrative.emails ?? null;
  if (!synthesis && !cv && !emails) return dossier;

  const directions = synthesis
    ? dossier.directions.map((direction) => {
        const written = synthesis.directions.find(
          (candidate) => candidate.id === direction.centerId,
        );
        return written
          ? {
              ...direction,
              why: written.why || direction.why,
              watchout: written.watchout || direction.watchout,
            }
          : direction;
      })
    : dossier.directions;

  const trainings = synthesis
    ? dossier.trainings.map((training) => {
        const written = synthesis.trainings.find(
          (candidate) => candidate.id === training.id,
        );
        return written ? { ...training, why: written.why || training.why } : training;
      })
    : dossier.trainings;

  const mergedEmails = emails
    ? dossier.emails.map((email) => {
        const written = emails.emails.find(
          (candidate) => candidate.offerId === email.offerId,
        );
        if (!written) return email;
        return {
          ...email,
          subject: written.subject || email.subject,
          body: ensureSignature(written.body || email.body, email, dossier),
        };
      })
    : dossier.emails;

  const steps =
    synthesis && synthesis.nextSteps.length > 0
      ? synthesis.nextSteps.map((step, index) => ({
          id: `ai-step-${index + 1}`,
          title: step.title,
          detail: step.detail,
          contact: dossier.actionPlan.steps[index]?.contact,
        }))
      : dossier.actionPlan.steps;

  const nextSynthesis = synthesis
    ? {
        ...dossier.synthesis,
        headline: synthesis.headline || dossier.synthesis.headline,
        summary: synthesis.summary || dossier.synthesis.summary,
        strengths:
          synthesis.strengths.length > 0
            ? synthesis.strengths
            : dossier.synthesis.strengths,
      }
    : dossier.synthesis;

  const nextCv = cv ? mergeCvNarrative(dossier.cv, cv) : dossier.cv;

  return {
    ...dossier,
    actionPlan: {
      headline: synthesis?.headline || dossier.actionPlan.headline,
      steps,
    },
    synthesis: nextSynthesis,
    directions,
    trainings,
    cv: nextCv,
    emails: mergedEmails,
    sources: [
      ...dossier.sources.filter((source) => source.id !== "ai"),
      { id: "ai", label: "Rédaction Claude local" },
    ],
  };
}
