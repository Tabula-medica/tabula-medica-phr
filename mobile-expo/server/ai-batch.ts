/**
 * BAA-safe batch processor.
 *
 * Drop-in replacement for the legacy `replit_integrations/batch/utils.ts` template that
 * preserves the exact `batchProcess(items, processor, options)` signature
 * existing call sites use. The difference: this module never reaches the
 * Replit AI proxy. It also exposes `batchAIComplete()` for the common
 * "run the same prompt over a list of items" pattern, which routes
 * through `aiClient.chatComplete()` and inherits its fail-closed PHI
 * protection.
 *
 * Once all call sites of the legacy batchProcess are migrated,
 * the legacy `replit_integrations/` template directory was deleted (Phase 4 cleanup, Task #88).
 */
import pLimit from "p-limit";
import pRetry from "p-retry";
import { chatComplete, type AICompleteOptions, type AICompleteResult } from "./ai-client";

export interface BatchOptions {
  concurrency?: number;
  retries?: number;
  minTimeout?: number;
  maxTimeout?: number;
  onProgress?: (completed: number, total: number, item: unknown) => void;
}

export function isRateLimitError(err: unknown): boolean {
  const m = err instanceof Error ? err.message : String(err);
  return /429|RATELIMIT|quota|rate limit/i.test(m);
}

/**
 * Generic concurrency-bounded, retry-wrapped batch runner. Identical
 * signature to the legacy implementation so call sites need no change
 * beyond updating their import path.
 */
export async function batchProcess<T, R>(
  items: T[],
  processor: (item: T, index: number) => Promise<R>,
  options: BatchOptions = {},
): Promise<R[]> {
  const limit = pLimit(options.concurrency ?? 2);
  let done = 0;
  return await Promise.all(
    items.map((item, i) =>
      limit(async () => {
        const r = await pRetry(() => processor(item, i), {
          retries: options.retries ?? 7,
          minTimeout: options.minTimeout ?? 2000,
          maxTimeout: options.maxTimeout ?? 128000,
          shouldRetry: (e: any) => isRateLimitError(e),
        } as any);
        done += 1;
        options.onProgress?.(done, items.length, item);
        return r;
      }),
    ),
  );
}

/**
 * Run the same prompt template against a list of items. Each call goes
 * through aiClient.chatComplete and so inherits BAA enforcement.
 */
export async function batchAIComplete<T>(
  items: T[],
  buildOpts: (item: T, index: number) => AICompleteOptions,
  batchOptions: BatchOptions = {},
): Promise<AICompleteResult[]> {
  return await batchProcess(
    items,
    async (item, i) => await chatComplete(buildOpts(item, i)),
    batchOptions,
  );
}
