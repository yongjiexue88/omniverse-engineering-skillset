const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const cliPath = path.resolve(__dirname, "../bin/omniverse-engineering-skillset.js");
const postinstallPath = path.resolve(__dirname, "../scripts/postinstall.js");
const {
  install,
  listSkills,
  resolveTargetDir
} = require("../bin/omniverse-engineering-skillset.js");
const { shouldSkipAutoInstall } = require("../scripts/postinstall.js");

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "omniverse-engineering-skillset-test-"));
}

function envWithoutInitCwd(extra = {}) {
  const env = { ...process.env };
  delete env.INIT_CWD;
  return { ...env, ...extra };
}

function skillPath(baseDir, target = ".agents/skills") {
  return path.join(baseDir, target, "omniverse-engineering-skillset", "SKILL.md");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

test("repo exposes the skill in the standard npx skills discovery layout", () => {
  const discoveredSkills = listSkills();
  assert.deepEqual(discoveredSkills, ["omniverse-engineering-skillset"]);

  for (const skillName of discoveredSkills) {
    const skillFile = path.resolve(__dirname, "../skills", skillName, "SKILL.md");
    const source = fs.readFileSync(skillFile, "utf8");
    const frontmatter = source.match(/^---\n([\s\S]*?)\n---/);

    assert.ok(frontmatter, `${skillName} is missing YAML frontmatter`);
    assert.match(frontmatter[1], new RegExp(`^name:\\s*${escapeRegExp(skillName)}\\s*$`, "m"));
    assert.match(frontmatter[1], /^description:\s*\S.+$/m);
  }
});

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
  assert.match(output, new RegExp(escapeRegExp(expectedDestination)));
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
  const originalSkip = process.env.OMNIVERSE_ENGINEERING_SKILLSET_SKIP_AUTO_INSTALL;
  const originalGlobal = process.env.npm_config_global;

  try {
    delete process.env.OMNIVERSE_ENGINEERING_SKILLSET_SKIP_AUTO_INSTALL;
    delete process.env.npm_config_global;
    assert.equal(shouldSkipAutoInstall(tempDir()), null);
    assert.equal(shouldSkipAutoInstall(null), "INIT_CWD is unavailable.");

    process.env.OMNIVERSE_ENGINEERING_SKILLSET_SKIP_AUTO_INSTALL = "1";
    assert.equal(
      shouldSkipAutoInstall(tempDir()),
      "OMNIVERSE_ENGINEERING_SKILLSET_SKIP_AUTO_INSTALL is set."
    );

    delete process.env.OMNIVERSE_ENGINEERING_SKILLSET_SKIP_AUTO_INSTALL;
    process.env.npm_config_global = "true";
    assert.equal(shouldSkipAutoInstall(tempDir()), "global npm install detected.");
  } finally {
    if (originalSkip === undefined) {
      delete process.env.OMNIVERSE_ENGINEERING_SKILLSET_SKIP_AUTO_INSTALL;
    } else {
      process.env.OMNIVERSE_ENGINEERING_SKILLSET_SKIP_AUTO_INSTALL = originalSkip;
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
