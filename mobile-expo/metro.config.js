const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

const exclusionList = config.resolver.blockList || [];

// ─── Existing source-tree exclusions ──────────────────────────────────────────
// Keeps the mobile Metro bundler from touching server-side code, the Vite web
// workspace, build artefacts and tooling directories.
const sourceExclusions = [
  new RegExp(path.resolve(__dirname, 'server').replace(/[/\\]/g, '[/\\\\]') + '[/\\\\].*'),
  new RegExp(path.resolve(__dirname, 'server_dist').replace(/[/\\]/g, '[/\\\\]') + '[/\\\\].*'),
  new RegExp(path.resolve(__dirname, 'drizzle').replace(/[/\\]/g, '[/\\\\]') + '[/\\\\].*'),
  new RegExp(path.resolve(__dirname, 'scripts').replace(/[/\\]/g, '[/\\\\]') + '[/\\\\].*'),
  new RegExp(path.resolve(__dirname, '.local').replace(/[/\\]/g, '[/\\\\]') + '[/\\\\].*'),
  new RegExp(path.resolve(__dirname, 'tmp').replace(/[/\\]/g, '[/\\\\]') + '[/\\\\].*'),
  // web/ is the Vite SPA workspace — its React 18 tree and node_modules must
  // never be resolved by Metro (which bundles the React 19 / RN mobile app).
  new RegExp(path.resolve(__dirname, 'web').replace(/[/\\]/g, '[/\\\\]') + '[/\\\\].*'),
];

// ─── Native-platform directory exclusions (inotify watch budget) ───────────────
// Metro's FallbackWatcher opens an fs.watch() handle on every directory it
// traverses.  On Replit the inotify limit is 65 536 handles; native platform
// subdirectories inside node_modules can exhaust the budget and crash Metro
// with ENOSPC.  Blocking these patterns prevents the walker from descending
// into directories that contain no JS modules we need to resolve or watch.
const nm = path.resolve(__dirname, 'node_modules').replace(/[/\\]/g, '[/\\\\]');
const nativeExclusions = [
  // Android Gradle / Maven artefacts
  new RegExp(`${nm}[/\\\\][^/\\\\]+[/\\\\]android[/\\\\].*`),
  new RegExp(`${nm}[/\\\\][^/\\\\]+[/\\\\]local-maven-repo[/\\\\].*`),
  // iOS CocoaPods / Xcode source trees
  new RegExp(`${nm}[/\\\\][^/\\\\]+[/\\\\]ios[/\\\\].*`),
  // Rust/C++ build outputs bundled by some RN packages
  new RegExp(`${nm}[/\\\\][^/\\\\]+[/\\\\]cpp[/\\\\].*`),
  // SPM (Swift Package Manager) manifests / checkouts
  new RegExp(`${nm}[/\\\\][^/\\\\]+[/\\\\]spm[/\\\\].*`),
  // Gradle wrapper caches
  new RegExp(`${nm}[/\\\\][^/\\\\]+[/\\\\]\\.gradle[/\\\\].*`),
  // Example / test apps embedded in packages
  new RegExp(`${nm}[/\\\\][^/\\\\]+[/\\\\]example[/\\\\].*`),
  new RegExp(`${nm}[/\\\\][^/\\\\]+[/\\\\]__tests__[/\\\\].*`),
  new RegExp(`${nm}[/\\\\][^/\\\\]+[/\\\\]e2e[/\\\\].*`),
];

const allExclusions = Array.isArray(exclusionList)
  ? [...exclusionList, ...sourceExclusions, ...nativeExclusions]
  : [exclusionList, ...sourceExclusions, ...nativeExclusions];

config.resolver.blockList = allExclusions;

config.watcher = {
  ...config.watcher,
  healthCheck: {
    enabled: false,
  },
  watchman: {
    deferStates: ['hg.update'],
  },
};

config.server = {
  ...config.server,
  rewriteRequestUrl: (url) => {
    return url;
  },
};

module.exports = config;
