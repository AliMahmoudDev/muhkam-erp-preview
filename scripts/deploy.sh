#!/usr/bin/env bash
# deploy.sh — Stage, commit (if needed), and push to GitHub → triggers auto-deploy to Hetzner VPS
set -euo pipefail

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🚀  MUHKAM ERP — Deploy to Production"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── 1. Check git identity ────────────────────────────────
if ! git config user.email > /dev/null 2>&1; then
  git config user.email "deploy@muhkam.app"
  git config user.name  "Muhkam Deploy"
fi

# ── 2. Stage all changes ─────────────────────────────────
git add -A

# ── 3. Commit only if there are staged changes ───────────
if git diff --cached --quiet; then
  echo "✅  Working tree is clean — no new changes to commit."
else
  # Auto-generate a descriptive commit message from changed files
  CHANGED=$(git diff --cached --name-only | head -5 | sed 's|artifacts/[^/]*/src/||' | paste -sd ', ' -)
  TIMESTAMP=$(date '+%Y-%m-%d %H:%M')
  MSG="deploy: ${CHANGED} — ${TIMESTAMP}"

  git commit -m "$MSG"
  echo "📦  Committed: $MSG"
fi

# ── 4. Push (pre-push hook runs lint + type-check + tests) ──
UNPUSHED=$(git log origin/main..HEAD --oneline 2>/dev/null | wc -l | tr -d ' ')

if [ "$UNPUSHED" -eq "0" ]; then
  echo "✅  Already up to date with origin/main — nothing to push."
  echo ""
  echo "  halaltec.com is already running the latest code."
  echo ""
  exit 0
fi

echo "📤  Pushing $UNPUSHED commit(s) to GitHub..."
echo "    (lint + type-check + tests run automatically before push)"
echo ""

git push origin main

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅  Push successful!"
echo ""
echo "  GitHub Actions is now deploying to halaltec.com"
echo "  Track progress:"
echo "  https://github.com/m4elmelegy-hub/MUHKAM-ERP/actions"
echo ""
echo "  Estimated deploy time: ~10-15 minutes"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
