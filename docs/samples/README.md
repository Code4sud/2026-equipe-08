# Échantillons de profil Orientis

Profil **fictif** (« manuel + tech »), calculé par le vrai code du projet (score, swipe adaptatif, matching) à partir d'une session de 24 swipes et des 15 paires de style. Les textes des 7 cartes adaptatives sont écrits à la main dans le style du LLM ; leurs cibles ROME viennent de l'algorithme. L'étape 2 (« Creuser ») contient deux expériences racontées : 3 questions chacune, réellement générées par le LLM, avec des réponses fictives (une question passée = réponse vide). Elle contient aussi 6 infos CV fictives, collectées au fil des deux récits (3 par récit). Le permis et la mobilité n'ont pas encore été demandés : ils l'auraient été au récit suivant. `user.constraints` est donc absent. C'est un cas normal, que le CV doit savoir gérer.

| Fichier | Ce que c'est | Où le trouver dans l'app |
|---|---|---|
| `declic-dossier.sample.json` | Le **dossier exporté** en fin de parcours : profil calculé + 3 directions métier. | Bouton d'export sur `/result` (`app/result/page.tsx`, fonction `download`) |
| `declic-session.sample.json` | L'**état brut de la session** : chaque swipe, sa raison, les cartes générées. | `localStorage`, clé `declic-session-v1` (`lib/store.ts`) |

## Pour un CV : ce qui compte

**0. Le plus direct : `user` et `interviews`** dans `declic-dossier.sample.json` (étape 2, « Creuser »).

- `user` suit les champs `user` du contrat d'entrée de `docs/DOSSIER.md` : prénom, âge, code postal, ville, niveau d'études, situation, permis, mobilité. Chaque expérience racontée devient une entrée de `user.experience`, avec sa compétence ROME dans `competences`. Les réponses libres qui ne rentrent dans aucun champ restent dans `user.raw`.
- `interviews[]` : pour chaque expérience creusée, la compétence ROME (`skill.code`, `skill.label`), la preuve (carte d'origine + question de vécu) et les questions / réponses (`qa`). Une réponse vide = question passée.
- Les réponses sont orales (écrites ou dictées) : à reformuler pour le CV, sans rien inventer.

**1. Le vécu (« déjà fait »)** : dans `declic-session.sample.json`, `responses[]`.

- `reason: "deja-souvent"` ou `"deja-une-fois"` sur une carte d'intérêt = le jeune l'a **déjà fait**.
- Une carte dont l'id commence par `gen-creuser-` pose une question de vécu (« Et c'est toi qui… ? ») : `direction: "right"` = **oui, c'est moi**, `"left"` = non (ni rejet, ni intérêt).
- La carte générée correspondante (`generated[]`, même `id`) porte la **compétence ROME** dans `target.label` (code OGR dans `target.macro`) et la carte d'origine dans `target.parentId`.

  Exemple dans l'échantillon : « Réparer un vélo crevé » (déjà fait souvent) → « Et c'est toi qui trouvais d'où venait la panne ? » → oui → compétence ROME *Réparer un équipement, une machine, une installation*.

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
