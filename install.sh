#!/usr/bin/env bash
set -euo pipefail

TARGET_DIR="${1:-.agents/skills}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILLS_DIR="$SCRIPT_DIR/skills"

if [[ ! -d "$SKILLS_DIR" ]]; then
  echo "Error: skills directory not found at $SKILLS_DIR" >&2
  exit 1
fi

mkdir -p "$TARGET_DIR"

for skill_dir in "$SKILLS_DIR"/*; do
  [[ -d "$skill_dir" ]] || continue
  cp -R "$skill_dir" "$TARGET_DIR/"
done

echo "Installed skills from $SKILLS_DIR into $TARGET_DIR"
