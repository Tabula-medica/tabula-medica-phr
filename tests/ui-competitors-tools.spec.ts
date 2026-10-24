import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const TOOLS = path.resolve(__dirname, "..", ".claude", "skills", "ui-competitors", "tools");
const hasPython = spawnSync("python3", ["--version"]).status === 0;

let dir: string;
beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), "ui-competitors-"));
});
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

function write(name: string, body: string): string {
  const p = path.join(dir, name);
  writeFileSync(p, body);
  return p;
}

function run(script: string, args: string[]) {
  const r = spawnSync("python3", ["-I", path.join(TOOLS, script), ...args], { encoding: "utf8" });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

const REVIEWS_HEADER = "competitor,source,url,date,rating,text\n";

describe.skipIf(!hasPython)("ui-competitors reviews.py", () => {
  it("ranks themes with verbatim, linked quotes and withholds identifiers", () => {
    const csv = write(
      "reviews.csv",
      REVIEWS_HEADER +
        "a,app-store,https://example.test/1,2026-09-01,1,The subscription is too expensive for what it does.\n" +
        "a,reddit,https://example.test/2,2026-09-02,2,Way too expensive and a paywall for basic export.\n" +
        "b,app-store,https://example.test/3,2026-09-03,1,Pricey. Cancel took forever.\n" +
        "b,reddit,https://example.test/4,2026-09-04,1,Email me at someone@example.test about the refund.\n" +
        "b,reddit,https://example.test/5,2026-09-05,1,Call 555-123-4567 and my MRN: AB12345 is wrong.\n" +
        "b,reddit,,2026-09-06,1,No link on this row so it is dropped.\n" +
        "b,reddit,https://example.test/7,2026-09-07,1,The subscription is too expensive for what it does.\n",
    );
    const r = run("reviews.py", [csv, "--json", "--today", "2026-10-01"]);
    expect(r.code).toBe(0);
    const j = JSON.parse(r.out);
    expect(j.reviews).toBe(3);
    expect(j.withheld).toBe(2);
    expect(j.dropped).toBe(1);
    expect(j.duplicates).toBe(1);
    const pricing = j.themes.find((t: { id: string }) => t.id === "pricing");
    expect(pricing.count).toBe(3);
    expect(pricing.competitors).toEqual(["a", "b"]);
    expect(pricing.thin).toBe(false);
    for (const q of pricing.quotes) {
      expect(q.url).toMatch(/^https:\/\/example\.test\//);
    }
    // Withheld text must never reach the output.
    expect(r.out).not.toContain("someone@example.test");
    expect(r.out).not.toContain("555-123-4567");
  });

  it("filters by competitor and flags small samples in the report", () => {
    const csv = write(
      "reviews-filter.csv",
      REVIEWS_HEADER +
        "a,app-store,https://example.test/1,2026-09-01,1,Crashes constantly.\n" +
        "b,reddit,https://example.test/2,2026-09-02,1,I wish it could export lab results.\n",
    );
    const out = execFileSync(
      "python3",
      ["-I", path.join(TOOLS, "reviews.py"), csv, "--competitor", "b", "--today", "2026-10-01"],
      { encoding: "utf8" },
    );
    expect(out).toContain("1 reviews");
    expect(out).toContain("Small sample");
    expect(out).not.toContain("Crashes constantly");
  });

  it("exits 2 when nothing is usable", () => {
    const csv = write("reviews-empty.csv", REVIEWS_HEADER + "a,reddit,,2026-09-01,1,no link\n");
    const r = run("reviews.py", [csv]);
    expect(r.code).toBe(2);
    expect(r.err).toContain("no usable rows");
  });
});

const GAP_HEADER = "pattern,area,us,c_a,c_b,impact,effort,verdict,evidence,notes\n";

describe.skipIf(!hasPython)("ui-competitors gap.py", () => {
  it("scores parity and ranks picks by impact x coverage / effort", () => {
    const csv = write(
      "gap.csv",
      GAP_HEADER +
        "crisis banner,companion,no,yes,yes,5,1,adopt,seen,\n" +
        "guided check-in,companion,partial,yes,yes,4,2,adapt,seen,\n" +
        "sharing with provider,records,no,yes,?,3,3,adopt,estimate,\n" +
        "avatar skins,companion,no,yes,no,1,4,skip,seen,not a fit for a clinical record\n" +
        "already have it,records,yes,yes,yes,4,2,adapt,seen,\n",
    );
    const r = run("gap.py", [csv, "--json", "--top", "2"]);
    expect(r.code).toBe(0);
    const j = JSON.parse(r.out);
    expect(j.picks.map((p: { pattern: string }) => p.pattern)).toEqual([
      "crisis banner",
      "guided check-in",
    ]);
    expect(j.backlog.map((p: { pattern: string }) => p.pattern)).toEqual(["sharing with provider"]);
    expect(j.skipped).toHaveLength(1);
    const est = j.table.find((t: { pattern: string }) => t.pattern.startsWith("sharing"));
    expect(est.pattern).toContain("(est)");
    // common patterns: crisis, check-in, sharing (coverage 1.0 on known), already have it.
    // got = 4*1 (already) + 4*0.5 (check-in) = 6 of 5+4+3+4 = 16.
    expect(j.parity_score).toBe(37.5);
    expect(j.problems).toEqual([]);
  });

  it("flags a skip with no reason and missing evidence", () => {
    const csv = write(
      "gap-problems.csv",
      GAP_HEADER + "mystery,x,no,?,?,3,2,skip,seen,\n",
    );
    const j = JSON.parse(run("gap.py", [csv, "--json"]).out);
    expect(j.problems.some((p: string) => p.includes("needs a reason"))).toBe(true);
    expect(j.problems.some((p: string) => p.includes("no competitor evidence"))).toBe(true);
  });

  it("renders a markdown gap table and rejects a matrix with no competitors", () => {
    const ok = write("gap-md.csv", GAP_HEADER + "crisis banner,companion,no,yes,no,5,1,adopt,seen,\n");
    const out = run("gap.py", [ok]).out;
    expect(out).toContain("| pattern | us | a | b | verdict | note |");
    expect(out).toContain("## Top picks");

    const bad = write("gap-bad.csv", "pattern,us,verdict\nx,no,adopt\n");
    const r = run("gap.py", [bad]);
    expect(r.code).toBe(2);
    expect(r.err).toContain("no competitor columns");
  });
});
