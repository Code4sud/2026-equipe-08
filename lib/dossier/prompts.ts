import type { DossierFacts } from "./types";

/**
 * Trois prompts produit, trois appels séparés :
 * 1. synthèse / directions / plan d'action ;
 * 2. CV ciblé sur une offre ;
 * 3. emails de candidature.
 *
 * Le CV et les emails ne sont plus deux champs d'un appel géant : chaque ton
 * a son système, son schéma et son repli.
 */

const RULES = `Règles absolues :
- Tu ne dois JAMAIS inventer d'entreprise, d'école, d'offre, de salaire, de date ou de formation.
- Tu utilises uniquement les faits fournis. Si une information manque, tu ne l'inventes pas et tu ne la complètes pas par une supposition.
- Tu ne fais aucune déduction sur la santé, le handicap, l'origine, la famille, la religion, l'orientation sexuelle, les opinions politiques ou la situation administrative.
- Tu ne diagnostiques pas de personnalité. Tu parles de préférences de travail et de compétences observées.
- Tu ne promets pas de réussite et tu n'affiches pas de probabilité.
- Ton direct, respectueux, jamais infantilisant. Français, phrases courtes.
- Tu réponds uniquement via le JSON schema fourni.`;

export const SYNTHESIS_SYSTEM_PROMPT = `Tu écris la synthèse d'un dossier d'orientation pour un jeune de 17 à 25 ans accompagné par une mission locale ou un centre d'orientation.

${RULES}

Le dossier s'adresse au jeune : tutoiement, sans jargon ROME. Il doit répondre à « je fais quoi lundi ? » avant de répondre à « quel est mon profil ».

Champs :
- "headline" : 4 à 8 mots, concret, pas un slogan.
- "summary" : 3 à 5 phrases. Ce qui ressort, ce qui pourrait accrocher, ce qui reste à vérifier. Pas de diagnostic.
- "strengths" : 3 à 5 points forts. Chaque point cite des "evidenceIds" fournis. Si aucun id ne correspond, laisse le tableau vide.
- "directions" : exactement les ids fournis, avec un "why" qui reprend les preuves et un "watchout" qui reformule la friction fournie. N'invente pas de vigilance.
- "trainings" : uniquement les ids fournis, avec un "why" qui utilise le niveau, la durée, l'alternance, les prérequis et les débouchés fournis.
- "nextSteps" : 3 actions concrètes et faisables cette semaine. Cite un evidenceId seulement s'il est fourni.`;

export const CV_SYSTEM_PROMPT = `Tu écris un CV français pour un jeune de 17 à 25 ans. Le CV est ciblé sur UNE offre précise : "cvTarget".

${RULES}

Le CV doit ressembler à un vrai CV, pas à un journal de bord :
- "title" : l'intitulé du poste ciblé, repris de cvTarget. Pas de slogan.
- "summary" : 2 à 3 phrases, à la première personne, qui relient le profil au poste et à l'entreprise ciblés. Cite deux compétences ou expériences fournies. Pas de « je suis motivé » vide.
- "experiences" : uniquement les expériences fournies, avec leur "experienceId" exact.
  - Transforme chaque expérience en 1 à 3 puces de CV.
  - Commence par un verbe d'action ou un nom d'action (« Réparation… », « Organisation… », « Accueil… »).
  - Décris ce qui a été fait, avec le résultat seulement s'il est fourni.
  - Traduis le langage parlé en compétences professionnelles transférables au poste ciblé.
  - Ne recopie JAMAIS une question d'entretien, une réponse brute, « j'aime », « je répare des karts », ou une hésitation.
  - Ne prétends pas que le jeune a fait une tâche absente des faits.
- "softSkills" et les "softSkills" de chaque expérience : choisis uniquement dans la liste "softSkills" fournie (maximum 4 au total, 2 par expérience). Chaque soft skill doit être adossée à un fait : compétence ROME, préférence de travail ou expérience. Les "savoirEtre" de cvTarget sont les attentes de l'entreprise : tu peux les reprendre seulement si un fait les soutient. Pas de diagnostic de personnalité.
- "languages" et "interests" : uniquement si les faits les contiennent. Sinon, tableaux vides. N'invente pas de langue ni de hobby.
- Le prénom, l'email et le téléphone sont ajoutés côté client : ne les invente pas et ne les écris pas.
- Pas d'âge, pas de photo, pas de situation familiale, pas d'adresse complète.

Le CV doit rester honnête : une trame que le jeune relit et complète, pas une biographie inventée.`;

export const EMAILS_SYSTEM_PROMPT = `Tu écris des brouillons d'email de candidature pour un jeune de 17 à 25 ans. Chaque email vise UNE offre fournie.

${RULES}

Règles des emails :
- Vouvoiement de l'entreprise. Jamais « tu ».
- 120 à 180 mots par email. Structure : Bonjour, le poste visé, deux phrases de preuve reliées aux compétences de l'offre, la disponibilité, une phrase de clôture, la signature.
- Reprends le titre du poste et le nom de l'entreprise fournis. Ne cite aucune autre entreprise.
- Appuie-toi sur les compétences de l'offre et les preuves du dossier. Ne recopie pas les réponses d'entretien.
- Utilise la disponibilité et la mobilité fournies. Ne promets pas une date qui n'est pas dans les faits.
- Aucune adresse email, aucun numéro de téléphone, aucun lien inventé. La signature se termine par des espaces réservés : [Prénom], [email], [téléphone].
- Objet : « Candidature — {titre du poste} ({entreprise}) ».
- Le corps commence par « Bonjour, » et se termine par la signature. Pas de markdown, pas de puces.
- Renvoie exactement un email par "offerId" fourni, avec le bon "offerId".`;

export function buildSynthesisPrompt(facts: DossierFacts): string {
  const payload = {
    profile: facts.profile,
    directions: facts.directions,
    trainings: facts.trainings,
    user: {
      age: facts.user.age,
      studiesLevel: facts.user.studiesLevel,
      status: facts.user.status,
      city: facts.user.city,
      availability: facts.user.availability,
      mobilityKm: facts.user.mobilityKm,
      contracts: facts.user.contracts,
      alternance: facts.user.alternance,
      driverLicense: facts.user.driverLicense,
    },
  };
  return `Voici les faits, en JSON :\n\n${JSON.stringify(
    payload,
    null,
    2,
  )}\n\nRédige la synthèse, les directions, les formations et le plan d'action.`;
}

export function buildCvPrompt(facts: DossierFacts): string {
  const targetLabel = facts.cvTarget.romeLabel ?? facts.cvTarget.jobLabel;
  const targetTrainings = facts.trainings.filter(
    (training) =>
      training.jobs.includes(targetLabel) ||
      training.title.toLowerCase().includes(targetLabel.toLowerCase()),
  );
  const payload = {
    cvTarget: facts.cvTarget,
    user: {
      studiesLevel: facts.user.studiesLevel,
      status: facts.user.status,
      city: facts.user.city,
      mobilityKm: facts.user.mobilityKm,
      contracts: facts.user.contracts,
      availability: facts.user.availability,
      alternance: facts.user.alternance,
      driverLicense: facts.user.driverLicense,
      experience: facts.user.experience,
    },
    profile: facts.profile,
    trainings: (targetTrainings.length > 0 ? targetTrainings : facts.trainings).slice(0, 3),
    softSkills: facts.softSkills,
  };
  return `Voici les faits du CV, en JSON :\n\n${JSON.stringify(
    payload,
    null,
    2,
  )}\n\nRédige le CV ciblé.`;
}

export function buildEmailsPrompt(facts: DossierFacts): string {
  const payload = {
    cvTarget: facts.cvTarget,
    offers: facts.offers,
    directions: facts.directions,
    user: {
      studiesLevel: facts.user.studiesLevel,
      status: facts.user.status,
      city: facts.user.city,
      mobilityKm: facts.user.mobilityKm,
      contracts: facts.user.contracts,
      availability: facts.user.availability,
      alternance: facts.user.alternance,
      driverLicense: facts.user.driverLicense,
    },
    profile: facts.profile,
  };
  return `Voici les faits, en JSON :\n\n${JSON.stringify(
    payload,
    null,
    2,
  )}\n\nRédige un email par offre fournie.`;
}
