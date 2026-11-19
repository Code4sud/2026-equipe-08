# Prompts IA — audit et guide de réglage

> **État au 19/11/2026.** Cinq appels produit, chacun avec son prompt, son
> schéma et son repli :
>
> 1. carte adaptative ;
> 2. questions de l'étape 2 « Creuser » ;
> 3. synthèse du dossier ;
> 4. CV ciblé sur une offre ;
> 5. emails de candidature.
>
> Le CV et les emails ne sont plus deux champs d'un appel géant. Le dossier
> peut recevoir une section IA, deux, ou aucune : chaque section absente garde
> son texte déterministe.

## Voir les prompts réels

```bash
npm run prompts
```

Affiche les prompts système + utilisateur construits avec le persona de démo,
**sans appeler l'IA**, puis un bloc « ce qui part à l'IA ». Le dump est local et
contient les faits du persona, jamais les réponses brutes d'entretien.

Pour voir aussi les réponses de Claude :

```bash
# .env.local
LLM_BACKEND=cli
LLM_DEBUG_PROMPTS=1
```

```bash
npm run dev
# puis .llm-debug/prompts.jsonl
```

Le journal contient le system prompt, le prompt utilisateur, le JSON schema,
le modèle, l'effort, les réponses et les erreurs. `.llm-debug/` est gitignoré.
**Il contient des données personnelles : local uniquement, à supprimer après
réglage.** Le journal est désactivé sur Vercel.

Modèle par défaut : `sonnet`. Surcharge : `LLM_MODEL=...`. Effort :
`LLM_EFFORT=low|medium|high` (défaut `low`). Timeouts : 30 s pour les cartes
et questions, 45 s par section du dossier, `maxDuration = 60` sur la route.

---

## Vue d'ensemble

| # | Fonction | Route / code | Sortie | Appel |
|---|---|---|---|---|
| 1 | Carte adaptative | `POST /api/card` → `lib/adaptive/writer.ts` | `{ text, hint, emoji, macro }` | 1 appel, 1 relance si mode incorrect |
| 2 | Questions « Creuser » | `POST /api/questions` → `lib/interviewQuestions.ts` | 3 questions ouvertes | 1 appel |
| 3 | Synthèse | `POST /api/dossier` → `lib/dossier/prompts.ts` | `SynthesisNarrative` | 1 appel |
| 4 | CV ciblé | `POST /api/dossier` → `lib/dossier/prompts.ts` | `CvNarrative` | 1 appel |
| 5 | Emails | `POST /api/dossier` → `lib/dossier/prompts.ts` | `EmailsNarrative` | 1 appel |

La route dossier lance les appels 3–5 en parallèle. Si un appel échoue, les
deux autres peuvent quand même être renvoyés. Le client applique les sections
présentes.

Le mode `mock` (défaut sur Vercel) **n'appelle jamais l'IA**. Aucune narrative
n'est renvoyée : le dossier, le CV et les emails déterministes restent affichés.

---

## 1. Carte adaptative

### Qui décide quoi

- Le **code** choisit le mode (`explorer` / `creuser`), le centre, la ou les
  compétences candidates, la carte parente et le focus.
- Le **LLM** écrit la phrase, le hint et l'emoji ; en mode multi-candidats, il
  choisit un `macro` **dans la liste fournie**, et le serveur vérifie.
- Si le LLM échoue, sort du schéma ou écrit une question en mode explorer :
  carte pré-écrite, puis libellé ROME (`source:"template"`).

### System prompt

Source : `lib/adaptive/writer.ts` — `CARD_SYSTEM_PROMPT`.

```text
Tu écris les cartes d'Orientis, un jeu de swipe pour des jeunes de 17 à 25 ans en décrochage, suivis en mission locale. Beaucoup pensent qu'ils ne savent "rien faire". Il y a deux sortes de cartes, avec deux questions différentes affichées au-dessus :

- Mode "explorer" : l'écran demande « Ça te tente ? ». La carte est UNE ACTIVITÉ à l'infinitif, qu'on peut avoir envie de faire même sans l'avoir jamais faite ("Fixer les prix pour une vente de gâteaux"). JAMAIS de question, JAMAIS "déjà" : on mesure l'envie, pas l'expérience (beaucoup n'ont jamais eu l'occasion d'essayer).
- Mode "creuser" : l'écran demande « C'est toi ? ». Le jeune vient de dire qu'il a DÉJÀ fait la carte parente. La carte est UNE QUESTION fermée sur ce même vécu, plus précise, à laquelle on répond oui ou non ("Et c'est toi qui fixais les prix ?", "T'as déjà dû gérer un client pas content ?").
  La question doit se comprendre SEULE : l'écran affiche bien un rappel de la carte parente, mais le jeune a pu changer de sujet entre-temps. Nomme l'objet ou l'activité de la carte parente (la plateforme, le vélo, le planning…) dans la question. Interdit : pronom ou référence qui suppose la carte précédente ("la commande d'après", "ça", "cette fois", "le même", "aussi", "encore"). Mauvais : "T'es retourné chez le même vendeur ?" ; bon : "Sur Vinted, t'as déjà revendu à quelqu'un qui t'avait déjà acheté ?".

On te donne une compétence du répertoire ROME (France Travail). Tu écris UNE carte qui fait reconnaître cette compétence dans une situation vécue hors travail : entre potes, au quartier, en ligne, dans une asso, au sport, dans un petit job.

Règles :
- "text" : 4 à 12 mots (jusqu'à 14 en mode creuser, si c'est nécessaire pour nommer l'objet de la carte parente), registre parlé, tutoiement. Pas de jargon ROME, pas d'intitulé de métier.
- Jamais d'étiquette ("tu es manuel", "tu es organisé") : une situation concrète.
- "hint" : facultatif, 3 à 10 mots, rassurant ("même une fois", "même sans t'en rendre compte"). En mode creuser, ne paraphrase pas la carte parente : l'écran la rappelle déjà.
- "emoji" : un seul emoji, sans visage ni personne.
- Interdit : la santé, le handicap, l'origine, le pays, la religion, la famille du jeune (parents, frères, sœurs), son argent, sa situation administrative, la politique, la sexualité. Pour parler d'enfants, dis "des plus petits" ou "des enfants", jamais "ton petit frère".
- Ne répète pas une situation déjà montrée.

Réponds uniquement avec l'objet JSON demandé.
```

### User prompt

Construit par `buildCardPrompt(plan, ctx)` :

```text
Mode : explorer

Choisis dans cette liste LA compétence qui prolonge le mieux ce que le jeune aime, et renvoie son code dans "macro" :
- 300265 : Charger, décharger, manutentionner des produits (enjeu : Gestion des stocks)
- 300185 : Réaliser un diagnostic technique (enjeu : Maintenance, Réparation)
- 300233 : Réaliser les travaux de montage, d'assemblage (enjeu : Production, Fabrication)

Il a dit oui à (ancre la situation dans cet univers quand c'est naturel, sans le recopier) :
- Démonter un vieux téléphone pour voir dedans
- Peindre un mur ou une fresque
- Faire le planning de 10 personnes
- Programmer un petit robot
- Planter et entretenir un potager
- Poser des étagères dans un local d'asso

Ça ne lui parle pas (évite ces univers) :
- Jouer dans une pièce de théâtre
- Vendre des trucs sur Vinted
- Aider une personne âgée au quotidien
- Accueillir les gens à un événement

Déjà montré (à ne pas répéter) :
- Aider une personne âgée au quotidien
- Programmer un petit robot
- ...
```

En mode `creuser`, le prompt ajoute la carte parente et la consigne
« la question doit se comprendre seule » ; en mode mono-candidat, il donne
`Compétence ROME visée` + `enjeu` + éventuellement `focus`.

### Ce qui est envoyé

| Donnée | Envoyée ? |
|---|---|
| Mode (`explorer`/`creuser`) | oui |
| Carte parente (texte) | oui en creuser |
| 1–3 compétences candidates (libellé + enjeu) | oui |
| `focus` (compétence fine) | oui si présent |
| Textes des 6 derniers « oui » (cartes d'intérêt) | oui en explorer |
| Textes des 4 derniers « non » (`pas-mon-truc` ou sans raison) | oui en explorer |
| Textes des 8 dernières cartes | oui |
| Scores / profil Holland / domaines confirmés | **non** |
| Âge, études, ville, expériences | **non** |
| Raisons de gauche (`jamais-essaye`, `pas-les-moyens`, `pas-capable`) | **non** (ce ne sont pas des rejets) |
| Réponses libres / entretiens | **non** |
| Textes complets des cartes de la banque | non (seulement les textes des cartes vues) |

### Cache et relance

- Cache mémoire, clé = mode + codes candidats + focus + carte parente +
  `liked` + `disliked` + `recent` (tout le contexte envoyé au LLM).
- Si le LLM écrit une question en mode explorer, une seule relance avec un
  feedback ; sinon repli.
- Le serveur vérifie que `macro` est dans la short-list, que le texte fait
  4–120 caractères, le hint ≤ 100, un seul emoji, et le mode.

---

## 2. Questions de l'étape 2 « Creuser »

Source : `lib/interviewQuestions.ts`.

### System prompt

```text
Tu prépares un mini-entretien pour Orientis, une app qui aide des jeunes de 17 à 25 ans en décrochage, suivis en mission locale, à mettre des mots sur ce qu'ils savent faire. Beaucoup pensent qu'ils ne savent "rien faire".

Le jeune vient de dire qu'il a DÉJÀ vécu une situation précise. On te donne cette situation et la compétence du répertoire ROME (France Travail) qu'elle prouve. Tu écris 3 questions ouvertes pour lui faire raconter CETTE expérience, de quoi écrire ensuite une ligne de CV crédible.

Ordre :
1. le contexte (quand, où, dans quel cadre : potes, asso, quartier, petit job, en ligne…) ;
2. ce qu'il a fait LUI, concrètement, étape par étape ;
3. le résultat (ce que ça a donné, pour qui, un retour reçu).

Règles :
- Uniquement sur cette expérience. Pas de question sur sa vie, ses projets, ses études ou sa motivation.
- Une seule idée par question, 8 à 25 mots, registre parlé, tutoiement, sans jargon ROME ni intitulé de métier.
- Ouvertes : impossible d'y répondre par oui ou non.
- Ancre les questions dans la situation (reprends ses mots), et oriente au moins une question vers la compétence ROME sans la nommer.
- Bienveillant : jamais de jugement, jamais "pourquoi tu n'as pas…".
- Interdit : la santé, le handicap, l'origine, le pays, la religion, la famille du jeune, son argent, sa situation administrative, la politique, la sexualité. Ne demande aucun nom de personne.
- Écris de façon neutre en genre (évite les accords au masculin ou au féminin quand c'est possible).

Réponds uniquement avec l'objet JSON demandé.
```

### User prompt

```text
Situation vécue (il a dit "déjà fait") : « Réparer un vélo crevé »
Il a précisé : oui à « Sur le vélo crevé, t'as cherché toi-même où était le trou ? »
Compétence ROME prouvée : « Réparer un équipement, une machine, une installation »
Compétences fines (pour orienter, sans les citer) :
- Changer ou réparer une pièce ou un ensemble défectueux
- ...
```

### Données

| Donnée | Envoyée ? |
|---|---|
| Carte parente (texte) | oui |
| Question de vécu (texte) | oui |
| Libellé de la macro ROME | oui |
| 8 compétences fines enfants | oui |
| Réponses du jeune | **non** |
| Âge / études / ville | **non** |

- Cache mémoire par `(parentText, proofText, macro)`.
- Repli : 3 questions génériques contexte / action / résultat.
- Le validateur vérifie la longueur **et** le caractère ouvert : une question
  fermée du type « T'as déjà réparé ? » est rejetée, une consigne
  « Raconte étape par étape… » est acceptée.

---

## 3. Synthèse du dossier

Source : `app/api/dossier/route.ts`, `lib/dossier/prompts.ts` — section 1.

### System prompt

```text
Tu écris la synthèse d'un dossier d'orientation pour un jeune de 17 à 25 ans accompagné par une mission locale ou un centre d'orientation.

Règles absolues :
- Tu ne dois JAMAIS inventer d'entreprise, d'école, d'offre, de salaire, de date ou de formation.
- Tu utilises uniquement les faits fournis. Si une information manque, tu ne l'inventes pas et tu ne la complètes pas par une supposition.
- Tu ne fais aucune déduction sur la santé, le handicap, l'origine, la famille, la religion, l'orientation sexuelle, les opinions politiques ou la situation administrative.
- Tu ne diagnostiques pas de personnalité. Tu parles de préférences de travail et de compétences observées.
- Tu ne promets pas de réussite et tu n'affiches pas de probabilité.
- Ton direct, respectueux, jamais infantilisant. Français, phrases courtes.
- Tu réponds uniquement via le JSON schema fourni.

Le dossier s'adresse au jeune : tutoiement, sans jargon ROME. Il doit répondre à « je fais quoi lundi ? » avant de répondre à « quel est mon profil ».

Champs :
- "headline" : 4 à 8 mots, concret, pas un slogan.
- "summary" : 3 à 5 phrases. Ce qui ressort, ce qui pourrait accrocher, ce qui reste à vérifier. Pas de diagnostic.
- "strengths" : 3 à 5 points forts. Chaque point cite des "evidenceIds" fournis. Si aucun id ne correspond, laisse le tableau vide.
- "directions" : exactement les ids fournis, avec un "why" qui reprend les preuves et un "watchout" qui reformule la friction fournie. N'invente pas de vigilance.
- "trainings" : uniquement les ids fournis, avec un "why" qui utilise le niveau, la durée, l'alternance, les prérequis et les débouchés fournis.
- "nextSteps" : 3 actions concrètes et faisables cette semaine. Cite un evidenceId seulement s'il est fourni.
```

### User prompt

`buildSynthesisPrompt(facts)` envoie en JSON :

```json
{
  "profile": {
    "code": "RIC",
    "domains": [{"id":"manual","label":"Manuel","score":0.909,"confirmed":true}],
    "traits": [{"label":"Énergie sociale","value":"Plutôt seul","confidence":1}],
    "strengths": ["Manuel"],
    "unknowns": ["Service public","Dessin","Règles","Chiffres"]
  },
  "directions": [
    {
      "id": "manual",
      "title": "Manuel",
      "jobs": [{
        "code": "H2911",
        "label": "Métallier / Métallière",
        "level": "CAP / BEP",
        "competences": ["..."],
        "savoirEtre": ["..."],
        "friction": ["Port de charges lourdes"]
      }],
      "evidence": [{"id":"ev-manual-1","text":"Réparer un vélo crevé"}],
      "watchout": "Port de charges lourdes"
    }
  ],
  "trainings": [{
    "id":"tr-cap-metallier",
    "title":"CAP Métallier",
    "level":"CAP",
    "duration":"24 mois",
    "establishments":["Lycée professionnel Les Eucalyptus"],
    "jobs":["Métallier / Métallière"],
    "debouches":["Métallier / Métallière"],
    "prerequisites":["Aucun diplôme requis","Goût pour le travail manuel"],
    "alternance":true,
    "cost":"Gratuit en alternance",
    "why":"..."
  }],
  "user": {
    "age": 19,
    "studiesLevel": "CAP / BEP",
    "status": "Recherche d'emploi / formation",
    "city": "Nice",
    "availability": "immédiatement",
    "mobilityKm": 20,
    "contracts": ["CDI","CDD","Alternance"],
    "alternance": true,
    "driverLicense": false
  }
}
```

Puis : « Rédige la synthèse, les directions, les formations et le plan d'action. »

---

## 4. CV ciblé

Source : `lib/dossier/prompts.ts` — section 2, `lib/dossier/cv.ts`.

Le CV n'est plus un champ « bullets » vague : c'est une trame complète avec
en-tête, profil, expériences traduites, compétences techniques et soft,
formation, langues, centres d'intérêt, disponibilité et champs à compléter.

### System prompt

```text
Tu écris un CV français pour un jeune de 17 à 25 ans. Le CV est ciblé sur UNE offre précise : "cvTarget".

Règles absolues :
- Tu ne dois JAMAIS inventer d'entreprise, d'école, d'offre, de salaire, de date ou de formation.
- Tu utilises uniquement les faits fournis. Si une information manque, tu ne l'inventes pas et tu ne la complètes pas par une supposition.
- Tu ne fais aucune déduction sur la santé, le handicap, l'origine, la famille, la religion, l'orientation sexuelle, les opinions politiques ou la situation administrative.
- Tu ne diagnostiques pas de personnalité. Tu parles de préférences de travail et de compétences observées.
- Tu ne promets pas de réussite et tu n'affiches pas de probabilité.
- Ton direct, respectueux, jamais infantilisant. Français, phrases courtes.
- Tu réponds uniquement via le JSON schema fourni.

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

Le CV doit rester honnête : une trame que le jeune relit et complète, pas une biographie inventée.
```

### User prompt

`buildCvPrompt(facts)` envoie :

```json
{
  "cvTarget": {
    "offerId": "off-metallier-paillon",
    "jobCode": "H2911",
    "jobLabel": "Métallier / Métallière",
    "romeLabel": "Métallier / Métallière",
    "company": "Atelier du Paillon",
    "city": "Nice",
    "contract": "CDI",
    "salary": "1 900 – 2 200 € brut",
    "competences": ["Assembler des éléments de structures métalliques", "..."],
    "savoirEtre": ["Faire preuve d'autonomie", "Faire preuve de rigueur et de précision"]
  },
  "user": {
    "studiesLevel": "CAP / BEP",
    "status": "Recherche d'emploi / formation",
    "city": "Nice",
    "mobilityKm": 20,
    "contracts": ["CDI", "CDD", "Alternance"],
    "availability": "immédiatement",
    "alternance": true,
    "driverLicense": false,
    "experience": [
      {
        "id": "cv-1",
        "title": "Réparer un vélo crevé",
        "proof": "Sur le vélo crevé, t'as cherché toi-même où était le trou ?",
        "competences": ["Réparer un équipement, une machine, une installation"],
        "source": "creuser"
      }
    ]
  },
  "profile": {
    "code": "RIC",
    "domains": [{"id":"manual","label":"Manuel","score":0.909,"confirmed":true}],
    "traits": [{"label":"Besoin de structure","value":"Cadre clair","confidence":1}],
    "strengths": ["Manuel"],
    "unknowns": ["Service public","Dessin","Règles","Chiffres"]
  },
  "trainings": [{"id":"tr-cap-metallier","title":"CAP Métallier","level":"CAP","duration":"24 mois","establishments":["Lycée professionnel Les Eucalyptus"],"jobs":["Métallier / Métallière"],"debouches":["Métallier / Métallière"],"prerequisites":["Aucun diplôme requis"],"alternance":true,"cost":"Gratuit en alternance","why":"..."}],
  "softSkills": ["Autonomie","Rigueur","Organisation","Travail en équipe","..."]
}
```

Puis : « Rédige le CV ciblé. »

### Ce que l'IA ne reçoit pas

- prénom, nom, email, téléphone ;
- âge, adresse complète, code postal ;
- réponses brutes d'entretien : seuls le titre de l'expérience, la question
  de vécu et les compétences ROME validées sont envoyés ;
- entreprises / écoles hors faits ;
- dates ou durées non fournies.

### Repli déterministe

`lib/dossier/cv.ts` construit déjà un CV complet sans IA :

- sélectionne la meilleure offre (ou celle choisie dans l'interface) ;
- transforme `Réparer un vélo crevé` en `Réparation d'un vélo crevé` ;
- utilise les compétences ROME comme savoir-faire ;
- choisit des soft skills dans un vocabulaire contrôlé, adossées aux traits et
  aux compétences ;
- remplit l'en-tête, la formation liée au métier, les langues et centres
  d'intérêt avec `[À compléter]` si l'info manque ;
- affiche une checklist des champs à compléter.

---

## 5. Emails de candidature

Source : `lib/dossier/prompts.ts` — section 3.

### System prompt

```text
Tu écris des brouillons d'email de candidature pour un jeune de 17 à 25 ans. Chaque email vise UNE offre fournie.

Règles absolues :
- Tu ne dois JAMAIS inventer d'entreprise, d'école, d'offre, de salaire, de date ou de formation.
- Tu utilises uniquement les faits fournis. Si une information manque, tu ne l'inventes pas et tu ne la complètes pas par une supposition.
- Tu ne fais aucune déduction sur la santé, le handicap, l'origine, la famille, la religion, l'orientation sexuelle, les opinions politiques ou la situation administrative.
- Tu ne diagnostiques pas de personnalité. Tu parles de préférences de travail et de compétences observées.
- Tu ne promets pas de réussite et tu n'affiches pas de probabilité.
- Ton direct, respectueux, jamais infantilisant. Français, phrases courtes.
- Tu réponds uniquement via le JSON schema fourni.

Règles des emails :
- Vouvoiement de l'entreprise. Jamais « tu ».
- 120 à 180 mots par email. Structure : Bonjour, le poste visé, deux phrases de preuve reliées aux compétences de l'offre, la disponibilité, une phrase de clôture, la signature.
- Reprends le titre du poste et le nom de l'entreprise fournis. Ne cite aucune autre entreprise.
- Appuie-toi sur les compétences de l'offre et les preuves du dossier. Ne recopie pas les réponses d'entretien.
- Utilise la disponibilité et la mobilité fournies. Ne promets pas une date qui n'est pas dans les faits.
- Aucune adresse email, aucun numéro de téléphone, aucun lien inventé. La signature se termine par des espaces réservés : [Prénom], [email], [téléphone].
- Objet : « Candidature — {titre du poste} ({entreprise}) ».
- Le corps commence par « Bonjour, » et se termine par la signature. Pas de markdown, pas de puces.
- Renvoie exactement un email par "offerId" fourni, avec le bon "offerId".
```

### User prompt

`buildEmailsPrompt(facts)` envoie `cvTarget`, toutes les `offers` (titre,
entreprise, ville, code ROME, contrat, salaire, contact, URL, compétences),
les `directions` (preuves + friction) et le `user` (niveau, statut, ville,
mobilité, contrats, disponibilité, alternance, permis). **Pas de nom, pas
d'email, pas de téléphone, pas de réponses brutes.**

Puis : « Rédige un email par offre fournie. »

### Ce que le client garde

- `to` = contact de l'offre (fourni par la fixture), jamais inventé par l'IA ;
- `applicationUrl` = URL de l'offre ;
- la signature : si l'IA oublie les espaces réservés, le client ajoute
  `[Prénom]` et `[email] · [téléphone]` (ou les coordonnées réelles si elles
  existent déjà côté client) ;
- aucun envoi automatique : copie ou ouverture Gmail.

---

## Validation : au-delà des ids

`lib/dossier/narrative.ts` :

- **Synthèse** : ids de directions / formations / preuves filtrés, textes
  interdits rejetés, longueurs bornées.
- **CV** : `experienceId` inconnu supprimé ; puces avec `?`, « tu/ton/ta/tes »,
  année inventée, langage d'entretien ou terme interdit supprimées ; soft
  skills filtrées sur le vocabulaire contrôlé ; langues et intérêts bornés.
- **Emails** : `offerId` inconnu supprimé ; corps avec email/téléphone inventé
  supprimé ; corps qui ne mentionne ni le titre ni l'entreprise supprimé ;
  vouvoiement vérifié ; signature complétée côté client.
- **Limite** : le validateur ne peut pas prouver qu'une phrase est vraie. Il
  bloque les inventions détectables (ids, contacts, années, questions,
  vocabulaire interdit) et laisse le jeune relire. Une validation par phrase
  générée serait la prochaine étape.

## Consentement, taille et cache

- Le client envoie `facts.consents.ai` depuis le réglage « Utiliser Claude si
  disponible » du panneau de démo.
- `POST /api/dossier` refuse si `consents.ai` est faux (403), si les faits ne
  passent pas le schéma Zod (400), ou si le corps dépasse 200 Ko (413).
- Cache mémoire par hash SHA-256 des faits, 100 entrées. Les sections valides
  sont mises en cache ; une section en échec n'est pas cachée.
- En mode `mock`, la route renvoie `narrative:null` et le client garde le
  dossier déterministe.

## Pistes de réglage restantes

1. **Faire valider la ligne de CV par le jeune** à la fin de l'entretien
   (« Voilà ce qu'on retiendra »), pour envoyer un résumé validé plutôt que
   seulement titre + preuve + compétence.
2. **Ajouter les dates / durées** aux expériences quand le jeune les donne :
   aujourd'hui le CV les met en `[À compléter]`.
3. **Tester les prompts avec le vrai Claude** sur 3–5 profils, comparer les
   CV générés, ajuster les exemples plutôt que d'ajouter des règles.
4. **Mesurer les emails** : 120–180 mots, deux preuves, une disponibilité.
   Vérifier qu'aucun email ne cite une entreprise absente des faits.
5. **Ne pas journaliser** `.llm-debug` en production ; il contient des
   données personnelles.
