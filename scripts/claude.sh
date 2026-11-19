#!/usr/bin/env bash
# Ouvre Claude Code (CLI local) pour se connecter et générer des cartes/dossiers.
# Aucun chemin n'est codé en dur : CLAUDE_BIN, PATH, emplacements usuels,
# puis l'extension VS Code.
set -euo pipefail

if [ -n "${CLAUDE_BIN:-}" ]; then
  exec "$CLAUDE_BIN" "$@"
fi

for candidate in \
  "$HOME/.local/bin/claude" \
  "$HOME/.claude/local/claude" \
  "$HOME/.npm-global/bin/claude" \
  "$HOME/bin/claude" \
  "/opt/homebrew/bin/claude" \
  "/usr/local/bin/claude"; do
  if [ -x "$candidate" ]; then
    exec "$candidate" "$@"
  fi
done

shopt -s nullglob
for candidate in "$HOME"/.vscode/extensions/anthropic.claude-code-*/resources/native-binary/claude; do
  if [ -x "$candidate" ]; then
    exec "$candidate" "$@"
  fi
done

echo "Claude Code introuvable." >&2
echo "Installe-le, ou définis CLAUDE_BIN=/chemin/vers/claude." >&2
exit 1
