#!/usr/bin/env node

const path = require("node:path");

const packageRoot = path.resolve(__dirname, "..");
const packageJson = require(path.join(packageRoot, "package.json"));
const { install } = require("../bin/engineering-agent-skills.js");

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
      agent: null,
      baseDir: initCwd
    });
  } finally {
    process.chdir(previousCwd);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  main,
  shouldSkipAutoInstall
};
