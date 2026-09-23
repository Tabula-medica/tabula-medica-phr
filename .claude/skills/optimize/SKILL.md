---
name: optimize
description: Make code faster without breaking it. Measure first, change, measure again, report before and after. Use for /optimize, "this is slow", "speed up X".
argument-hint: <file, function, query, or endpoint>
---

# /optimize

Target: $ARGUMENTS

1. **Measure**: establish a baseline (timing, query plan, bundle size, or profiler output). Record the numbers.
2. **Find the bottleneck** with evidence, not intuition. Name the one thing that dominates.
3. **Change** the minimum needed: algorithm, query, caching, batching, lazy loading. Keep behavior identical.
4. **Re-measure** with the same method. Run the project's tests from `CLAUDE.md`.
5. Report a before/after table and any trade-off introduced (memory, complexity, staleness).

If the gain is under 10%, say so and recommend stopping.
