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
TARGET_DIR_ABS="$(cd "$TARGET_DIR" && pwd -P)"

for skill_dir in "$SKILLS_DIR"/*; do
  [[ -d "$skill_dir" ]] || continue
  skill_dir_abs="$(cd "$skill_dir" && pwd -P)"
  skill_name="$(basename "$skill_dir_abs")"
  destination="$TARGET_DIR_ABS/$skill_name"

  if [[ "$destination" == "$skill_dir_abs" || "$destination" == "$skill_dir_abs"/* ]]; then
    echo "Error: refusing to install into the source skill directory: $destination" >&2
    exit 1
  fi

  if [[ "$skill_dir_abs" == "$destination"/* ]]; then
    echo "Error: refusing to install into a parent of the source skill directory: $destination" >&2
    exit 1
  fi

  rm -rf "$destination"
  cp -R "$skill_dir_abs" "$TARGET_DIR_ABS/"
done

echo "Installed skills from $SKILLS_DIR into $TARGET_DIR_ABS"
