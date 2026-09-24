// ABHA ↔ user linkage.
//
// This is the module the whole consent gate rests on: `evaluateConsentArtefact` compares an
// artefact's patient against the caller's ABHA address, and that comparison only means anything
// because the address comes from here rather than from the request. So the branch that matters
// most is the one that REFUSES — a second user must not be able to take over an address.
//
// `db` is mocked at the module boundary. These tests pin the decision logic (which outcome for
// which database state), not Postgres itself.
import { beforeEach, describe, expect, it, vi } from "vitest";

/** Rows the fake `db` will return, set per test. */
const state: {
  insertReturns: { id: string }[];
  selectReturns: { id: string; userId: string; externalSub: string }[];
  updatedIds: string[];
  insertedValues: Record<string, unknown>[];
  onConflictCalls: number;
} = { insertReturns: [], selectReturns: [], updatedIds: [], insertedValues: [], onConflictCalls: 0 };

vi.mock("../server/db", () => ({
  db: {
    insert: () => ({
      values: (v: Record<string, unknown>) => {
        state.insertedValues.push(v);
        return {
          onConflictDoNothing: () => {
            state.onConflictCalls++;
            return { returning: async () => state.insertReturns };
          },
        };
      },
    }),
    select: () => ({
      from: () => ({ where: () => ({ limit: async () => state.selectReturns }) }),
    }),
    update: () => ({
      set: () => ({
        where: (clause: unknown) => {
          state.updatedIds.push(String(clause));
          return Promise.resolve();
        },
      }),
    }),
  },
}));

const { linkAbhaAddress, getLinkedAbhaAddress, ABHA_PROVIDER } = await import("../server/abdm/linkage");

beforeEach(() => {
  state.insertReturns = [];
  state.selectReturns = [];
  state.updatedIds = [];
  state.insertedValues = [];
  state.onConflictCalls = 0;
});

describe("linkAbhaAddress", () => {
  it("links a new ABHA address", async () => {
    state.insertReturns = [{ id: "row-1" }];
    await expect(linkAbhaAddress("user-1", "asha.patel@sbx")).resolves.toBe("linked");
    expect(state.insertedValues[0]).toMatchObject({ userId: "user-1", provider: ABHA_PROVIDER });
  });

  it("goes through the unique index rather than reading first", async () => {
    // The read-then-insert shape races: two concurrent verifications both see "no existing row"
    // and the loser's insert throws instead of returning "conflict". The insert must be the
    // first statement and must carry the conflict target.
    state.insertReturns = [{ id: "row-1" }];
    await linkAbhaAddress("user-1", "asha.patel@sbx");
    expect(state.onConflictCalls).toBe(1);
  });

  it("reports already-linked and refreshes lastSeenAt when the same user re-links", async () => {
    state.insertReturns = [];
    state.selectReturns = [{ id: "row-1", userId: "user-1", externalSub: "asha.patel@sbx" }];
    await expect(linkAbhaAddress("user-1", "asha.patel@sbx")).resolves.toBe("already-linked");
    expect(state.updatedIds).toHaveLength(1);
  });

  it("refuses when the address already belongs to another user", async () => {
    // The whole point: first verified claim wins. A later claimant is refused, never re-pointed.
    state.insertReturns = [];
    state.selectReturns = [{ id: "row-1", userId: "someone-else", externalSub: "asha.patel@sbx" }];
    await expect(linkAbhaAddress("user-2", "asha.patel@sbx")).resolves.toBe("conflict");
    expect(state.updatedIds).toEqual([]);
  });

  it("reports conflict, not a crash, when the row vanishes between insert and read", async () => {
    state.insertReturns = [];
    state.selectReturns = [];
    await expect(linkAbhaAddress("user-1", "asha.patel@sbx")).resolves.toBe("conflict");
  });

  it("canonicalises case so one address cannot become two rows under two users", async () => {
    state.insertReturns = [{ id: "row-1" }];
    await linkAbhaAddress("user-1", "  Asha.Patel@SBX  ");
    expect(state.insertedValues[0].externalSub).toBe("asha.patel@sbx");
  });

  it("keeps the ABHA number out of indexed columns", async () => {
    state.insertReturns = [{ id: "row-1" }];
    await linkAbhaAddress("user-1", "asha.patel@sbx", { abhaNumber: "91-1111-1111-1111" });
    const values = state.insertedValues[0];
    expect(values.metadata).toEqual({ abhaNumber: "91-1111-1111-1111" });
    expect(values.email).toBeUndefined();
  });

  it("refuses to link without a user or an address", async () => {
    await expect(linkAbhaAddress("", "asha.patel@sbx")).rejects.toThrow();
    await expect(linkAbhaAddress("user-1", "   ")).rejects.toThrow();
  });
});

describe("getLinkedAbhaAddress", () => {
  it("returns the linked address", async () => {
    state.selectReturns = [{ id: "row-1", userId: "user-1", externalSub: "asha.patel@sbx" }];
    await expect(getLinkedAbhaAddress("user-1")).resolves.toBe("asha.patel@sbx");
  });

  it("returns null when nothing is linked", async () => {
    state.selectReturns = [];
    await expect(getLinkedAbhaAddress("user-1")).resolves.toBeNull();
  });

  it("returns null for a missing user id without querying", async () => {
    await expect(getLinkedAbhaAddress("")).resolves.toBeNull();
  });
});
