# Swipe adaptatif — plan et décisions techniques

> Étape 1 du parcours Déclic : **Swipe adaptatif → Quiz (4-5 questions, voix) → CV → RDV & entreprises**.
> Statut : moteur et branchement faits, en mode `mock` et `cli`. Reste : brancher le mode `api`, régler les prompts avec de vraies réponses, curer le lien carte ↔ ROME.

## En une phrase

Après quelques cartes de la banque fixe, Déclic **écrit des cartes pour le jeune** : il en choisit le sujet (une compétence ROME) à partir de ses réponses, puis un LLM rédige la situation. Un « déjà fait » déclenche une carte qui **creuse** ce vécu.

```
banque fixe ──► swipe ──► état (réponses + cartes générées)
                               │
                               ▼  POST /api/card
                     ┌─────────────────────┐
                     │ 1. choix de la cible │  code pur, testé
                     │    explorer / creuser│  (lib/adaptive/target.ts)
                     ├─────────────────────┤
                     │ 2. écriture du texte │  LLM, ou repli sans LLM
                     │    + garde-fous      │  (lib/adaptive/writer.ts)
                     └─────────────────────┘
                               │
                               ▼
                     file d'attente côté client (1 carte d'avance)
```

## Décisions techniques

| # | Décision | Pourquoi |
|---|---|---|
| 1 | **Le code choisit la cible, le LLM n'écrit que la phrase.** | Testable, contrôlable (pas de dérive vers un thème sensible), moins cher, et ça marche sans réseau. |
| 2 | **Cible = macro-compétence ROME** (506 au total, 224 retenues pour le swipe). | Assez fin pour être une vraie compétence, assez petit pour tenir dans un prompt (~8 k tokens) et pour une liste fermée. |
| 3 | **Les poids de centres d'intérêt d'une carte générée ne viennent jamais du LLM** : 50 % centre sondé (ou carte parente) + 50 % vecteur ROME de la compétence. | Même règle que la BASELINE (« aucun tagging LLM ») : le score d'intérêt existant reste valable, la page résultat n'a pas changé. |
| 4 | **Vecteur ROME d'une compétence = moyenne des centres des métiers accessibles dont la fiche la contient** (principale = 1, sinon 0,5). | Dérivé des fiches officielles, reproductible (`npm run build:skills`). |
| 5 | **Vivier de chaque centre classé par P(macro│centre) × lift**, compétences présentes dans > 30 % des métiers exclues. | Sinon « Respecter les règles QHSSE » et « Utiliser les outils numériques » sortent partout et ne discriminent rien. |
| 6 | **Exclues du swipe** : savoir-être (gardés pour le quiz), « Technique expert », actes cliniques (psycho, médical, chirurgie, sanitaire, funéraire, culte…). | Les savoir-être se prouvent par un récit, pas par un swipe. Les actes cliniques pousseraient le générateur vers la santé. |
| 7 | **Deux modes.** *Explorer* : centre prioritaire (même UCB que le deck fixe) → compétence pas encore vue, en variant les enjeux ROME. *Creuser* : après « déjà fait souvent / une fois ». | Explorer couvre, creuser approfondit le vécu = matière pour le quiz. |
| 8 | **Creuser une carte générée** : même compétence, une compétence fine plus précise. **Creuser une carte de la banque** : short-list ≤ 8 (correspondance de mots rares avec les libellés ROME, puis viviers des 2 centres de la carte) ; le LLM choisit **dans** la liste, le serveur vérifie. | La banque fixe n'a pas de lien ROME : le LLM tranche, mais dans un cadre fermé. |
| 9 | **Sans LLM, pas de « creuser » au hasard** : si aucun mot ne relie la carte à ROME (`loose`), on explore à la place. | Mieux vaut une carte d'exploration qu'une suite absurde (« énigmes » → « géologie »). |
| 10 | **Plafonds** : 6 cartes creuser, 18 cartes générées, on ne creuse pas une carte creuser. | Garder le swipe court et éviter l'interrogatoire. |
| 11 | **Alternance** banque / adaptatif ; une carte creuser prête passe devant. Le client garde **une carte d'avance** et ne bloque jamais sur le LLM. | `claude -p` met plusieurs secondes : la banque comble l'attente. Les situations écrites à la main restent visibles. |
| 12 | **Démarrage après 2 cartes** de la banque. | Zéro latence au début, et un premier signal avant de générer. |
| 13 | **Garde-fous sur le texte généré** : santé, origine, religion, famille (« ton petit frère », « tes parents »…), argent, situation administrative, « tu es… », longueur. Échec → texte construit depuis le libellé ROME. | Un faux positif coûte une carte moins jolie ; un faux négatif coûte la confiance du jeune. |
| 14 | **Aucune donnée personnelle envoyée au LLM** : le swipe ne contient pas de texte libre. Le LLM reçoit la cible ROME et les textes des cartes déjà montrées. | Le sujet le plus sensible du hackathon. |
| 15 | **Le jeune voit quand une carte a été écrite pour lui** (« Carte rien que pour toi », « On creuse un peu »). | L'adaptativité se voit en démo, et c'est honnête. |
| 16 | **Une seule couche LLM** (`lib/llm`) : `mock` (défaut), `cli` (`claude -p`, abonnement, local), `api` (à brancher). Sortie validée par zod quel que soit le mode. | Les coéquipiers sans abonnement développent en `mock`. Changer de mode = une variable d'environnement. |
| 17 | **Cache mémoire** des textes écrits par le LLM (par cible). | Les répétitions de la démo deviennent instantanées. |

## Fichiers

| Fichier | Rôle |
|---|---|
| `scripts/build-skills.mjs` → `data/rome/skills.json` | Référentiel compacté : macros, arborescence, compétences fines, vecteurs de centres, viviers par centre. |
| `lib/adaptive/skills.ts` | Accès au référentiel (serveur uniquement, ~430 Ko). |
| `lib/adaptive/target.ts` | Couverture, choix de la cible, construction de la carte. Pur, testé. |
| `lib/adaptive/writer.ts` | Prompt, garde-fous, repli sans LLM. |
| `lib/llm/` | `completeJson()` + backend `claude -p`. |
| `app/api/card/route.ts` | `POST /api/card`. |
| `lib/store.ts` | File de cartes générées, `pump()`, alternance. |
| `app/deck/page.tsx` | Puces « déjà fait » après un oui, badge des cartes générées. |
| `lib/adaptive/target.test.ts` | 15 tests du moteur. |

## Lancer

```bash
npm run build:skills           # seulement si le dump ROME change
npm run dev                    # mode mock : cartes construites depuis ROME, sans LLM
```

Avec ton abonnement Claude (en local, CLI `claude` installée et connectée), crée `.env.local` :

```bash
LLM_BACKEND=cli
# LLM_MODEL=claude-opus-5-5    # défaut
```

## Contrat pour le quiz (P3)

Les cartes générées gardent leur cible dans `card.target` (`macro`, `label`, `mode`, `parentId`). `coverage(responses, cards)` donne le statut de chaque compétence visée :

- `vecu` : « déjà fait », c'est **la matière du quiz** (raconter, prouver, valider) ;
- `attire` : oui sans expérience déclarée ;
- `inconnu` : « jamais essayé » ou barrière d'accès, **pas un rejet** ;
- `rejete` : « pas mon truc ».

Le quiz part des cartes `vecu`, d'abord les cartes creuser.

## Limites connues et suite

1. **Mode `api` à brancher** (SDK Anthropic + `ANTHROPIC_API_KEY`) pour la démo sur Vercel : `claude -p` ne tourne qu'en local.
2. **Lien carte de la banque ↔ ROME** : la correspondance de mots est une heuristique (bonne sur « caisse », « réparer », « animaux », vide sur « énigmes », « karting »). Prochaine amélioration à fort impact : **curer à la main 1 à 3 macros par carte de la banque** (~90 cartes).
3. **Textes du repli sans LLM** = libellés ROME bruts (« Réguler, superviser le trafic d'un réseau de transport »). Acceptable en dev, pas en démo : la démo tourne avec le LLM, ou avec un lot de cartes pré-écrites.
4. **Pré-génération** : écrire une fois, avec le LLM, la carte explorer de chacune des 224 cibles et la versionner. Les cartes explorer deviennent instantanées et marchent sans LLM ; seules les cartes creuser restent générées à la volée.
5. **Prompts à régler** sur de vraies sessions (longueur, registre, variété des emojis).
6. Un « déjà fait » tapé pendant qu'une requête est en cours n'est creusé qu'à la carte adaptative suivante.
