import { strict as assert } from "node:assert";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { checkNoProductionTransportOverrides } from "./ai-policy.test";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "ai-policy-static-"));
function write(file: string, content: string): void {
  const target = path.join(root, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}

try {
  write("ai-client.ts", "export function __setTransportsForTest(overrides: {\n");
  write("__tests__/allowed.test.ts", "__setTransportsForTest({});\n");
  write("safe.ts", "export const safe = true;\n");
  assert.deepEqual(checkNoProductionTransportOverrides(root).violations, []);

  const cases = [
    ["service.ts", 'import { __setTransportsForTest as override } from "./ai-client";'],
    ["nested/service.tsx", 'const setter = client["__setTransportsForTest"];'],
    ["worker.js", "__setTransportsForTest({});"],
    ["nested/__tests__/not-exempt.ts", "client.__setTransportsForTest({});"],
    ["reexport.mjs", 'export { __setTransportsForTest } from "./ai-client";'],
  ];
  for (const [file, text] of cases) {
    write(file, `// first line\n${text}\n`);
    assert.deepEqual(checkNoProductionTransportOverrides(root).violations, [
      { file, line: 2, text },
    ]);
    fs.unlinkSync(path.join(root, file));
  }

  write("ai-client.ts", "export function __setTransportsForTest(overrides: {\n__setTransportsForTest({});\n");
  assert.deepEqual(checkNoProductionTransportOverrides(root).violations, [
    { file: "ai-client.ts", line: 2, text: "__setTransportsForTest({});" },
  ]);
  console.log("OK — production transport override static guard catches forbidden references");
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
