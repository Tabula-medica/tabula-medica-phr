import { describe, it, expect, vi } from "vitest";
import { clearMobileOnboardingProgress } from "../server/storage/onboarding-cleanup";
import { mobileOnboardingProgress } from "@shared/schema";

interface FakeDb {
  delete: ReturnType<typeof vi.fn>;
}

describe("clearMobileOnboardingProgress", () => {
  it("issues a DELETE on mobile_onboarding_progress scoped to the user", async () => {
    const captured: { table?: unknown; predicate?: any } = {};
    const whereSpy = vi.fn(async (predicate: any) => {
      captured.predicate = predicate;
    });
    const deleteSpy = vi.fn((table: unknown) => {
      captured.table = table;
      return { where: whereSpy };
    });
    const fakeDb: FakeDb = { delete: deleteSpy };

    await clearMobileOnboardingProgress(
      "user-123",
      fakeDb as unknown as Parameters<typeof clearMobileOnboardingProgress>[1],
    );

    expect(deleteSpy).toHaveBeenCalledTimes(1);
    expect(captured.table).toBe(mobileOnboardingProgress);
    expect(whereSpy).toHaveBeenCalledTimes(1);

    // Inspect the Drizzle eq() expression. eq() returns a SQL object whose
    // queryChunks include [column, "=", placeholder(value)]. Walking those
    // chunks lets us assert the predicate truly binds to userId and our
    // userId value, not just that .where() was invoked.
    const predicate = captured.predicate;
    expect(predicate).toBeDefined();
    expect(predicate.queryChunks).toBeDefined();

    const columnChunk = predicate.queryChunks.find(
      (c: any) => c && typeof c === "object" && "name" in c,
    );
    expect(columnChunk).toBe(mobileOnboardingProgress.userId);

    const paramChunk = predicate.queryChunks.find(
      (c: any) =>
        c && typeof c === "object" && "value" in c && c.value === "user-123",
    );
    expect(paramChunk).toBeDefined();
  });

  it("is a no-op when userId is empty", async () => {
    const deleteSpy = vi.fn();
    const fakeDb: FakeDb = { delete: deleteSpy };

    await clearMobileOnboardingProgress(
      "",
      fakeDb as unknown as Parameters<typeof clearMobileOnboardingProgress>[1],
    );

    expect(deleteSpy).not.toHaveBeenCalled();
  });
});
