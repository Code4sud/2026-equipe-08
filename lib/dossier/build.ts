import { CARDS } from "../../content/cards";
import { CENTER_IDS } from "../centers";
import { JOBS } from "../jobs";
import {
  buildDirections,
  dominantJobCenter,
  matchJobs,
  profileHeadline,
} from "../match";
import { jobLevel, shortCenter } from "../presentation";
import {
  computeProfile,
  resolveConfirmation,
  topDomains,
  unknownDomains,
} from "../score";
import { TRAITS, RIASEC } from "../types";
import type { Job, JobMatch, Profile } from "../types";
import { TRAIT_META, traitSummary } from "../traits";
import { OFFERS, TRAININGS } from "./demo";
import { extractExperience, mergeExperience } from "./experience";
import { applyNarrative } from "./narrative";
import type {
  BuildInput,
  DemoUser,
  Dossier,
  DossierActionStep,
  DossierCv,
  DossierDirection,
  DossierEmail,
  DossierJob,
  DossierOffer,
  DossierSession,
  DossierTraining,
} from "./types";

export type { BuildInput };

/** Recalcule le profil exactement comme le store, depuis une session brute. */
export function profileFromSession(session: DossierSession): Profile {
  let profile = computeProfile(session.responses, session.traitResponses, [
    ...CARDS,
    ...session.generated,
  ]);
  for (const confirmation of session.confirmations) {
    profile = resolveConfirmation(
      profile,
      confirmation.centerId,
      confirmation.accepted,
    );
  }
  return profile;
}

function uniqueBy<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const k = key(item);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}

function trainingsFor(job: Job): DossierTraining[] {
  const exact = TRAININGS.filter((t) => t.jobCodes.includes(job.code));
  const center = dominantJobCenter(job);
  const fallback = TRAININGS.filter((t) => t.centers.includes(center));
  const selected = (exact.length > 0 ? exact : fallback).slice(0, 2);

  return selected.map((training) => ({
    ...training,
    why:
      exact.length > 0
        ? `Le chemin le plus direct vers ${job.label} : ${training.title}.`
        : `Une passerelle possible vers ${job.label} : ${training.title}.`,
  }));
}

function offersFor(job: Job): DossierOffer[] {
  const exact = OFFERS.filter((o) => o.jobCodes.includes(job.code));
  const center = dominantJobCenter(job);
  const fallback = OFFERS.filter((o) =>
    o.centers.some((c) => (job.centers[c] ?? 0) > 0 || c === center),
  );
  return (exact.length > 0 ? exact : fallback).slice(0, 2);
}

function makeEmail(
  user: DemoUser,
  job: DossierJob,
  offer: DossierOffer,
): DossierEmail {
  const name = user.firstName || "[Ton prénom]";
  const proof =
    job.evidence.length > 0
      ? `Lors de mon parcours, j'ai notamment : ${job.evidence.slice(0, 3).join(" ; ")}.`
      : "Mon profil correspond à ce que vous recherchez.";
  const contact = [user.email, user.phone].filter(Boolean).join(" · ");

  return {
    id: `mail-${offer.id}`,
    offerId: offer.id,
    to: offer.contact,
    subject: `Candidature — ${offer.title} (${offer.company})`,
    body: `Bonjour,

Je vous adresse ma candidature pour le poste de ${offer.title} à ${offer.city}.

${proof}

Je suis disponible ${user.availableFrom} et mobile jusqu'à ${user.mobilityKm} km autour de ${user.city}.
${user.alternance ? "Je suis aussi ouvert·e à une alternance pour monter en compétences." : ""}

Je serais ravi·e d'échanger avec vous.

${name} ${user.lastName ?? ""}
${contact || "[ton email] · [ton téléphone]"}`,
    applicationUrl: offer.url,
  };
}

function makeJob(match: JobMatch): DossierJob {
  const job = match.job;
  return {
    code: job.code,
    label: job.label,
    definition: job.definition,
    level: jobLevel(job.level),
    access: job.access,
    competences: job.competences,
    match: {
      score: match.score,
      interest: match.interest,
      context: match.context,
    },
    evidence: match.evidence,
    friction: match.friction,
    trainings: trainingsFor(job),
    offers: offersFor(job).map((offer) => ({
      ...offer,
      distanceKm: undefined,
    })),
  };
}

function makeDirections(
  matches: ReturnType<typeof matchJobs>,
  profile: Profile,
): DossierDirection[] {
  return buildDirections(matches, profile).map((direction) => {
    return {
      centerId: direction.centerId,
      title: direction.title,
      subtitle: direction.subtitle,
      score: direction.score,
      why: `Tu as choisi ${direction.jobs[0]?.evidence.slice(0, 2).join(" et ") ?? "des activités de ce domaine"}. Ce sont les cartes qui soutiennent cette direction.`,
      watchout: direction.jobs[0]?.friction[0],
      evidence: direction.jobs[0]?.evidence ?? [],
      jobs: direction.jobs.map((match) => makeJob(match)),
    };
  });
}

function makeSynthesis(profile: Profile, user: DemoUser) {
  const confirmed = profile.confirmed.map(shortCenter);
  const tops = topDomains(profile, 3).map(shortCenter);
  const traits = TRAITS.map(
    (trait) =>
      `${TRAIT_META[trait].label.toLowerCase()} : ${traitSummary(trait, profile.traits[trait].mean)}`,
  ).join(" · ");
  const contracts = user.contractTypes.join(", ");

  return {
    headline: profileHeadline(profile) || "Ton profil se dessine",
    summary: `${user.firstName ? `${user.firstName}, ` : ""}${
      confirmed.length > 0
        ? `tu as confirmé ${confirmed.length > 1 ? "les domaines" : "le domaine"} ${confirmed.join(", ")}`
        : `tes réponses font ressortir ${tops.join(", ")}`
    }. ${traits}. Tu cherches ${contracts} autour de ${user.city}, avec une mobilité de ${user.mobilityKm} km. Les pistes ci-dessous sont des affinités de profil, pas des probabilités de réussite.`,
    strengths: (confirmed.length > 0 ? confirmed : tops).map((label) => ({
      label,
      evidenceIds: [],
    })),
    watchouts: uniqueBy(
      profile.confirmed.length > 0
        ? profile.confirmed.map(() => "Vérifier les prérequis et le rythme de la formation.")
        : ["Certaines pistes demandent une formation ou une alternance."],
      (x) => x,
    ),
    unknowns: unknownDomains(profile, 4).map(shortCenter),
  };
}

function makeCv(
  synthesis: ReturnType<typeof makeSynthesis>,
  profile: Profile,
  user: DemoUser,
  experience: Dossier["experience"],
  trainings: DossierTraining[],
): DossierCv {
  const topTraining = trainings[0];
  const confirmed = profile.confirmed.map(shortCenter);
  const name = `${user.firstName} ${user.lastName ?? ""}`.trim();
  const top = confirmed.join(", ") || synthesis.headline;
  const experienceText = experience
    .slice(0, 3)
    .map((item) => item.title)
    .join(", ");

  return {
    title: `${synthesis.headline || "Mon profil"} — ${user.alternance ? "alternance" : "emploi"}`,
    summary: `Profil ${top.toLowerCase()}${
      experienceText ? `, avec des expériences en ${experienceText}` : ""
    }. Je recherche ${user.contractTypes.join(", ")} à ${user.city}${
      user.alternance ? " ou une alternance" : ""
    }, avec une mobilité de ${user.mobilityKm} km.`,
    contact: {
      name: name || "[Ton nom]",
      city: user.city,
      email: user.email,
      phone: user.phone,
    },
    sections: [
      {
        heading: "Expériences & compétences",
        items: experience.map((item) => ({
          title: item.title,
          detail: item.detail,
        })),
      },
      {
        heading: "Compétences validées",
        items: confirmed.map((label) => ({
          title: label,
          detail: "Domaine confirmé par toi",
        })),
      },
      {
        heading: "Formation",
        items: [
          {
            title: `Niveau actuel : ${user.studiesLevel}`,
          },
          ...(topTraining
            ? [
                {
                  title: topTraining.title,
                  detail: `${topTraining.durationMonths} mois · ${
                    topTraining.alternance ? "alternance" : "voie scolaire"
                  } · ${topTraining.establishments.map((e) => e.name).join(", ")}`,
                },
              ]
            : []),
        ],
      },
      {
        heading: "Disponibilité",
        items: [
          {
            title: `Disponible ${user.availableFrom}`,
            detail: `Mobile ${user.mobilityKm} km autour de ${user.city} · Permis ${
              user.driverLicense ? "oui" : "non"
            }`,
          },
        ],
      },
    ],
  };
}

function makeActionPlan(
  directions: DossierDirection[],
  emails: DossierEmail[],
  trainings: DossierTraining[],
  user: DemoUser,
): { headline: string; steps: DossierActionStep[] } {
  const firstOffer = directions
    .flatMap((d) => d.jobs)
    .flatMap((j) => j.offers)
    .find((offer) => emails.some((e) => e.offerId === offer.id));
  const firstEmail = emails.find((e) => e.offerId === firstOffer?.id);
  const firstTraining = directions
    .flatMap((d) => d.jobs)
    .flatMap((j) => j.trainings)
    .find((t) => trainings.some((x) => x.id === t.id));

  const steps: DossierActionStep[] = [];

  if (firstOffer) {
    steps.push({
      id: "step-apply",
      title: `Envoie ta candidature à ${firstOffer.company}`,
      detail: `Poste : ${firstOffer.title} à ${firstOffer.city}. Le message est prêt dans la section Emails ; relis-le et ajoute tes coordonnées avant d'envoyer.`,
      contact: {
        name: firstOffer.company,
        email: firstEmail?.to,
        url: firstOffer.url,
      },
    });
  }

  if (firstTraining) {
    steps.push({
      id: "step-training",
      title: `Contacte ${firstTraining.establishments[0]?.name ?? "le centre de formation"}`,
      detail: `Demande une immersion ou une alternance pour ${firstTraining.title} (${firstTraining.durationMonths} mois). Prérequis : ${firstTraining.prerequisites.join(", ")}.`,
      contact: {
        name: firstTraining.establishments[0]?.name,
        url: firstTraining.establishments[0]?.url,
      },
    });
  }

  steps.push({
    id: "step-counselor",
    title: "Va à la mission locale ou au CIO avec ce dossier",
    detail: `Montre les 3 directions, les preuves et les questions. Demande une immersion avant de choisir. Tu es mobile ${user.mobilityKm} km autour de ${user.city}.`,
  });

  return { headline: "3 choses à faire cette semaine", steps };
}

export function buildDossier(input: BuildInput): Dossier {
  const { session, profile, user } = input;
  const allCards = [...CARDS, ...session.generated];
  const experience = mergeExperience(
    extractExperience(session),
    user.experience,
  );
  const matches = matchJobs(profile, JOBS, allCards, JOBS.length);
  const directions = makeDirections(matches, profile);
  const trainings = uniqueBy(
    directions.flatMap((d) => d.jobs.flatMap((j) => j.trainings)),
    (t) => t.id,
  );
  const emails = uniqueBy(
    directions
      .flatMap((d) => d.jobs)
      .flatMap((job) =>
        job.offers.map((offer) => makeEmail(user, job, offer)),
      ),
    (e) => e.offerId,
  );
  const synthesis = makeSynthesis(profile, user);
  const cv = makeCv(synthesis, profile, user, experience, trainings);
  const actionPlan = makeActionPlan(directions, emails, trainings, user);
  const domains = Object.fromEntries(
    CENTER_IDS.map((id) => {
      const d = profile.domains[id];
      return [
        id,
        {
          mean: d.mean,
          confidence: d.confidence,
          confirmed: d.confirmed,
          rejected: d.rejected,
        },
      ];
    }),
  ) as Dossier["profile"]["domains"];

  const dossier: Dossier = {
    version: "declic-dossier-0.2",
    // Rempli au moment de l'export : new Date() est interdit au prerender.
    generatedAt: "",
    user: { ...user, experience },
    experience,
    profile: {
      code: profile.code,
      theta: profile.theta,
      domains,
      traits: profile.traits,
      confirmed: profile.confirmed,
      rejected: profile.rejected,
    },
    actionPlan,
    synthesis,
    directions,
    trainings,
    cv,
    emails,
    charts: {
      radar: Object.fromEntries(
        RIASEC.map((key) => [key, Math.min(1, profile.theta[key] * 3)]),
      ) as Dossier["charts"]["radar"],
      domains: topDomains(profile, 6).map((id) => ({
        id,
        label: shortCenter(id),
        score: profile.domains[id].mean,
        confidence: profile.domains[id].confidence,
      })),
      matchBars: directions
        .flatMap((d) => d.jobs)
        .sort((a, b) => b.match.score - a.match.score)
        .slice(0, 6)
        .map((job) => ({ label: job.label, value: job.match.score })),
    },
    sources: [
      {
        id: "rome",
        label: "ROME 4.0 v62 — France Travail",
        url: "https://www.data.gouv.fr/fr/datasets/repertoire-operationnel-des-metiers-et-des-emplois-rome/",
      },
      {
        id: "demo-offers",
        label: "Offres de démonstration — Nice",
      },
      {
        id: "demo-trainings",
        label: "Formations de démonstration — Nice",
      },
    ],
    disclaimers: [
      "Les offres et formations affichées sont des données de démonstration pour Nice : à vérifier sur France Travail, ONISEP ou avec la mission locale.",
      "L'affinité de profil n'est pas une probabilité de réussite.",
      "Aucune déduction sur la santé, l'origine, la famille ou la religion.",
      "Le jeune valide ce qui est retenu ; tout est modifiable.",
    ],
  };

  return input.narrative
    ? applyNarrative(dossier, input.narrative)
    : dossier;
}
