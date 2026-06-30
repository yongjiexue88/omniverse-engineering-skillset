#!/usr/bin/env node

const { execFileSync } = require("node:child_process");

function runGit(args) {
  try {
    return execFileSync("git", args, { encoding: "utf8" }).trim();
  } catch (error) {
    return `git ${args.join(" ")} failed: ${error.message}`;
  }
}

function section(title, content) {
  console.log(`## ${title}`);
  console.log(content || "(none)");
  console.log("");
}

section("Branch", runGit(["branch", "--show-current"]));
section("Status", runGit(["status", "--short"]));
section("Unstaged Diff Stat", runGit(["diff", "--stat"]));
section("Staged Diff Stat", runGit(["diff", "--cached", "--stat"]));
