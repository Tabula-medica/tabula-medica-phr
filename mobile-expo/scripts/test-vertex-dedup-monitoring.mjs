import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { configuration, apply } from "./setup-vertex-dedup-monitoring.mjs";

const project = "united-planet-485003-n7";
const channel = `projects/${project}/notificationChannels/123456`;
const config = () => configuration(project, channel);

test("counter targets production degraded errors and both logger transports without PHI labels", () => {
  const { metric, policy } = config();
  for (const text of ['resource.type="cloud_run_revision"', 'service_name="tabula-medica-web"',
    'location="us-central1"', `project_id="${project}"`, "severity>=ERROR",
    'jsonPayload.level="error"', "jsonPayload.message:", "textPayload:", "[VertexDedup] AI matching DEGRADED"]) {
    assert.ok(metric.filter.includes(text), text);
  }
  assert.deepEqual(metric.metricDescriptor, { metricKind: "DELTA", valueType: "INT64", unit: "1" });
  assert.equal(metric.labelExtractors, undefined);
  assert.ok(policy.conditions[0].conditionThreshold.filter.includes(`logging.googleapis.com/user/${metric.name}`));
  assert.deepEqual(policy.notificationChannels, [channel]);
});

test("one event opens a service-wide alert; silence closes without claiming recovery", () => {
  const { policy } = config();
  const condition = policy.conditions[0].conditionThreshold;
  assert.equal(policy.enabled, true);
  assert.equal(condition.thresholdValue, 0);
  assert.equal(condition.comparison, "COMPARISON_GT");
  assert.equal(condition.duration, "60s");
  assert.equal(condition.evaluationMissingData, "EVALUATION_MISSING_DATA_INACTIVE");
  assert.deepEqual(condition.aggregations, [{
    alignmentPeriod: "300s", perSeriesAligner: "ALIGN_SUM",
    crossSeriesReducer: "REDUCE_SUM", groupByFields: [],
  }]);
  assert.equal(policy.alertStrategy.autoClose, "1800s");
  assert.match(policy.documentation.content, /NOT confirmed AI recovery/);
  const source = readFileSync(new URL("../server/vertex-deduplication-service.ts", import.meta.url), "utf8");
  assert.match(source, /logger\.error\("\[VertexDedup\] AI matching DEGRADED:/);
});

test("rejects invalid project and cross-project notification channels", () => {
  assert.throws(() => configuration(project, "projects/other-project/notificationChannels/123"));
  assert.throws(() => configuration('bad"project', channel));
});

function fakeRun({ existing = false, wrongChannel = false, failure = false, duplicates = false } = {}) {
  const calls = [];
  const files = [];
  const run = args => {
    calls.push(args);
    if (args[1] === "channels") {
      assert.ok(args.some(a => a === "--format=json(name,type,enabled,labels.channel_name)"));
      return { type: "slack", enabled: true, labels: { channel_name: wrongChannel ? "#wrong" : "#engineering" } };
    }
    if (failure) throw new Error("permission denied");
    if (args[2] === "list") {
      if (args[1] === "metrics") return existing ? [{ name: config().metric.name }] : [];
      const policy = { name: `projects/${project}/alertPolicies/42`, userLabels: { managed_by: "vertex-dedup-backstop" } };
      return duplicates ? [policy, policy] : existing ? [policy] : [];
    }
    const file = args.find(a => /--(config|policy)-from-file=/.test(a)).split("=")[1];
    files.push(file);
    JSON.parse(readFileSync(file, "utf8"));
    return {};
  };
  return { calls, files, run };
}

for (const existing of [false, true]) {
  test(existing ? "re-running updates managed resources" : "first run creates metric before policy", () => {
    const fake = fakeRun({ existing });
    apply(project, "#engineering", config(), fake.run);
    const writes = fake.calls.filter(a => ["create", "update"].includes(a[2]));
    assert.deepEqual(writes.map(a => a.slice(0, 3)), [
      ["logging", "metrics", existing ? "update" : "create"],
      ["monitoring", "policies", existing ? "update" : "create"],
    ]);
    assert.equal(fake.files.length, 2);
    assert.ok(fake.files.every(file => !existsSync(file)));
  });
}

for (const options of [{ wrongChannel: true }, { failure: true }, { duplicates: true }]) {
  test(`fails closed before writes: ${JSON.stringify(options)}`, () => {
    const fake = fakeRun(options);
    assert.throws(() => apply(project, "#engineering", config(), fake.run));
    assert.ok(fake.calls.every(a => !["create", "update"].includes(a[2])));
  });
}

test("CLI dry run is local and requires explicit channel selection", () => {
  const script = new URL("./setup-vertex-dedup-monitoring.mjs", import.meta.url);
  const result = spawnSync(process.execPath, [script.pathname, "--channel", channel], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Dry run only/);
  const missing = spawnSync(process.execPath, [script.pathname], { encoding: "utf8" });
  assert.equal(missing.status, 1);
});

test("failed policy writes are surfaced and temporary config files are removed", () => {
  const fake = fakeRun();
  assert.throws(() => apply(project, "#engineering", config(), args => {
    const result = fake.run(args);
    if (args[1] === "policies" && args[2] === "create") throw new Error("policy write failed");
    return result;
  }), /policy write failed/);
  assert.equal(fake.files.length, 2);
  assert.ok(fake.files.every(file => !existsSync(file)));
});
