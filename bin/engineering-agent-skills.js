#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const packageRoot = path.resolve(__dirname, "..");
const skillsRoot = path.join(packageRoot, "skills");
const packageJson = require(path.join(packageRoot, "package.json"));

const agentTargets = {
  universal: ".agents/skills",
  codex: ".agents/skills",
  cursor: ".agents/skills",
  "github-copilot": ".agents/skills",
  "claude-code": ".claude/skills",
  claude: ".claude/skills"
};

function usage() {
  console.log(`engineering-agent-skills ${packageJson.version}

Usage:
  engineering-agent-skills install [options]
  engineering-agent-skills list

Options:
  --skill <name>       Install one skill. Can be repeated. Defaults to all skills.
  --target <path>      Install into a custom skills directory. Defaults to .agents/skills.
  --agent <name>       Use a known agent target: universal, codex, claude-code, cursor.
                       Use "all" to install to all known unique targets.
  --help, -h           Show help.
  --version, -v        Show version.

Examples:
  npx engineering-agent-skills install
  npx engineering-agent-skills install --skill engineering-agent-skills
  npx engineering-agent-skills install --agent codex
  npx engineering-agent-skills install --agent claude-code
  npx engineering-agent-skills install --target .agents/skills
`);
}

function parseArgs(argv) {
  const options = {
    command: "install",
    skills: [],
    target: null,
    agent: null
  };

  const args = [...argv];
  if (args[0] && !args[0].startsWith("-")) {
    options.command = args.shift();
  }

  while (args.length > 0) {
    const arg = args.shift();
    if (arg === "--help" || arg === "-h") {
      options.command = "help";
    } else if (arg === "--version" || arg === "-v") {
      options.command = "version";
    } else if (arg === "--skill") {
      const value = args.shift();
      if (!value) throw new Error("--skill requires a value");
      options.skills.push(...value.split(",").filter(Boolean));
    } else if (arg === "--target") {
      const value = args.shift();
      if (!value) throw new Error("--target requires a value");
      options.target = value;
    } else if (arg === "--agent") {
      const value = args.shift();
      if (!value) throw new Error("--agent requires a value");
      options.agent = value;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  return options;
}

function listSkills() {
  return fs
    .readdirSync(skillsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((skillName) => fs.existsSync(path.join(skillsRoot, skillName, "SKILL.md")))
    .sort();
}

function resolveTargets(options) {
  if (options.target) {
    return [options.target];
  }

  if (!options.agent) {
    return [agentTargets.universal];
  }

  if (options.agent === "all" || options.agent === "*") {
    return [...new Set(Object.values(agentTargets))];
  }

  const target = agentTargets[options.agent];
  if (!target) {
    const knownAgents = Object.keys(agentTargets).sort().join(", ");
    throw new Error(`Unknown agent "${options.agent}". Use --target for a custom path. Known agents: ${knownAgents}`);
  }

  return [target];
}

function resolveInstallBaseDir(options = {}) {
  return path.resolve(options.baseDir || process.env.INIT_CWD || process.cwd());
}

function resolveTargetDir(baseDir, targetDir) {
  if (path.isAbsolute(targetDir)) {
    return path.resolve(targetDir);
  }

  return path.resolve(baseDir, targetDir);
}

function isSameOrInside(childPath, parentPath) {
  const relativePath = path.relative(parentPath, childPath);
  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}

function assertSafeInstallDestination(sourceDir, destinationDir) {
  const resolvedSource = path.resolve(sourceDir);
  const resolvedDestination = path.resolve(destinationDir);

  if (isSameOrInside(resolvedDestination, resolvedSource)) {
    throw new Error(
      `Refusing to install into the source skill directory: ${resolvedDestination}. ` +
        "Choose a target outside the package skills directory."
    );
  }

  if (isSameOrInside(resolvedSource, resolvedDestination)) {
    throw new Error(
      `Refusing to install into a parent of the source skill directory: ${resolvedDestination}. ` +
        "Choose a target outside the package source tree."
    );
  }
}

function installSkill(skillName, targetDir, baseDir = resolveInstallBaseDir()) {
  const sourceDir = path.join(skillsRoot, skillName);
  if (!fs.existsSync(path.join(sourceDir, "SKILL.md"))) {
    throw new Error(`Skill not found: ${skillName}`);
  }

  const destinationDir = path.join(resolveTargetDir(baseDir, targetDir), skillName);
  assertSafeInstallDestination(sourceDir, destinationDir);
  fs.mkdirSync(path.dirname(destinationDir), { recursive: true });
  fs.rmSync(destinationDir, { recursive: true, force: true });
  fs.cpSync(sourceDir, destinationDir, { recursive: true });
  return destinationDir;
}

function install(options) {
  const availableSkills = listSkills();
  const selectedSkills = options.skills.length > 0 ? options.skills : availableSkills;
  const targets = resolveTargets(options);
  const baseDir = resolveInstallBaseDir(options);

  for (const skillName of selectedSkills) {
    if (!availableSkills.includes(skillName)) {
      throw new Error(`Skill not found: ${skillName}. Available skills: ${availableSkills.join(", ")}`);
    }
  }

  const installed = [];
  for (const target of targets) {
    for (const skillName of selectedSkills) {
      installed.push(installSkill(skillName, target, baseDir));
    }
  }

  console.log(`Installed ${selectedSkills.length} skill(s) into ${targets.length} target(s):`);
  for (const destination of installed) {
    console.log(`- ${destination}`);
  }
}

function main() {
  try {
    const options = parseArgs(process.argv.slice(2));

    if (options.command === "help") {
      usage();
    } else if (options.command === "version") {
      console.log(packageJson.version);
    } else if (options.command === "list") {
      for (const skillName of listSkills()) {
        console.log(skillName);
      }
    } else if (options.command === "install") {
      install(options);
    } else {
      throw new Error(`Unknown command: ${options.command}`);
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  install,
  listSkills,
  resolveTargets,
  resolveInstallBaseDir,
  resolveTargetDir,
  installSkill
};
