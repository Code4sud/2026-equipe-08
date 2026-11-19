# Dossier de restitution — baseline

> Statut : proposition à valider. Aucun code écrit pour l'instant.
> Objectif : remplacer la page résultat actuelle par un **dossier complet, actionnable et exportable**, construit à partir du JSON du swipe.
> Contrainte : le swipe est réécrit en parallèle → **le dossier ne dépend pas de son code interne**, seulement d'un contrat JSON.

---

## 1. Principe directeur

**Les données décident. L'IA écrit. Le jeune valide.**

- Le moteur déterministe calcule : domaines, métiers, formations, offres locales, adéquation, prérequis.
- L'IA transforme ces faits en **texte lisible** : synthèse, profil du CV, emails, conseils.
- L'IA n'a **jamais** le droit d'inventer une entreprise, une formation, un établissement, un salaire ou une offre.
- Le jeune voit les sources, les dates, les preuves, et peut tout exporter.

Pour quelqu'un qui ne sait pas quoi faire, le dossier doit répondre à **« je fais quoi lundi ? »** avant de répondre à « quel est mon profil ». La première section est donc un plan d'action, pas un radar.

---

## 2. Contrat d'entrée — ce que le swipe doit fournir

Le swipe produit un fichier JSON. Le dossier consomme un **format canonique** ; un adaptateur mappe le JSON du swipe vers ce format si les noms changent.

```ts
export type SwipeResult = {
  schemaVersion: "1.0";
  generatedAt: string;                 // ISO
  instrument: {
    bankVersion: string;
    romeVersion: string;               // ex. "62"
  };

  user: {
    firstName?: string;                // optionnel, pour le CV
    age?: number;                       // donnée factuelle d'éligibilité
    postalCode: string;                 // pas d'adresse complète
    city?: string;
    studiesLevel:
      | "sans-diplome"
      | "cap-bep"
      | "bac"
      | "bac+2"
      | "bac+3"
      | "bac+5"
      | "autre";
    currentStatus:
      | "college"
      | "lycee"
      | "etudes"
      | "alternance"
      | "recherche"
      | "emploi"
      | "inactif";
    experience: Array<{
      title: string;
      organization?: string;
      durationMonths?: number;
      description?: string;
      competences?: string[];           // libellés ou codes ROME validés
    }>;
    constraints?: {
      mobilityKm?: number;
      driverLicense?: boolean;
      availableFrom?: string;
      maxTrainingMonths?: number;
      minSalary?: number;
      // pas de données santé / famille / religion / origine
    };
  };

  interest: {
    theta: Record<"R" | "I" | "A" | "S" | "E" | "C", number>;
    code: string;                       // ex. "R-S-I"
    domains: Array<{
      id: string;                       // ex. "manual"
      label: string;
      score: number;                    // 0..1
      confidence: number;               // 0..1
      confirmed: boolean;
      rejected: boolean;
      evidence: string[];               // textes de cartes likées
    }>;
    traits: Record<
      "socialEnergy" | "structure" | "openness" | "cooperation" | "pace",
      { mean: number; confidence: number }  // mean -1..1
    >;
  };

  evidence: {
    cards: Array<{
      id: string;
      text: string;
      direction: "left" | "right";
      reason?: string;
    }>;
    // récit libre : optionnel, jamais envoyé brut à l'IA
    story?: { text: string; validatedCompetences: string[] };
  };

  consents: {
    profile: boolean;                   // générer le dossier
    ai: boolean;                        // envoyer les faits pseudonymisés à l'IA
    export: boolean;                    // autoriser l'export
  };
};
```

### Règles sur les champs personnels

- **Âge, niveau d'études, expérience** : données factuelles d'**éligibilité** (prérequis, alternance, permis, limites d'âge). Jamais utilisées pour inférer une maturité, une personnalité ou une origine.
- **Code postal** : sert à calculer la distance ; jamais de rue/adresse.
- **Prénom** : optionnel, remplacé par `[Prénom]` avant l'IA ; réinséré côté client dans le CV.
- **Aucune** donnée santé, handicap, famille, religion, origine, orientation sexuelle, opinions politiques.

---

## 3. Contrat de sortie — le dossier

```ts
export type Dossier = {
  schemaVersion: "1.0";
  generatedAt: string;
  inputHash: string;                    // pour le cache et l'export
  sources: Array<{
    id: string;                         // "rome", "france-travail", "onisep"...
    label: string;
    url?: string;
    fetchedAt?: string;
  }>;

  actionPlan: {
    headline: string;                   // "3 choses à faire cette semaine"
    steps: Array<{
      id: string;
      title: string;                    // "Appeler le CFA de Nice"
      detail: string;
      deadline?: string;
      contact?: { name?: string; email?: string; phone?: string; url?: string };
      evidenceIds: string[];
    }>;
  };

  synthesis: {
    headline: string;                   // "Concret, analyse, organisation"
    summary: string;                    // 3–5 phrases, sans jargon
    strengths: Array<{ label: string; evidenceIds: string[] }>;
    watchouts: string[];                // "tu préfères un rythme régulier"
    unknowns: string[];                 // "on n'a pas exploré le soin"
  };

  directions: Array<{
    centerId: string;
    title: string;
    subtitle: string;
    score: number;
    why: string;                        // texte IA + preuves
    evidenceIds: string[];
    jobs: JobDossier[];
  }>;

  trainings: TrainingDossier[];         // formations qui peuvent intéresser
  cv: CvDossier;
  emails: EmailDraft[];
  charts: {
    radar: Record<"R" | "I" | "A" | "S" | "E" | "C", number>;
    domains: Array<{ id: string; label: string; score: number; confidence: number }>;
    matchBars: Array<{ label: string; value: number }>;
  };
  disclaimers: string[];
};

export type JobDossier = {
  code: string;                         // code ROME
  label: string;
  definition: string;
  level: string;                        // "CAP", "Bac+2"...
  match: { score: number; interest: number; context: number };
  competences: {
    savoirFaire: Array<{ code: string; label: string }>;
    savoirEtre: Array<{ code: string; label: string }>;
  };
  friction: string[];
  access: string;                       // texte ROME
  localOffers: LocalOffer[];
  trainingPaths: TrainingPath[];
  salary?: { min: number; max: number; source: string };
  tension?: { level: string; source: string };
};

export type LocalOffer = {
  id: string;
  title: string;
  company: string;
  city: string;
  distanceKm?: number;
  contract?: string;
  salary?: string;
  url: string;
  publishedAt?: string;
  source: string;                       // "france-travail" | "fixture"
};

export type TrainingPath = {
  id: string;
  title: string;
  diplomaLevel: string;                 // "CAP", "BTS", "BUT", "Licence"
  durationMonths: number;
  alternance: boolean;
  prerequisites: string[];
  cost?: string;
  establishments: Array<{
    name: string;
    city: string;
    distanceKm?: number;
    url?: string;
    source: string;
  }>;
  debouches: Array<{ code: string; label: string }>; // ROME
  nextStep: string;
};

export type TrainingDossier = TrainingPath & {
  why: string;                          // "tu as confirmé le manuel + la tech"
  evidenceIds: string[];
};

export type CvDossier = {
  title: string;                        // "Technicien installation réseau"
  summary: string;                      // 2–3 phrases, IA
  sections: Array<{
    heading: string;                    // "Expériences", "Compétences"...
    items: Array<{ title: string; detail?: string; dates?: string }>;
  }>;
  export: { json: boolean; pdf: boolean };
};

export type EmailDraft = {
  id: string;
  offerId: string;
  to?: string;                          // seulement si la source le fournit
  subject: string;
  body: string;
  applicationUrl?: string;              // fallback si pas d'email
  status: "draft" | "copied";
};
```

---

## 4. Pipeline

```
SwipeResult + UserContext
        │
        ▼
  validation Zod + normalisation
        │
        ▼
  faits déterministes
  ├─ directions / métiers (moteur existant)
  ├─ prérequis + chemins de formation
  ├─ offres locales (API ou fixture)
  ├─ établissements proches (BAN + dataset)
  └─ graphiques
        │
        ▼
  narrative IA (optionnelle, schéma strict)
  ├─ synthèse
  ├─ pourquoi chaque direction
  ├─ profil + bullets du CV
  ├─ emails
  └─ plan d'action
        │
        ▼
  Dossier JSON → page React → export JSON / PDF
```

**Règle de repli :** si l'IA échoue (pas de clé, timeout, JSON invalide), chaque section a un texte déterministe construit depuis les faits. Le dossier ne casse jamais.

---

## 5. L'IA : ce qu'elle fait, ce qu'elle ne fait pas

### Entrée

Un **fait** pseudonymisé, pas le JSON brut :

```ts
type DossierFacts = {
  profile: {
    code: string;
    domains: Array<{ id: string; label: string; score: number; confirmed: boolean }>;
    traits: Array<{ label: string; value: string; confidence: number }>;
    strengths: string[];
    unknowns: string[];
  };
  directions: Array<{
    id: string;
    title: string;
    jobs: Array<{ code: string; label: string; level: string; competences: string[] }>;
    evidence: Array<{ id: string; text: string }>;
  }>;
  trainings: Array<{ id: string; title: string; level: string; duration: string; establishments: string[] }>;
  offers: Array<{ id: string; title: string; company: string; city: string }>;
  user: {
    age?: number;
    studiesLevel: string;
    experience: Array<{ title: string; duration: string }>;
    mobilityKm?: number;
  };
};
```

- Pas de nom, pas d'adresse, pas de récit brut.
- Les identifiants (`evidenceIds`, `offerId`, `trainingId`) sont la seule façon de citer.

### Sortie (Zod)

```ts
type Narrative = {
  headline: string;
  summary: string;
  strengths: Array<{ label: string; evidenceIds: string[] }>;
  directions: Array<{ id: string; why: string; watchout: string }>;
  trainings: Array<{ id: string; why: string }>;
  cv: { title: string; summary: string; bullets: string[] };
  emails: Array<{ offerId: string; subject: string; body: string }>;
  nextSteps: Array<{ title: string; detail: string; evidenceIds: string[] }>;
};
```

### Garde-fous

1. **Citations obligatoires** : toute affirmation doit référencer un `evidenceId`, `offerId` ou `trainingId` existant. Sinon, la phrase est supprimée.
2. **Interdits** : santé, handicap, origine, famille, religion, orientation sexuelle, opinions politiques, situation administrative. Pas de diagnostic, pas de « tu es introverti·e ».
3. **Pas d'invention** : aucune entreprise, école, formation, salaire ou offre qui ne soit pas dans les faits. Si l'IA invente, le validateur rejette.
4. **Pas de promesse** : pas de « tu vas être embauché », pas de probabilité de réussite.
5. **Ton** : direct, respectueux, jamais infantilisant. Le jeune est « tu ».
6. **Langue** : français, phrases courtes, jargon ROME traduit.
7. **Coût / latence** : un seul appel par dossier, cache par `inputHash`, timeout 25 s, repli déterministe. Sur Vercel Hobby, prévoir `maxDuration = 60` et un fallback.
8. **Consentement** : `consents.ai` doit être vrai ; sinon, mode déterministe.

---

## 6. Sources de données — ce qui est réellement faisable

| Besoin | Source | Accès | Statut |
|---|---|---|---|
| Métiers, compétences, contextes | ROME 4.0 v62 | importé | **fait** |
| Domaines, scores, preuves | Swipe JSON | contrat ci-dessus | à brancher |
| Code postal → ville / distance | API Adresse (BAN) | gratuit, sans clé | facile |
| Offres locales + entreprises | API France Travail (Offres d'emploi) | OAuth `client_id` / `client_secret` | **clés requises** |
| Entreprises par secteur | API Recherche d'entreprises | gratuit | P1 |
| Formations / établissements | ONISEP / Parcoursup open data | open data, volumineux | **sous-ensemble curé pour la démo** |
| Débouchés d'une formation | ROME | importé | facile |
| Tension / salaire | France Travail / INSEE | API ou open data | P1 |
| Rédaction | LLM (Claude/OpenAI/Mistral) | clé API | optionnel |

### Décision pour vendredi

- **Offres et formations** : un jeu de **fixtures réalistes** (10–20 offres, 20–30 formations) avec de vrais noms d'établissements/liens, clairement marqué `source: "fixture"` si ce n'est pas branché. Pas d'invention silencieuse.
- **BAN** : brancher si le temps le permet ; sinon, ville saisie manuellement.
- **France Travail** : brancher uniquement si les clés sont disponibles aujourd'hui. Sinon, le dossier fonctionne avec les fixtures et le mentionne.
- **IA** : mode `mock` par défaut ; si une clé est fournie, activer la narrative. Le dossier reste complet sans IA.

> **On ne fait pas croire que les offres sont réelles si elles ne le sont pas.** Chaque bloc affiche sa source et sa date.

---

## 6 bis. Ressources du Centre et open data — ce qu'on peut utiliser

### Matrice d'usage

| Ressource | Usage | Où dans le dossier | Conditions |
|---|---|---|---|
| **18 Rapports des Possibles** | Recherche design : structure d'un bon rapport, ton, niveau de détail, « champ des possibles » | Modèle de `actionPlan`, `synthesis`, dossier conseiller | Interne, anonymisé mais sensible. Ne pas republier, ne pas envoyer à l'IA sans accord explicite. Citer le Centre. |
| **Guide pratique du Centre** | Les 4 temps de la restitution, l'entretien, l'Agora, la lecture du rapport | Ordre des sections, `actionPlan`, questions conseiller | Interne ; citer. |
| **Déroulé type de la restitution** | Les 4 temps + les préoccupations fréquentes des jeunes | Plan d'action, ton, questions à poser | Interne ; citer. |
| **Photos Agora / Mur des Possibles** | Moodboard, couleurs, mise en page, ambiance | Design uniquement | Droits d'image ; **pas de visages** ; accord du Centre. |
| **ROME 4.0** | Métiers, compétences, contextes, tags, arbre | Job cards, formations, débouchés, badges | Licence Ouverte ; **déjà importé v62**. |
| **ONISEP** | Formations, établissements, métiers | `trainings`, `establishments` | Open data ; vérifier la licence ; sous-ensemble régional. |
| **Carif-Oref** | Offre de formation régionale, alternance, financement | `trainings` | Open data ; vérifier la licence ; sous-ensemble régional. |
| **orientation-regionsud.fr** | Liens « pour aller plus loin » | `nextStep`, sources | **Lien/citation uniquement**, pas de scraping. |
| **Responsable du Centre** | Validation du parcours, des rapports, des questions | Recherche produit | Pas runtime ; 1–2 h/jour. |
| **O*NET Job Zones** (XLSX joint) | Référence conceptuelle des niveaux de préparation 1–5 | Formulation des niveaux | **Pas de code ROME** dans le fichier → pas de jointure fiable. ROME `acces_metier` reste la source. |
| **XLSX/XML ROME joints** | Même version v62 que le JSON déjà importé | Vérification, tags, arbre | Pas de ré-import nécessaire. |

### Ce que les fichiers ROME apportent vraiment

- **`fiches-rome-tag`** (ou le JSON `unix_referentiel_code_rome`) : `transition_eco`, `transition_num`, `transition_demo`, `emploi_reglemente`, `emploi_cadre`.
  → badges « Métier réglementé », « Transition écologique », « Emploi cadre » et avertissement d'accès.
- **`arboprincipale`** : 14 grands domaines / 110 domaines professionnels.
  → libellé de domaine pour grouper les directions et les formations.
- **`arborescence-simplifiee` / `arbocompetences`** : macros, domaines, enjeux, objectifs.
  → déjà utilisés par `scripts/build-skills.mjs` ; pas de nouveau runtime.
- **`RefRomeXml`** : même version que le JSON ; utile pour vérifier, pas pour remplacer.

### Ce qu'on ne fait pas

- **Pas d'entraînement IA sur les 18 rapports**, pas de rapports bruts dans les prompts. Anonymisé ≠ consentement pour l'IA.
- **Pas de republication** du guide, du déroulé ou des photos.
- **Pas de scraping** d'orientation-regionsud.fr.
- **Pas de jointure O*NET → ROME** par titre : les intitulés sont traduits mais il n'y a pas de code ROME. Les niveaux de préparation O*NET ne remplacent pas `acces_metier`.

### Ce qu'il nous faut

1. **2–3 rapports anonymisés** + le **guide** + le **déroulé** déposés dans le workspace (je n'ai pas accès à Discord) → j'aligne le template du dossier et le ton.
2. L'accord du Centre pour utiliser les photos comme **moodboard** (pas comme assets avec visages).
3. Les **questions à poser à la responsable** : qu'est-ce qui rend un rapport utile ? Quels sont les 4 temps ? Quelles sont les 5 préoccupations les plus fréquentes ? Qu'est-ce que le Mur des Possibles change dans l'entretien ?

---

## 7. CV

- **Template** rempli avec : prénom (optionnel), ville, titre, résumé (IA ou déterministe), expériences, compétences validées, formations, langues/centres d'intérêt (optionnels), disponibilité.
- **Pas de photo par défaut**, pas d'âge, pas de situation familiale, pas d'origine.
- Le jeune peut éditer chaque champ avant export.
- Export : **PDF via impression** (fiable, sans dépendance) + **JSON**. DOCX en P2.
- Le CV est un **brouillon** : mention « à relire avant envoi ».

---

## 8. Emails

- Pour chaque offre shortlistée : objet + corps personnalisé (2–3 phrases sur l'adéquation, 1 phrase sur la disponibilité, formule de politesse).
- **Pas d'envoi automatique.** `mailto:` + bouton « copier ».
- **Pas d'adresse inventée.** Si la source ne fournit pas d'email, on affiche le lien de candidature ou un message à copier dans le formulaire de l'entreprise.
- L'IA peut rédiger, mais chaque email référence l'`offerId` et les compétences validées ; le validateur rejette les entreprises inconnues.

---

## 9. Formations et débouchés

Pour chaque métier qui exige un diplôme :

```
Métier → niveau requis → chemin le plus court → établissements proches → durée/coût/alternance → débouchés → prochaine étape
```

- Si le jeune est sans diplôme : proposer d'abord CAP / alternance / formation courte, pas « va à l'université ».
- Si le jeune a le Bac : BTS / BUT / licence selon le domaine.
- Toujours afficher les **prérequis**, la **durée**, l'**alternance**, le **coût** et la **distance**.
- « Débouchés » : métiers ROME liés à la formation, avec le niveau d'accès.
- « Universités dans la région » : établissements réels, ville, distance, lien officiel.
- Pas de formation inventée ; si la donnée manque, afficher « à vérifier auprès du CIO / mission locale ».

---

## 10. Graphiques

- Radar Holland (existant) + barres de confiance par domaine.
- Barres de match (intérêt / contexte) pour chaque métier.
- Timeline de formation (durée, alternance).
- Demande locale (nombre d'offres) et tension si disponible, avec source et date.
- **Pas de pourcentage de réussite.** Les barres sont des affinités, pas des probabilités.

---

## 11. Export

| Format | Contenu |
|---|---|
| **PDF** | dossier complet imprimable + CV + emails + plan d'action |
| **JSON** | dossier structuré, sources, version de schéma, `inputHash` |
| **DOCX** (P2) | CV éditable |
| **Lien** | éventuellement un lien de partage conseiller (pas pour le MVP) |

Le PDF doit tenir en deux documents :
1. **Dossier jeune** : plan d'action, synthèse, 3 directions, formations, CV, emails.
2. **Dossier conseiller** : preuves, zones grises, sources, questions à explorer.

---

## 12. Éthique et données personnelles

1. **Consentements séparés** : générer le dossier, envoyer les faits à l'IA, exporter.
2. **Minimisation** : pas de nom/adresse dans l'IA ; code postal → ville ; récit brut jamais envoyé.
3. **Pas d'inférence protégée** : santé, handicap, origine, famille, religion, orientation sexuelle, opinions politiques, situation administrative.
4. **Âge / études / expérience** = éligibilité factuelle, jamais un signal de personnalité.
5. **Le jeune valide** : chaque compétence du CV et chaque email est éditable.
6. **Transparence** : source + date sur chaque offre, formation, salaire, tension.
7. **Pas de classement des personnes** : on classe des pistes et des formations, pas le jeune.
8. **Droit à l'erreur** : bouton « ce n'est pas moi » sur chaque section ; le dossier se régénère.

---

## 13. Découpe réaliste (vendredi)

### P0 — doit être livré

- Contrat `SwipeResult` + adaptateur + fixture JSON.
- Page `/dossier` (ou refonte de `/result`) avec :
  - plan d'action,
  - synthèse + radar + barres,
  - 3 directions + métiers + preuves + friction,
  - **un chemin de formation par métier** (dataset curé),
  - CV template + export PDF/JSON,
  - 2–3 emails pré-écrits pour les offres shortlistées (fixtures),
  - section « ce qu'on ne sait pas » + questions conseiller.
- Narrative déterministe ; IA optionnelle derrière `LLM_BACKEND`.
- Tests : contrat, génération du dossier, absence d'invention, export.

### P1 — si les clés/temps existent

- BAN pour le code postal.
- France Travail pour les offres réelles.
- IA branchée (Claude/OpenAI/Mistral) avec validateur de citations.
- DOCX.

### P2 — après le hackathon

- ONISEP/Parcoursup complet.
- Tension/salaire.
- Lien de partage conseiller.
- Auto-candidature (à éviter : l'email doit rester un brouillon).

---

## 14. Questions à trancher

1. **Le JSON du swipe** : peux-tu coller un exemple réel ou le schéma exact ? C'est le seul vrai blocker d'intégration.
2. **Clés France Travail** (`client_id` / `client_secret`) : disponibles aujourd'hui ? Sinon, fixtures assumées.
3. **Clé IA** pour la démo (Anthropic/OpenAI/Mistral) : disponible sur Vercel ? Sinon, narrative déterministe.
4. **Ville / code postal de démo** et **3–5 familles de métiers** à couvrir dans les fixtures.
5. **Remplace `/result`** ou nouvelle route `/dossier` ? Recommandation : `/dossier`, en gardant `/result` comme synthèse actuelle.
6. **CV** : PDF seulement, ou DOCX aussi ?
7. **Emails** : adresses réelles si l'API les fournit, ou message + lien de candidature ?
