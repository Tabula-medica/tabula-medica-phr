import type { Request, Response } from "express";
import type { InsertAuditLog } from "@shared/schema";

type AuditWriter = (entry: InsertAuditLog) => Promise<unknown>;
type FailureReporter = (event: string) => void;

const stats = {
  attempted: 0,
  completed: 0,
  failed: 0,
  pending: 0,
  lifecycleViolations: 0,
  lastFailureAt: null as string | null,
};

export function getAuditWriteStats() {
  return { ...stats };
}

interface RequestAuditState {
  pending: Set<Promise<void>>;
  failed: boolean;
  endRequested: boolean;
}

/**
 * Existing route helpers are synchronous. Keep their writes concurrent with the
 * rest of the handler, but await every write before ending the HTTP response.
 * This is a request-completion barrier, NOT a background/in-memory retry queue.
 * There are no timers, polling, or extra DB round trips on successful requests.
 */
export function createRequestAuditRecorder(
  write: AuditWriter,
  reportFailure: FailureReporter,
) {
  const requests = new WeakMap<Request, RequestAuditState>();

  return function recordRequestAudit(req: Request, entry: InsertAuditLog): void {
    const res = req.res;
    if (!res || res.writableEnded || res.destroyed) {
      stats.lifecycleViolations++;
      reportFailure("AUDIT_OUTSIDE_REQUEST");
      throw new Error("Audit logging requires an active HTTP response");
    }

    let state = requests.get(req);
    if (!state) {
      state = { pending: new Set(), failed: false, endRequested: false };
      requests.set(req, state);
      installCompletionBarrier(res, state);
    }

    const requestState = state;
    stats.attempted++;
    stats.pending++;
    // Promise.resolve().then also captures synchronous writer failures. The
    // rejection handler is attached immediately, even if the route never ends.
    const pending = Promise.resolve()
      .then(() => write(entry))
      .then(
        () => { stats.completed++; },
        () => {
          requestState.failed = true;
          stats.failed++;
          stats.lastFailureAt = new Date().toISOString();
          // Never send DB errors/DETAIL or audit payloads to ordinary logs:
          // either may contain PHI. The durable audit store owns the payload.
          reportFailure("AUDIT_WRITE_FAILED");
        },
      )
      .finally(() => {
        stats.pending--;
        requestState.pending.delete(pending);
      });
    requestState.pending.add(pending);
  };
}

function installCompletionBarrier(res: Response, state: RequestAuditState) {
  const originalEnd = res.end;
  res.end = function (...args: Parameters<Response["end"]>) {
    if (state.endRequested) return res;
    state.endRequested = true;

    const finish = () => {
      res.end = originalEnd;
      if (res.destroyed) return;
      if (state.failed) {
        // A streaming response may already have sent its headers. It cannot be
        // changed into an error response: abort rather than complete a 2xx.
        if (res.headersSent) {
          res.destroy();
          return;
        }
        res.statusCode = 503;
        res.statusMessage = "Service Unavailable";
        // Discard any original payload headers (including auth cookies).
        for (const header of [
          "content-length", "content-encoding", "content-disposition",
          "etag", "last-modified", "location", "set-cookie", "transfer-encoding",
        ]) res.removeHeader(header);
        const body = JSON.stringify({
          error: "Audit recording failed. Check the operation's status before retrying.",
          code: "AUDIT_WRITE_FAILED",
        });
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader("Content-Length", Buffer.byteLength(body));
        res.setHeader("Cache-Control", "no-store");
        // Preserve the caller's end callback, but never its success payload.
        const callback = args.find((arg) => typeof arg === "function");
        originalEnd.call(res, body, "utf8", callback as (() => void) | undefined);
        return;
      }
      originalEnd.apply(res, args);
    };

    if (state.pending.size === 0) {
      finish();
    } else {
      // Drain in a loop so audits added while a request is completing are also
      // awaited. Settled promises never reject; failures live on request state.
      void (async () => {
        while (state.pending.size) await Promise.all([...state.pending]);
        finish();
      })().catch(() => res.destroy());
    }
    return res;
  } as Response["end"];
}
