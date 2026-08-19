import { describe, it, expect } from "vitest";
import {
  COMMON_MEDICATIONS,
  generatePrescriptionDraft,
} from "../server/prescription-draft-service";

const context = {
  patientId: "patient-1",
  name: "Test Patient",
  age: 52,
  allergies: [] as string[],
  currentMedications: [] as string[],
  conditions: [] as string[],
};

describe("catalogue defaults", () => {
  it("puts most medications on a 100-day supply with 1 refill", () => {
    const hundredDay = COMMON_MEDICATIONS.filter(
      (m) => m.defaultDuration === "100 days" && m.defaultRefills === 1,
    );
    // "Most" is the requirement; the exceptions are principled, not accidental.
    expect(hundredDay.length).toBeGreaterThan(COMMON_MEDICATIONS.length / 2);
  });

  it("derives quantity from doses per day, not a hardcoded number", () => {
    const metformin = COMMON_MEDICATIONS.find((m) => m.name === "Metformin");
    expect(metformin?.dosesPerDay).toBe(2);
    expect(metformin?.defaultQuantity).toBe(200);

    const lisinopril = COMMON_MEDICATIONS.find((m) => m.name === "Lisinopril");
    expect(lisinopril?.defaultQuantity).toBe(100);
  });

  it("gives every medication an explicit dose formulation", () => {
    for (const med of COMMON_MEDICATIONS) {
      expect(med.defaultFormulation, med.name).toBeTruthy();
    }
  });

  it("caps the PPI at its guideline course rather than 100 days", () => {
    const omeprazole = COMMON_MEDICATIONS.find((m) => m.name === "Omeprazole");
    expect(omeprazole?.dispenseClass).toBe("guideline-limited-course");
    expect(omeprazole?.defaultDuration).toBe("56 days");
    expect(omeprazole?.defaultRefills).toBe(0);
  });
});

describe("generatePrescriptionDraft", () => {
  it("defaults a chronic medication to 100 days, 1 refill, outpatient", async () => {
    const draft = await generatePrescriptionDraft(context, "Atorvastatin");
    expect(draft.daysSupply).toBe(100);
    expect(draft.quantity).toBe(100);
    expect(draft.refills).toBe(1);
    expect(draft.careSetting).toBe("outpatient");
    expect(draft.duration).toBe("100 days");
    expect(draft.dispensePolicy).toBe("standard-100-day");
  });

  it("names the formulation in the sig", async () => {
    const draft = await generatePrescriptionDraft(context, "Omeprazole");
    expect(draft.formulation).toBe("delayed-release capsule");
    expect(draft.instructions).toContain("delayed-release capsule");
  });

  it("recomputes quantity when the prescriber changes the frequency", async () => {
    const draft = await generatePrescriptionDraft(context, "Lisinopril", {
      frequency: "twice daily",
    });
    expect(draft.quantity).toBe(200);
  });

  it("shortens a new start and says why", async () => {
    const draft = await generatePrescriptionDraft(context, "Metformin", {
      isNewStart: true,
    });
    expect(draft.daysSupply).toBe(30);
    expect(draft.quantity).toBe(60);
    expect(draft.dispensePolicy).toBe("new-start");
    expect(draft.dispensePolicyReason).toContain("tolerance");
  });

  it("surfaces a cap to the prescriber as a warning, not silently", async () => {
    const draft = await generatePrescriptionDraft(context, "Omeprazole");
    expect(draft.dispensePolicyReason).toBeTruthy();
    expect(draft.warnings.some((w) => w.startsWith("Dispensing:"))).toBe(true);
  });

  it("withholds the extended supply for a medication it cannot classify", async () => {
    // The failure this prevents: defaulting an unrecognised antibiotic to 100 days.
    const draft = await generatePrescriptionDraft(context, "Amoxicillin");
    expect(draft.daysSupply).toBe(30);
    expect(draft.refills).toBe(0);
    expect(
      draft.warnings.some((w) => w.includes("Extended 100-day supply withheld")),
    ).toBe(true);
  });

  it("does not apply a days supply to an inpatient order", async () => {
    const draft = await generatePrescriptionDraft(context, "Amlodipine", {
      careSetting: "inpatient",
    });
    expect(draft.daysSupply).toBe(1);
    expect(draft.refills).toBe(0);
    expect(draft.dispensePolicy).toBe("inpatient");
  });

  it("still returns a draft that requires clinician signature", async () => {
    const draft = await generatePrescriptionDraft(context, "Lisinopril");
    expect(draft.status).toBe("draft");
    expect(draft.disclaimer).toContain("Requires clinician review");
  });
});
