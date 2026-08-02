#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
PORTFOLIO="${PORTFOLIO_PATH:-"$ROOT/../Portfolio"}"
TARGET="$PORTFOLIO/public/apps/stylophone-visualiser"

if ! git -C "$PORTFOLIO" rev-parse --show-toplevel >/dev/null 2>&1; then
  echo "Portfolio repository not found at: $PORTFOLIO" >&2
  echo "Set PORTFOLIO_PATH to override the sibling-repository path." >&2
  exit 1
fi

echo "Building Stylophone for /apps/stylophone-visualiser..."
(
  cd "$ROOT"
  VITE_BASE_PATH=/apps/stylophone-visualiser/ npm run build
)

mkdir -p "$TARGET"
rsync -a --delete "$ROOT/dist/" "$TARGET/"

echo "Synced build to: $TARGET"
echo
echo "Commit and push Portfolio to publish it:"
printf '  git -C %q add public/apps/stylophone-visualiser\n' "$PORTFOLIO"
printf '  git -C %q commit -m "chore: update Stylophone build"\n' "$PORTFOLIO"
printf '  git -C %q push\n' "$PORTFOLIO"
