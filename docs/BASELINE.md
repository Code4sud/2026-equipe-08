# Baseline — Détecteur de potentiel caché

> Statut : décisions verrouillées le 18/11/2026. Base de code en cours.
> Nom de travail : **Orientis** (à valider).
> Contrainte : **3 jours (livraison vendredi), 6 personnes, pas de stack imposée.**
> Public : **17–25 ans**, mission locale / décrochage.
> Décisions : swipe **droite/gauche** uniquement (pas de voix) · import **ROME 4.0 v62** · sortie **3 directions + short-list** · autonomie vis-à-vis des supports fournis.

---

## 0. Le pari de départ

**Le swipe n'est pas le produit. C'est l'amorce.**

Le brief du Sujet 4 ne demande pas un moteur de recommandation d'emploi. Il demande trois choses difficiles :

1. faire **raconter** sans que ça ressemble à un interrogatoire ;
2. **extraire** des compétences d'un récit libre ;
3. **montrer d'où vient** chaque compétence, et faire valider par le jeune.

Un pur « Tinder des métiers » rate les trois : il interroge (swipe = question fermée), il déduit (boîte noire), et il ne produit aucune preuve.

La bonne architecture est donc :

```
Swipe  ──►  Récit  ──►  Validation  ──►  ROME  ──►  Restitution
(amorce,     (preuve,    (éthique,       (vocabulaire,  (pistes +
 prior)       matière)    contrôle)       preuve)        prochaines étapes)
```

Le swipe sert à **donner envie de parler** et à fournir un prior. Le récit fournit la **preuve**. La validation fournit la **légitimité**. ROME fournit le **vocabulaire commun** avec le conseiller.

**Phrase de positionnement :** *« Un jeu de cartes qui fait parler, et qui rend au jeune ses compétences avec ses propres mots — preuves à l'appui. »*

---

## 1. Ce qu'on mesure — et ce qu'on refuse de mesurer

Quatre couches. Holland est la couche 1, pas le produit entier.

| Couche | Ce qu'on mesure | Comment | Pourquoi |
|---|---|---|---|
| **1. Intérêts** | Les 6 thèmes RIASEC | Swipe sur des activités concrètes | Squelette du profil, vocabulaire Holland |
| **2. Exposition & auto-efficacité** | « Déjà fait ? » / « Je saurais le faire ? » | Micro-question après le swipe | Un intérêt sans exposition est souvent une envie, pas une compétence |
| **3. Style de travail** | 5 spectres : énergie sociale, structure, ouverture, coopération, rythme | 15 paires de choix forcés (même geste de swipe) | Deux personnes au même code Holland ne tiennent pas dans le même environnement |
| **4. Contraintes** | Mobilité, horaires, durée de formation, salaire minimum, moyens | Formulaire court, jamais déduit | Une piste non finançable/accessible n'est pas une piste |

### Ce qu'on ne mesure pas

- **Les aptitudes.** Un swipe mesure un intérêt, pas une capacité. Si le guide du Centre exige des aptitudes, il faut 2–3 micro-épreuves optionnelles (rotation spatiale, suites logiques, analogies verbales — 90 s chacune). On ne les mélange pas au score d'intérêt.
- **La personnalité clinique.** On mesure 5 spectres de travail, pas un Big Five complet, pas de neuroticisme, pas de diagnostic. On ne déduit **jamais** un trait depuis les intérêts (« aime le foot → extraverti » est un stéréotype, pas une mesure). Les spectres sont demandés directement, dans une séquence séparée, et affichés comme des préférences, jamais comme des étiquettes.
- **Les attributs protégés.** Santé, handicap, origine, religion, famille, orientation sexuelle, opinions politiques, situation administrative. Ni collecte, ni inférence, ni proxy.

> Règle : **on ne déduit jamais un fait sur la personne ; on ne retient qu'une compétence qu'elle a validée.**

---

## 2. Holland en une page (et ses limites)

### Les six types

| Code | Type | Ce qui l'attire | Exemples d'activités |
|---|---|---|---|
| **R** | Réaliste | Agir sur le concret, les outils, le vivant, l'extérieur | Réparer, construire, conduire, jardiner, sport |
| **I** | Investigateur | Comprendre, analyser, expliquer | Démonter, coder, enquêter, calculer |
| **A** | Artistique | Créer, exprimer, imaginer | Dessiner, monter, écrire, scénographier |
| **S** | Social | Aider, transmettre, écouter | Expliquer, accompagner, soigner, animer |
| **E** | Entreprenant | Convaincre, diriger, prendre des risques | Vendre, négocier, organiser, lancer |
| **C** | Conventionnel | Organiser, fiabiliser, suivre des règles | Gérer une caisse, classer, planifier, contrôler |

Ordre de l'hexagone : **R – I – A – S – E – C**. Deux types adjacents se ressemblent ; deux types opposés (R/S, I/E, A/C) sont en tension.

### Les concepts Holland → les fonctionnalités produit

| Concept | Définition | Usage produit |
|---|---|---|
| **Type** | Thème d'intérêt dominant | 6 scores, radar |
| **Code à 3 lettres** | Les 3 types dominants (ex. R-I-S) | Résumé du profil |
| **Cohérence** | Les 2 premiers types sont-ils adjacents ? | Indicateur de fiabilité (« profil cohérent » vs « tiraillé ») |
| **Différenciation** | Écart entre le pic et le reste | Si plat → mode **exploration**, pas recommandation |
| **Congruence** | Adéquation personne–environnement | Score d'affinité métier |
| **Identité** | Clarté que la personne a de elle-même | Confiance / incertitude affichée |

C'est le cœur de l'argument jury : **chaque concept théorique devient une fonctionnalité visible**, pas un score caché.

### Les quatre limites à assumer

1. **Intérêts ≠ aptitudes ≠ valeurs.** Holland ne prédit pas la performance ; il prédit modestement la satisfaction et la persistance. Corrélation personne–environnement ≈ 0,2–0,3 dans les méta-analyses.
2. **Biais d'exposition.** Un jeune qui n'a jamais vu un métier ne peut pas l'aimer. « Je n'aime pas » veut souvent dire « je ne connais pas ». Conséquence : cartes concrètes, formulation « ça te tenterait ? », réponse « jamais essayé » séparée.
3. **Biais culturels et de genre.** Les items et les visuels peuvent véhiculer des stéréotypes. Audit obligatoire du deck.
4. **ROME n'est pas construit sur Holland.** Le mapping ROME ↔ RIASEC est une approximation experte, à documenter et à versionner.

**Conséquence :** Holland est le squelette, pas le verdict. On sort des **directions** et une **short-list**, jamais « le métier qui te correspond ».

---

## 3. Le modèle de swipe

### 3.1 Anatomie d'une carte

```ts
type Card = {
  id: string;
  text: string;              // "Réparer un vélo crevé"
  media?: string;            // illustration, jamais de visage
  riasec: Partial<Record<'R'|'I'|'A'|'S'|'E'|'C', number>>; // 0..1
  facets: string[];          // "manuel", "exterieur", "soin", "negociation"...
  tags: string[];            // anti-répétition, thèmes
  source: 'holland-adapté' | 'terrain' | 'rome';
  bankVersion: string;
};
```

Règles de rédaction :
- une **situation concrète**, jamais un adjectif (« Réparer un vélo » > « Tu es manuel ») ;
- pas de visage, pas de décor social stéréotypé ;
- pas de carte dont l'intérêt principal est un proxy protégé (religion, famille, santé) ;
- phrases courtes, registre parlé, zéro ton de test.

### 3.2 Vocabulaire de réponse

**Deux gestes seulement : droite = oui, gauche = non.** C'est la promesse d'usage, on n'y touche pas.

Le problème psychométrique : un swipe gauche confond « je n'aime pas », « je n'ai jamais essayé » et « je n'y ai pas accès ». La solution tient en **un chip optionnel après le geste**, sur une carte sur trois :

- après **gauche** : `pas mon truc` · `jamais essayé` · `peur de pas y arriver` · `pas les moyens` · `pas près de chez moi`
- après **droite** : `déjà fait souvent` · `déjà fait une fois` · `jamais fait mais ça me tente`

Un tap, jamais un clavier. Le chip ne bloque pas : si le jeune continue, on enregistre le swipe brut.

Traitement :
- `jamais essayé` → **donnée manquante** pour l'intérêt (pas un rejet), mais information d'exposition ;
- `pas mon truc` → intérêt négatif ;
- `peur de pas y arriver` → intérêt non concluant + barrière de confiance ;
- `pas les moyens` / `pas près de chez moi` → barrière d'accès, à remonter au conseiller.

C'est là que se gagne la précision — et c'est directement utile à l'entretien (mobilité, moyens, assurance).

### 3.3 Deux niveaux : 30 centres ROME, 6 dimensions Holland

Le ROME 4.0 fournit **30 centres d'intérêt** (« J'aime le travail manuel », « J'aime organiser, planifier », « Je souhaite prendre soin des autres »…) et relie chacun à des métiers. C'est une taxonomie française, déjà connue des conseillers, et beaucoup plus fine que 6 types.

On l'utilise comme **espace latent commun** entre les cartes et les métiers :

```
30 centres  ──projection M──►  6 dimensions Holland  ──►  code à 3 lettres
     │
     └──────────────►  matching métier (même espace)
```

- Chaque **carte** est taguée sur 1 à 3 centres (poids 0–1).
- Chaque **métier** est tagué par les centres ROME auxquels il appartient (`principal` = 1, sinon 0,5).
- La **matrice M (30×6)** est une affectation experte, versionnée : chaque centre contribue à 1–2 types Holland.
- Le code Holland reste la synthèse lisible ; les 30 centres portent la précision et la preuve.

**Exemples de correspondance (à figer dans `content/centers.ts`) :**

| Centre ROME | R | I | A | S | E | C |
|---|---|---|---|---|---|---|
| J'aime le travail manuel | .8 | .1 | | | | .1 |
| J'aime faire des découvertes | .2 | .8 | | | | |
| Je suis un / une artiste | | | .9 | | .1 | |
| Je souhaite prendre soin des autres | | | | .9 | | .1 |
| J'aime communiquer, convaincre | | | | .3 | .7 | |
| J'aime organiser, planifier | | | | | .3 | .7 |
| J'aime manier les chiffres | | .3 | | | | .7 |
| J'aime être au contact de la nature | .8 | .2 | | | | |

### 3.4 Le style de travail — 5 spectres, 15 paires

Après le deck d'intérêts, une séquence **séparée** : 15 paires de choix forcés, même geste gauche/droite. Trois paires par spectre, pôles inversés d'une paire à l'autre pour éviter le straight-lining. Aucun item de santé mentale.

| Spectre | Pôles | Ce que ça change dans le matching |
|---|---|---|
| **Énergie sociale** | seul ↔ avec du monde | contact public, taille d'équipe, accueil |
| **Structure** | improvisation ↔ cadre clair | procédures, planning, routine, précision |
| **Ouverture** | repères stables ↔ nouveauté | variété, projets, changement |
| **Coopération** | compétition ↔ entraide | travail collectif, soin, accompagnement |
| **Rythme** | régulier ↔ pression | urgences, pics, horaires décalés |

Chaque paire a un `leftValue` / `rightValue` dans `[-1, 1]`. Score du spectre = moyenne des valeurs choisies, confiance = `min(1, n/3)`. **Jamais de pourcentage de personnalité** : un curseur, un mot, et ce que ça implique pour le travail.

Le 5e spectre est un **rythme préféré**, pas une stabilité émotionnelle. On n'affiche ni « stressé », ni « anxieux », ni un trait clinique.

### 3.5 Scoring des intérêts — modèle Beta (v0) puis calibration (v1)

**v0, le modèle livré :**

Chaque centre `c` a un prior `Beta(α=1,2 ; β=1,2)` (moyenne 50 %, intervalle large).

```
droite  →  α_c += w_ic · q
gauche  →  β_c += 0,8 · w_ic · q
« jamais essayé » / barrière d'accès  →  aucun update
```

- `w_ic` = chargement de la carte `i` sur le centre `c` (0–1, somme ≈ 1 par carte).
- `q` = qualité (1 par défaut ; 0,75 si swipe < 180 ms).
- `moyenne = α / (α + β)` ; `sd = sqrt(αβ / ((α+β)²(α+β+1)))`.
- `lower80 = moyenne − 1,28·sd` ; `upper80 = moyenne + 1,28·sd`.
- `confiance = 1 − sd / 0,28`, bornée 0–1.
- `θ6 = projection des 30 moyennes sur la matrice M (30×6)`, puis normalisation.
- **Cohérence** = adjacence des 2 premiers types. **Différenciation** = écart pic / médiane.

La moyenne Beta **sature** : le 10e like dans un domaine bouge moins que le 2e. C'est ce qui empêche un domaine de devenir « 100 % » juste parce que le deck a montré 15 cartes manuelles.

**La règle de confirmation — le cœur du produit :**

Un domaine devient **proposable** quand :

```
moyenne ≥ 0,72   ET   lower80 ≥ 0,60   ET   nEff ≥ 3,5   ET   ≥ 4 cartes likées
```

L'app insère alors une **carte de confirmation**, pas un swipe :

> « On dirait que le travail manuel, c'est vraiment ton truc. Voilà ce qui nous fait dire ça : [3 cartes]. Tu confirmes ? »

- **Oui** → domaine verrouillé, **passé en approfondissement** (il reste prioritaire dans le tirage), bonus fort dans le matching.
- **Pas vraiment** → domaine remis au prior, retiré de la pêche, cartes trompeuses écartées.

C'est le « 100 % » : **une validation humaine**, pas une prétention statistique. Le jeune peut changer d'avis plus tard.

**v1, calibration :**

- Remplacer les poids experts par un modèle de réponse graduée (`P(y ≥ k) = σ(a_i·θ − b_ik)`), estimation MAP, incertitude = inverse de la matrice d'information.
- Calibrer `a_i, b_i` sur les réponses agrégées (avec consentement). L'algorithme apprend alors les items autant que les personnes.

**Contrôles qualité :**
- swipe < 180 ms → poids réduit (0,75) ;
- 12 réponses identiques d'affilée → carte formulée à l'envers + confiance abaissée ;
- 2–3 items reformulés dans le deck → détection d'incohérence, sans pénaliser ;
- « jamais essayé » et les barrières d'accès ne comptent **jamais** comme un rejet.

### 3.6 Sélection adaptative — couverture, puis UCB

Deux régimes, pas deux phases arbitraires :

1. **Couverture — 12 cartes maximum.** On priorise les centres jamais vus (`nEff < 0,6`) et les plus incertains, nuancé par la moyenne (`+ 1,5 · (moyenne − 0,5)`) ; pénalité si la carte dominante est la même que les 2 précédentes. La phase s'arrête **dès qu'un intérêt se dessine** : un centre avec ≥ 2 cartes aimées et une moyenne ≥ 0,6 (ou un centre confirmé).
2. **Ensuite — UCB.** Pour chaque centre actif :

```
moyenne'_c = nEff_c ≥ 1 ? moyenne_c : min(moyenne_c, 0,45)   // a priori prudent
priorité_c = moyenne'_c + 0,10 · sqrt( log(n + 2) / (nEff_c + 0,5) )
```

Le **set de focus** se resserre : 30 → 12 → 6 centres, classés sur `moyenne'` : un centre à peine vu passe derrière les centres aimés au lieu d'occuper le focus avec sa moyenne a priori de 0,5. Hors focus, la priorité est multipliée par 0,35 (exploration résiduelle).

> Réglage du 19/11/2026 (avant : couverture fixe sur 15 cartes, c = 0,38, focus trié sur la moyenne brute). En simulation, le bonus d'exploration à 0,38 dépassait l'écart entre un centre aimé et un centre jamais vu : l'algorithme continuait à balayer en largeur malgré un intérêt net. Avec ce réglage, la première confirmation arrive ~9 cartes plus tôt (≈ 26 au lieu de ≈ 35) et la part de cartes sur les centres aimés double sur les 20 premières cartes. Pénalité de diversité 0,85 si même centre dominant, 4 % d'aléatoire.

Pourquoi ce choix : l'échantillonnage par pure incertitude étale la preuve sur 30 domaines et ne confirme jamais rien ; l'exploitation pure surréagit à un seul swipe contradictoire. L'UCB garde un domaine prometteur dans le jeu après un mauvais tirage — c'est la différence entre apprendre et surréagir.

**Intérêt découvert = approfondissement** (décision du 19/11/2026). Un domaine **confirmé** reste dans le tirage avec une priorité fixe de 1, au-dessus de tout domaine ouvert : le deck creuse ce que le jeune aime au lieu de repartir en largeur. Son score est verrouillé ; les cartes jouées dessus s'ajoutent à ses preuves (`likedCards`) pour la restitution. La pénalité de diversité laisse passer des cartes d'exploration entre deux cartes d'approfondissement. Un domaine **rejeté** sort du tirage.

En simulation (swipe adaptatif, 150 sessions par profil), la part des cartes sur les domaines aimés après la première confirmation passe de 1–16 % à 28–56 %, sans perte sur la découverte des autres intérêts.

### 3.7 Quand s'arrêter

- plancher : 28 cartes ;
- cible : 35 ;
- **plafond dur : 48** (le deck s'arrête tout seul) ;
- arrêt anticipé si `confirmés + rejetés ≥ 8` ou si tous les centres ont `nEff ≥ 4` ;
- bouton « j'ai assez répondu » dès 20 cartes.

On affiche un **profil partiel dès la carte 15** (« voilà déjà ce qu'on voit ») : récompense précoce, pas de machine à sous. Pas de streak, pas de classement, pas de temps infini.

### 3.8 Ce qu'on affiche

- Radar 6 branches (échelle relative lisible) + code 3 lettres + **mots Holland**.
- **Domaines forts** en second : « Manuel · Tech · Nature ».
- Confirmés (✓) et écartés (grisés) : la trace des validations.
- Les 5 spectres de travail, en curseurs, avec « ce que ça implique ».
- **« Ce qu'on ne sait pas encore »** : les domaines flous + 3 questions à poser au conseiller. C'est ce panneau qui rend l'outil crédible.
- Aucun pourcentage de « réussite ». Des niveaux : *fort / à explorer / piste*, toujours accompagnés des raisons.

---

## 4. Du profil aux métiers

### 4.1 Vecteur métier

```ts
type JobVector = {
  id: string;
  label: string;
  romeCode: string;                  // ROME 4.0 v62, jamais inventé
  definition: string;                // texte ROME
  centers: Record<string, number>;   // 30 centres ROME : 1 = principal, .5 = secondaire
  riasec: Record<'R'|'I'|'A'|'S'|'E'|'C', number>; // projection de `centers`
  contexts: string[];                // contextes ROME (samedi, extérieur, public...)
  competences: {
    savoirFaire: { code: string; label: string }[];  // coeur de métier d'abord
    savoirEtre: { code: string; label: string }[];
  };
  access: string;                    // texte ROME "accès au métier"
  source: 'rome-4.0-v62';
  version: string;
};
```

**Source unique : ROME 4.0 v62 (octobre 2026).**
1. **Import** : dump JSON public, 1 923 métiers, 30 centres d'intérêt, 194 contextes de travail, savoir-faire et savoir-être. Conversion ISO-8859-1 → UTF-8.
2. **Matching** : le vecteur `centers` d'un métier vient des listes ROME officielles (`principal: true` → 1, sinon 0,5). Aucun tagging LLM sur les métiers : on n'importe pas de stéréotypes.
3. **Curated subset** : on n'affiche que les métiers accessibles sans diplôme long (sans diplôme → Bac+2), pour ne pas proposer médecine à un jeune qui veut travailler. Le reste de la base sert à la recherche.
4. **Fraîcheur** : API France Travail (offres, tension) pour les « prochaines étapes », pas pour le score. Optionnel, hors chemin critique.

### 4.2 Score

```
intérêt_j = cos( vecteur_utilisateur_30 , centers_j )
           − 0,45 · pénalité_domaines_rejetés

contexte_j = moyenne pondérée des 5 spectres vs contextes ROME du métier
           (1 = adéquation parfaite, 0 = opposé)

score_j = 0,65 · intérêt_j + 0,35 · contexte_j − pénalité_mismatch
```

- **Pénalité de mismatch** : si un spectre est connu avec confiance et que le métier est à l'opposé, le score baisse. Un profil « plutôt seul » ne voit pas « agent d'accueil » en tête.
- **Filtres durs** sur les contraintes : diplôme, mobilité, durée. Le sous-ensemble de démo est filtré sur les niveaux 0–3 (sans diplôme → Bac+2).
- **Diversité (MMR)** : les pistes ne doivent pas être des variantes du même métier.
- **Traçabilité** : pour chaque piste, les 3 cartes qui la soutiennent, les compétences ROME partagées, et **un point de friction** (« horaires décalés », « travail seul »). Montrer la friction est un signal de confiance, pas une faiblesse.

### 4.3 Sortie

Pas un métier. **3 directions**, chacune avec 3–4 métiers. Les directions suivent les **domaines les plus forts de la personne** (confirmés d'abord, puis moyenne), pas le meilleur score isolé : sinon un domaine secondaire avec deux métiers peut voler la place d'un domaine confirmé.

Pour chaque direction :

- pourquoi (preuves : cartes choisies, domaine confirmé) ;
- ce qui pourrait ne pas coller (friction) ;
- prochaine étape concrète : immersion, mini-stage, rencontre d'un pro, formation, mission locale.

---

## 5. La couche récit — option de sprint, pas cœur du MVP

> Décision : **pas de voix**. Le swipe est le cœur. Le récit texte est un **stretch** confié à 1 personne, à brancher après le chemin swipe → restitution. S'il est livré, il suit le contrat ci-dessous ; sinon, la démo reste honnête : le swipe prouve les compétences par les cartes likées, et le brief conseiller liste les questions à explorer.

### 5.1 Déclencheur

Après un cluster de swipes, l'app ne pose pas une question d'entretien. Elle **rebondit sur ce que le jeune vient de faire** :

> « Tu as liké 6 trucs de réparation. Raconte-moi la dernière fois que tu as réparé un truc — même un truc nul. »

Deux formats : texte libre, ou « je préfère choisir une autre histoire ». Jamais plus de 3 relances, jamais « pourquoi ».

### 5.2 Contrat d'extraction (sortie structurée, Zod)

```ts
type Extract = {
  situation: string;          // ce qui s'est passé
  action: string;             // ce que la personne a fait
  objet: string;              // sur quoi / avec qui
  competenceCandidate: string; // formulation brute
  romeCandidates: { code: string; label: string }[];
  quote: string;              // extrait exact, pour la preuve
  confidence: number;
};
```

**Interdits explicites dans le prompt et dans un post-filtre :** santé, handicap, origine, religion, famille, orientation sexuelle, opinions politiques, situation administrative. Si le récit en contient, on **ne stocke pas le fait** ; on ne garde que la compétence que le jeune validera.

### 5.3 Mapping ROME

1. Récupération des savoir-faire ROME proches (embeddings + mots-clés).
2. Re-ranking LLM contraint : 1 à 3 codes, avec le libellé exact.
3. **Obligation de citation** : chaque code proposé doit être appuyé par un extrait du récit. Pas de citation → proposition rejetée.

### 5.4 Validation — la règle des deux mots

Écran de validation, une compétence à la fois :

```
Ce que tu as dit :   « Je gère quand les gens s'engueulent. »
Ce que ça s'appelle : Gérer des tensions / Résoudre des conflits  (ROME)
D'où ça vient :      ton récit du 18/11 + 4 cartes likées

[ C'est vrai ]   [ Pas vraiment ]   [ C'est plus compliqué ]
[ Reformuler avec mes mots ]
```

Rien n'entre dans le profil sans un **oui explicite**. Le jeune garde **ses mots** en premier, le libellé ROME en second. C'est littéralement « rend au jeune ses compétences avec ses propres mots ».

### 5.5 Registre de preuves

Chaque élément retenu stocke : citation, mots du jeune, code ROME, source (swipe / récit), date, statut de validation. C'est la réponse à « montrer d'où vient chacune ». Le récit brut n'est **pas** conservé par défaut ; seuls les extraits validés le sont.

### 5.6 Brief conseiller / psychologue

Une page, pas un dossier : profil, cohérence, différenciation, zones floues, compétences validées avec citations, 5 questions à explorer en entretien. Le professionnel reçoit **ce que le jeune a accepté de partager**, jamais le récit brut.

---

## 6. Éthique — les dix règles non négociables

1. **Denylist d'inférence** : santé, handicap, origine, religion, famille, orientation sexuelle, opinions politiques, situation administrative, âge, genre. Ni collecte, ni proxy, ni corrélation.
2. **Pas de cold start démographique.** Pas de prior par âge, genre ou quartier. Deck équilibré pour tous.
3. **Pas d'analyse d'image.** Illustrations uniquement, aucun visage.
4. **Trois consentements explicites** : démarrer, enregistrer un récit, exporter vers un conseiller. Mineur de moins de 15 ans : consentement parental (RGPD/CNIL).
5. **Minimisation** : récit brut non persisté ; export déclenché par le jeune ; suppression possible à tout moment.
6. **Le jeune valide tout.** Aucune compétence retenue sans oui. Il peut reformuler, éditer, supprimer.
7. **Langage non diagnostique.** Pas de score de santé, d'employabilité, de « potentiel ». Pas de probabilité de réussite.
8. **On ne classe pas les personnes, on classe des pistes.** L'algorithme mesure une affinité personne–métier, jamais la valeur de la personne.
9. **Audit du deck** : stéréotypes de genre/classe, représentation contre-stéréotypée, relecture par 3 personnes extérieures.
10. **Humain dans la boucle.** L'outil prépare l'entretien ; il ne décide pas. Si un chip « santé » apparaît, on ne stocke pas le détail : on oriente vers un professionnel.

---

## 7. Écrans (MVP)

| # | Écran | Contenu | Critère de réussite |
|---|---|---|---|
| 1 | Accueil | 1 phrase, pas de formulaire, pas de compte | démarrage < 10 s |
| 2 | Deck | carte + swipe gauche/droite + chips de raison | 28–48 cartes sans friction |
| 3 | Confirmation | « on dirait que c'est ton truc » + preuves + oui/non | 100 % des domaines verrouillés par le jeune |
| 4 | Profil partiel (carte 15) | radar naissant + « ce qu'on voit déjà » | effet « ah, ça me ressemble » |
| 5 | Style | 15 paires de choix forcés, même geste | 60 s, complétion > 70 % |
| 6 | Récit (stretch) | 1 déclencheur contextuel, texte libre | 60 % des users racontent |
| 7 | Validation | 1 compétence / écran, 2 mots, citation | 100 % validé ou rejeté |
| 8 | Restitution | 3 directions, preuves, frictions, prochaines étapes | « je vois quoi faire lundi » |
| 9 | Export | dossier JSON + page imprimable | lisible en 2 min |

---

## 8. Architecture & données

```
app/
  page.tsx            accueil
  deck/page.tsx       swipe intérêts + confirmation
  style/page.tsx      15 paires de style
  result/page.tsx     restitution + export
lib/
  types.ts            Card, Job, Response, Profile…
  centers.ts          30 centres, projection Holland, hexagone
  traits.ts           5 spectres, contextes ROME, friction
  score.ts            Beta, confirmation, cohérence
  select.ts           couverture + UCB + focus
  match.ts            matching 30 centres + contexte + MMR
  store.ts            Zustand + localStorage
  demo.ts             persona de démonstration
  presentation.ts     couleurs, labels, niveaux
  useMounted.ts       garde d'hydratation
content/
  cards.ts            80+ cartes d'intérêts
  pairs.ts            15 paires de style
  centers.json        source des 30 centres
data/rome/
  centers.json        30 centres générés
  jobs.json           1 923 métiers (local, non versionné)
  jobs-featured.json  ~200 métiers accessibles (versionné)
  meta.json           version + compteurs
scripts/
  import-rome.mjs     ROME ISO-8859-1 → JSON UTF-8
docs/
  BASELINE.md
```

- **Scoring = TypeScript pur, déterministe, testé (vitest).** Jamais dans le LLM.
- **LLM = uniquement** récit → extraction structurée (stretch). Jamais le score.
- **Versionner l'instrument** : `bankVersion`, `romeVersion`, version du schéma localStorage.
- **Local-first** : Zustand + localStorage, pas de backend, pas de compte. Export JSON + impression.
- **Accessibilité** : les 2 gestes existent aussi en boutons (et c'est plus rapide en démo).

### Modèle de données

```ts
Session        { responses[], traitResponses[], confirmations[], startedAt }
Response       { cardId, direction: 'left'|'right', reason?, latencyMs, ts }
TraitResponse  { pairId, direction: 'left'|'right', latencyMs, ts }
Confirmation   { centerId, accepted, ts }
Profile        { domains[30] Beta, traits[5], theta[6], code,
                 consistency, differentiation, confirmed[], rejected[] }
```

---

## 9. Découpe hackathon

### MUST (la démo tient debout)

- 80+ cartes, swipe gauche/droite + chips de raison sur 1 carte sur 3.
- Import ROME v62 : 30 centres, 1 923 métiers, contextes, savoir-faire, savoir-être.
- Scoring Beta 30 centres + projection Holland + confiance + cohérence + différenciation.
- **Confirmation gate** : le jeune verrouille ou rejette un domaine ; le rejet retire le domaine du deck.
- **5 spectres de style** : 15 paires de choix forcés, même geste.
- ~200 métiers accessibles (sans diplôme → Bac+2), 3 directions, preuves + friction.
- Export JSON + page imprimable.

### SHOULD

- Récit texte + extraction structurée + validation (1 dev, cut line).
- Comparateur « tu hésites entre X et Y ».
- Courbe de confiance vs nombre de swipes (superbe artefact de démo).
- Curated set manuel des 3 métiers par direction (le mapping ROME centres → métiers est bruité).

### WON'T (assumé)

- Voix.
- Comptes, base de données, temps réel.
- Affichage des 1 923 métiers (tout est importé, on surface le sous-ensemble accessible).
- Calibration statistique réelle des items.
- Analyse vidéo/photo, biométrie.

### Plan 3 jours / 6 personnes

| Jour | Data / ROME | Contenu | Scoring | UI deck | UI restitution | Style + export |
|---|---|---|---|---|---|---|
| **Mer 18** | import v62, 213 métiers | 80+ cartes taguées | Beta + UCB + tests | scaffold, swipe, confirmation | radar, 3 directions, preuves | 15 paires, dossier JSON |
| **Thu 19** | curation des directions | audit stéréotypes | matching contexte + MMR | chips, profil 15 | frictions, zones grises | polish style, impression |
| **Ven 20** | gel | gel | gel | polish | polish | démo |

**Règle de gel : vendredi 12h.** Après : répétition, vidéo de secours, pitch. Pas de feature.

### Script de démo (90 s)

1. **Le résultat d'abord** : ouvrir `/result` sur le persona de démonstration → Manuel / Tech / Nature, code Holland, preuves, friction. « Voilà ce qu'on rend au jeune. »
2. **Le direct** : 12 swipes sur `/deck`, montrer que le profil bouge et que la confiance monte.
3. **Le moment fort** : déclencher une confirmation (« On dirait que le manuel, c'est ton truc ») → le jeune valide → le domaine se verrouille.
4. **Le style** : 5 paires sur `/style` → « deux personnes au même code Holland ne tiennent pas dans le même environnement ».
5. **La restitution** : 3 directions, la preuve par les cartes, la friction, l'étape de lundi, l'export.

---

## 10. Évaluation (ce qu'on pourra prouver)

| Test | Méthode | Ce que ça montre |
|---|---|---|
| Validité de contenu | 3 relecteurs notent l'alignement item ↔ centre | les cartes mesurent ce qu'elles prétendent |
| Convergence | utilisateur simulé, 35 swipes adaptatifs | le top 3 retrouve les domaines cachés |
| Confirmation | domaine fortement aimé → proposition → verrouillage | le jeune valide, l'algo ne décide pas |
| Rejet | domaine fortement rejeté → retiré du deck et du matching | le « non » est respecté |
| Contexte | profil « plutôt seul » → les métiers de contact baissent | la personnalité change vraiment la short-list |
| Stabilité | test-retest à 2 semaines sur 10 personnes | pas de bruit |
| Ressenti | « ça me ressemble ? » 1–5 | adoption |
| Utilité conseiller | 3 conseillers notent le brief | la sortie prépare l'entretien |
| Équité | audit du deck + analyse des réponses par sous-groupe | pas de stéréotype |

Le repo contient 17 tests (`npm test`) couvrant la banque, le scoring, la confirmation, le rejet, la convergence, la sélection sans doublon, les 15 paires et le matching.

Ne pas promettre d'« accuracy ». Promettre : **couverture, stabilité, traçabilité, utilité perçue**.

---

## 11. Décisions verrouillées / points restants

**Verrouillé :**
- 3 jours, 6 personnes, vendredi 12h gel.
- Swipe gauche/droite, pas de voix.
- ROME 4.0 v62 importé (dump JSON public, 1 923 métiers, 30 centres, 213 métiers accessibles).
- 17–25 ans, mission locale / décrochage.
- 3 directions × 3–4 métiers, pas de métier unique.
- Sortie indépendante des supports fournis : on construit notre propre banque de cartes.
- Scoring Beta + UCB + set de focus ; confirmation/rejet explicite par le jeune.
- 5 spectres de style, 15 paires, aucun trait clinique.
- Deck plafonné à 48 cartes, cible 35.
- Export JSON + page imprimable, local-first.

**Restant à trancher (impact faible, peut attendre) :**
1. **Nom** : « Orientis » ou autre chose ?
2. **Récit texte** : on le garde dans le sprint (1 dev) ou on le coupe tout de suite ?
3. **Hébergement de la démo** : local (plus sûr en hackathon) ou Vercel ?
4. **Curation** : qui relit les 3 métiers par direction pour éviter les intrus ROME (ex. « panéliste ») ?

---

## Annexe A — Définitions opérationnelles (pour l'équipe)

- **R** : préfère l'action physique, les outils, les machines, les animaux, le plein air. Valeurs : concret, utilité, autonomie pratique.
- **I** : préfère observer, analyser, résoudre des problèmes abstraits. Valeurs : savoir, rigueur, indépendance intellectuelle.
- **A** : préfère créer, s'exprimer, travailler sans cadre rigide. Valeurs : esthétique, originalité, liberté.
- **S** : préfère aider, enseigner, écouter, soigner. Valeurs : altruisme, coopération, lien.
- **E** : préfère convaincre, diriger, vendre, prendre des risques. Valeurs : influence, statut, initiative.
- **C** : préfère organiser, classer, fiabiliser, suivre des procédures. Valeurs : ordre, sécurité, précision.

## Annexe B — Exemples de cartes

> Les cartes réelles sont taguées sur les **30 centres ROME** ; la projection Holland est calculée. Le tableau ci-dessous est une illustration en types Holland, pas le format de production.

| Carte | R | I | A | S | E | C |
|---|---|---|---|---|---|---|
| Réparer un vélo crevé | .9 | .2 | | | | |
| Démonter un vieux téléphone pour voir dedans | .6 | .8 | | | | |
| Expliquer un truc que tu maîtrises à quelqu'un | | | | .8 | .3 | |
| Gérer la caisse d'une asso | | | | | .4 | .9 |
| Créer un compte qui marche sur les réseaux | | | .7 | | .7 | |
| Organiser un tournoi de foot du quartier | .3 | | | .5 | .8 | |
| Faire un montage vidéo | | | .9 | | | |
| Convaincre un pote de venir à un événement | | | | .2 | .9 | |
| Traduire une conversation pour quelqu'un | | | | .6 | | .3 |
| Ranger et classer des documents pour une asso | | | | | | .9 |
| Coder un petit jeu | | .9 | .4 | | | |
| S'occuper d'un animal blessé | .5 | .3 | | .7 | | |

> Note : « Traduire pour un proche » est un bon exemple de compétence réelle à récupérer **sans** stocker le fait familial. On garde « traduire », pas « aide ses parents ».

## Annexe C — Vecteur métier (sortie réelle de l'import)

```ts
{
  code: "I1209",
  label: "Technicien / Technicienne d'installation de panneau digital",
  definition: "…",                         // texte ROME
  access: "Cet emploi est accessible avec un diplôme de niveau Bac…",
  level: 2,                                 // 0 sans diplôme … 5 Bac+5
  centers: { tech: 1, manual: 0.5, detail: 0.5 },
  riasec: { R: 0.28, I: 0.47, A: 0.03, S: 0, E: 0.03, C: 0.19 },
  contexts: ["En extérieur", "Déplacements professionnels", "…"],
  competences: {
    savoirFaire: [{ code: "…", label: "…", principal: true }],
    savoirEtre: [{ code: "…", label: "…" }],
    savoirs: [{ code: "…", label: "…" }]
  },
  mobilities: ["I1307 - Antenniste", "…"]
}
```

Le champ `centers` vient des listes ROME (`principal: true` → 1, sinon 0,5). Aucun tagging LLM sur les métiers.

## Annexe D — Les 5 spectres, 15 paires

| Spectre | Paires (choix gauche / choix droit) |
|---|---|
| **Énergie sociale** | calme avec 1–2 potes / beaucoup de monde · parler aux gens / attendre qu'on vienne · prendre la parole / écouter |
| **Structure** | planifier / commencer et voir · bazar organisé / chaque chose à sa place · demander un cadre / improviser |
| **Ouverture** | tester direct / ce que je maîtrise · repères stables / ça change tout le temps · gens différents / mêmes personnes |
| **Coopération** | compromis / défendre son point · avancer ensemble / être le meilleur · continuer / s'arrêter pour aider |
| **Rythme** | urgence / rythme régulier · gérer dans l'instant / se calmer avant de décider · rythme stable / pics de pression |

**Ce qu'on ne fait pas :** pas de neuroticisme, pas de diagnostic, pas de trait déduit des intérêts. Le 5e spectre est un rythme préféré, pas une stabilité émotionnelle.
