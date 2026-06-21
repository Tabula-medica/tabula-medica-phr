export interface LabProvider {
  id: string;
  name: string;
  integrationPartner: string;
  apiType: string;
  status: "connected" | "disconnected" | "maintenance";
  supportedTestCategories: string[];
  coverageRegions: string[];
  lastSyncAt: string;
  connectionDetails: {
    endpoint: string;
    authType: string;
    version: string;
  };
}

export interface LabTest {
  id: string;
  name: string;
  loincCode: string;
  category: string;
  description: string;
  specimenType: string;
  turnaroundTime: string;
  providers: string[];
  cptCode?: string;
}

export interface LabOrderRequest {
  patientId: string;
  providerId: string;
  tests: { testId: string; priority: "routine" | "urgent" | "stat" }[];
  orderingPhysician: string;
  clinicalNotes?: string;
  icdCodes?: string[];
  specimenCollectionDate?: string;
}

export interface LabOrder {
  id: string;
  patientId: string;
  providerId: string;
  providerName: string;
  tests: { testId: string; testName: string; loincCode: string; priority: "routine" | "urgent" | "stat" }[];
  status: "pending" | "submitted" | "in-progress" | "completed" | "cancelled";
  orderingPhysician: string;
  clinicalNotes?: string;
  icdCodes?: string[];
  submittedAt: string;
  updatedAt: string;
  estimatedCompletionAt?: string;
  integrationPartner: string;
  externalOrderId?: string;
}

export interface FHIRObservation {
  resourceType: "Observation";
  id: string;
  status: "registered" | "preliminary" | "final" | "amended" | "corrected" | "cancelled";
  category: { coding: { system: string; code: string; display: string }[] }[];
  code: { coding: { system: string; code: string; display: string }[]; text: string };
  subject: { reference: string };
  effectiveDateTime: string;
  issued: string;
  valueQuantity?: { value: number; unit: string; system: string; code: string };
  valueString?: string;
  interpretation?: { coding: { system: string; code: string; display: string }[] }[];
  referenceRange?: { low?: { value: number; unit: string }; high?: { value: number; unit: string }; text?: string }[];
  performer?: { reference: string; display: string }[];
  noCdsDisclaimer?: string;
}

export interface LabResult {
  id: string;
  orderId: string;
  patientId: string;
  providerId: string;
  providerName: string;
  testName: string;
  loincCode: string;
  value: string;
  unit: string;
  referenceRange: string;
  interpretation: "normal" | "abnormal" | "critical" | "indeterminate";
  status: "preliminary" | "final" | "corrected";
  collectedAt: string;
  reportedAt: string;
  performingLab: string;
  fhirObservation: FHIRObservation;
  noCdsDisclaimer: string;
}

export interface LabResultsOptions {
  providerId?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  loincCode?: string;
}

export interface LabIntegrationDashboard {
  totalProviders: number;
  connectedProviders: number;
  totalOrders: number;
  pendingOrders: number;
  completedOrders: number;
  totalResults: number;
  availableTests: number;
  recentOrders: LabOrder[];
  providerStatus: { providerId: string; name: string; status: string; lastSync: string }[];
  noCdsDisclaimer: string;
}

const NO_CDS_DISCLAIMER = "COMPLIANCE NOTICE: Lab results are presented for informational purposes only. This system does NOT provide clinical decision support, medical diagnoses, or treatment recommendations. All lab results must be interpreted by a qualified healthcare provider. AI-analyzed content is strictly informational and must not be used as a substitute for professional medical judgment.";

const labProviders: Map<string, LabProvider> = new Map();
const labTests: Map<string, LabTest> = new Map();
const labOrders: Map<string, LabOrder> = new Map();
const labResults: Map<string, LabResult> = new Map();

function initializeSampleData(): void {
  labProviders.set("quest-diagnostics", {
    id: "quest-diagnostics",
    name: "Quest Diagnostics",
    integrationPartner: "Fasten Health",
    apiType: "Fasten Health FHIR R4 API",
    status: "connected",
    supportedTestCategories: ["Chemistry", "Hematology", "Immunology", "Microbiology", "Urinalysis", "Endocrinology"],
    coverageRegions: ["US-Nationwide"],
    lastSyncAt: new Date().toISOString(),
    connectionDetails: {
      endpoint: "https://api.fastenhealth.com/fhir/R4",
      authType: "OAuth2 / SMART on FHIR",
      version: "FHIR R4 (4.0.1)",
    },
  });

  labProviders.set("labcorp", {
    id: "labcorp",
    name: "LabCorp",
    integrationPartner: "Particle Health",
    apiType: "Particle Health ADT/ORU API",
    status: "connected",
    supportedTestCategories: ["Chemistry", "Hematology", "Immunology", "Toxicology", "Urinalysis", "Endocrinology"],
    coverageRegions: ["US-Nationwide"],
    lastSyncAt: new Date().toISOString(),
    connectionDetails: {
      endpoint: "https://api.particlehealth.com/v1",
      authType: "OAuth2 Bearer Token",
      version: "Particle Health API v1",
    },
  });

  const tests: LabTest[] = [
    {
      id: "test-cbc",
      name: "Complete Blood Count (CBC) with Differential",
      loincCode: "58410-2",
      category: "Hematology",
      description: "Measures red blood cells, white blood cells, hemoglobin, hematocrit, and platelets",
      specimenType: "Whole Blood (EDTA)",
      turnaroundTime: "1 business day",
      providers: ["quest-diagnostics", "labcorp"],
      cptCode: "85025",
    },
    {
      id: "test-cmp",
      name: "Comprehensive Metabolic Panel (CMP)",
      loincCode: "24323-8",
      category: "Chemistry",
      description: "Measures glucose, calcium, electrolytes, kidney function, and liver function markers",
      specimenType: "Serum (SST)",
      turnaroundTime: "1 business day",
      providers: ["quest-diagnostics", "labcorp"],
      cptCode: "80053",
    },
    {
      id: "test-lipid",
      name: "Lipid Panel",
      loincCode: "24331-1",
      category: "Chemistry",
      description: "Measures total cholesterol, HDL, LDL, and triglycerides",
      specimenType: "Serum (SST)",
      turnaroundTime: "1 business day",
      providers: ["quest-diagnostics", "labcorp"],
      cptCode: "80061",
    },
    {
      id: "test-tsh",
      name: "Thyroid Stimulating Hormone (TSH)",
      loincCode: "11580-8",
      category: "Endocrinology",
      description: "Measures TSH levels to evaluate thyroid function",
      specimenType: "Serum (SST)",
      turnaroundTime: "1-2 business days",
      providers: ["quest-diagnostics", "labcorp"],
      cptCode: "84443",
    },
    {
      id: "test-hba1c",
      name: "Hemoglobin A1c (HbA1c)",
      loincCode: "4548-4",
      category: "Chemistry",
      description: "Measures average blood glucose over the past 2-3 months",
      specimenType: "Whole Blood (EDTA)",
      turnaroundTime: "1 business day",
      providers: ["quest-diagnostics", "labcorp"],
      cptCode: "83036",
    },
    {
      id: "test-urinalysis",
      name: "Urinalysis with Microscopy",
      loincCode: "24356-8",
      category: "Urinalysis",
      description: "Chemical and microscopic analysis of urine specimen",
      specimenType: "Urine (Clean Catch)",
      turnaroundTime: "1 business day",
      providers: ["quest-diagnostics", "labcorp"],
      cptCode: "81001",
    },
  ];

  for (const test of tests) {
    labTests.set(test.id, test);
  }

  const sampleOrder: LabOrder = {
    id: "order-001",
    patientId: "patient-001",
    providerId: "quest-diagnostics",
    providerName: "Quest Diagnostics",
    tests: [
      { testId: "test-cbc", testName: "Complete Blood Count (CBC) with Differential", loincCode: "58410-2", priority: "routine" },
      { testId: "test-cmp", testName: "Comprehensive Metabolic Panel (CMP)", loincCode: "24323-8", priority: "routine" },
    ],
    status: "completed",
    orderingPhysician: "Dr. Sarah Chen",
    clinicalNotes: "Annual wellness exam labs",
    icdCodes: ["Z00.00"],
    submittedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    estimatedCompletionAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    integrationPartner: "Fasten Health",
    externalOrderId: "HG-2026-00142857",
  };
  labOrders.set(sampleOrder.id, sampleOrder);

  const sampleOrder2: LabOrder = {
    id: "order-002",
    patientId: "patient-001",
    providerId: "labcorp",
    providerName: "LabCorp",
    tests: [
      { testId: "test-lipid", testName: "Lipid Panel", loincCode: "24331-1", priority: "routine" },
      { testId: "test-hba1c", testName: "Hemoglobin A1c (HbA1c)", loincCode: "4548-4", priority: "routine" },
    ],
    status: "in-progress",
    orderingPhysician: "Dr. Sarah Chen",
    clinicalNotes: "Diabetes and cardiovascular risk monitoring",
    icdCodes: ["E11.65", "E78.5"],
    submittedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    estimatedCompletionAt: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
    integrationPartner: "Particle Health",
    externalOrderId: "PH-LC-2026-009832",
  };
  labOrders.set(sampleOrder2.id, sampleOrder2);

  function buildFhirObservation(id: string, patientId: string, loincCode: string, testName: string, value: number, unit: string, interpretation: string, effectiveDate: string): FHIRObservation {
    const interpretationCode = interpretation === "normal" ? "N" : interpretation === "abnormal" ? "A" : interpretation === "critical" ? "AA" : "IND";
    const interpretationDisplay = interpretation === "normal" ? "Normal" : interpretation === "abnormal" ? "Abnormal" : interpretation === "critical" ? "Critical" : "Indeterminate";
    return {
      resourceType: "Observation",
      id,
      status: "final",
      category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/observation-category", code: "laboratory", display: "Laboratory" }] }],
      code: { coding: [{ system: "http://loinc.org", code: loincCode, display: testName }], text: testName },
      subject: { reference: `Patient/${patientId}` },
      effectiveDateTime: effectiveDate,
      issued: new Date().toISOString(),
      valueQuantity: { value, unit, system: "http://unitsofmeasure.org", code: unit },
      interpretation: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation", code: interpretationCode, display: interpretationDisplay }] }],
      performer: [{ reference: "Organization/quest-diagnostics", display: "Quest Diagnostics" }],
      noCdsDisclaimer: NO_CDS_DISCLAIMER,
    };
  }

  const reportedDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
  const collectedDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const sampleResults: LabResult[] = [
    {
      id: "result-001",
      orderId: "order-001",
      patientId: "patient-001",
      providerId: "quest-diagnostics",
      providerName: "Quest Diagnostics",
      testName: "White Blood Cell Count",
      loincCode: "6690-2",
      value: "7.2",
      unit: "10*3/uL",
      referenceRange: "4.5-11.0 10*3/uL",
      interpretation: "normal",
      status: "final",
      collectedAt: collectedDate,
      reportedAt: reportedDate,
      performingLab: "Quest Diagnostics - Marlborough, MA",
      fhirObservation: buildFhirObservation("obs-wbc-001", "patient-001", "6690-2", "White Blood Cell Count", 7.2, "10*3/uL", "normal", collectedDate),
      noCdsDisclaimer: NO_CDS_DISCLAIMER,
    },
    {
      id: "result-002",
      orderId: "order-001",
      patientId: "patient-001",
      providerId: "quest-diagnostics",
      providerName: "Quest Diagnostics",
      testName: "Hemoglobin",
      loincCode: "718-7",
      value: "14.5",
      unit: "g/dL",
      referenceRange: "12.0-17.5 g/dL",
      interpretation: "normal",
      status: "final",
      collectedAt: collectedDate,
      reportedAt: reportedDate,
      performingLab: "Quest Diagnostics - Marlborough, MA",
      fhirObservation: buildFhirObservation("obs-hgb-001", "patient-001", "718-7", "Hemoglobin", 14.5, "g/dL", "normal", collectedDate),
      noCdsDisclaimer: NO_CDS_DISCLAIMER,
    },
    {
      id: "result-003",
      orderId: "order-001",
      patientId: "patient-001",
      providerId: "quest-diagnostics",
      providerName: "Quest Diagnostics",
      testName: "Glucose",
      loincCode: "2345-7",
      value: "105",
      unit: "mg/dL",
      referenceRange: "74-106 mg/dL",
      interpretation: "normal",
      status: "final",
      collectedAt: collectedDate,
      reportedAt: reportedDate,
      performingLab: "Quest Diagnostics - Marlborough, MA",
      fhirObservation: buildFhirObservation("obs-glu-001", "patient-001", "2345-7", "Glucose", 105, "mg/dL", "normal", collectedDate),
      noCdsDisclaimer: NO_CDS_DISCLAIMER,
    },
    {
      id: "result-004",
      orderId: "order-001",
      patientId: "patient-001",
      providerId: "quest-diagnostics",
      providerName: "Quest Diagnostics",
      testName: "Creatinine",
      loincCode: "2160-0",
      value: "1.3",
      unit: "mg/dL",
      referenceRange: "0.7-1.2 mg/dL",
      interpretation: "abnormal",
      status: "final",
      collectedAt: collectedDate,
      reportedAt: reportedDate,
      performingLab: "Quest Diagnostics - Marlborough, MA",
      fhirObservation: buildFhirObservation("obs-cre-001", "patient-001", "2160-0", "Creatinine", 1.3, "mg/dL", "abnormal", collectedDate),
      noCdsDisclaimer: NO_CDS_DISCLAIMER,
    },
  ];

  for (const result of sampleResults) {
    labResults.set(result.id, result);
  }
}

initializeSampleData();
console.log("[LabDiagnosticsIntegration] Service initialized with sample data");
console.log("[LabDiagnosticsIntegration] Providers: Quest Diagnostics (Fasten Health), LabCorp (Particle Health)");
console.log("[LabDiagnosticsIntegration] NO-CDS compliance enabled for all outputs");

export function getLabProviders(): LabProvider[] {
  console.log("[HIPAA-AUDIT] Lab providers list accessed");
  return Array.from(labProviders.values());
}

export function submitLabOrder(request: LabOrderRequest): LabOrder {
  const provider = labProviders.get(request.providerId);
  if (!provider) {
    throw new Error(`Lab provider not found: ${request.providerId}`);
  }

  if (provider.status !== "connected") {
    throw new Error(`Lab provider ${provider.name} is not currently connected (status: ${provider.status})`);
  }

  const resolvedTests = request.tests.map((t) => {
    const test = labTests.get(t.testId);
    if (!test) throw new Error(`Lab test not found: ${t.testId}`);
    if (!test.providers.includes(request.providerId)) {
      throw new Error(`Test ${test.name} is not available from ${provider.name}`);
    }
    return { testId: t.testId, testName: test.name, loincCode: test.loincCode, priority: t.priority };
  });

  const order: LabOrder = {
    id: `order-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
    patientId: request.patientId,
    providerId: request.providerId,
    providerName: provider.name,
    tests: resolvedTests,
    status: "submitted",
    orderingPhysician: request.orderingPhysician,
    clinicalNotes: request.clinicalNotes,
    icdCodes: request.icdCodes,
    submittedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    estimatedCompletionAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    integrationPartner: provider.integrationPartner,
    externalOrderId: provider.integrationPartner === "Fasten Health"
      ? `HG-${Date.now()}`
      : `PH-LC-${Date.now()}`,
  };

  labOrders.set(order.id, order);

  console.log(`[HIPAA-AUDIT] Lab order submitted | OrderId: ${order.id} | PatientId: ${request.patientId} | Provider: ${provider.name} | Tests: ${resolvedTests.map((t) => t.testName).join(", ")} | IntegrationPartner: ${provider.integrationPartner}`);

  return order;
}

export function getLabResults(patientId: string, options?: LabResultsOptions): { results: LabResult[]; totalCount: number; noCdsDisclaimer: string } {
  console.log(`[HIPAA-AUDIT] Lab results accessed | PatientId: ${patientId} | Filters: ${JSON.stringify(options || {})}`);

  let results = Array.from(labResults.values()).filter((r) => r.patientId === patientId);

  if (options?.providerId) {
    results = results.filter((r) => r.providerId === options.providerId);
  }
  if (options?.status) {
    results = results.filter((r) => r.status === options.status);
  }
  if (options?.loincCode) {
    results = results.filter((r) => r.loincCode === options.loincCode);
  }
  if (options?.startDate) {
    results = results.filter((r) => r.collectedAt >= options.startDate!);
  }
  if (options?.endDate) {
    results = results.filter((r) => r.collectedAt <= options.endDate!);
  }

  return {
    results,
    totalCount: results.length,
    noCdsDisclaimer: NO_CDS_DISCLAIMER,
  };
}

export function getLabOrderStatus(orderId: string): LabOrder | null {
  const order = labOrders.get(orderId);
  if (!order) return null;

  console.log(`[HIPAA-AUDIT] Lab order status accessed | OrderId: ${orderId} | PatientId: ${order.patientId} | Status: ${order.status}`);

  return order;
}

export function searchAvailableTests(query: string, provider?: string): LabTest[] {
  console.log(`[HIPAA-AUDIT] Lab test search | Query: "${query}" | Provider: ${provider || "all"}`);

  const lowerQuery = query.toLowerCase();
  let results = Array.from(labTests.values()).filter(
    (t) =>
      t.name.toLowerCase().includes(lowerQuery) ||
      t.loincCode.includes(lowerQuery) ||
      t.category.toLowerCase().includes(lowerQuery) ||
      t.description.toLowerCase().includes(lowerQuery)
  );

  if (provider) {
    results = results.filter((t) => t.providers.includes(provider));
  }

  return results;
}

export function getLabIntegrationDashboard(): LabIntegrationDashboard {
  console.log("[HIPAA-AUDIT] Lab integration dashboard accessed");

  const allOrders = Array.from(labOrders.values());
  const allProviders = Array.from(labProviders.values());

  return {
    totalProviders: allProviders.length,
    connectedProviders: allProviders.filter((p) => p.status === "connected").length,
    totalOrders: allOrders.length,
    pendingOrders: allOrders.filter((o) => o.status === "pending" || o.status === "submitted").length,
    completedOrders: allOrders.filter((o) => o.status === "completed").length,
    totalResults: labResults.size,
    availableTests: labTests.size,
    recentOrders: allOrders.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()).slice(0, 10),
    providerStatus: allProviders.map((p) => ({
      providerId: p.id,
      name: p.name,
      status: p.status,
      lastSync: p.lastSyncAt,
    })),
    noCdsDisclaimer: NO_CDS_DISCLAIMER,
  };
}

export function getUpcomingLabOrders(patientId: string): LabOrder[] {
  console.log(`[HIPAA-AUDIT] Upcoming lab orders accessed | PatientId: ${patientId}`);
  return Array.from(labOrders.values())
    .filter((o) => o.patientId === patientId && (o.status === "pending" || o.status === "submitted" || o.status === "in-progress"))
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
}
