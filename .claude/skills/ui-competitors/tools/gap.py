#!/usr/bin/env python3
"""Gap table and pick-the-top-3 scorer for /ui-competitors. Standard library only.

Adapted from the parity-scoring idea in replica-skill's parity.py (MIT, (c) 2026
Jake Schincariol; see ../THIRD_PARTY_NOTICES.md). Rewritten for this skill: it
scores how well we cover the patterns competitors share, not how closely we
copy any one of them.

    python3 -I gap.py gap.csv
    python3 -I gap.py gap.csv --top 3 --json

The CSV has these columns (extra columns are ignored):

    pattern    the UI or flow pattern, in plain words ("guided symptom triage")
    area       the screen or flow it belongs to
    us         yes | partial | no     do we have it today
    c_<name>   one column per competitor: yes | partial | no | ?
               "?" means not seen on a public page. It is an estimate.
    impact     1-5, user value if we adopt it
    effort     1-5, build cost (5 = hardest)
    verdict    adopt | adapt | skip
    evidence   seen | estimate   (estimate if anything was inferred, not seen)
    notes      anything. For skip, say why. Required.

Competitor coverage of a pattern is the mean of the c_ columns that are not "?"
(yes 1, partial 0.5, no 0). Parity is how much of the commonly offered patterns
(competitor coverage >= 0.5, verdict not skip) we already do, weighted by impact.

Picks are patterns with verdict adopt or adapt that we do not fully have, ranked
by impact * competitor coverage / effort. Rows seen on a public page rank above
estimates on ties. At most --top (default 3) are picked. Never copy a
competitor's layout, copy, or assets: adapt the pattern.
"""

import argparse
import csv
import json
import sys

CREDIT = {"yes": 1.0, "y": 1.0, "partial": 0.5, "no": 0.0, "n": 0.0, "": 0.0}
VERDICTS = ("adopt", "adapt", "skip")
COMMON = 0.5


class GapError(Exception):
    pass


def _num(row, key, problems, default):
    raw = row.get(key, "")
    try:
        value = float(raw)
    except ValueError:
        problems.append("line %d: %s '%s' is not a number 1-5, counted as %g"
                        % (row["line"], key, raw, default))
        return default
    if value < 1 or value > 5:
        problems.append("line %d: %s %g is outside 1-5, counted as %g"
                        % (row["line"], key, value, default))
        return default
    return value


def load(path):
    with open(path, newline="", encoding="utf-8-sig") as fh:
        reader = csv.DictReader(fh)
        if reader.fieldnames is None:
            raise GapError("%s is empty" % path)
        fields = [f.strip().lower() for f in reader.fieldnames]
        for need in ("pattern", "us", "verdict"):
            if need not in fields:
                raise GapError("%s has no '%s' column. Columns needed: pattern, area, "
                               "us, c_<competitor>..., impact, effort, verdict, "
                               "evidence, notes" % (path, need))
        competitors = [f[2:] for f in fields if f.startswith("c_") and len(f) > 2]
        if not competitors:
            raise GapError("%s has no competitor columns. Add one c_<name> column per "
                           "competitor, e.g. c_wysa" % path)
        rows = []
        for i, raw in enumerate(reader, start=2):
            if None in raw:
                raise GapError(
                    "%s line %d has more fields than columns. Quote any comma "
                    "inside a field." % (path, i))
            row = {(k or "").strip().lower(): (v or "").strip() for k, v in raw.items()}
            if not row.get("pattern"):
                continue
            row["line"] = i
            rows.append(row)
    return rows, competitors


def score(rows, competitors, top=3):
    problems = []
    counted, skipped = [], []
    for row in rows:
        verdict = row.get("verdict", "").lower()
        if verdict not in VERDICTS:
            problems.append("line %d: verdict '%s' is not adopt/adapt/skip, counted as adapt"
                            % (row["line"], row.get("verdict", "")))
            verdict = "adapt"
        us = row.get("us", "").lower()
        if us not in CREDIT:
            problems.append("line %d: us '%s' is not yes/partial/no, counted as no"
                            % (row["line"], row.get("us", "")))
        cells = {c: row.get("c_" + c, "").lower() for c in competitors}
        known = []
        unknown = 0
        for c, v in cells.items():
            if v in ("?", ""):
                unknown += 1
            elif v in CREDIT:
                known.append(CREDIT[v])
            else:
                problems.append("line %d: c_%s '%s' is not yes/partial/no/?, counted as ?"
                                % (row["line"], c, v))
                unknown += 1
        coverage = sum(known) / len(known) if known else 0.0
        if not known:
            problems.append("line %d: '%s' has no competitor evidence at all"
                            % (row["line"], row["pattern"]))
        evidence = row.get("evidence", "").lower()
        if evidence not in ("seen", "estimate"):
            problems.append("line %d: evidence '%s' is not seen/estimate, counted as estimate"
                            % (row["line"], row.get("evidence", "")))
            evidence = "estimate"
        estimate = evidence == "estimate" or unknown > 0
        impact = _num(row, "impact", problems, 1.0)
        effort = _num(row, "effort", problems, 5.0)
        item = dict(row, verdict=verdict, us_credit=CREDIT.get(us, 0.0), cells=cells,
                    coverage=coverage, estimate=estimate, impact=impact, effort=effort)
        if verdict == "skip":
            if not row.get("notes"):
                problems.append("line %d: skipped '%s' needs a reason in notes"
                                % (row["line"], row["pattern"]))
            skipped.append(item)
        else:
            counted.append(item)

    common = [r for r in counted if r["coverage"] >= COMMON]
    total = sum(r["impact"] for r in common)
    got = sum(r["impact"] * r["us_credit"] for r in common)
    parity = 100.0 * got / total if total else 0.0

    areas = {}
    for r in common:
        a = r.get("area") or "(no area)"
        t = areas.setdefault(a, [0.0, 0.0, 0])
        t[0] += r["impact"] * r["us_credit"]
        t[1] += r["impact"]
        t[2] += 1
    by_area = sorted(
        ({"area": a, "score": round(100.0 * g / t, 1) if t else 0.0, "patterns": n}
         for a, (g, t, n) in areas.items()),
        key=lambda d: d["score"])

    candidates = [r for r in counted if r["us_credit"] < 1.0]
    for r in candidates:
        r["priority"] = round(r["impact"] * r["coverage"] / r["effort"], 3)
    candidates.sort(key=lambda r: (-r["priority"], r["estimate"], r["effort"], r["pattern"]))

    def brief(r):
        return {"pattern": r["pattern"], "area": r.get("area", ""), "us": r.get("us", "") or "no",
                "verdict": r["verdict"], "impact": r["impact"], "effort": r["effort"],
                "competitor_coverage": round(r["coverage"], 2),
                "priority": r.get("priority"), "estimate": r["estimate"],
                "notes": r.get("notes", "")}

    return {
        "competitors": competitors,
        "patterns": len(rows),
        "common_patterns": len(common),
        "parity_score": round(parity, 1),
        "by_area": by_area,
        "picks": [brief(r) for r in candidates[:top]],
        "backlog": [brief(r) for r in candidates[top:]],
        "skipped": [brief(r) for r in skipped],
        "table": [{"pattern": r["pattern"] + (" (est)" if r["estimate"] else ""),
                   "us": r.get("us", "") or "no", "cells": r["cells"],
                   "verdict": r["verdict"], "notes": r.get("notes", "")}
                  for r in counted + skipped],
        "problems": problems,
    }


def render(result):
    comps = result["competitors"]
    out = ["## Gap table", ""]
    out.append("| pattern | us | %s | verdict | note |" % " | ".join(comps))
    out.append("| --- | --- | %s | --- | --- |" % " | ".join("---" for _ in comps))
    for r in result["table"]:
        out.append("| %s | %s | %s | %s | %s |" % (
            r["pattern"], r["us"], " | ".join(r["cells"][c] or "?" for c in comps),
            r["verdict"], r["notes"]))
    out.append("")
    out.append("Rows marked (est) were inferred, not seen on a public page.")
    out.append("")
    out.append("## Parity: %.1f / 100" % result["parity_score"])
    out.append("")
    out.append("How much of the %d patterns that at least half the competitors offer we "
               "already cover, weighted by impact." % result["common_patterns"])
    out.append("")
    out.append("By area, weakest first")
    for a in result["by_area"]:
        out.append("- %-28s %5.1f  (%d patterns)" % (a["area"], a["score"], a["patterns"]))
    out.append("")
    out.append("## Top picks (impact x coverage / effort)")
    out.append("")
    if not result["picks"]:
        out.append("- nothing. We cover every pattern marked adopt or adapt.")
    for i, p in enumerate(result["picks"], 1):
        out.append("%d. %s (%s): %s, impact %g, effort %g, competitors %.0f%%, score %.2f%s" % (
            i, p["pattern"], p["area"] or "-", p["verdict"], p["impact"], p["effort"],
            100 * p["competitor_coverage"], p["priority"],
            ", estimate" if p["estimate"] else ""))
    if result["backlog"]:
        out.append("")
        out.append("## Backlog, not picked")
        for p in result["backlog"]:
            out.append("- %s: score %.2f%s" % (p["pattern"], p["priority"],
                                              ", estimate" if p["estimate"] else ""))
    if result["skipped"]:
        out.append("")
        out.append("## Skipped on purpose")
        for p in result["skipped"]:
            out.append("- %s: %s" % (p["pattern"], p["notes"] or "no reason given, add one"))
    if result["problems"]:
        out.append("")
        out.append("## Fix in the matrix")
        for p in result["problems"]:
            out.append("- %s" % p)
    return "\n".join(out) + "\n"


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("matrix", help="the gap matrix CSV")
    ap.add_argument("--top", type=int, default=3, help="how many to pick (default 3)")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args(argv)
    if args.top < 1:
        print("gap: --top must be at least 1", file=sys.stderr)
        return 2
    try:
        rows, competitors = load(args.matrix)
        result = score(rows, competitors, top=args.top)
    except (GapError, OSError, ValueError) as exc:
        print("gap: %s" % exc, file=sys.stderr)
        return 2
    if args.json:
        print(json.dumps(result, indent=2))
    else:
        sys.stdout.write(render(result))
    return 0


if __name__ == "__main__":
    sys.exit(main())
