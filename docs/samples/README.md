# Échantillons de profil Orientis

Profil **fictif** (« manuel + tech »), calculé par le vrai code du projet à partir d'une session de 21 swipes et des 15 paires de style : score, swipe adaptatif, matching. Les textes des 4 cartes adaptatives sont écrits à la main, dans le style du LLM. Leurs cibles ROME viennent de l'algorithme.

Les éléments suivants ont été **réellement générés par le LLM** (mode `cli`) :
- les 9 **skill matches**, chacun avec sa compétence ROME (2 n'en ont pas, aucune ne collait) ;
- les 5 **métiers proposés** dans « Mes matchs » ;
- les questions de « On creuse ».

Deux métiers ont été creusés (Mécanicien cycles, Réparateur multimédia), avec des réponses fictives. Une question passée a une réponse vide. Il y a aussi 6 infos CV fictives (3 par récit). Le permis et la mobilité n'ont pas encore été demandés, donc `user.constraints` est absent. C'est un cas normal, que le CV doit savoir gérer.

| Fichier | Ce que c'est | Où le trouver dans l'app |
|---|---|---|
| `declic-dossier.sample.json` | Le **dossier exporté** en fin de parcours : profil calculé + 3 directions métier. | Bouton d'export sur `/result` (`app/result/page.tsx`, fonction `download`) |
| `declic-session.sample.json` | L'**état brut de la session** : chaque swipe, sa raison, les cartes générées. | `localStorage`, clé `declic-session-v1` (`lib/store.ts`) |

## Pour un CV : ce qui compte

**0. Le plus direct : `user`, `interviews` et `skillMatches`** dans `declic-dossier.sample.json`.

- `user` suit les champs `user` du contrat d'entrée de `docs/DOSSIER.md` : prénom, âge, code postal, ville, niveau d'études, situation, permis, mobilité. Chaque récit devient une entrée de `user.experience`, avec ses compétences ROME dans `competences`. `user.targetJobs` donne les métiers que le jeune a choisi de creuser. Les réponses libres qui ne rentrent dans aucun champ restent dans `user.raw`.
- `interviews[]` : un récit par **métier choisi** dans « Mes matchs ». Il contient :
  - `job.code` et `job.label` (code et intitulé ROME) ;
  - les expériences vécues sur lesquelles il s'appuie (`experiences[].card`, `experiences[].skill`) ;
  - les questions et réponses (`qa`). Une réponse vide = question passée.
- `skillMatches[]` : tout ce que le jeune a **déjà fait** (`card`), avec `reason` (souvent / une fois) et la compétence ROME prouvée (`skill`, ou `null` si aucune ne colle).
- Les réponses sont orales (écrites ou dictées) : à reformuler pour le CV, sans rien inventer.

**1. Le détail du vécu** : dans `declic-session.sample.json`.

- `skillMatches[]` : la même mémoire des matchs, avec l'id de la carte (`cardId`).
- `jobs.list[]` : les métiers proposés dans « Mes matchs ». Chacun a son code ROME, son accroche (`pitch`) et les cartes qui le soutiennent (`cardIds`).
- `responses[]` : chaque swipe. `reason: "deja-souvent"` ou `"deja-une-fois"` = le jeune l'a **déjà fait**.

  Exemple dans l'échantillon : « Réparer un vélo crevé » (déjà fait souvent) → compétence ROME *Réparer un équipement, une machine, une installation* → métier proposé *Mécanicien / Mécanicienne cycles* → récit.

**2. Les intérêts** : `profile.confirmed` (domaines validés par le jeune), `profile.code` (code Holland à 3 lettres), `profile.domains[id].mean` (0–1).

**3. Le style de travail** : `profile.traits` (5 spectres, `mean` de −1 à 1 ; `confidence` 0–1).

**4. Les pistes métier** : `directions[].jobs[]` avec le code ROME, les preuves (`evidence`, textes de cartes) et les points de friction.

## Pièges

- **Les textes des cartes de la banque ne sont pas dans les JSON** : seuls leurs ids le sont (`reparer-velo`…). Les textes sont dans `content/cards.ts`. Les cartes générées, elles, ont leur texte dans `generated[]`.
- `profile.domains[id].likedCards` contient des **ids**, pas des textes.
- Les raisons d'un « non » ne sont pas des rejets : `jamais-essaye`, `pas-les-moyens`, `pas-pres`, `pas-capable` = pas eu l'occasion ou barrière d'accès. Seul `pas-mon-truc` (ou un non sans raison) est un vrai « pas intéressé ».
- Le dossier exporté contient le vécu **raconté** (`interviews`), mais pas les raisons de chaque swipe : celles-ci sont dans la session.
- Rien de tout ça n'est une évaluation de la personne : c'est une affinité de profil, à faire valider par le jeune.

## Valeurs de `reason`

| Valeur | Geste | Sens |
|---|---|---|
| `deja-souvent` | oui | déjà fait souvent |
| `deja-une-fois` | oui | déjà fait au moins une fois |
| `jamais-fait-mais-tente` | oui | ça tente, jamais fait |
| `pas-mon-truc` | non | pas intéressé |
| `jamais-essaye` | non | jamais essayé (pas un rejet) |
| `pas-les-moyens` / `pas-pres` / `pas-capable` | non | barrière d'accès ou de confiance (pas un rejet) |
