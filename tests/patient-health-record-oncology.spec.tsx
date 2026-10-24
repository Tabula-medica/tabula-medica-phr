// @vitest-environment jsdom
// Chart Oncology tab must load Cancer Track by profile and pass pediatric ages through.
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import PatientHealthRecord, { ageFromDateOfBirth } from "../client/src/pages/patient-health-record";
import { getQueryFn } from "../client/src/lib/queryClient";

afterEach(cleanup);

describe("ageFromDateOfBirth", () => {
  const now = new Date("2026-10-24T12:00:00Z");

  it("keeps pediatric ages and still lets adult screening drop them", () => {
    expect(ageFromDateOfBirth("2012-01-15", 0, now)).toBe(14);
    expect(ageFromDateOfBirth("2012-01-15", 18, now)).toBeUndefined();
    expect(ageFromDateOfBirth("1980-01-15", 18, now)).toBe(46);
    expect(ageFromDateOfBirth("2012-12-01", 0, now)).toBe(13);
    expect(ageFromDateOfBirth(undefined)).toBeUndefined();
  });
});

describe("PatientHealthRecord oncology tab", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
        const path = String(url);
        if (path.includes("/api/cancer-track/profiles/profile-default")) {
          return json([
            {
              id: "cancer-1",
              cancerType: "breast",
              subtype: "Invasive ductal carcinoma",
              stage: "IIA",
              diagnosisDate: "2025-01-15",
              inRemission: true,
              biomarkers: [{ name: "ER", value: "90%", status: "positive" }],
            },
          ]);
        }
        if (path.includes("/api/cancer-track/profiles/")) return json([]);
        if (path.endsWith("/timeline")) return json([]);
        if (path.endsWith("/documents")) return json([]);
        if (path.includes("/decisions")) return json({ decisions: {} });
        if (path.includes("/api/patient-health-record/patient/patient-001")) {
          return json({
            patientId: "patient-001",
            demographics: { id: "d1", firstName: "Ada", lastName: "Child", dateOfBirth: "2010-01-15", gender: "Female" },
            appointmentHistory: [],
            vitalSigns: [],
            labResults: [],
            clinicianNotes: [],
            lastUpdated: "2026-10-24T00:00:00Z",
            totalRecords: { appointments: 0, vitals: 0, labs: 0, notes: 0 },
          });
        }
        if (path.includes("lab-categories")) return json([]);
        if (path.includes("note-types")) return json([]);
        return json({});
      }),
    );
  });

  it("loads the seeded Cancer Track profile and applies a pediatric age to oncology rules", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, queryFn: getQueryFn({ on401: "throw" }) } } });
    render(
      <QueryClientProvider client={qc}>
        <PatientHealthRecord />
      </QueryClientProvider>,
    );
    const user = userEvent.setup();
    await user.click(await screen.findByTestId("tab-oncology"));
    await waitFor(() => expect(screen.getByTestId("suggestion-genetics-referral")).toBeTruthy());
    const urls = (fetch as unknown as { mock: { calls: string[][] } }).mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.includes("/api/cancer-track/profiles/profile-default"))).toBe(true);
    expect(urls.some((u) => u.includes("/api/cancer-track/profiles/patient-001"))).toBe(false);
  });
});
