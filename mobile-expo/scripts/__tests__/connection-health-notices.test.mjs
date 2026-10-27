import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import { build } from "esbuild";

// Exercise the real component's rendered element tree without loading the broken
// Expo/RN Jest preset. Only native primitives and the theme hook are substituted.
const result = await build({
  entryPoints: ["client/components/ConnectionHealthNotices.tsx"],
  bundle: true,
  write: false,
  platform: "node",
  format: "cjs",
  external: ["react"],
  plugins: [{
    name: "native-component-test-adapters",
    setup(builder) {
      builder.onResolve({ filter: /^(react-native|@expo\/vector-icons|@\/hooks\/useTheme|@\/components\/ThemedText)$/ }, args => ({
        path: args.path, namespace: "test-adapter",
      }));
      builder.onLoad({ filter: /.*/, namespace: "test-adapter" }, ({ path }) => ({
        contents: path === "react-native"
          ? `export const View = "View", Pressable = "Pressable", ActivityIndicator = "ActivityIndicator"; export const StyleSheet = { create: value => value }; export const Platform = { OS: "ios", select: options => options.ios ?? options.default };`
          : path === "@expo/vector-icons"
            ? `export const Feather = "Icon";`
            : path === "@/components/ThemedText"
              ? `export const ThemedText = "Text";`
              : `export const useTheme = () => ({ theme: { primary: "#0066cc", text: "#111", textSecondary: "#555", warning: "#ff0", info: "#00f", buttonText: "#fff", backgroundDefault: "#fff" } });`,
      }));
    },
  }],
});
const module = { exports: {} };
new Function("require", "module", "exports", result.outputFiles[0].text)(
  createRequire(import.meta.url), module, module.exports,
);
const { ConnectionHealthNotices } = module.exports;

function nodes(element) {
  if (element == null || typeof element === "boolean") return [];
  if (Array.isArray(element)) return element.flatMap(nodes);
  return typeof element === "object"
    ? [element, ...nodes(element.props?.children)]
    : [element];
}
function render(health, props = {}) {
  return nodes(ConnectionHealthNotices({ health, onReconnect() {}, ...props }));
}
function text(tree) {
  return tree.filter(node => typeof node === "string").join(" ");
}
const connection = (sourceType, syncStatus, needsReauth = false, lastSyncedAt = null) =>
  ({ sourceType, syncStatus, needsReauth, lastSyncedAt });

test("active connections and empty health produce no warnings", () => {
  assert.deepEqual(render([]), []);
  assert.deepEqual(render([connection("cigna", "active")]), []);
});

test("reauth, explicit needsReauth, and other stale statuses offer source-specific reconnection", () => {
  for (const [status, flag] of [["needs_reauth", false], ["active", true], ["stale", false], ["error", true]]) {
    let selected;
    const tree = render([connection("cigna", status, flag)], {
      onReconnect: source => { selected = source; },
    });
    assert.match(text(tree), /Reconnect needed/);
    const button = tree.find(node => node.props?.testID === "reconnect-cigna");
    assert.equal(button.props.accessibilityLabel, "Reconnect Cigna");
    button.props.onPress();
    assert.equal(selected, "cigna");
  }
});

test("transient errors do not blame the patient or offer a reconnect action", () => {
  const tree = render([connection("epic", "error")]);
  assert.match(text(tree), /Sync temporarily unavailable/);
  assert.match(text(tree), /You do not need to reconnect/);
  assert.ok(!tree.some(node => node.props?.testID === "reconnect-epic"));
});

test("mixed source health retains each affected source without flagging active sources", () => {
  const tree = render([
    connection("cigna", "needs_reauth"),
    connection("epic", "error"),
    connection("aetna", "active"),
  ]);
  assert.match(text(tree), /Cigna/);
  assert.match(text(tree), /Epic/);
  assert.doesNotMatch(text(tree), /Aetna/);
});

test("unavailable connection service replaces the action with an explicit message", () => {
  const tree = render([connection("cigna", "needs_reauth")], { canReconnect: false });
  assert.match(text(tree), /Reconnecting is currently unavailable/);
  assert.ok(!tree.some(node => node.props?.testID === "reconnect-cigna"));
});

test("pending reconnection disables all actions and exposes busy state for selected source", () => {
  const tree = render([
    connection("cigna", "needs_reauth"), connection("epic", "needs_reauth"),
  ], { reconnectingSource: "cigna" });
  const actions = tree.filter(node => node.props?.testID?.startsWith("reconnect-"));
  assert.equal(actions.length, 2);
  assert.ok(actions.every(node => node.props.disabled));
  assert.equal(actions[0].props.accessibilityState.busy, true);
  assert.equal(actions[1].props.accessibilityState.busy, false);
});

test("valid last-sync timestamps are shown but invalid or absent timestamps are omitted", () => {
  assert.match(text(render([connection("cigna", "needs_reauth", true, "2026-10-20T12:00:00Z")])), /Last synced/);
  for (const timestamp of [null, "invalid"]) {
    assert.doesNotMatch(text(render([connection("cigna", "needs_reauth", true, timestamp)])), /Last synced|Invalid Date/);
  }
});
