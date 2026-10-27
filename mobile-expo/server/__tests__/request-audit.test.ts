import assert from "node:assert/strict";
import { once } from "node:events";
import http from "node:http";
import { readFileSync, readdirSync } from "node:fs";
import { test, type TestContext } from "node:test";
import express, { type Request, type Response } from "express";
import ts from "typescript";
import {
  createRequestAuditRecorder,
  getAuditWriteStats,
} from "../audit/request-audit";
import { createCreateRecordHandler } from "../routes/create-record-handler";

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

async function serve(t: TestContext, handler: (req: Request, res: Response) => void) {
  const app = express();
  app.use(express.json());
  app.all("/", handler);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
  const address = server.address() as { port: number };
  return `http://127.0.0.1:${address.port}/`;
}

test("a response cannot finish until its audit insert is committed", { timeout: 5000 }, async (t) => {
  const commit = deferred();
  const started = deferred();
  const before = getAuditWriteStats();
  let response!: Response;
  let continued = false;
  const entries: unknown[] = [];
  const audit = createRequestAuditRecorder(async (entry) => {
    started.resolve();
    await commit.promise;
    entries.push(entry);
  }, () => assert.fail("unexpected audit failure"));
  const url = await serve(t, (req, res) => {
    response = res;
    audit(req, { action: "view_record", resourceId: "test-record" });
    continued = true; // Other request work is not serialized behind the DB.
    res.status(201).json({ saved: true });
  });
  const result = fetch(url);
  await started.promise;
  assert.equal(continued, true);
  assert.equal(response.writableEnded, false);
  assert.equal(response.headersSent, false);
  assert.equal(getAuditWriteStats().pending, before.pending + 1);
  assert.equal(entries.length, 0);
  commit.resolve();
  const received = await result;
  assert.equal(received.status, 201);
  assert.deepEqual(await received.json(), { saved: true });
  assert.equal(entries.length, 1);
  assert.equal(getAuditWriteStats().completed, before.completed + 1);
  assert.equal(getAuditWriteStats().pending, before.pending);
});

test("all audits are awaited without serializing their inserts", { timeout: 5000 }, async (t) => {
  const commits = [deferred(), deferred()];
  const bothStarted = deferred();
  let started = 0;
  let response!: Response;
  const audit = createRequestAuditRecorder(async () => {
    const index = started++;
    if (started === 2) bothStarted.resolve();
    await commits[index].promise;
  }, () => assert.fail("unexpected audit failure"));
  const url = await serve(t, (req, res) => {
    response = res;
    audit(req, { action: "first" });
    audit(req, { action: "second" });
    res.status(403).json({ error: "denied" });
  });
  const result = fetch(url);
  await bothStarted.promise;
  commits[1].resolve();
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(response.writableEnded, false);
  commits[0].resolve();
  const received = await result;
  assert.equal(received.status, 403);
  assert.deepEqual(await received.json(), { error: "denied" });
});

test("failed inserts become 503 errors, metrics, and PHI-free critical events", { timeout: 5000 }, async (t) => {
  const before = getAuditWriteStats();
  const events: string[] = [];
  const audit = createRequestAuditRecorder(async () => {
    throw new Error("DB DETAIL with confidential patient data");
  }, (event) => { events.push(event); });
  const url = await serve(t, (req, res) => {
    audit(req, { action: "view_record", metadata: { secret: "test-only PHI" } });
    res.cookie("session", "must-not-be-issued");
    res.setHeader("Content-Disposition", 'attachment; filename="private.csv"');
    res.setHeader("Location", "/private");
    res.setHeader("Content-Encoding", "gzip");
    res.status(201).json({ private: "must-not-be-sent" });
  });
  const received = await fetch(url);
  assert.equal(received.status, 503);
  assert.equal(received.headers.get("set-cookie"), null);
  assert.equal(received.headers.get("location"), null);
  assert.equal(received.headers.get("content-encoding"), null);
  assert.equal(received.headers.get("content-disposition"), null);
  assert.equal(received.headers.get("etag"), null);
  assert.equal(received.headers.get("cache-control"), "no-store");
  const body = await received.text();
  assert.equal(JSON.parse(body).code, "AUDIT_WRITE_FAILED");
  assert.doesNotMatch(body, /confidential|test-only|must-not-be-sent/);
  assert.deepEqual(events, ["AUDIT_WRITE_FAILED"]);
  const after = getAuditWriteStats();
  assert.equal(after.failed, before.failed + 1);
  assert.equal(after.pending, before.pending);
  assert.ok(after.lastFailureAt);
});

test("synchronous writer failures are handled without unhandled rejections", { timeout: 5000 }, async (t) => {
  const events: string[] = [];
  const audit = createRequestAuditRecorder(() => {
    throw new Error("sync insert failure");
  }, (event) => { events.push(event); });
  const url = await serve(t, (req, res) => {
    audit(req, { action: "sync_failure" });
    res.send("success must not escape");
  });
  const response = await fetch(url);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, "AUDIT_WRITE_FAILED");
  assert.deepEqual(events, ["AUDIT_WRITE_FAILED"]);
});

test("record creation's best-effort catch cannot hide an audit failure", { timeout: 5000 }, async (t) => {
  const audit = createRequestAuditRecorder(async () => {
    throw new Error("audit DB unavailable");
  }, () => {});
  const handler = createCreateRecordHandler({
    storage: {
      createHealthRecord: async () => ({ id: "record", type: "note" }),
      getHealthRecords: async () => [],
      awardPoints: async () => {},
      incrementRecordsLogged: async () => {},
    },
    clinicalAutomationEngine: { processTrigger: async () => {} },
    auditLog: (req, action, resourceType, resourceId) =>
      audit(req, { action, resourceType, resourceId }),
    getUserId: () => "test-user",
  });
  const url = await serve(t, (req, res) => { void handler(req, res, () => {}); });
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "note" }),
  });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, "AUDIT_WRITE_FAILED");
});

test("already-sent streaming headers cause a failed audit to abort, not complete", { timeout: 5000 }, async (t) => {
  const commit = deferred();
  const audit = createRequestAuditRecorder(() => commit.promise, () => {});
  let finished = false;
  const url = await serve(t, (req, res) => {
    audit(req, { action: "stream_export" });
    res.on("finish", () => { finished = true; });
    res.write("partial");
    res.end("complete");
  });
  const response = await fetch(url);
  const body = response.text();
  commit.reject(new Error("audit failure"));
  await assert.rejects(body);
  assert.equal(finished, false);
});

test("end callbacks still run and successfully recorded payloads are unchanged", { timeout: 5000 }, async (t) => {
  const audit = createRequestAuditRecorder(async () => {}, () => {});
  const callback = deferred();
  const url = await serve(t, (req, res) => {
    audit(req, { action: "callback" });
    res.end("original", () => callback.resolve());
  });
  const response = await fetch(url);
  assert.equal(await response.text(), "original");
  await callback.promise;
});

test("audit calls without an active response fail explicitly", () => {
  const before = getAuditWriteStats();
  const events: string[] = [];
  const audit = createRequestAuditRecorder(async () => {}, (event) => { events.push(event); });
  assert.throws(() => audit({} as Request, { action: "late" }), /active HTTP response/);
  assert.deepEqual(events, ["AUDIT_OUTSIDE_REQUEST"]);
  assert.equal(getAuditWriteStats().lifecycleViolations, before.lifecycleViolations + 1);
});

test("generated routes cannot put auditLog after an unconditional response", () => {
  for (const name of readdirSync("server/routes").filter((name) => name.endsWith(".ts"))) {
    const source = ts.createSourceFile(
      name, readFileSync(`server/routes/${name}`, "utf8"), ts.ScriptTarget.Latest, true,
    );
    function visit(node: ts.Node) {
      if (ts.isBlock(node)) {
        let sentResponse = false;
        for (const statement of node.statements) {
          if (!ts.isExpressionStatement(statement)) continue;
          const text = statement.getText(source);
          if (/^auditLog\(/.test(text)) {
            assert.equal(sentResponse, false, `${name}: audit must precede the response`);
          }
          if (/^res\.(?:json|send|end|redirect)\(/.test(text)) sentResponse = true;
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  const helper = readFileSync("server/routes/_helpers.ts", "utf8");
  assert.match(helper, /recordRequestAudit\(req,/);
  assert.match(helper, /logger\.critical\("audit", event\)/);
});
