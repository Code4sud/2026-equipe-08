import { shortCenter } from "../presentation";
import { studiesLabel } from "../presentation";
import { topDomains } from "../score";
import type { Profile } from "../types";
import type {
  CvNarrative,
  CvTarget,
  DemoExperience,
  DemoUser,
  DossierCv,
  DossierDirection,
  DossierJob,
  DossierOffer,
  DossierTraining,
} from "./types";

/**
 * Vocabulaire contrôlé des soft skills. L'IA ne peut choisir que dans cette
 * liste : on évite les « team player » vagues et les diagnostics de
 * personnalité. Le jeune reste libre de retirer une ligne.
 */
export const SOFT_SKILLS = [
  "Autonomie",
  "Rigueur",
  "Organisation",
  "Travail en équipe",
  "Communication",
  "Sens du service",
  "Adaptabilité",
  "Curiosité",
  "Initiative",
  "Gestion des priorités",
  "Régularité",
  "Respect des consignes",
  "Respect des règles de sécurité",
  "Minutie",
  "Sens du diagnostic",
  "Logique",
  "Créativité",
  "Négociation",
  "Persévérance",
  "Aisance relationnelle",
] as const;

export type SoftSkill = (typeof SOFT_SKILLS)[number];

const SOFT_BY_LOWER = new Map(
  SOFT_SKILLS.map((skill) => [skill.toLowerCase(), skill]),
);

export function isSoftSkill(value: string): boolean {
  return SOFT_BY_LOWER.has(value.trim().toLowerCase());
}

function canonicalSoftSkill(value: string): string | undefined {
  return SOFT_BY_LOWER.get(value.trim().toLowerCase());
}

/** « de Métallier » / « d'Opérateur » : évite les fautes dans le CV et l'email. */
export function deLabel(label: string): string {
  return /^[aeiouyàâäéèêëîïôöùûüœ]/iu.test(label.trim())
    ? `d'${label}`
    : `de ${label}`;
}

export function cleanSoftSkills(values: string[], max = 8): string[] {
  const out: string[] = [];
  for (const value of values) {
    const canonical = canonicalSoftSkill(value);
    if (canonical && !out.includes(canonical)) out.push(canonical);
    if (out.length >= max) break;
  }
  return out;
}

export type CvTargetChoice = {
  target: CvTarget;
  job?: DossierJob;
  offer?: DossierOffer;
};

/**
 * Choisit l'offre que le CV cible. Par défaut : l'offre du métier qui a le
 * meilleur score, pour que le CV parle au recruteur le plus pertinent.
 */
export function chooseCvTarget(
  directions: DossierDirection[],
  city: string,
  offerId?: string,
): CvTargetChoice {
  const pairs = directions.flatMap((direction) =>
    direction.jobs.flatMap((job) =>
      job.offers.map((offer) => ({ direction, job, offer })),
    ),
  );

  const chosen =
    (offerId ? pairs.find((pair) => pair.offer.id === offerId) : undefined) ??
    [...pairs].sort((a, b) => b.job.match.score - a.job.match.score)[0];

  if (!chosen) {
    const job = directions.flatMap((direction) => direction.jobs)[0];
    return {
      target: {
        jobCode: job?.code,
        jobLabel: job?.label ?? "Candidature spontanée",
        romeLabel: job?.label,
        city,
        competences:
          job?.competences.savoirFaire.map((c) => c.label).slice(0, 6) ?? [],
        savoirEtre:
          job?.competences.savoirEtre.map((c) => c.label).slice(0, 6) ?? [],
      },
      job,
    };
  }

  return {
    job: chosen.job,
    offer: chosen.offer,
    target: {
      offerId: chosen.offer.id,
      jobCode: chosen.job.code,
      jobLabel: chosen.offer.title,
      romeLabel: chosen.job.label,
      company: chosen.offer.company,
      city: chosen.offer.city,
      contract: chosen.offer.contract,
      salary: chosen.offer.salary,
      contact: chosen.offer.contact,
      url: chosen.offer.url,
      competences: chosen.job.competences.savoirFaire
        .map((c) => c.label)
        .slice(0, 6),
      savoirEtre: chosen.job.competences.savoirEtre
        .map((c) => c.label)
        .slice(0, 6),
    },
  };
}

const VERB_TO_NOUN: Record<string, string> = {
  aider: "Accompagnement",
  accueillir: "Accueil",
  analyser: "Analyse",
  animer: "Animation",
  assembler: "Assemblage",
  charger: "Chargement",
  concevoir: "Conception",
  conseiller: "Conseil",
  construire: "Construction",
  contrôler: "Contrôle",
  cuisiner: "Préparation",
  créer: "Création",
  démonter: "Démontage",
  entretenir: "Entretien",
  faire: "Organisation",
  gérer: "Gestion",
  installer: "Installation",
  livrer: "Livraison",
  maintenir: "Maintenance",
  monter: "Montage",
  nettoyer: "Nettoyage",
  organiser: "Organisation",
  peindre: "Peinture",
  planter: "Plantation",
  préparer: "Préparation",
  programmer: "Programmation",
  réaliser: "Réalisation",
  réparer: "Réparation",
  tester: "Test",
  vendre: "Vente",
};

function articleFor(word: string): string {
  const lower = word.toLowerCase();
  if (lower === "un") return "d'un";
  if (lower === "une") return "d'une";
  if (lower === "des") return "de";
  if (lower === "le") return "du";
  if (lower === "la") return "de la";
  if (lower === "les") return "des";
  if (lower === "l'") return "de l'";
  return "";
}

/**
 * Transforme « Réparer un vélo crevé » en « Réparation d'un vélo crevé ».
 * Sans LLM, c'est déjà plus présentable qu'une phrase parlée recopiée.
 */
export function activityToTitle(activity: string): string {
  const clean = activity.replace(/[.!?…\s]+$/u, "").trim();
  if (!clean) return "Expérience";
  const [first, ...rest] = clean.split(/\s+/u);
  const noun = VERB_TO_NOUN[first.toLowerCase()];
  if (!noun) return clean.charAt(0).toUpperCase() + clean.slice(1);

  const tail = rest.join(" ");
  const firstWord = rest[0] ?? "";
  if (firstWord.toLowerCase().startsWith("l'")) {
    const remainder = [firstWord.slice(2), ...rest.slice(1)]
      .filter(Boolean)
      .join(" ");
    return `${noun} de l'${remainder}`;
  }
  const article = firstWord ? articleFor(firstWord) : "";
  const remainder = article ? tail.replace(/^\S+/u, "").trim() : tail;
  const object = article ? `${article} ${remainder}`.trim() : tail;
  return `${noun}${object ? ` ${object}` : ""}`;
}

function proofToBullet(proof?: string): string | undefined {
  if (!proof) return undefined;
  const text = proof
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (/cherch|diagnost|trouv|panne/.test(text)) {
    return "Diagnostic de la panne et recherche de la solution";
  }
  if (/demont|repar|remont|install/.test(text)) {
    return "Démontage, réparation et remontage";
  }
  if (/planning|organis|prepar|anticip/.test(text)) {
    return "Organisation et anticipation";
  }
  if (/client|accueill|vendre|conseill/.test(text)) {
    return "Relation client et conseil";
  }
  if (/equipe|potes|groupe|collectif/.test(text)) {
    return "Travail en équipe";
  }
  if (/seul|autonom/.test(text)) {
    return "Travail en autonomie";
  }
  if (/verifi|control|qualit/.test(text)) {
    return "Contrôle qualité";
  }
  if (/secur|norme/.test(text)) {
    return "Respect des règles de sécurité";
  }
  return undefined;
}

/**
 * Soft skills adossées à des faits : préférences de travail mesurées +
 * compétences ROME réellement prouvées. Jamais un diagnostic de personnalité.
 */
function mapSavoirEtre(label: string): string | undefined {
  const text = label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (text.includes("autonom")) return "Autonomie";
  if (text.includes("rigueur") || text.includes("precision")) return "Rigueur";
  if (text.includes("organis") || text.includes("priorit")) return "Organisation";
  if (text.includes("equipe") || text.includes("collectif")) return "Travail en équipe";
  if (text.includes("communic") || text.includes("ecoute") || text.includes("expression")) return "Communication";
  if (text.includes("adapt")) return "Adaptabilité";
  if (text.includes("curieu")) return "Curiosité";
  if (text.includes("initiative")) return "Initiative";
  if (text.includes("secur")) return "Respect des règles de sécurité";
  if (text.includes("minutie") || text.includes("soin")) return "Minutie";
  if (text.includes("service") || text.includes("client")) return "Sens du service";
  if (text.includes("negoci")) return "Négociation";
  if (text.includes("persever")) return "Persévérance";
  if (text.includes("relation")) return "Aisance relationnelle";
  if (text.includes("stress") || text.includes("pression") || text.includes("urgence")) return "Gestion des priorités";
  if (text.includes("regular") || text.includes("ponctual")) return "Régularité";
  return undefined;
}

export function softSkillsFor(
  profile: Profile,
  experience: DemoExperience[],
  target: CvTarget,
): string[] {
  const out = new Set<string>();
  const add = (skill: string) => {
    if (isSoftSkill(skill)) out.add(skill);
  };

  // Les savoir-être de l'offre passent en premier : c'est ce que l'entreprise
  // demande, et le CV ciblé doit lui répondre sans inventer de preuve.
  for (const label of target.savoirEtre ?? []) {
    const mapped = mapSavoirEtre(label);
    if (mapped) add(mapped);
  }

  if (profile.traits.structure.mean > 0.15) {
    add("Rigueur");
    add("Respect des consignes");
  }
  if (profile.traits.socialEnergy.mean < -0.15) add("Autonomie");
  if (profile.traits.socialEnergy.mean > 0.15) add("Aisance relationnelle");
  if (profile.traits.cooperation.mean > 0.15) add("Travail en équipe");
  if (profile.traits.openness.mean > 0.15) add("Adaptabilité");
  if (profile.traits.pace.mean > 0.15) add("Gestion des priorités");
  if (profile.traits.pace.mean < -0.15) add("Régularité");

  const text = [
    ...experience.flatMap((item) => item.competences ?? []),
    ...target.competences,
  ]
    .join(" ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (/repar|diagnost|mainten|install/.test(text)) {
    add("Sens du diagnostic");
    add("Minutie");
  }
  if (/organis|planif|gerer/.test(text)) add("Organisation");
  if (/accueill|client|vendre|conseill/.test(text)) {
    add("Sens du service");
    add("Communication");
  }
  if (/equipe|collectif/.test(text)) add("Travail en équipe");
  if (/secur|norme/.test(text)) add("Respect des règles de sécurité");
  if (/cre|concev|peindre/.test(text)) add("Créativité");
  if (/program|numer|informat/.test(text)) add("Logique");

  return [...out].slice(0, 6);
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export type MakeCvInput = {
  profile: Profile;
  user: DemoUser;
  experience: DemoExperience[];
  trainings: DossierTraining[];
  target: CvTarget;
};

export function makeCv({
  profile,
  user,
  experience,
  trainings,
  target,
}: MakeCvInput): DossierCv {
  const name =
    `${user.firstName} ${user.lastName ?? ""}`.trim() || "[Prénom] [Nom]";
  const top = topDomains(profile, 3).map(shortCenter);
  const technical = unique([
    ...target.competences,
    ...experience.flatMap((item) => item.competences ?? []),
  ]).slice(0, 8);
  const soft = softSkillsFor(profile, experience, target);
  const mobility = `Mobile ${user.mobilityKm} km autour de ${user.city}${
    user.driverLicense ? " · Permis B" : ""
  }`;
  const experienceLine =
    experience.length > 0
      ? `Mes expériences : ${experience
          .slice(0, 2)
          .map((item) => activityToTitle(item.title).toLowerCase())
          .join(" et ")}.`
      : "";
  const targetLine = target.company
    ? `Je souhaite mettre à profit mes compétences au poste ${deLabel(
        target.jobLabel,
      )} chez ${target.company}.`
    : `Je souhaite mettre à profit mes compétences au poste ${deLabel(
        target.jobLabel,
      )}.`;

  const cvExperiences = experience
    .filter(
      (item) =>
        Boolean(item.proof) ||
        (item.competences?.length ?? 0) > 0 ||
        (item.source === "manuel" && Boolean(item.detail)),
    )
    .slice(0, 4)
    .map((item) => {
    const bullets: string[] = [];
    if (item.competences && item.competences.length > 0) {
      bullets.push(
        `Savoir-faire : ${item.competences
          .slice(0, 3)
          .map((competence) => competence.toLowerCase())
          .join(" ; ")}.`,
      );
    }
    const proof = proofToBullet(item.proof);
    if (proof) bullets.push(proof);
    if (item.detail && item.source === "manuel") {
      bullets.push(item.detail.replace(/\s+/g, " ").trim().slice(0, 240));
    }
    if (bullets.length === 0) bullets.push(`${activityToTitle(item.title)}.`);

    return {
      id: item.id,
      title: activityToTitle(item.title),
      organization: item.source === "manuel" ? "Expérience déclarée" : undefined,
      bullets,
      softSkills: soft.slice(0, 3),
    };
  });

  const matchingTraining = trainings.find(
    (training) => target.jobCode && training.jobCodes.includes(target.jobCode),
  );
  const education: DossierCv["education"] = [
    { title: `Niveau : ${studiesLabel(user.studiesLevel)}` },
  ];
  if (matchingTraining) {
    education.push({
      title: matchingTraining.title,
      detail: `${matchingTraining.durationMonths} mois · ${
        matchingTraining.alternance ? "alternance" : "voie scolaire"
      } · ${matchingTraining.establishments.map((e) => e.name).join(", ")}`,
    });
  }

  const placeholders: string[] = [];
  if (!user.email) placeholders.push("Ajoute ton email dans l'en-tête");
  if (!user.phone) placeholders.push("Ajoute ton téléphone dans l'en-tête");
  if (!user.lastName) placeholders.push("Ajoute ton nom si tu le souhaites");
  placeholders.push("Précise les dates ou durées de tes expériences");
  placeholders.push("Complète tes langues");
  placeholders.push("Ajoute 2 centres d'intérêt");

  return {
    target,
    header: {
      name,
      title: target.jobLabel,
      city: user.city,
      email: user.email,
      phone: user.phone,
      availability: `Disponible ${user.availableFrom}`,
      mobility,
    },
    summary: `${user.firstName ? `${user.firstName}, ` : ""}${studiesLabel(
      user.studiesLevel,
    )} à ${user.city}. ${experienceLine} ${targetLine} Profil ${top
      .join(", ")
      .toLowerCase()} ; disponible ${user.availableFrom}, mobilité ${
      user.mobilityKm
    } km autour de ${user.city}.`,
    experiences: cvExperiences,
    skills: { technical, soft },
    education,
    languages: [],
    interests: [],
    placeholders,
  };
}

/** Fusionne uniquement la partie CV de la narrative IA, si elle vise la même offre. */
export function mergeCvNarrative(cv: DossierCv, narrative: CvNarrative): DossierCv {
  if (cv.target.offerId && narrative.targetOfferId !== cv.target.offerId) {
    return cv;
  }

  const experiences = cv.experiences.map((item) => {
    const written = narrative.experiences.find(
      (candidate) => candidate.experienceId === item.id,
    );
    if (!written) return item;
    return {
      ...item,
      bullets:
        written.bullets.length > 0 ? written.bullets : item.bullets,
      softSkills:
        written.softSkills.length > 0
          ? cleanSoftSkills(written.softSkills, 4)
          : item.softSkills,
    };
  });

  const soft = cleanSoftSkills(
    [...narrative.softSkills, ...cv.skills.soft],
    8,
  );
  const languages = narrative.languages.map((l) => l.trim()).filter(Boolean);
  const interests = narrative.interests.map((i) => i.trim()).filter(Boolean);
  const placeholders = cv.placeholders.filter((placeholder) => {
    if (languages.length > 0 && placeholder.includes("langues")) return false;
    if (interests.length > 0 && placeholder.includes("centres")) return false;
    return true;
  });

  return {
    ...cv,
    header: {
      ...cv.header,
      title: narrative.title || cv.header.title,
    },
    summary: narrative.summary || cv.summary,
    experiences,
    skills: {
      ...cv.skills,
      soft: soft.length > 0 ? soft : cv.skills.soft,
    },
    languages: languages.length > 0 ? languages : cv.languages,
    interests: interests.length > 0 ? interests : cv.interests,
    placeholders,
  };
}
