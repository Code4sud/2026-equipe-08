# Swipe adaptatif — plan et décisions techniques

> Étape 1 du parcours Orientis : **Swipe adaptatif → Quiz (4-5 questions, voix) → CV → RDV & entreprises**.
> Statut : moteur et branchement faits, en mode `mock` et `cli`. Reste : brancher le mode `api`, régler les prompts avec de vraies réponses, curer le lien carte ↔ ROME.

## En une phrase

Après quelques cartes de la banque fixe, Orientis **écrit des cartes pour le jeune** : il en choisit le sujet (une compétence ROME) à partir de ses réponses, puis un LLM rédige la situation. Un « déjà fait » déclenche une carte qui **creuse** ce vécu.

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
| 13 | **Pas de filtre de thèmes sensibles sur le texte généré pour l'instant** (retiré le 19/11, version précédente : commit `5ceeea1`). Le prompt porte seul les règles (pas de santé, origine, religion, famille du jeune). Restent des contrôles de forme (longueur) ; échec → texte construit depuis le libellé ROME. | Décision d'équipe : éviter les faux positifs pendant qu'on règle les prompts. À réévaluer avant la démo. |
| 14 | **Aucune donnée personnelle envoyée au LLM** : le swipe ne contient pas de texte libre. Le LLM reçoit la cible ROME et les textes des cartes déjà montrées. | Le sujet le plus sensible du hackathon. |
| 15 | **Le jeune voit quand une carte a été écrite pour lui** (« Carte rien que pour toi », « On creuse un peu »). | L'adaptativité se voit en démo, et c'est honnête. |
| 16 | **Une seule couche LLM** (`lib/llm`) : `mock` (défaut), `cli` (`claude -p`, abonnement, local), `api` (à brancher). Sortie validée par zod quel que soit le mode. | Les coéquipiers sans abonnement développent en `mock`. Changer de mode = une variable d'environnement. |
| 17 | **Cache mémoire** des textes écrits par le LLM (par cible). | Les répétitions de la démo deviennent instantanées. |
| 18 | **Intérêt et vécu séparés.** Carte explorer = une *activité* sous « Ça te tente ? » (jamais de question, jamais « déjà » ; une relance au LLM sinon). Carte creuser = une *question de vécu* sous « C'est toi ? » ; sa réponse ne touche **pas** au score d'intérêt, elle marque seulement la compétence « vécu » ou non. | Sinon « non, jamais fait » était compté comme « pas intéressé », ce qui pénalise exactement le public visé (pas eu l'occasion d'essayer). |
| 19 | **« Tu l'as déjà fait ? » après chaque oui** sur une carte d'intérêt : deux gros boutons, *Pas encore* / *Oui, déjà fait*, la carte suivante s'efface en attendant. | C'est le déclencheur du mode creuser : en puce optionnelle, il ne se serait presque jamais vu. Un tap de plus par oui, assumé. |
| 20 | **Une carte creuser est demandée dès le « déjà fait »**, même si une carte explorer attend déjà en file, et passe devant. | Mesuré avec `claude -p` : la carte creuser arrive ~2 cartes après le « déjà fait ». |
| 21 | **Explorer personnalisé.** Le code choisit le centre (UCB) et **3 compétences** de son vivier (enjeux variés) ; le LLM reçoit les cartes **aimées** et **pas aimées** (textes de cartes uniquement) et choisit la compétence qui prolonge le mieux ses goûts. Le serveur vérifie que le code renvoyé est dans la liste. | Le domaine reste piloté par le score ; la situation colle au jeune. Mesuré : même domaine, mêmes 3 compétences → « Retaper un vieux vélo pour le revendre » (profil foot/vente), « Monter toi-même ton PC » (jeux vidéo), « Monter des niches pour un refuge » (animaux). |
| 22 | **217 cartes explorer pré-écrites** (`npm run pregen:cards`, ~70 s avec `claude -p`), dédoublonnées entre elles et contre la banque fixe (≥ 60 % de mots communs = doublon). Utilisées quand aucun LLM n'est là (mode mock, Vercel sans clé, LLM en échec). | Plus jamais de libellé ROME brut à l'écran. La démo tient sans IA. |
| 23 | **Sans LLM, pas de « creuser » sur une carte générée** (la suite serait en jargon ROME) ; « creuser » une carte de la banque reliée par les mots affiche l'activité pré-écrite sous « C'est toi ? ». | Mieux vaut explorer que montrer une suite illisible. |

## Fichiers

| Fichier | Rôle |
|---|---|
| `scripts/build-skills.mjs` → `data/rome/skills.json` | Référentiel compacté : macros, arborescence, compétences fines, vecteurs de centres, viviers par centre. |
| `lib/adaptive/skills.ts` | Accès au référentiel (serveur uniquement, ~430 Ko). |
| `lib/adaptive/target.ts` | Couverture, choix de la cible, construction de la carte. Pur, testé. |
| `lib/adaptive/writer.ts` | Prompt (goûts du jeune, 3 candidates), contrôles de forme, repli sans LLM. |
| `lib/adaptive/pregen.ts` + `data/rome/explorer-cards.json` | 217 cartes explorer pré-écrites. |
| `scripts/pregen-cards.ts` | Génération par lots (8 compétences × 4 en parallèle), incrémentale, dédoublonnée. |
| `lib/llm/` | `completeJson()` + backend `claude -p`. |
| `app/api/card/route.ts` | `POST /api/card`. |
| `lib/store.ts` | File de cartes générées, `pump()`, alternance. |
| `app/deck/page.tsx` | Puces « déjà fait » après un oui, badge des cartes générées. |
| `lib/adaptive/target.test.ts` | 15 tests du moteur. |

## Lancer

```bash
npm run build:skills           # seulement si le dump ROME change
npm run pregen:cards           # réécrit les cartes explorer manquantes (claude -p ; --force pour tout réécrire)
npm run dev                    # mode mock : cartes construites depuis ROME, sans LLM
```

Avec ton abonnement Claude (en local, CLI `claude` installée et connectée), crée `.env.local` :

```bash
LLM_BACKEND=cli
# LLM_MODEL=claude-opus-5-5    # défaut
```

## Mesuré avec `claude -p` (Claude Opus 5.5, effort bas)

7 cartes générées, 7 acceptées par les garde-fous, **4,5 à 6 s** par carte (11 s pour une short-list floue de 8 compétences), en parallèle. Exemples :

| Situation | Compétence ROME | Carte écrite |
|---|---|---|
| explorer | Gérer les stocks | 📦 T'as déjà compté ce qui restait avant une soirée entre potes ? — *Boissons, chips, même vite fait* |
| creuser « Gérer la caisse d'une asso » | Définir la tarification (choisie dans la short-list) | 🏷️ Et c'est toi qui fixais les prix des trucs vendus ? — *Même pour une buvette ou des gâteaux* |
| creuser « Démonter et réparer un scooter » | Réaliser un diagnostic technique | 🔍 Et c'est toi qui as trouvé d'où venait la panne ? — *Même en testant pièce par pièce* |
| creuser « Garder des enfants » | Accompagner le développement de l'enfant | 📚 Et c'est toi qui les aidais à faire leurs devoirs ? — *Même juste lire une histoire, ça compte* |
| creuser « Vendre des trucs sur Vinted » | Présenter et valoriser un produit | 📸 Et c'est toi qui prenais les photos et écrivais l'annonce ? |

### Session complète dans le navigateur (`claude -p`, rythme humain ~2,5 s par carte)

18 cartes en 44 s, 6 cartes écrites par Claude, aucune erreur :

```
Organiser un tournoi de foot du quartier      → oui + déjà fait
…
[On creuse un peu] Et c'est toi qui trouvais le terrain et les ballons ?
Soigner un animal blessé                       → oui + déjà fait
…
[On creuse un peu] T'as déjà nettoyé ou bandé sa blessure toi-même ?
Faire respecter les règles dans un événement   → oui + déjà fait
…
[On creuse un peu] T'as déjà dû calmer quelqu'un qui s'énervait ?   (ROME : Gérer une situation conflictuelle)
[Carte rien que pour toi] Faire la pub d'une vente de gâteaux au quartier
```

## Contrat pour le quiz (P3)

Les cartes générées gardent leur cible dans `card.target` (`macro`, `label`, `mode`, `parentId`). `coverage(responses, cards)` donne le statut de chaque compétence visée :

- `vecu` : « déjà fait », c'est **la matière du quiz** (raconter, prouver, valider) ;
- `attire` : oui sans expérience déclarée ;
- `inconnu` : « jamais essayé » ou barrière d'accès, **pas un rejet** ;
- `rejete` : « pas mon truc ».

Le quiz part des cartes `vecu`, d'abord les cartes creuser.

## Skill matches, « Mes matchs » et « On creuse » (19/11/2026)

**Pourquoi.** Une compétence ROME (« Organiser une livraison ») ne fait pas rêver ; un jeune se projette dans un **métier**. Le swipe garde les compétences comme preuves, mais ce qu'on montre, ce sont des métiers.

**1. Skill match = un « Oui, déjà fait ».** Dès qu'un jeune dit « déjà fait » sur une carte (banque ou générée), une **notification** « C'est un skill match ! » s'affiche en haut d'écran (4,5 s, ne bloque pas le swipe) et le match rejoint la **mémoire des matchs** (`skillMatches`, `lib/matches.ts`). Plus de carte « On creuse un peu » dans le swipe ni d'écran de match bloquant.

- Compétence ROME du match : une carte générée porte déjà la sienne (`card.target`) ; pour une carte de la banque, `/api/skill` la résout en arrière-plan (`lib/skillOf.ts`) : short-list fermée (lien par les mots avec le garde-fou verbe / centre, puis viviers des 2 centres), le LLM choisit **dans** la liste ou répond « aucune ». Sans LLM : le lien par les mots, sinon aucune compétence (mieux que deviner). Mesuré : ~3 s.

**2. « Mes matchs » (`/matchs`)** : bouton dans l'en-tête du deck avec une pastille (matchs pas encore vus), ou tap sur la notification.

- **Métiers proposés** (`/api/jobs`, `lib/careers.ts`) : le code choisit 25 candidats parmi les **849 métiers ROME accessibles** de `data/rome/jobs-index.json` (`npm run build:jobs`, niveaux 0 à 3 ou inconnu) ; score = compétences ROME prouvées présentes dans la fiche + mots communs entre cartes et métier + proximité des centres d'intérêt. Le LLM en retient 3 à 5, variés, et écrit une **accroche reliée au vécu** (« Tu répares déjà un vélo crevé : c'est le cœur du quotidien d'un mécanicien cycles »). Il ne peut choisir que dans la liste : pas de métier inventé. Sans LLM : les 4 mieux classés, accroche construite. Mesuré : 4 à 6 s, puis cache tant que les matchs ne changent pas.
- Pourquoi un index et pas `jobs-featured.json` : ses ~213 métiers couvrent les centres d'intérêt mais pas les métiers évidents (pas de « Mécanicien cycles »).
- Sous les métiers : la liste des skill matchs (carte, « déjà fait », compétence ROME).

**3. « On creuse » (`/creuser`) : un récit par métier choisi**, sur les expériences qui y mènent (au plus 3).

| | |
|---|---|
| Questions | 3, sur ces expériences vues sous l'angle du métier : contexte → ce qu'il a fait → ce que ça a donné. Écrites par le LLM (`/api/questions`, `lib/interviewQuestions.ts`) à partir du **métier ROME, des textes des cartes et de leurs compétences** ; jamais une réponse du jeune n'est envoyée au LLM. Sans LLM : questions de repli. |
| Questions CV | Au plus 3 par récit, parmi celles encore sans réponse (prénom, ville, études, situation, petits boulots, âge, permis, mobilité) ; une question passée n'est pas reposée. |
| Quitter | « Revenir aux cartes » à tout moment ; reprise au même écran (lien « Reprendre ton récit » dans le deck). |
| Fin | **« Voir mon dossier »** (`/dossier`), ou creuser un autre métier, ou continuer à swiper. |
| Dictée | Whisper (`onnx-community/whisper-base`, q8, ~75 Mo) dans un Web Worker : **le son ne quitte pas l'appareil**. Modèle téléchargé du Hub au premier usage puis en cache. Mesuré (Edge, sans GPU) : 1re dictée 5 à 10 s, puis ~3 s pour 6 s de parole. |
| Stockage | `localStorage` uniquement (`skillMatches`, `jobs`, `interviews`, `cv` dans `declic-session-v1`, version 6 ; les anciennes sessions sont migrées, leurs « déjà fait » deviennent des matchs). |

**Sortie pour le dossier** : l'export de `/result` contient `skillMatches`, `interviews` (métier, expériences, questions / réponses) et `user` (contrat `docs/DOSSIER.md`, avec `targetJobs`). `lib/dossier/experience.ts` lit les compétences des matchs et les récits par métier.

## Limites connues et suite

1. **Mode `api` à brancher** (SDK Anthropic + `ANTHROPIC_API_KEY`) pour la démo sur Vercel : `claude -p` ne tourne qu'en local.
2. **Lien carte de la banque ↔ ROME** : la correspondance de mots est une heuristique (bonne sur « caisse », « réparer », « animaux », vide sur « énigmes », « karting »). Prochaine amélioration à fort impact : **curer à la main 1 à 3 macros par carte de la banque** (~90 cartes).
3. ~~Textes du repli sans LLM~~ et ~~pré-génération~~ : faits (décisions 22-23). Reste : les cartes « creuser » sans LLM n'existent que pour les cartes de la banque reliées par les mots.
4. **En mode `cli`, les cartes explorer restent écrites à la volée** (personnalisées, ~5 s). Option si la latence gêne en démo : servir la carte pré-écrite tout de suite et ne garder le LLM que pour « creuser ».
5. **Prompts à régler** sur de vraies sessions (longueur, registre, variété des emojis).
