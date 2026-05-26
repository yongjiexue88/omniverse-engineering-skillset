const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const cliPath = path.resolve(__dirname, "../bin/engineering-agent-skills.js");
const postinstallPath = path.resolve(__dirname, "../scripts/postinstall.js");
const {
  install,
  resolveTargetDir
} = require("../bin/engineering-agent-skills.js");
const { shouldSkipAutoInstall } = require("../scripts/postinstall.js");

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "engineering-agent-skills-test-"));
}

function envWithoutInitCwd(extra = {}) {
  const env = { ...process.env };
  delete env.INIT_CWD;
  return { ...env, ...extra };
}

function skillPath(baseDir, target = ".agents/skills") {
  return path.join(baseDir, target, "engineering-agent-skills", "SKILL.md");
}

test("CLI default install creates .agents/skills under the current directory", () => {
  const baseDir = tempDir();

  const output = execFileSync(process.execPath, [cliPath, "install"], {
    cwd: baseDir,
    env: envWithoutInitCwd(),
    encoding: "utf8"
  });

  const expectedSkill = skillPath(baseDir);
  const expectedDestination = fs.realpathSync(path.dirname(expectedSkill));
  assert.ok(fs.existsSync(expectedSkill));
  assert.match(output, new RegExp(expectedDestination.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("INIT_CWD controls the install base when cwd differs", () => {
  const invocationDir = tempDir();
  const otherCwd = tempDir();

  execFileSync(process.execPath, [cliPath, "install"], {
    cwd: otherCwd,
    env: envWithoutInitCwd({ INIT_CWD: invocationDir }),
    encoding: "utf8"
  });

  assert.ok(fs.existsSync(skillPath(invocationDir)));
  assert.equal(fs.existsSync(skillPath(otherCwd)), false);
});

test("absolute --target paths are not resolved against the install base", () => {
  const baseDir = tempDir();
  const absoluteTarget = path.join(tempDir(), "custom-skills");

  install({
    command: "install",
    skills: [],
    target: absoluteTarget,
    agent: null,
    baseDir
  });

  assert.ok(fs.existsSync(skillPath(path.dirname(absoluteTarget), path.basename(absoluteTarget))));
  assert.equal(fs.existsSync(skillPath(baseDir, absoluteTarget)), false);
});

test("--agent claude-code installs into .claude/skills", () => {
  const baseDir = tempDir();

  install({
    command: "install",
    skills: [],
    target: null,
    agent: "claude-code",
    baseDir
  });

  assert.ok(fs.existsSync(skillPath(baseDir, ".claude/skills")));
});

test("resolveTargetDir keeps absolute targets absolute", () => {
  const baseDir = tempDir();
  const absoluteTarget = path.join(tempDir(), "skills");

  assert.equal(resolveTargetDir(baseDir, absoluteTarget), absoluteTarget);
});

test("postinstall skip rules only cover explicit skip, global install, and missing INIT_CWD", () => {
  const originalSkip = process.env.ENGINEERING_AGENT_SKILLS_SKIP_AUTO_INSTALL;
  const originalGlobal = process.env.npm_config_global;

  try {
    delete process.env.ENGINEERING_AGENT_SKILLS_SKIP_AUTO_INSTALL;
    delete process.env.npm_config_global;
    assert.equal(shouldSkipAutoInstall(tempDir()), null);
    assert.equal(shouldSkipAutoInstall(null), "INIT_CWD is unavailable.");

    process.env.ENGINEERING_AGENT_SKILLS_SKIP_AUTO_INSTALL = "1";
    assert.equal(
      shouldSkipAutoInstall(tempDir()),
      "ENGINEERING_AGENT_SKILLS_SKIP_AUTO_INSTALL is set."
    );

    delete process.env.ENGINEERING_AGENT_SKILLS_SKIP_AUTO_INSTALL;
    process.env.npm_config_global = "true";
    assert.equal(shouldSkipAutoInstall(tempDir()), "global npm install detected.");
  } finally {
    if (originalSkip === undefined) {
      delete process.env.ENGINEERING_AGENT_SKILLS_SKIP_AUTO_INSTALL;
    } else {
      process.env.ENGINEERING_AGENT_SKILLS_SKIP_AUTO_INSTALL = originalSkip;
    }

    if (originalGlobal === undefined) {
      delete process.env.npm_config_global;
    } else {
      process.env.npm_config_global = originalGlobal;
    }
  }
});

test("postinstall installs into INIT_CWD even when package root is elsewhere", () => {
  const invocationDir = tempDir();

  execFileSync(process.execPath, [postinstallPath], {
    cwd: __dirname,
    env: envWithoutInitCwd({ INIT_CWD: invocationDir }),
    encoding: "utf8"
  });

  assert.ok(fs.existsSync(skillPath(invocationDir)));
});
