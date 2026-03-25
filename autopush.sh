#!/bin/bash
# autopush.sh — auto-commit and push any changes in ~/clawboard to GitHub
cd ~/clawboard || exit 1

# Check if there's anything to commit
if git diff --quiet && git diff --staged --quiet && [ -z "$(git status --porcelain)" ]; then
  exit 0  # nothing changed, skip silently
fi

git add -A
TIMESTAMP=$(date '+%Y-%m-%d %H:%M')
CHANGED=$(git diff --staged --name-only | head -5 | tr '\n' ', ' | sed 's/,$//')
git commit -m "Auto-sync $TIMESTAMP — $CHANGED" --no-gpg-sign 2>/dev/null
git push origin main 2>&1
