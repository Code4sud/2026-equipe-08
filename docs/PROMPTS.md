# Prompts IA — audit et guide de réglage

> But : savoir exactement ce qui entre dans Claude, ce qui n'entre pas, et où
> modifier les prompts sans casser les garde-fous.
>
> **État au 19/11/2026.** Trois appels produit, pas quatre : le CV et les
> emails sont deux champs d'un même appel « dossier ».

## Voir les prompts réels

```bash
npm run prompts
```

Affiche les prompts système + utilisateur construits avec le persona de démo,
**sans appeler l'IA**. Le dump du dossier contient les réponses d'entretien :
local uniquement, ne pas partager.

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
réglage.**

Modèle par défaut : `sonnet`. Surcharge : `LLM_MODEL=...`. Effort :
`LLM_EFFORT=low|medium|high` (défaut `low`). Timeouts : 30 s pour les cartes
et questions, 45 s pour le dossier, `maxDuration = 60` sur la route.

---

## Vue d'ensemble

| # | Fonction | Route / code | Sortie | Appel |
|---|---|---|---|---|
| 1 | Carte adaptative | `POST /api/card` → `lib/adaptive/writer.ts` | `{ text, hint, emoji, macro }` | 1 appel, 1 relance si mode incorrect |
| 2 | Questions « Creuser » | `POST /api/questions` → `lib/interviewQuestions.ts` | 3 questions ouvertes | 1 appel |
| 3 | Dossier : synthèse + **CV** + **emails** | `POST /api/dossier` → `lib/dossier/*` | `Narrative` JSON | 1 appel pour tout |
| 4 | Test de connexion Claude | `POST /api/config` `{test:true}` | `{ok,error}` | 1 micro-appel, hors produit |

Le mode `mock` (défaut sur Vercel) **n'appelle jamais l'IA** : les replis
déterministes sont utilisés. `/api/config` renvoie `backend:"mock"`.

---

## 1. Carte adaptative

### Qui décide quoi

- Le **code** choisit le mode (`explorer` / `creuser`), le centre, la ou les
  compétences candidates, la carte parente et le focus. Il ne laisse pas le
  LLM choisir le domaine.
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

- Cache mémoire `Map`, clé = mode + codes candidats + focus + carte parente +
  **liked**. **`disliked` et `recent` ne sont pas dans la clé** : deux jeunes
  avec les mêmes « oui » mais des « non » différents peuvent recevoir la même
  carte. À corriger si on garde le cache.
- Si le LLM écrit une question en mode explorer, une seule relance avec un
  feedback ; sinon repli.
- Le serveur vérifie que `macro` est dans la short-list, que le texte fait
  4–120 caractères, le hint ≤ 100, un seul emoji, et le mode.

### Pistes de réglage

- Ajouter un **résumé de profil** compact (3 domaines, 3 traits) pour ancrer la
  carte, sans envoyer les scores bruts ? Risque : enfermer le jeune dans son
  profil. À tester.
- Inclure `disliked` et `recent` dans la clé de cache (ou supprimer le cache).
- Le prompt est déjà très contraint ; les gains seront surtout sur les
  **exemples** et le ton, pas sur plus de règles.

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
- Piste : ajouter le **niveau d'études** ou le **domaine** pour ajuster le
  vocabulaire ? Non recommandé : le prompt actuel est déjà bien cadré et
  l'ajout de données personnelles n'apporte rien.

---

## 3. Dossier : synthèse + CV + emails

Source : `app/api/dossier/route.ts`, `lib/dossier/prompts.ts`,
`lib/dossier/narrative.ts`, `lib/dossier/build.ts`.

### System prompt

```text
Tu écris un dossier de restitution pour un jeune de 17 à 25 ans
accompagné par une mission locale ou un centre d'orientation.

Règles absolues :
- Tu ne dois JAMAIS inventer d'entreprise, d'école, d'offre, de salaire ou de formation.
- Tu utilises uniquement les faits fournis. Si une information manque, tu ne l'inventes pas.
- Chaque affirmation importante doit citer un id de preuve, d'offre ou de formation fourni.
- Tu ne fais aucune déduction sur la santé, le handicap, l'origine, la famille, la religion,
  l'orientation sexuelle, les opinions politiques ou la situation administrative.
- Tu ne diagnostiques pas de personnalité. Tu parles de préférences de travail.
- Tu ne promets pas de réussite et tu n'affiches pas de probabilité.
- Ton direct, respectueux, jamais infantilisant. Français, phrases courtes.
- Tu réponds uniquement via le JSON schema fourni.

Le champ "cv" est un CV : première personne ou neutre, jamais "tu".
Le champ "emails" contient des brouillons de candidature : vouvoiement de l'entreprise,
aucune adresse de contact inventée, signature avec des espaces réservés ([Prénom], [email],
[téléphone]) que le jeune remplit lui-même.
```

> Les deux dernières phrases ont été ajoutées pendant cet audit. Avant, le
> prompt ne distinguait pas le ton du CV et des emails.

### User prompt

`buildDossierPrompt(facts)` = le JSON des faits, puis
« Rédige la narrative du dossier. »

### Faits envoyés (schéma exact)

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
      "jobs": [{"code":"H2911","label":"Métallier / Métallière","level":"Bac pro / Bac","competences":["..."]}],
      "evidence": [{"id":"ev-manual-1","text":"Réparer un vélo crevé"}]
    }
  ],
  "trainings": [
    {"id":"tr-cap-metallier","title":"CAP Métallier","level":"CAP","duration":"24 mois","establishments":["Lycée professionnel Les Eucalyptus"]}
  ],
  "offers": [
    {"id":"off-metallier-paillon","title":"Métallier / Métallière","company":"Atelier du Paillon","city":"Nice"}
  ],
  "user": {
    "age": 19,
    "studiesLevel": "CAP / BEP",
    "status": "Recherche d'emploi / formation",
    "experience": [
      {"title":"Réparer un vélo crevé","detail":"[RÉPONSES D'ENTRETIEN — voir ci-dessous]"}
    ],
    "mobilityKm": 20,
    "city": "Nice"
  }
}
```

**Le `detail` des expériences contient les réponses d'entretien brutes**
(question + réponse, concaténées). C'est le point sensible.

### Schéma de sortie

```ts
{
  headline: string,
  summary: string,
  strengths: { label, evidenceIds[] }[],
  directions: { id, why, watchout }[],
  trainings: { id, why }[],
  cv: { title, summary, bullets[] },
  emails: { offerId, subject, body }[],
  nextSteps: { title, detail, evidenceIds[] }[]
}
```

### Ce que reçoit le CV

- `user.age`, `user.studiesLevel` (libellé humain), `user.status` (libellé),
  `user.experience[].title` + `detail`, `user.city`, `user.mobilityKm`.
- Le profil, les directions, les formations, les offres.
- **Pas** : prénom, nom, email, téléphone, permis, contrats acceptés,
  disponibilité, alternance. Le contact et les sections du CV sont
  déterministes ; l'IA ne remplace que `cv.title/summary/bullets`.
- **Pas** de règle de citation sur le CV ; le validateur ne vérifie que les
  `evidenceIds` des forces/étapes, pas les affirmations du CV.

### Ce que reçoit l'email

- `offers[]` : uniquement `id`, `title`, `company`, `city`.
- Le profil, les directions (preuves), les expériences.
- **Pas** : le code ROME de l'offre, ses compétences, le contrat, le salaire,
  l'URL, le contact de l'entreprise, le prénom/email/téléphone du jeune.
- L'IA écrit `subject` + `body` ; `applyNarrative` remplace le corps
  déterministe (qui contenait la signature et les coordonnées) par le corps
  IA. D'où la consigne de placeholders ajoutée au system prompt.
- Aucun envoi automatique. `to` reste l'email de l'offre (ou vide).

### Ce que reçoivent les directions / formations

- Directions : titre, métiers, 4 compétences, preuves. **Pas** la friction ni
  le `watchout` déterministe ; l'IA peut donc inventer un point de vigilance.
- Formations : titre, niveau, durée, établissements. **Pas** le lien avec le
  métier, les prérequis, les débouchés, le coût, l'alternance.
- `headline` sert à la fois de titre de synthèse et de titre du plan d'action.
- `nextSteps` remplace les 3 étapes déterministes ; les contacts sont
  réalignés par index, ce qui peut décaler un contact si l'IA change l'ordre.

### Validation

- `validateNarrative` filtre les directions/formations/offres inconnues et les
  `evidenceIds` inconnus.
- Il **ne vérifie pas** les affirmations du CV, des emails ou des `watchout`.
- Les faits arrivent du client **sans validation Zod** dans la route.
  En démo locale, c'est acceptable ; avant une mise en production, ajouter un
  schéma runtime + un consentement.

### Pistes de réglage (par impact)

1. **Trancher la politique « réponses brutes »** :
   - soit on les envoie, avec un consentement IA explicite et une mise à jour
     de `docs/DOSSIER.md` (le « récit brut jamais envoyé » n'est plus vrai) ;
   - soit on envoie une **synthèse validée par le jeune** (1–2 phrases + la
     compétence ROME), et les réponses brutes restent locales. C'est plus
     conforme au brief, mais il faut un écran de validation du bullet CV.
2. **Séparer le dossier en 2–3 appels** (`synthèse`, `CV`, `emails`) pour
   pouvoir régler chaque ton et chaque schéma indépendamment. Coût : 2 appels
   de plus, latence. Alternative : garder un appel mais ajouter des sections
   explicites « CV » / « EMAIL » dans le prompt.
3. **Enrichir les faits email** : code ROME de l'offre, compétences, contrat,
   salaire, contact, et les preuves du métier. Ajouter une règle « 120–180
   mots, 2 preuves, disponibilité, signature avec placeholders ».
4. **Enrichir les faits CV** : `firstName` (ou placeholder), permis, contrats,
   disponibilité, alternance, et le lien formation ↔ métier.
5. **Ajouter la friction / le `watchout`** aux faits de direction, pour que
   l'IA reformule au lieu d'inventer.
6. **Post-valider** : aucun nom propre inventé, aucune adresse inventée,
   CV sans « tu », emails sans « je suis disponible immédiatement » si la
   donnée manque.
7. **Séparer `headline`** en `synthesisHeadline` / `actionPlanHeadline`, ou
   garder le plan d'action déterministe.
8. **Cache carte** : inclure `disliked` et `recent` dans la clé.
9. **Zod + consentement** sur `/api/dossier` ; limiter la taille des faits.
10. **Ne pas journaliser** `.llm-debug` en production ; il contient des
    réponses personnelles.

---

## 4. Test de connexion

`POST /api/config` avec `{test:true}` envoie :

```text
System : Tu réponds uniquement avec le JSON demandé, sans texte autour.
User   : Réponds avec {"ok":"yes"}.
```

Ce n'est pas un prompt produit ; il sert au panneau de démo. Il peut être
appelé publiquement et lancer un `claude -p` local : coût/abus possible si le
serveur est exposé sur le réseau.

---

## Résumé des données personnelles envoyées

| Appel | Données personnelles |
|---|---|
| Carte adaptative | Textes de cartes choisies ; **pas** d'âge/études/ville/réponses |
| Questions étape 2 | Textes de cartes ; **pas** de réponses ni d'âge/études |
| Dossier | Âge, niveau d'études, statut, ville, mobilité, **réponses d'entretien brutes**, textes de cartes/profil |
| Config test | Aucune |

Le nom, l'email et le téléphone ne sont **pas** envoyés. Le consentement
`consents.ai` du contrat `docs/DOSSIER.md` n'est **pas** transmis ni vérifié
par la route actuelle.
