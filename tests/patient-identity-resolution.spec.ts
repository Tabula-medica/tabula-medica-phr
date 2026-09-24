import { describe, expect, it, vi, beforeEach } from "vitest";

// patient-identity-resolution.ts imports the real storage singleton, which
// pulls in DB/encryption modules unsuitable for a unit test — mock it with a
// minimal in-memory fake covering exactly the methods these functions call.
vi.mock("../server/storage", () => {
  let connections: any[] = [];
  let patients: any[] = [];
  let unifiedPatients: Map<string, any> = new Map();
  let nextId = 1;

  const storage = {
    __reset() {
      connections = [];
      patients = [];
      unifiedPatients = new Map();
      nextId = 1;
    },
    __seedConnection(conn: any) {
      connections.push(conn);
    },
    __seedPatient(patient: any) {
      patients.push(patient);
    },
    async getEhrConnections(userId?: string) {
      if (!userId) return connections;
      return connections.filter(c => c.userId === userId || c.userId === "current-user");
    },
    async getPatientsByConnection(connectionId: string) {
      return patients.filter(p => p.ehrConnectionId === connectionId);
    },
    async getUnifiedPatient(id: string) {
      return unifiedPatients.get(id);
    },
    async createUnifiedPatient(patient: any) {
      const id = `unified-${nextId++}`;
      const created = { ...patient, id, createdAt: new Date().toISOString() };
      unifiedPatients.set(id, created);
      return created;
    },
    async updateUnifiedPatient(id: string, updates: any) {
      const existing = unifiedPatients.get(id);
      if (!existing) return undefined;
      const updated = { ...existing, ...updates };
      unifiedPatients.set(id, updated);
      return updated;
    },
  };
  return { storage };
});

import { storage } from "../server/storage";
import {
  resolveUnifiedPatientForNewSource,
  attachEhrSourceToUnifiedPatient,
  type NewPatientSource,
} from "../server/services/patient-identity-resolution";

const fakeStorage = storage as any;

const USER = "user-1";
const OTHER_USER = "user-2";

function source(overrides: Partial<NewPatientSource> = {}): NewPatientSource {
  return {
    firstName: "Jane",
    lastName: "Doe",
    dateOfBirth: "1985-03-14",
    email: "jane.doe@example.com",
    phone: "571-555-0123",
    ehrConnectionId: "conn-new",
    platform: "epic",
    facilityName: "Test Facility",
    mrn: "MRN-999",
    ...overrides,
  };
}

beforeEach(() => {
  fakeStorage.__reset();
});

describe("resolveUnifiedPatientForNewSource", () => {
  it("creates a new UnifiedPatient when the account has no other connections", async () => {
    const match = await resolveUnifiedPatientForNewSource(USER, source());
    expect(match.isNewUnifiedPatient).toBe(true);
    expect(match.matchConfidence).toBe("high");
    expect(match.unifiedPatientId).toBeTruthy();

    // No source is attached yet — that only happens via attachEhrSourceToUnifiedPatient.
    const unified = await storage.getUnifiedPatient(match.unifiedPatientId);
    expect(unified?.ehrSources).toEqual([]);
  });

  it("matches into an existing UnifiedPatient from a different connection of the same account", async () => {
    const created = await storage.createUnifiedPatient({
      firstName: "Jane", lastName: "Doe", dateOfBirth: "1985-03-14",
      email: "jane.doe@example.com", phone: "571-555-0123", middleName: "UNK",
      gender: "other", address: "", ehrSources: [], matchConfidence: "high",
    });
    fakeStorage.__seedConnection({ id: "conn-a", userId: USER, platform: "epic" });
    fakeStorage.__seedPatient({
      id: "patient-a",
      ehrConnectionId: "conn-a",
      unifiedPatientId: created.id,
      firstName: "Jane",
      lastName: "Doe",
      dateOfBirth: "1985-03-14",
      email: "jane.doe@example.com",
      phone: "571-555-0123",
    });

    const match = await resolveUnifiedPatientForNewSource(USER, source({ ehrConnectionId: "conn-b" }));
    expect(match.isNewUnifiedPatient).toBe(false);
    expect(match.unifiedPatientId).toBe(created.id);
    expect(match.matchConfidence).toBe("high");
  });

  it("does not match against the SAME connection's own existing patient", async () => {
    fakeStorage.__seedConnection({ id: "conn-a", userId: USER, platform: "epic" });
    fakeStorage.__seedPatient({
      id: "patient-a",
      ehrConnectionId: "conn-a",
      unifiedPatientId: "unified-a",
      firstName: "Jane",
      lastName: "Doe",
      dateOfBirth: "1985-03-14",
    });

    // Same connection id as the candidate — must be excluded from matching.
    const match = await resolveUnifiedPatientForNewSource(USER, source({ ehrConnectionId: "conn-a" }));
    expect(match.isNewUnifiedPatient).toBe(true);
  });

  it("never matches against another account's connections, including legacy current-user seed data", async () => {
    fakeStorage.__seedConnection({ id: "conn-other", userId: OTHER_USER, platform: "epic" });
    fakeStorage.__seedConnection({ id: "conn-legacy", userId: "current-user", platform: "epic" });
    fakeStorage.__seedPatient({
      id: "patient-other",
      ehrConnectionId: "conn-other",
      unifiedPatientId: "unified-other",
      firstName: "Jane",
      lastName: "Doe",
      dateOfBirth: "1985-03-14",
      email: "jane.doe@example.com",
      phone: "571-555-0123",
    });
    fakeStorage.__seedPatient({
      id: "patient-legacy",
      ehrConnectionId: "conn-legacy",
      unifiedPatientId: "unified-legacy",
      firstName: "Jane",
      lastName: "Doe",
      dateOfBirth: "1985-03-14",
      email: "jane.doe@example.com",
      phone: "571-555-0123",
    });

    // getEhrConnections(USER) would normally also return the "current-user"
    // connection per its broadening behavior — must be filtered out.
    const match = await resolveUnifiedPatientForNewSource(USER, source());
    expect(match.isNewUnifiedPatient).toBe(true);
  });

  it("declines to auto-merge on a tie between two different people's UnifiedPatients at the same confidence", async () => {
    fakeStorage.__seedConnection({ id: "conn-a", userId: USER, platform: "epic" });
    fakeStorage.__seedConnection({ id: "conn-b", userId: USER, platform: "cerner" });
    // Two DIFFERENT existing patients, each matching the candidate at the
    // exact same confidence tier ("medium": dob+lastName+firstName only).
    fakeStorage.__seedPatient({
      id: "patient-a", ehrConnectionId: "conn-a", unifiedPatientId: "unified-a",
      firstName: "Jane", lastName: "Doe", dateOfBirth: "1985-03-14",
    });
    fakeStorage.__seedPatient({
      id: "patient-b", ehrConnectionId: "conn-b", unifiedPatientId: "unified-b",
      firstName: "Jane", lastName: "Doe", dateOfBirth: "1985-03-14",
    });

    const match = await resolveUnifiedPatientForNewSource(
      USER,
      source({ ehrConnectionId: "conn-c", email: "", phone: "" }),
    );
    // Iteration order must not silently pick one — a tie means "not
    // positively identified", so a fresh identity is created instead.
    expect(match.isNewUnifiedPatient).toBe(true);
  });
});

describe("attachEhrSourceToUnifiedPatient", () => {
  it("records the source using the REAL internal patient id, not an external MRN", async () => {
    const match = await resolveUnifiedPatientForNewSource(USER, source());
    await attachEhrSourceToUnifiedPatient(match, {
      ehrConnectionId: "conn-new",
      platform: "epic",
      facilityName: "Test Facility",
      mrn: "MRN-999",
      patientId: "internal-patient-abc",
    });

    const unified = await storage.getUnifiedPatient(match.unifiedPatientId);
    expect(unified?.ehrSources).toHaveLength(1);
    expect(unified?.ehrSources[0].patientId).toBe("internal-patient-abc");
    expect(unified?.ehrSources[0].mrn).toBe("MRN-999");
  });

  it("aggregates to the WEAKER confidence when attaching to an existing match, never inflating it", async () => {
    fakeStorage.__seedConnection({ id: "conn-a", userId: USER, platform: "epic" });
    fakeStorage.__seedPatient({
      id: "patient-a", ehrConnectionId: "conn-a", unifiedPatientId: "will-be-replaced",
      firstName: "Jane", lastName: "Doe", dateOfBirth: "1985-03-14",
      email: "jane.doe@example.com", phone: "571-555-0123",
    });
    const created = await storage.createUnifiedPatient({
      firstName: "Jane", lastName: "Doe", dateOfBirth: "1985-03-14",
      email: "jane.doe@example.com", phone: "571-555-0123", middleName: "UNK",
      gender: "other", address: "", ehrSources: [], matchConfidence: "high",
    });
    fakeStorage.__seedPatient({
      id: "patient-a", ehrConnectionId: "conn-a", unifiedPatientId: created.id,
      firstName: "Jane", lastName: "Doe", dateOfBirth: "1985-03-14",
      email: "jane.doe@example.com", phone: "571-555-0123",
    });

    // Weaker corroboration this time (only DOB+lastName -> "low", which
    // shouldMerge() would reject) is bypassed here by calling attach directly
    // with a "medium" match to verify the aggregate math specifically.
    await attachEhrSourceToUnifiedPatient(
      { unifiedPatientId: created.id, matchConfidence: "medium", isNewUnifiedPatient: false },
      { ehrConnectionId: "conn-b", platform: "cerner", facilityName: "F2", mrn: "MRN-2", patientId: "internal-2" },
    );

    const unified = await storage.getUnifiedPatient(created.id);
    expect(unified?.matchConfidence).toBe("medium"); // weaker of "high" and "medium"
  });

  it("keeps a brand-new UnifiedPatient at its initial confidence on its first attach", async () => {
    const match = await resolveUnifiedPatientForNewSource(USER, source());
    expect(match.matchConfidence).toBe("high");
    await attachEhrSourceToUnifiedPatient(match, {
      ehrConnectionId: "conn-new",
      platform: "epic",
      facilityName: "Test Facility",
      mrn: "MRN-999",
      patientId: "internal-patient-abc",
    });
    const unified = await storage.getUnifiedPatient(match.unifiedPatientId);
    expect(unified?.matchConfidence).toBe("high");
  });
});
