// @vitest-environment jsdom
// Oncology tab: renders from Cancer Track data, shows the provider-only framing, and wires decisions.
import { describe, it, expect, afterEach, beforeAll, beforeEach, vi } from "vitest";
import { render, cleanup, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import axe, { type Result } from "axe-core";
import { OncologySurvivorshipPanel } from "../client/src/components/oncology-survivorship-panel";
import { getQueryFn } from "../client/src/lib/queryClient";

beforeAll(() => {
  const proto = HTMLElement.prototype;
  if (!proto.hasPointerCapture) proto.hasPointerCapture = () => false;
  if (!proto.setPointerCapture) proto.setPointerCapture = () => {};
  if (!proto.releasePointerCapture) proto.releasePointerCapture = () => {};
});

afterEach(cleanup);

const cancer = {
  id: "cancer-1",
  cancerType: "breast",
  subtype: "Invasive ductal carcinoma",
  stage: "IIA",
  diagnosisDate: "2021-03-15",
  inRemission: true,
  biomarkers: [{ name: "ER", value: "95%", status: "positive" }],
};
const timeline = [
  { id: "t1", treatmentType: "chemotherapy", title: "AC-T", startDate: "2021-06-15", endDate: "2021-11-30", details: { drugs: ["Doxorubicin", "Paclitaxel"] } },
  { id: "t2", treatmentType: "radiation", title: "Chest wall RT", startDate: "2021-12-15", endDate: "2022-01-20", details: { radiationSite: "Chest wall", radiationDose: "50 Gy" } },
];
const documents = [
  { id: "d1", folderType: "pathology_reports", title: "Surgical pathology", documentDate: "2021-05-01", summary: "IDC grade 2, margins negative" },
  { id: "d2", folderType: "imaging_ct", title: "CT chest", documentDate: "2025-01-10" },
];

let putBodies: unknown[] = [];

beforeEach(() => {
  putBodies = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
      if (init?.method === "PUT") {
        putBodies.push({ url, body: JSON.parse(String(init.body)) });
        return json({ decision: { suggestionId: String(url).split("/").pop(), status: "accepted", decidedBy: "u", decidedAt: "2026-10-22T00:00:00Z" } });
      }
      if (String(url).includes("/api/cancer-track/profiles/")) return json([cancer]);
      if (String(url).endsWith("/timeline")) return json(timeline);
      if (String(url).endsWith("/documents")) return json(documents);
      if (String(url).includes("/decisions")) return json({ decisions: {} });
      return json({});
    }),
  );
});

function mount() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, queryFn: getQueryFn({ on401: "throw" }) } } });
  return render(
    <QueryClientProvider client={qc}>
      <OncologySurvivorshipPanel patientId="patient-001" age={52} sex="female" labs={[]} />
    </QueryClientProvider>,
  );
}

describe("OncologySurvivorshipPanel", () => {
  it("aggregates the course and lists provider-only considerations", async () => {
    mount();
    await waitFor(() => expect(screen.getByTestId("text-oncology-headline").textContent).toMatch(/Invasive ductal carcinoma breast/));
    expect(screen.getByText(/Provider-only/i)).toBeTruthy();
    expect(screen.getByTestId("suggestion-cardiac-surveillance")).toBeTruthy();
    expect(screen.queryByTestId("suggestion-bone-health")).toBeNull(); // no aromatase inhibitor / ADT in this case
    // Chest RT + anthracycline without a documented cumulative dose -> data gap surfaced.
    expect(screen.getByTestId("oncology-data-gaps").textContent).toMatch(/cumulative dose/i);
  });

  it("records a clinician decision against the server", async () => {
    mount();
    const accept = await screen.findByTestId("button-accept-cardiac-surveillance");
    fireEvent.click(accept);
    await waitFor(() => expect(putBodies.length).toBe(1));
    expect(putBodies[0]).toMatchObject({
      url: "/api/oncology-survivorship/patients/patient-001/decisions/cancer-1--cardiac-surveillance",
      body: { status: "accepted" },
    });
  });

  it("does not carry session entries, AI notes, or decisions onto the next cancer", async () => {
    const colon = {
      id: "cancer-2",
      cancerType: "colon",
      subtype: "Adenocarcinoma",
      stage: "III",
      diagnosisDate: "2019-04-01",
      inRemission: true,
      biomarkers: [] as { name: string; value: string; status: string }[],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
        if (init?.method === "POST" && String(url).includes("/refine")) {
          return json({ aiRefined: true, courseNarrative: "BREAST-ONLY-NOTE", refinements: [], clarifyingQuestions: [] });
        }
        if (String(url).includes("/api/cancer-track/profiles/")) return json([cancer, colon]);
        if (String(url).includes("/cancer-2/") && String(url).endsWith("/timeline")) return json([]);
        if (String(url).endsWith("/timeline")) return json(timeline);
        if (String(url).endsWith("/documents")) return json(documents);
        if (String(url).includes("/decisions")) {
          return json({
            decisions: {
              "cancer-1--psychosocial-distress": {
                suggestionId: "cancer-1--psychosocial-distress",
                status: "completed",
                decidedBy: "u",
                decidedAt: "2026-09-01T00:00:00Z",
              },
            },
          });
        }
        return json({});
      }),
    );

    const user = userEvent.setup();
    mount();
    await screen.findByTestId("suggestion-cardiac-surveillance");
    // Completed items are hidden in the open filter, so the breast decision must not be visible yet.
    expect(screen.queryByTestId("suggestion-psychosocial-distress")).toBeNull();

    await user.click(screen.getByTestId("subtab-add-data"));
    fireEvent.change(screen.getByTestId("input-study-title"), { target: { value: "Session-only PET" } });
    await user.click(screen.getByTestId("button-add-study"));
    await user.click(screen.getByTestId("subtab-studies"));
    expect(screen.getByText(/Session-only PET/)).toBeTruthy();

    await user.click(screen.getByTestId("subtab-survivorship"));
    await user.click(screen.getByTestId("button-ai-refine"));
    await screen.findByText("BREAST-ONLY-NOTE");

    await user.click(screen.getByTestId("select-cancer"));
    await user.click(await screen.findByRole("option", { name: /colon/i }));

    await waitFor(() => expect(screen.getByTestId("text-oncology-headline").textContent).toMatch(/Adenocarcinoma colon/));
    expect(screen.queryByText("BREAST-ONLY-NOTE")).toBeNull();
    expect(screen.getByTestId("suggestion-psychosocial-distress").textContent).toMatch(/No record/);
    expect(screen.getByTestId("suggestion-psychosocial-distress").textContent).not.toMatch(/completed/);
    await user.click(screen.getByTestId("subtab-studies"));
    expect(screen.queryByText(/Session-only PET/)).toBeNull();
  });

  it("has no WCAG A/AA violations", async () => {
    const { container } = mount();
    await screen.findByTestId("suggestion-cardiac-surveillance");
    const results = await axe.run(container, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] },
      rules: { "color-contrast": { enabled: false } },
    });
    const v: Result[] = results.violations;
    expect(v.map((x) => `${x.id}: ${x.nodes.map((n) => n.html).join(" | ")}`)).toEqual([]);
  });
});
