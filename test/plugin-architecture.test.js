const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const rootDir = path.resolve(__dirname, "..");
const packageJson = readJson("package.json");

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), "utf8"));
}

function assertPathExists(relativePath) {
  assert.ok(
    fs.existsSync(path.join(rootDir, relativePath)),
    `${relativePath} should exist`
  );
}

test("Codex plugin manifest mirrors package metadata and references existing assets", () => {
  const manifest = readJson(".codex-plugin/plugin.json");

  assert.equal(manifest.name, packageJson.name);
  assert.equal(manifest.version, packageJson.version);
  assert.equal(manifest.description, packageJson.description);
  assert.equal(manifest.skills, "./skills/");
  assert.equal(manifest.interface.displayName, "Omniverse Engineering Skillset");

  assertPathExists("skills/omniverse-engineering-skillset/SKILL.md");
  assertPathExists(manifest.interface.composerIcon.replace("./", ""));
  assertPathExists(manifest.interface.logo.replace("./", ""));
});

test("platform plugin manifests use the package name and version", () => {
  const manifestPaths = [
    ".agy/plugin.json",
    ".claude-plugin/plugin.json",
    ".cursor-plugin/plugin.json",
    ".kimi-plugin/plugin.json"
  ];

  for (const manifestPath of manifestPaths) {
    const manifest = readJson(manifestPath);
    assert.equal(manifest.name, packageJson.name, `${manifestPath} name`);
    assert.equal(manifest.version, packageJson.version, `${manifestPath} version`);
  }
});

test("repo-local marketplaces point at the renamed package", () => {
  const codexMarketplace = readJson(".agents/plugins/marketplace.json");
  assert.equal(codexMarketplace.plugins[0].name, packageJson.name);
  assert.equal(
    codexMarketplace.plugins[0].source.url,
    "https://github.com/yongjiexue88/omniverse-engineering-skillset.git"
  );

  const claudeMarketplace = readJson(".claude-plugin/marketplace.json");
  assert.equal(claudeMarketplace.plugins[0].name, packageJson.name);

  const cursorMarketplace = readJson(".cursor-plugin/marketplace.json");
  assert.equal(cursorMarketplace.plugins[0].name, packageJson.name);

  const kimiMarketplace = readJson(".kimi-plugin/marketplace.json");
  assert.equal(kimiMarketplace.plugins[0].id, packageJson.name);
});
