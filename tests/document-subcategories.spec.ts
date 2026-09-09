import { describe, expect, it } from "vitest";
import {
  autoTagCategories,
  autoTagSubcategories,
  autoTagSubcategoryLabels,
  documentTagOverrideSchema,
  insertUploadedDocumentSchema,
  isValidSubcategory,
  uploadedDocumentTypeToAutoTagCategory,
  uploadedDocumentTypes,
} from "../shared/schema";

describe("intake subcategory taxonomy", () => {
  it("defines a subcategory list for every auto-tag category", () => {
    for (const category of autoTagCategories) {
      expect(Array.isArray(autoTagSubcategories[category])).toBe(true);
    }
  });

  it("has a display label for every subcategory", () => {
    for (const category of autoTagCategories) {
      for (const subcategory of autoTagSubcategories[category]) {
        expect(autoTagSubcategoryLabels[subcategory]).toBeTruthy();
      }
    }
  });

  it("does not reuse a subcategory key across categories", () => {
    const all = autoTagCategories.flatMap(category => [...autoTagSubcategories[category]]);
    expect(new Set(all).size).toBe(all.length);
  });

  it("maps document types onto valid auto-tag categories", () => {
    for (const [documentType, category] of Object.entries(uploadedDocumentTypeToAutoTagCategory)) {
      expect(uploadedDocumentTypes).toContain(documentType);
      expect(autoTagCategories).toContain(category);
    }
  });
});

describe("isValidSubcategory", () => {
  it("accepts a subcategory belonging to the category", () => {
    expect(isValidSubcategory("lab", "blood_work")).toBe(true);
    expect(isValidSubcategory("imaging", "mri")).toBe(true);
  });

  it("rejects a subcategory from another category", () => {
    expect(isValidSubcategory("lab", "mri")).toBe(false);
    expect(isValidSubcategory("other", "blood_work")).toBe(false);
  });

  it("rejects unknown values", () => {
    expect(isValidSubcategory("lab", "not_a_subcategory")).toBe(false);
  });
});

describe("documentTagOverrideSchema", () => {
  const base = { documentId: "doc-1", newCategory: "lab" as const };

  it("accepts an override without a subcategory", () => {
    expect(documentTagOverrideSchema.safeParse(base).success).toBe(true);
    expect(documentTagOverrideSchema.safeParse({ ...base, newSubcategory: null }).success).toBe(true);
  });

  it("accepts a matching subcategory", () => {
    expect(documentTagOverrideSchema.safeParse({ ...base, newSubcategory: "urinalysis" }).success).toBe(true);
  });

  it("rejects a subcategory that does not belong to the new category", () => {
    const result = documentTagOverrideSchema.safeParse({ ...base, newSubcategory: "ct_scan" });
    expect(result.success).toBe(false);
  });
});

describe("insertUploadedDocumentSchema", () => {
  it("accepts an optional subcategory on intake", () => {
    const result = insertUploadedDocumentSchema.safeParse({
      patientId: "p1",
      documentType: "lab_result",
      subcategory: "blood_work",
      title: "CBC panel",
      fileName: "cbc.pdf",
      originalFileName: "cbc.pdf",
      mimeType: "application/pdf",
      fileSize: 1024,
      storageUrl: "/objects/cbc.pdf",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.subcategory).toBe("blood_work");
    }
  });
});
