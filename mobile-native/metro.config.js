// Metro config — extends the Expo default. We add the repo root and the
// shared local native module (`../modules/expo-cac-reader`) to the watch
// folders so Metro can resolve the CAC reader package that lives outside
// this app directory.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const repoRoot = path.resolve(projectRoot, "..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [path.resolve(repoRoot, "modules")];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(repoRoot, "node_modules"),
];

module.exports = config;
