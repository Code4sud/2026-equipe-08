# Démo locale — machine de présentation

> La version Vercel est une vitrine. La démo importante tourne **en local**,
> avec `claude -p` pour le swipe adaptatif et la rédaction du dossier.

## 1. Prérequis

- Node.js 20+ et npm
- Le dépôt cloné
- Claude Code installé et **connecté** (optionnel : sans lui, le dossier reste complet en mode mock)

```bash
npm install
cp .env.example .env.local
```

Pour activer l'IA locale, dans `.env.local` :

```bash
LLM_BACKEND=cli
# LLM_MODEL=sonnet
```

## 2. Connecter Claude Code

Le binaire peut être :

- dans le `PATH` (`claude`) ;
- dans `~/.local/bin/claude` ou `~/.claude/local/claude` ;
- dans l'extension VS Code `anthropic.claude-code-*` ;
- ailleurs : renseigne `CLAUDE_BIN=/chemin/vers/claude`.

Le helper du projet cherche tous ces emplacements :

```bash
npm run claude
```

Dans la session interactive, connecte-toi (`/login` ou le prompt proposé),
puis quitte. Test rapide :

```bash
npm run claude -- -p "Réponds uniquement: ok"
```

Si tu vois `OAuth session expired`, reconnecte-toi : c'est le seul blocage
possible côté IA.

## 3. Lancer

```bash
npm run dev
```

- `/` accueil
- `/deck` swipe
- `/style` 5 spectres
- `/dossier` **la page à montrer**
- `/demo` panneau de préparation de la démo

## 4. Préparer la démo en 20 secondes

1. Ouvrir `/demo`
2. Cliquer **Charger le persona + dossier**
3. Cliquer **Demander ma position** → *Autoriser (Nice)*
4. Cliquer **Tester Claude** :
   - `Claude répond.` → la rédaction IA marche
   - `OAuth session expired` → relancer `npm run claude` et se reconnecter
5. Ouvrir `/dossier` : le dossier démo est complet même sans IA
6. Sur `/dossier`, cliquer **Générer avec Claude** pour remplacer les textes
   déterministes par la rédaction locale (10–30 s)

## 5. Ce qui est simulé

- Offres et formations : **Nice**, jeu de démonstration (`content/demo/`), pas des offres réelles.
- Géolocalisation : simulation, aucune position réelle demandée.
- Les textes déterministes restent affichés si Claude échoue : la démo ne casse pas.

## 6. Vercel

- Ne pas définir `LLM_BACKEND=cli` sur Vercel : il n'y a pas de CLI.
- Sans variable, le backend est `mock` : le dossier fonctionne avec les textes
  déterministes et les cartes pré-écrites.
- Le projet Vercel est lié en CLI ; un `git push` ne redéploie pas. Utiliser
  `vercel deploy --prod --yes` après un changement.
