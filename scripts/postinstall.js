#!/usr/bin/env node

const path = require("node:path");

const packageRoot = path.resolve(__dirname, "..");
const packageJson = require(path.join(packageRoot, "package.json"));
const { install } = require("../bin/engineering-agent-skills.js");

function isSameOrInside(childPath, parentPath) {
  const relativePath = path.relative(parentPath, childPath);
  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}

function shouldSkipAutoInstall(initCwd) {
  if (process.env.ENGINEERING_AGENT_SKILLS_SKIP_AUTO_INSTALL) {
    return "ENGINEERING_AGENT_SKILLS_SKIP_AUTO_INSTALL is set.";
  }

  if (process.env.npm_config_global === "true") {
    return "global npm install detected.";
  }

  if (!initCwd) {
    return "INIT_CWD is unavailable.";
  }

  const projectNodeModules = path.join(initCwd, "node_modules");
  if (!isSameOrInside(packageRoot, projectNodeModules)) {
    return "package is not installed under this project's node_modules.";
  }

  return null;
}

function main() {
  const initCwd = process.env.INIT_CWD ? path.resolve(process.env.INIT_CWD) : null;
  const skipReason = shouldSkipAutoInstall(initCwd);

  if (skipReason) {
    console.log(`[${packageJson.name}] Skipping automatic skill install: ${skipReason}`);
    return;
  }

  const previousCwd = process.cwd();
  process.chdir(initCwd);

  try {
    install({
      command: "install",
      skills: [],
      target: null,
      agent: null
    });
  } finally {
    process.chdir(previousCwd);
  }
}

main();
