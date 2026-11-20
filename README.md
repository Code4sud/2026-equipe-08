# Orientis

> **T'as plus de skills que tu crois.**

Orientis est un jeu de cartes qui aide les 17–25 ans éloignés de l'emploi à mettre des mots sur ce qu'ils savent faire. On swipe des activités concrètes, on répond à 15 choix entre deux situations de travail, puis l'app rend **3 directions métier** avec, pour chacune, les cartes qui la soutiennent, les compétences ROME et un point de friction.

Ce n'est pas un test psychologique. C'est une boussole : **le jeune valide tout ce qui est retenu**.

**Démo en ligne** : https://declic-livid.vercel.app
**Démo locale (la vraie)** : `npm run dev` → `/dossier` et `/demo`. Guide : [`docs/LOCAL.md`](docs/LOCAL.md).
**Démo automatique** : bouton **▶ Démo automatique** sur `/` ou `/demo` ; le scénario Sam joue le swipe, le style, les entretiens et le dossier final.

- Modèle complet, décisions et limites : [`docs/BASELINE.md`](docs/BASELINE.md)
- Swipe adaptatif (cartes écrites pour le jeune, ROME, LLM) : [`docs/SWIPE-ADAPTATIF.md`](docs/SWIPE-ADAPTATIF.md)
- 30 domaines ROME 4.0 · 1 923 métiers importés · ~213 métiers accessibles dans la démo
- 5 spectres de travail · 15 paires de choix forcés
- Local-first : pas de compte, pas de backend, données dans `localStorage`

---

## Démarrer

```bash
npm install
npm run dev
```

Routes :

| Route | Écran |
|---|---|
| `/` | accueil |
| `/deck` | swipe des intérêts + confirmations |
| `/creuser` | étape 2 : questions ouvertes sur une expérience prouvée + infos CV, dictée vocale locale |
| `/style` | 15 paires de style de travail |
| `/result` | restitution, 3 directions, export |
| `/dossier` | dossier complet : plan d'action, CV ciblé, emails, sources |
| `/demo` | panneau de démonstration : persona, localisation, IA |

> Ce projet utilise **Next.js 16.4**. Les APIs ont changé : lire `node_modules/next/dist/docs/` avant d'écrire du code (voir `AGENTS.md`).

## Scripts

```bash
npm run dev          # serveur de développement
npm run build        # build production
npm test             # tests Vitest (scoring, convergence, matching, swipe adaptatif)
npm run import:rome  # régénère data/rome/*.json depuis le dump ROME
npm run build:skills # régénère data/rome/skills.json (macro-compétences ROME)
npm run prompts      # affiche les prompts IA sans appeler Claude
npm run lint
```

### LLM

Une seule couche, `lib/llm`, réglée par `.env.local` :

```bash
LLM_BACKEND=mock   # défaut : aucun appel, chaque feature a un repli
LLM_BACKEND=cli    # `claude -p` avec l'abonnement Claude de la machine (local uniquement)
```

Le dossier utilise trois appels séparés (synthèse, CV ciblé, emails). Audit
complet, payloads et garde-fous : [`docs/PROMPTS.md`](docs/PROMPTS.md).

---

## Données ROME

Source : **ROME 4.0 v62 — 26M10** (octobre 2026), France Travail, Licence Ouverte.
Dump public : `https://api.francetravail.fr/api-nomenclatureemploi/v1/open-data/json`

Le dump est un ZIP de JSON encodés en **ISO-8859-1**. Le script `scripts/import-rome.mjs` :

1. dézippe et convertit en UTF-8 ;
2. relie les 30 centres d'intérêt ROME aux 1 923 métiers ;
3. extrait contextes de travail, savoir-faire, savoir-être, accès ;
4. normalise le niveau d'accès (0 = sans diplôme … 5 = Bac+5) ;
5. filtre les parcours trop longs / réglementés / hors cible ;
6. génère `centers.json`, `jobs.json` (complet, local) et `jobs-featured.json` (versionné).

```bash
mkdir -p data/rome
curl -sL "https://api.francetravail.fr/api-nomenclatureemploi/v1/open-data/json" \
  -o data/rome/rome-4.0-json.zip
unzip -o data/rome/rome-4.0-json.zip -d data/rome/unzipped
npm run import:rome
```

Fichiers :

| Fichier | Versionné | Rôle |
|---|---|---|
| `data/rome/centers.json` | oui | 30 centres + définitions + projection Holland |
| `data/rome/jobs-featured.json` | oui | ~213 métiers accessibles utilisés par l'app |
| `data/rome/jobs.json` | non (5 Mo) | les 1 923 métiers, pour la recherche future |
| `data/rome/unzipped/` | non (88 Mo) | dump brut |

> **Limite connue** : le lien ROME « centre d'intérêt → métier » est bruité. Certains centres ramènent des métiers peu représentatifs (« panéliste », « caviste de chai »). Une curation humaine des 3 métiers par direction est la prochaine amélioration à fort impact.

---

## Algorithme (résumé)

### 1. Intérêts — 30 centres ROME

Chaque carte a un poids sur 1–3 centres. Chaque centre a un prior `Beta(1,2 ; 1,2)`.

```
droite  → α += w · q
gauche  → β += 0,8 · w · q
jamais essayé / barrière d'accès → aucun update
```

- `moyenne = α/(α+β)`, confiance = largeur de l'intervalle crédible.
- « Jamais essayé » n'est **pas** un rejet.
- Les raisons (pas mon truc / pas les moyens / peur de pas y arriver) séparent goût, accès et confiance.

### 2. Confirmation — le jeune verrouille

Un domaine devient proposable à `moyenne ≥ 0,72`, `lower80 ≥ 0,60`, `nEff ≥ 3,5`, `≥ 4 cartes likées`.
L'app affiche alors une carte de confirmation avec les preuves. **Oui** verrouille le domaine et le passe en **approfondissement** (il reste prioritaire dans le deck) ; **pas vraiment** le remet au prior et l'écarte.

### 3. Sélection — couverture puis UCB

- Couverture des domaines jamais vus : 12 cartes maximum, arrêtée dès qu'un domaine a ≥ 2 cartes aimées et une moyenne ≥ 0,6.
- Ensuite : `priorité = moyenne' + 0,10·sqrt(log(n+2)/(nEff+0,5))`, où `moyenne'` est plafonnée à 0,45 tant que `nEff < 1` ; focus 30 → 12 → 6 domaines (domaines à peine vus derrière les domaines aimés), 35 % d'exploration hors focus.
- Plafond dur : 48 cartes. Cible : 35.

### 4. Style de travail — 5 spectres

Énergie sociale, structure, ouverture, coopération, rythme. 15 paires, 3 par spectre, pôles inversés. Le score est une moyenne `[-1, 1]` ; la confiance vient du nombre de réponses. **Aucun trait clinique, aucun neuroticisme.**

### 5. Matching

```
intérêt  = cos(vecteur 30 centres, centres du métier) − pénalité domaines rejetés
contexte = adéquation des 5 spectres aux contextes ROME du métier
score    = 0,65·intérêt + 0,35·contexte − pénalité de mismatch
```

Puis MMR pour diversifier. Les **directions suivent les domaines les plus forts de la personne** (confirmés d'abord), pas le meilleur score isolé.

### 6. Restitution

- Code Holland à 3 lettres + mots (Concret · Analyser · Organiser).
- Domaines forts en second (Manuel · Tech · Nature).
- 3 directions × 3–4 métiers, avec preuves, compétences ROME, friction, niveau d'accès.
- Panneau « ce qu'on ne sait pas encore » + 3 questions pour l'entretien.
- Export JSON + impression.

---

## Structure

```
app/
  page.tsx            accueil
  deck/page.tsx       swipe + confirmation
  style/page.tsx      15 paires
  result/page.tsx     restitution + export
lib/
  types.ts            types partagés
  centers.ts          30 centres → 6 Holland
  traits.ts           5 spectres + contextes ROME + friction
  score.ts            Beta, confirmation, cohérence
  select.ts           couverture + UCB + focus
  match.ts            matching + MMR + directions
  store.ts            Zustand + localStorage
  demo.ts             persona de démonstration
  presentation.ts     couleurs, labels, niveaux
  useMounted.ts       garde d'hydratation
content/
  cards.ts            80+ cartes
  pairs.ts            15 paires
  centers.json        source des centres
data/rome/            JSON générés
scripts/import-rome.mjs
docs/BASELINE.md
```

---

## Tests

`npm test` couvre 17 cas :

- couverture des 30 centres et poids des cartes ;
- like / dislike / « jamais essayé » / barrières d'accès ;
- confirmation d'un domaine fort, rejet d'un domaine fort ;
- convergence d'un utilisateur simulé en 35 swipes adaptatifs ;
- sélection sans doublon, 15 paires sans doublon ;
- matching, diversité, 3 directions ;
- persona de démonstration.

```bash
npm test
```

---

## Éthique — les règles du produit

1. **Aucune inférence** sur la santé, le handicap, l'origine, la religion, la famille, l'orientation sexuelle, les opinions politiques, la situation administrative.
2. **Aucun trait de personnalité déduit des intérêts.** Les spectres sont demandés directement, dans une séquence séparée.
3. **Le jeune valide** chaque domaine retenu ; il peut reformuler, écarter, recommencer.
4. **On ne classe pas les personnes, on classe des pistes.** Pas de score d'employabilité, pas de probabilité de réussite.
5. **Local-first** : pas de compte, pas de serveur, export déclenché par le jeune.

---

## 3 jours / 6 personnes

| Rôle | Jour 1 | Jour 2 | Jour 3 |
|---|---|---|---|
| Data / ROME | import v62, 213 métiers | curation des directions | gel |
| Contenu | 80+ cartes | audit stéréotypes | gel |
| Scoring | Beta + UCB + tests | contexte + MMR | gel |
| UI deck | swipe + confirmation | chips, profil 15 | polish |
| UI restitution | radar, 3 directions | frictions, zones grises | polish |
| Style + export | 15 paires, dossier JSON | impression, démo | pitch |

**Gel vendredi 12h.** Après : répétition, vidéo de secours, pitch.

### Script de démo (90 s)

1. Ouvrir `/result` sur la persona de démonstration → Manuel / Tech / Nature, preuves, friction.
2. 12 swipes sur `/deck` → le profil bouge, la confiance monte.
3. Déclencher une confirmation → le jeune valide → le domaine se verrouille.
4. 5 paires sur `/style` → « même code Holland, environnement différent ».
5. Restitution + export.

---

## Limites assumées

- **Pas de récit libre dans le MVP** : le brief du Sujet 4 demande « faire raconter ». Le récit texte + extraction + validation est un stretch (1 dev) documenté dans `docs/BASELINE.md` §5. Sans lui, la démo reste honnête : les preuves sont les cartes, et le brief conseiller liste les questions à explorer.
- **Mapping ROME centres → métiers bruité** : curation humaine nécessaire.
- **Pas de calibration statistique** : les poids sont experts, le modèle est une heuristique sérieuse, pas un instrument validé.
- **Pas de voix**, pas de compte, pas de base de données.
