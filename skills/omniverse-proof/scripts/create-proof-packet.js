#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-") || "proof";
}

function main() {
  const title = process.argv.slice(2).join(" ").trim();
  if (!title) {
    throw new Error("Usage: create-proof-packet.js <title>");
  }

  const date = new Date().toISOString().slice(0, 10);
  const outputDir = path.resolve(process.cwd(), "docs/proof");
  const outputPath = path.join(outputDir, `${date}-${slugify(title)}.md`);
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(
    outputPath,
    `# ${title}

Date: ${date}

## Claims

| Claim | Evidence | Result | Confidence |
| --- | --- | --- | --- |

## Commands

## Artifacts

## Residual Risk
`
  );
  console.log(outputPath);
}

try {
  main();
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exit(1);
}
