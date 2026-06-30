#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-") || "plan";
}

function parseArgs(argv) {
  const options = { dir: "docs/plans", force: false, title: null };
  const args = [...argv];

  while (args.length > 0) {
    const arg = args.shift();
    if (arg === "--dir") {
      options.dir = args.shift();
    } else if (arg === "--force") {
      options.force = true;
    } else if (!options.title) {
      options.title = arg;
    } else {
      options.title += ` ${arg}`;
    }
  }

  if (!options.title) {
    throw new Error("Usage: create-plan.js <title> [--dir docs/plans] [--force]");
  }

  return options;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const date = new Date().toISOString().slice(0, 10);
  const outputDir = path.resolve(process.cwd(), options.dir);
  const outputPath = path.join(outputDir, `${date}-${slugify(options.title)}.md`);

  fs.mkdirSync(outputDir, { recursive: true });
  if (fs.existsSync(outputPath) && !options.force) {
    throw new Error(`Refusing to overwrite ${outputPath}. Pass --force to replace it.`);
  }

  const content = `# ${options.title}

Date: ${date}

## Goal

## Current State

## Constraints

## Steps

- [ ] 

## Validation

## Risks

## Rollback
`;

  fs.writeFileSync(outputPath, content);
  console.log(outputPath);
}

try {
  main();
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exit(1);
}
