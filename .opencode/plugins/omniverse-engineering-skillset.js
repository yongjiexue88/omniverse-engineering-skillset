const path = require("node:path");

const pluginDir = __dirname;
const skillsDir = path.resolve(pluginDir, "../../skills");

const OmniverseEngineeringSkillsetPlugin = async () => ({
  config: async (config) => {
    config.skills = config.skills || {};
    config.skills.paths = config.skills.paths || [];
    if (!config.skills.paths.includes(skillsDir)) {
      config.skills.paths.push(skillsDir);
    }
  }
});

module.exports = OmniverseEngineeringSkillsetPlugin;
module.exports.OmniverseEngineeringSkillsetPlugin = OmniverseEngineeringSkillsetPlugin;
