#!/usr/bin/env node
// Defaults to a local dry run. Never reads app credentials or Slack webhook secrets.
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const configDir = new URL("../infra/monitoring/", import.meta.url);
export function configuration(project, channel) {
  if (!/^[a-z][a-z0-9-]{4,61}[a-z0-9]$/.test(project)) throw new Error("Invalid GCP project ID");
  if (!new RegExp(`^projects/${project}/notificationChannels/[0-9]+$`).test(channel)) {
    throw new Error("Channel must be a full notification channel name in the selected project");
  }
  const metric = JSON.parse(readFileSync(new URL("vertex-dedup-degraded-metric.json", configDir)));
  metric.filter += `\nresource.labels.project_id="${project}"`;
  const policy = JSON.parse(readFileSync(new URL("vertex-dedup-degraded-policy.json", configDir)));
  policy.notificationChannels = [channel];
  return { metric, policy };
}

export function apply(project, slackChannel, config, run) {
  // Use a projection: full channel JSON can include Slack credentials.
  const channel = run(["monitoring", "channels", "describe", config.policy.notificationChannels[0],
    "--format=json(name,type,enabled,labels.channel_name)"]);
  if (channel.type !== "slack" || channel.enabled !== true ||
      channel.labels?.channel_name !== slackChannel) {
    throw new Error("Monitoring channel must be enabled Slack and match --slack-channel exactly");
  }
  // List first: permission/network failures must never be interpreted as "not found".
  const metrics = run(["logging", "metrics", "list", "--format=json(name)"]);
  const policies = run(["monitoring", "policies", "list", "--format=json(name,userLabels)"]);
  const existing = policies.filter(p => p.userLabels?.managed_by === "vertex-dedup-backstop");
  if (existing.length > 1) throw new Error("Multiple managed backstop policies found; reconcile before re-running");
  const directory = mkdtempSync(join(tmpdir(), "vertex-dedup-monitoring-"));
  try {
    const metricFile = join(directory, "metric.json");
    const policyFile = join(directory, "policy.json");
    writeFileSync(metricFile, JSON.stringify(config.metric), { mode: 0o600 });
    writeFileSync(policyFile, JSON.stringify(config.policy), { mode: 0o600 });
    run(["logging", "metrics", metrics.some(m => m.name === config.metric.name) ? "update" : "create",
      config.metric.name, `--config-from-file=${metricFile}`, "--format=json(name)"]);
    run(["monitoring", "policies", existing.length ? "update" : "create",
      ...(existing.length ? [existing[0].name] : []),
      `--policy-from-file=${policyFile}`, "--format=json(name)"]);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function main() {
  const args = process.argv.slice(2);
  const options = {};
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (key === "--apply") options.apply = true;
    else if (["--project", "--channel", "--slack-channel"].includes(key) && args[i + 1] && !args[i + 1].startsWith("--")) {
      options[key.slice(2)] = args[++i];
    } else throw new Error(`Unknown or incomplete argument: ${key}`);
  }
  const project = options.project || "united-planet-485003-n7";
  const config = configuration(project, options.channel || "");
  if (!options.apply) {
    console.log(JSON.stringify(config, null, 2));
    console.log("Dry run only. Use --apply --slack-channel '#engineering' after checking the destination.");
    return;
  }
  if (!options["slack-channel"]?.startsWith("#")) throw new Error("--slack-channel '#channel' is required with --apply");
  apply(project, options["slack-channel"], config, (args) => {
    const result = spawnSync("gcloud", [...args, `--project=${project}`, "--quiet"], { encoding: "utf8" });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`gcloud ${args.slice(0, 3).join(" ")} failed: ${result.stderr}`);
    // Some successful gcloud write commands only emit a status on stderr.
    return result.stdout.trim() ? JSON.parse(result.stdout) : {};
  });
  console.log("Metric and alert policy applied. Complete the synthetic delivery check in docs/CLOUD_RUN_DEPLOYMENT.md.");
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
