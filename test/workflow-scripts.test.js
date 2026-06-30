const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const rootDir = path.resolve(__dirname, "..");

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "omniverse-workflow-script-test-"));
}

function runScript(relativePath, args, cwd = tempDir()) {
  const output = execFileSync(
    process.execPath,
    [path.join(rootDir, relativePath), ...args],
    { cwd, encoding: "utf8" }
  ).trim();
  return { cwd, output };
}

test("plan script creates a durable plan template", () => {
  const { output } = runScript("skills/omniverse-plan/scripts/create-plan.js", ["Test Plan"]);

  assert.ok(fs.existsSync(output));
  const content = fs.readFileSync(output, "utf8");
  assert.match(content, /^# Test Plan/m);
  assert.match(content, /^## Validation/m);
});

test("compound script creates a solution-note template", () => {
  const { output } = runScript("skills/omniverse-compound/scripts/create-solution-note.js", [
    "Token Refresh Failure"
  ]);

  assert.ok(fs.existsSync(output));
  const content = fs.readFileSync(output, "utf8");
  assert.match(content, /^# Token Refresh Failure/m);
  assert.match(content, /^## Root Cause/m);
});

test("browser QA and proof scripts create report templates", () => {
  const qa = runScript("skills/omniverse-test-browser/scripts/create-browser-qa-report.js", [
    "Signup Flow",
    "--url",
    "http://localhost:3000/signup"
  ]);
  assert.ok(fs.existsSync(qa.output));
  assert.match(fs.readFileSync(qa.output, "utf8"), /http:\/\/localhost:3000\/signup/);

  const proof = runScript("skills/omniverse-proof/scripts/create-proof-packet.js", [
    "Comment Reply Safety"
  ]);
  assert.ok(fs.existsSync(proof.output));
  assert.match(fs.readFileSync(proof.output, "utf8"), /^## Claims/m);
});

test("git summary script prints status sections", () => {
  const output = execFileSync(
    process.execPath,
    [path.join(rootDir, "skills/omniverse-commit/scripts/git-change-summary.js")],
    { cwd: rootDir, encoding: "utf8" }
  );

  assert.match(output, /## Branch/);
  assert.match(output, /## Status/);
  assert.match(output, /## Unstaged Diff Stat/);
  assert.match(output, /## Staged Diff Stat/);
});
