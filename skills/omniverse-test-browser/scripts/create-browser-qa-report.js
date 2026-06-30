#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-") || "browser-qa";
}

function parseArgs(argv) {
  const options = { dir: "docs/qa", title: null, url: "" };
  const args = [...argv];

  while (args.length > 0) {
    const arg = args.shift();
    if (arg === "--dir") {
      options.dir = args.shift();
    } else if (arg === "--url") {
      options.url = args.shift() || "";
    } else if (!options.title) {
      options.title = arg;
    } else {
      options.title += ` ${arg}`;
    }
  }

  if (!options.title) {
    throw new Error("Usage: create-browser-qa-report.js <title> [--url http://localhost:3000] [--dir docs/qa]");
  }

  return options;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const date = new Date().toISOString().slice(0, 10);
  const outputDir = path.resolve(process.cwd(), options.dir);
  const outputPath = path.join(outputDir, `${date}-${slugify(options.title)}.md`);

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(
    outputPath,
    `# ${options.title}

Date: ${date}
URL: ${options.url}

## Scenarios

- [ ] Happy path
- [ ] Empty state
- [ ] Loading state
- [ ] Error state
- [ ] Mobile viewport

## Findings

| Severity | Area | Evidence | Recommendation |
| --- | --- | --- | --- |

## Console And Network Notes

## Screenshots
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
