import type {
  FhirEhrConnection,
  EhrSyncLog,
  HealthcareProvider,
  ProviderLocation,
  InsurancePlan,
  ProviderNetworkAffiliation,
  PatientInsurance,
  EPrescription,
  SpecialistReferral,
  ProviderScheduleTemplate,
  ProviderAvailabilitySlot,
  ExternalCalendarSync,
  ProviderAppointmentBooking,
  InsuranceNetworkMatch,
  ProviderSearchFilters,
  ProviderSearchResult,
  EhrSystemType,
  EhrConnectionStatus,
  FhirResourceType,
  ProviderSpecialty,
  EPrescriptionStatus,
  ReferralStatus,
  PharmacyExtended,
} from "@shared/schema";

const fhirConnections: Map<string, FhirEhrConnection> = new Map();
const syncLogs: Map<string, EhrSyncLog> = new Map();
const providers: Map<string, HealthcareProvider> = new Map();
const locations: Map<string, ProviderLocation> = new Map();
const insurancePlans: Map<string, InsurancePlan> = new Map();
const networkAffiliations: Map<string, ProviderNetworkAffiliation> = new Map();
const patientInsurance: Map<string, PatientInsurance> = new Map();
const pharmacies: Map<string, PharmacyExtended> = new Map();
const ePrescriptions: Map<string, EPrescription> = new Map();
const referrals: Map<string, SpecialistReferral> = new Map();
const scheduleTemplates: Map<string, ProviderScheduleTemplate> = new Map();
const availabilitySlots: Map<string, ProviderAvailabilitySlot> = new Map();
const calendarSyncs: Map<string, ExternalCalendarSync> = new Map();
const bookings: Map<string, ProviderAppointmentBooking> = new Map();

function initializeSampleData(): void {
  const now = new Date().toISOString();

  const sampleProviders: HealthcareProvider[] = [
    {
      id: "prov-1",
      npi: "1234567890",
      firstName: "Sarah",
      lastName: "Johnson",
      credentials: ["MD", "FACC"],
      providerType: "physician",
      specialties: ["cardiology", "internal_medicine"],
      primarySpecialty: "cardiology",
      status: "active",
      bio: "Board-certified cardiologist with 15 years of experience in interventional cardiology.",
      languages: ["English", "Spanish"],
      acceptingNewPatients: true,
      appointmentModes: ["in_person", "telehealth"],
      averageRating: 4.8,
      reviewCount: 127,
      yearsExperience: 15,
      medicalSchool: "Johns Hopkins University School of Medicine",
      boardCertifications: ["Cardiovascular Disease", "Internal Medicine"],
      hospitalAffiliations: ["City General Hospital", "Memorial Heart Center"],
      groupPractice: "Heart Care Associates",
      metadata: {},
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "prov-2",
      npi: "0987654321",
      firstName: "Michael",
      lastName: "Chen",
      credentials: ["MD"],
      providerType: "physician",
      specialties: ["family_medicine"],
      primarySpecialty: "family_medicine",
      status: "active",
      bio: "Primary care physician focused on preventive medicine and chronic disease management.",
      languages: ["English", "Mandarin"],
      acceptingNewPatients: true,
      appointmentModes: ["in_person", "telehealth", "hybrid"],
      averageRating: 4.9,
      reviewCount: 256,
      yearsExperience: 12,
      medicalSchool: "Stanford University School of Medicine",
      boardCertifications: ["Family Medicine"],
      hospitalAffiliations: ["Community Medical Center"],
      groupPractice: "Family Health Partners",
      metadata: {},
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "prov-3",
      npi: "5678901234",
      firstName: "Emily",
      lastName: "Rodriguez",
      credentials: ["MD", "PhD"],
      providerType: "specialist",
      specialties: ["endocrinology"],
      primarySpecialty: "endocrinology",
      status: "active",
      bio: "Endocrinologist specializing in diabetes care and thyroid disorders.",
      languages: ["English", "Spanish", "Portuguese"],
      acceptingNewPatients: true,
      appointmentModes: ["in_person", "telehealth"],
      averageRating: 4.7,
      reviewCount: 89,
      yearsExperience: 10,
      medicalSchool: "Harvard Medical School",
      boardCertifications: ["Endocrinology", "Diabetes and Metabolism"],
      hospitalAffiliations: ["University Hospital"],
      metadata: {},
      createdAt: now,
      updatedAt: now,
    },
  ];

  sampleProviders.forEach((p) => providers.set(p.id, p));

  const sampleLocations: ProviderLocation[] = [
    {
      id: "loc-1",
      providerId: "prov-1",
      name: "Heart Care Associates - Main Office",
      addressLine1: "100 Medical Center Drive",
      city: "Boston",
      state: "MA",
      zipCode: "02115",
      country: "USA",
      phone: "617-555-1234",
      fax: "617-555-1235",
      email: "info@heartcare.com",
      isPrimary: true,
      appointmentModes: ["in_person", "telehealth"],
      officeHours: [
        { day: "Monday", open: "08:00", close: "17:00", closed: false },
        { day: "Tuesday", open: "08:00", close: "17:00", closed: false },
        { day: "Wednesday", open: "08:00", close: "17:00", closed: false },
        { day: "Thursday", open: "08:00", close: "17:00", closed: false },
        { day: "Friday", open: "08:00", close: "16:00", closed: false },
        { day: "Saturday", open: "09:00", close: "12:00", closed: false },
        { day: "Sunday", open: "", close: "", closed: true },
      ],
      handicapAccessible: true,
      parkingAvailable: true,
      publicTransitAccess: true,
      latitude: 42.3601,
      longitude: -71.0589,
      createdAt: now,
    },
    {
      id: "loc-2",
      providerId: "prov-2",
      name: "Family Health Partners - Downtown",
      addressLine1: "250 Main Street",
      addressLine2: "Suite 400",
      city: "Boston",
      state: "MA",
      zipCode: "02110",
      country: "USA",
      phone: "617-555-2345",
      isPrimary: true,
      appointmentModes: ["in_person", "telehealth", "hybrid"],
      officeHours: [
        { day: "Monday", open: "07:00", close: "19:00", closed: false },
        { day: "Tuesday", open: "07:00", close: "19:00", closed: false },
        { day: "Wednesday", open: "07:00", close: "19:00", closed: false },
        { day: "Thursday", open: "07:00", close: "19:00", closed: false },
        { day: "Friday", open: "07:00", close: "17:00", closed: false },
        { day: "Saturday", open: "08:00", close: "14:00", closed: false },
        { day: "Sunday", open: "", close: "", closed: true },
      ],
      handicapAccessible: true,
      parkingAvailable: false,
      publicTransitAccess: true,
      latitude: 42.3554,
      longitude: -71.0603,
      createdAt: now,
    },
  ];

  sampleLocations.forEach((l) => locations.set(l.id, l));

  const samplePlans: InsurancePlan[] = [
    {
      id: "plan-1",
      carrierId: "carrier-1",
      carrierName: "Blue Cross Blue Shield",
      planName: "Blue Choice PPO",
      planType: "ppo",
      networkName: "Blue Preferred Network",
      effectiveDate: "2024-01-01",
      isActive: true,
      metadata: {},
      createdAt: now,
    },
    {
      id: "plan-2",
      carrierId: "carrier-2",
      carrierName: "Aetna",
      planName: "Aetna Open Access HMO",
      planType: "hmo",
      networkName: "Aetna Primary Network",
      effectiveDate: "2024-01-01",
      isActive: true,
      metadata: {},
      createdAt: now,
    },
    {
      id: "plan-3",
      carrierId: "carrier-3",
      carrierName: "Medicare",
      planName: "Medicare Part B",
      planType: "medicare",
      networkName: "Medicare Network",
      effectiveDate: "2024-01-01",
      isActive: true,
      metadata: {},
      createdAt: now,
    },
  ];

  samplePlans.forEach((p) => insurancePlans.set(p.id, p));

  const sampleAffiliations: ProviderNetworkAffiliation[] = [
    {
      id: "aff-1",
      providerId: "prov-1",
      insurancePlanId: "plan-1",
      networkStatus: "in_network",
      effectiveDate: "2024-01-01",
      verifiedAt: now,
      copay: 40,
      coinsurance: 20,
      priorAuthRequired: false,
      referralRequired: false,
      createdAt: now,
    },
    {
      id: "aff-2",
      providerId: "prov-2",
      insurancePlanId: "plan-1",
      networkStatus: "in_network",
      effectiveDate: "2024-01-01",
      copay: 25,
      coinsurance: 20,
      priorAuthRequired: false,
      referralRequired: false,
      createdAt: now,
    },
    {
      id: "aff-3",
      providerId: "prov-1",
      insurancePlanId: "plan-2",
      networkStatus: "in_network",
      effectiveDate: "2024-01-01",
      copay: 50,
      coinsurance: 25,
      priorAuthRequired: true,
      referralRequired: true,
      createdAt: now,
    },
  ];

  sampleAffiliations.forEach((a) => networkAffiliations.set(a.id, a));

  const samplePharmacies: PharmacyExtended[] = [
    {
      id: "pharm-1",
      ncpdpId: "1234567",
      npi: "9876543210",
      name: "CVS Pharmacy",
      chainName: "CVS",
      addressLine1: "123 Main St",
      city: "Boston",
      state: "MA",
      zipCode: "02115",
      phone: "617-555-3456",
      fax: "617-555-3457",
      email: "rx@cvs.com",
      is24Hour: true,
      hasDelivery: true,
      hasDriveThru: true,
      acceptsElectronic: true,
      acceptedInsurance: ["BCBS", "Aetna", "Medicare", "Medicaid"],
      hours: [
        { day: "Monday", open: "00:00", close: "23:59", closed: false },
        { day: "Tuesday", open: "00:00", close: "23:59", closed: false },
        { day: "Wednesday", open: "00:00", close: "23:59", closed: false },
        { day: "Thursday", open: "00:00", close: "23:59", closed: false },
        { day: "Friday", open: "00:00", close: "23:59", closed: false },
        { day: "Saturday", open: "00:00", close: "23:59", closed: false },
        { day: "Sunday", open: "00:00", close: "23:59", closed: false },
      ],
      latitude: 42.3601,
      longitude: -71.0589,
      isPreferred: true,
      createdAt: now,
    },
    {
      id: "pharm-2",
      ncpdpId: "2345678",
      name: "Walgreens",
      chainName: "Walgreens",
      addressLine1: "456 Oak Avenue",
      city: "Boston",
      state: "MA",
      zipCode: "02116",
      phone: "617-555-4567",
      is24Hour: false,
      hasDelivery: true,
      hasDriveThru: false,
      acceptsElectronic: true,
      acceptedInsurance: ["BCBS", "Aetna", "UnitedHealthcare"],
      hours: [
        { day: "Monday", open: "08:00", close: "22:00", closed: false },
        { day: "Tuesday", open: "08:00", close: "22:00", closed: false },
        { day: "Wednesday", open: "08:00", close: "22:00", closed: false },
        { day: "Thursday", open: "08:00", close: "22:00", closed: false },
        { day: "Friday", open: "08:00", close: "22:00", closed: false },
        { day: "Saturday", open: "09:00", close: "21:00", closed: false },
        { day: "Sunday", open: "10:00", close: "18:00", closed: false },
      ],
      isPreferred: false,
      createdAt: now,
    },
  ];

  samplePharmacies.forEach((p) => pharmacies.set(p.id, p));

  const sampleReferral: SpecialistReferral = {
    id: "ref-1",
    patientId: "patient-1",
    patientName: "John Smith",
    referringProviderId: "prov-2",
    referringProviderName: "Dr. Michael Chen",
    referringProviderNpi: "0987654321",
    specialistProviderId: "prov-1",
    specialistProviderName: "Dr. Sarah Johnson",
    specialistProviderNpi: "1234567890",
    specialty: "cardiology",
    referralType: "consultation",
    priority: "routine",
    status: "pending",
    reasonForReferral: "Evaluation of chest pain and shortness of breath",
    clinicalSummary: "Patient presents with intermittent chest pain for 2 weeks. EKG normal. Troponin negative. Recommend cardiology evaluation.",
    diagnoses: [
      { code: "R07.9", description: "Chest pain, unspecified" },
      { code: "R06.02", description: "Shortness of breath" },
    ],
    relevantHistory: "Hypertension, controlled on lisinopril. Family history of CAD.",
    currentMedications: ["Lisinopril 10mg daily", "Aspirin 81mg daily"],
    allergies: ["Penicillin"],
    requestedServices: ["Stress test", "Echocardiogram"],
    insuranceVerified: true,
    priorAuthRequired: false,
    validFrom: now,
    validUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    visitsUsed: 0,
    appointmentScheduled: false,
    documents: [],
    communicationLog: [],
    metadata: {},
    createdAt: now,
    updatedAt: now,
  };

  referrals.set(sampleReferral.id, sampleReferral);

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const sampleSlots: ProviderAvailabilitySlot[] = [];
  for (let i = 0; i < 5; i++) {
    const slotDate = new Date(tomorrow);
    slotDate.setDate(slotDate.getDate() + i);
    for (let hour = 9; hour <= 16; hour++) {
      const slot: ProviderAvailabilitySlot = {
        id: `slot-${i}-${hour}`,
        providerId: "prov-1",
        locationId: "loc-1",
        date: slotDate.toISOString().split("T")[0],
        startTime: `${hour.toString().padStart(2, "0")}:00`,
        endTime: `${hour.toString().padStart(2, "0")}:30`,
        status: hour % 3 === 0 ? "booked" : "available",
        appointmentTypes: ["new_patient", "follow_up", "consultation"],
        appointmentModes: ["in_person", "telehealth"],
        createdAt: now,
        updatedAt: now,
      };
      sampleSlots.push(slot);
    }
  }
  sampleSlots.forEach((s) => availabilitySlots.set(s.id, s));

  console.log("[ProviderIntegration] Service initialized with sample data");
}

initializeSampleData();

export const ehrIntegrationService = {
  getConnections(patientId: string): FhirEhrConnection[] {
    return Array.from(fhirConnections.values()).filter((c) => c.patientId === patientId);
  },

  getConnection(connectionId: string): FhirEhrConnection | undefined {
    return fhirConnections.get(connectionId);
  },

  createConnection(
    patientId: string,
    ehrSystem: EhrSystemType,
    institutionName: string,
    institutionId: string,
    fhirEndpoint: string,
    patientFhirId: string,
    scopes: string[]
  ): FhirEhrConnection {
    const now = new Date().toISOString();
    const connection: FhirEhrConnection = {
      id: `fhir-conn-${Date.now()}`,
      patientId,
      ehrSystem,
      status: "pending",
      institutionName,
      institutionId,
      fhirEndpoint,
      patientFhirId,
      scopes,
      syncedResources: [],
      metadata: {},
      createdAt: now,
      updatedAt: now,
    };
    fhirConnections.set(connection.id, connection);
    return connection;
  },

  updateConnectionStatus(connectionId: string, status: EhrConnectionStatus, error?: string): FhirEhrConnection | undefined {
    const connection = fhirConnections.get(connectionId);
    if (!connection) return undefined;
    connection.status = status;
    connection.errorMessage = error;
    connection.updatedAt = new Date().toISOString();
    return connection;
  },

  async syncConnection(connectionId: string, resourceTypes?: FhirResourceType[]): Promise<EhrSyncLog> {
    const connection = fhirConnections.get(connectionId);
    if (!connection) throw new Error("Connection not found");

    const syncLog: EhrSyncLog = {
      id: `sync-${Date.now()}`,
      connectionId,
      patientId: connection.patientId,
      syncType: resourceTypes ? "resource_specific" : "full",
      status: "started",
      resourceTypes: resourceTypes || ["Patient", "Observation", "Condition", "MedicationRequest"],
      recordsFetched: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      recordsSkipped: 0,
      errors: [],
      startedAt: new Date().toISOString(),
    };

    syncLogs.set(syncLog.id, syncLog);

    await new Promise((resolve) => setTimeout(resolve, 100));

    syncLog.status = "completed";
    syncLog.recordsFetched = Math.floor(Math.random() * 50) + 10;
    syncLog.recordsCreated = Math.floor(syncLog.recordsFetched * 0.3);
    syncLog.recordsUpdated = Math.floor(syncLog.recordsFetched * 0.5);
    syncLog.recordsSkipped = syncLog.recordsFetched - syncLog.recordsCreated - syncLog.recordsUpdated;
    syncLog.completedAt = new Date().toISOString();
    syncLog.durationMs = 100;

    connection.lastSyncAt = syncLog.completedAt;
    connection.lastSyncStatus = "success";
    connection.syncedResources = syncLog.resourceTypes;
    connection.status = "connected";
    connection.updatedAt = syncLog.completedAt;

    return syncLog;
  },

  getSyncLogs(connectionId: string): EhrSyncLog[] {
    return Array.from(syncLogs.values())
      .filter((l) => l.connectionId === connectionId)
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  },

  getSupportedSystems(): { id: EhrSystemType; name: string; logoUrl?: string; fhirVersion: string; capabilities: string[] }[] {
    return [
      { id: "fastenhealth", name: "Fasten Health", fhirVersion: "R4", capabilities: ["patient", "observations", "conditions", "medications", "allergies", "immunizations", "procedures", "documents", "encounters", "diagnostics"] },
    ];
  },

  async fetchPatientRecord(connectionId: string): Promise<{
    patient: any;
    conditions: any[];
    medications: any[];
    allergies: any[];
    labResults: any[];
    immunizations: any[];
    vitals: any[];
  }> {
    const connection = fhirConnections.get(connectionId);
    if (!connection) throw new Error("Connection not found");
    if (connection.status !== "connected") throw new Error("Connection not active");

    const now = new Date().toISOString();
    return {
      patient: {
        resourceType: "Patient",
        id: connection.patientFhirId,
        name: [{ given: ["John"], family: "Smith" }],
        gender: "male",
        birthDate: "1975-05-15",
        address: [{ city: "Boston", state: "MA", postalCode: "02115" }],
      },
      conditions: [
        { resourceType: "Condition", id: "cond-1", code: { coding: [{ system: "http://snomed.info/sct", code: "38341003", display: "Hypertension" }] }, clinicalStatus: { coding: [{ code: "active" }] }, recordedDate: "2020-03-15" },
        { resourceType: "Condition", id: "cond-2", code: { coding: [{ system: "http://snomed.info/sct", code: "44054006", display: "Type 2 Diabetes Mellitus" }] }, clinicalStatus: { coding: [{ code: "active" }] }, recordedDate: "2018-07-22" },
      ],
      medications: [
        { resourceType: "MedicationRequest", id: "med-1", medicationCodeableConcept: { coding: [{ system: "http://www.nlm.nih.gov/research/umls/rxnorm", code: "197884", display: "Lisinopril 10 MG Oral Tablet" }] }, status: "active", dosageInstruction: [{ text: "Take 1 tablet daily" }] },
        { resourceType: "MedicationRequest", id: "med-2", medicationCodeableConcept: { coding: [{ system: "http://www.nlm.nih.gov/research/umls/rxnorm", code: "860975", display: "Metformin 500 MG Oral Tablet" }] }, status: "active", dosageInstruction: [{ text: "Take 1 tablet twice daily with meals" }] },
      ],
      allergies: [
        { resourceType: "AllergyIntolerance", id: "allergy-1", code: { coding: [{ system: "http://www.nlm.nih.gov/research/umls/rxnorm", code: "7984", display: "Penicillin" }] }, clinicalStatus: { coding: [{ code: "active" }] }, criticality: "high", reaction: [{ manifestation: [{ coding: [{ display: "Anaphylaxis" }] }] }] },
      ],
      labResults: [
        { resourceType: "Observation", id: "lab-1", code: { coding: [{ system: "http://loinc.org", code: "4548-4", display: "Hemoglobin A1c" }] }, valueQuantity: { value: 6.8, unit: "%" }, effectiveDateTime: now, status: "final" },
        { resourceType: "Observation", id: "lab-2", code: { coding: [{ system: "http://loinc.org", code: "2339-0", display: "Glucose" }] }, valueQuantity: { value: 105, unit: "mg/dL" }, effectiveDateTime: now, status: "final" },
        { resourceType: "Observation", id: "lab-3", code: { coding: [{ system: "http://loinc.org", code: "2160-0", display: "Creatinine" }] }, valueQuantity: { value: 1.1, unit: "mg/dL" }, effectiveDateTime: now, status: "final" },
      ],
      immunizations: [
        { resourceType: "Immunization", id: "imm-1", vaccineCode: { coding: [{ system: "http://hl7.org/fhir/sid/cvx", code: "207", display: "COVID-19 Vaccine" }] }, occurrenceDateTime: "2024-01-15", status: "completed" },
        { resourceType: "Immunization", id: "imm-2", vaccineCode: { coding: [{ system: "http://hl7.org/fhir/sid/cvx", code: "140", display: "Influenza Vaccine" }] }, occurrenceDateTime: "2024-10-01", status: "completed" },
      ],
      vitals: [
        { resourceType: "Observation", id: "vital-1", code: { coding: [{ system: "http://loinc.org", code: "8480-6", display: "Systolic Blood Pressure" }] }, valueQuantity: { value: 128, unit: "mmHg" }, effectiveDateTime: now, status: "final" },
        { resourceType: "Observation", id: "vital-2", code: { coding: [{ system: "http://loinc.org", code: "8462-4", display: "Diastolic Blood Pressure" }] }, valueQuantity: { value: 82, unit: "mmHg" }, effectiveDateTime: now, status: "final" },
        { resourceType: "Observation", id: "vital-3", code: { coding: [{ system: "http://loinc.org", code: "8867-4", display: "Heart Rate" }] }, valueQuantity: { value: 72, unit: "beats/min" }, effectiveDateTime: now, status: "final" },
      ],
    };
  },

  async fetchLabResults(connectionId: string, dateFrom?: string, dateTo?: string): Promise<any[]> {
    const connection = fhirConnections.get(connectionId);
    if (!connection) throw new Error("Connection not found");

    const now = new Date().toISOString();
    const labCategories = [
      { panel: "Complete Blood Count", tests: [
        { code: "6690-2", display: "WBC", value: 7.2, unit: "x10^9/L", reference: "4.5-11.0" },
        { code: "789-8", display: "RBC", value: 4.8, unit: "x10^12/L", reference: "4.5-5.5" },
        { code: "718-7", display: "Hemoglobin", value: 14.2, unit: "g/dL", reference: "13.5-17.5" },
        { code: "777-3", display: "Platelet Count", value: 225, unit: "x10^9/L", reference: "150-400" },
      ]},
      { panel: "Comprehensive Metabolic Panel", tests: [
        { code: "2339-0", display: "Glucose", value: 105, unit: "mg/dL", reference: "70-100" },
        { code: "2160-0", display: "Creatinine", value: 1.1, unit: "mg/dL", reference: "0.7-1.3" },
        { code: "3094-0", display: "BUN", value: 18, unit: "mg/dL", reference: "7-20" },
        { code: "2951-2", display: "Sodium", value: 140, unit: "mEq/L", reference: "136-145" },
        { code: "2823-3", display: "Potassium", value: 4.2, unit: "mEq/L", reference: "3.5-5.0" },
      ]},
      { panel: "Lipid Panel", tests: [
        { code: "2093-3", display: "Total Cholesterol", value: 195, unit: "mg/dL", reference: "<200" },
        { code: "2085-9", display: "HDL Cholesterol", value: 55, unit: "mg/dL", reference: ">40" },
        { code: "2089-1", display: "LDL Cholesterol", value: 118, unit: "mg/dL", reference: "<100" },
        { code: "2571-8", display: "Triglycerides", value: 145, unit: "mg/dL", reference: "<150" },
      ]},
    ];

    return labCategories.flatMap(category => 
      category.tests.map(test => ({
        resourceType: "Observation",
        id: `lab-${test.code}-${Date.now()}`,
        category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/observation-category", code: "laboratory" }] }],
        code: { coding: [{ system: "http://loinc.org", code: test.code, display: test.display }], text: test.display },
        valueQuantity: { value: test.value, unit: test.unit },
        referenceRange: [{ text: test.reference }],
        effectiveDateTime: now,
        status: "final",
        panel: category.panel,
      }))
    );
  },

  async fetchMedicationHistory(connectionId: string): Promise<any[]> {
    const connection = fhirConnections.get(connectionId);
    if (!connection) throw new Error("Connection not found");

    return [
      { resourceType: "MedicationRequest", id: "med-hist-1", medicationCodeableConcept: { coding: [{ system: "http://www.nlm.nih.gov/research/umls/rxnorm", code: "197884", display: "Lisinopril 10 MG" }] }, status: "active", authoredOn: "2020-03-20", dosageInstruction: [{ text: "Take 1 tablet daily in the morning" }], dispenseRequest: { numberOfRepeatsAllowed: 11, quantity: { value: 30, unit: "tablets" } } },
      { resourceType: "MedicationRequest", id: "med-hist-2", medicationCodeableConcept: { coding: [{ system: "http://www.nlm.nih.gov/research/umls/rxnorm", code: "860975", display: "Metformin 500 MG" }] }, status: "active", authoredOn: "2018-08-01", dosageInstruction: [{ text: "Take 1 tablet twice daily with meals" }], dispenseRequest: { numberOfRepeatsAllowed: 11, quantity: { value: 60, unit: "tablets" } } },
      { resourceType: "MedicationRequest", id: "med-hist-3", medicationCodeableConcept: { coding: [{ system: "http://www.nlm.nih.gov/research/umls/rxnorm", code: "313782", display: "Atorvastatin 20 MG" }] }, status: "active", authoredOn: "2021-01-15", dosageInstruction: [{ text: "Take 1 tablet at bedtime" }], dispenseRequest: { numberOfRepeatsAllowed: 11, quantity: { value: 30, unit: "tablets" } } },
      { resourceType: "MedicationRequest", id: "med-hist-4", medicationCodeableConcept: { coding: [{ system: "http://www.nlm.nih.gov/research/umls/rxnorm", code: "243670", display: "Aspirin 81 MG" }] }, status: "active", authoredOn: "2020-03-20", dosageInstruction: [{ text: "Take 1 tablet daily" }], dispenseRequest: { numberOfRepeatsAllowed: 11, quantity: { value: 30, unit: "tablets" } } },
      { resourceType: "MedicationRequest", id: "med-hist-5", medicationCodeableConcept: { coding: [{ system: "http://www.nlm.nih.gov/research/umls/rxnorm", code: "312617", display: "Amlodipine 5 MG" }] }, status: "stopped", authoredOn: "2019-06-10", dosageInstruction: [{ text: "Take 1 tablet daily" }], note: [{ text: "Discontinued due to ankle edema" }] },
    ];
  },

  async sendPrescriptionToEhr(connectionId: string, prescription: any): Promise<{ success: boolean; ehrPrescriptionId: string; timestamp: string }> {
    const connection = fhirConnections.get(connectionId);
    if (!connection) throw new Error("Connection not found");

    await new Promise(resolve => setTimeout(resolve, 150));

    return {
      success: true,
      ehrPrescriptionId: `${connection.ehrSystem.toUpperCase()}-RX-${Date.now()}`,
      timestamp: new Date().toISOString(),
    };
  },

  async sendReferralToEhr(connectionId: string, referral: SpecialistReferral): Promise<{ success: boolean; ehrReferralId: string; timestamp: string; acknowledgment?: string }> {
    const connection = fhirConnections.get(connectionId);
    if (!connection) throw new Error("Connection not found");

    await new Promise(resolve => setTimeout(resolve, 200));

    return {
      success: true,
      ehrReferralId: `${connection.ehrSystem.toUpperCase()}-REF-${Date.now()}`,
      timestamp: new Date().toISOString(),
      acknowledgment: "Referral received and queued for processing",
    };
  },

  async queryExternalProvider(ehrSystem: EhrSystemType, providerId: string): Promise<any> {
    return {
      found: true,
      provider: {
        npi: providerId,
        name: "External Provider",
        specialty: "General Practice",
        organization: "External Health System",
        address: { city: "Boston", state: "MA" },
        acceptingReferrals: true,
        fhirEndpoint: `https://${ehrSystem}.example.com/fhir/r4`,
      },
    };
  },
};

export const providerDirectoryService = {
  searchProviders(filters: ProviderSearchFilters): ProviderSearchResult {
    let results = Array.from(providers.values());

    if (filters.specialty) {
      results = results.filter((p) => p.specialties.includes(filters.specialty!) || p.primarySpecialty === filters.specialty);
    }
    if (filters.providerType) {
      results = results.filter((p) => p.providerType === filters.providerType);
    }
    if (filters.name) {
      const searchName = filters.name.toLowerCase();
      results = results.filter((p) =>
        `${p.firstName} ${p.lastName}`.toLowerCase().includes(searchName) ||
        p.lastName.toLowerCase().includes(searchName)
      );
    }
    if (filters.acceptingNewPatients !== undefined) {
      results = results.filter((p) => p.acceptingNewPatients === filters.acceptingNewPatients);
    }
    if (filters.appointmentMode) {
      results = results.filter((p) => p.appointmentModes.includes(filters.appointmentMode!));
    }
    if (filters.language) {
      results = results.filter((p) => p.languages.includes(filters.language!));
    }
    if (filters.minRating) {
      results = results.filter((p) => (p.averageRating || 0) >= filters.minRating!);
    }

    if (filters.sortBy === "rating") {
      results.sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0));
    } else if (filters.sortBy === "name") {
      results.sort((a, b) => a.lastName.localeCompare(b.lastName));
    }

    const page = filters.page || 1;
    const pageSize = filters.pageSize || 20;
    const startIndex = (page - 1) * pageSize;
    const paginatedResults = results.slice(startIndex, startIndex + pageSize);

    const providersWithLocations = paginatedResults.map((p) => {
      const primaryLocation = Array.from(locations.values()).find(
        (l) => l.providerId === p.id && l.isPrimary
      ) || Array.from(locations.values()).find((l) => l.providerId === p.id);

      let networkStatus: "in_network" | "out_of_network" | "pending_verification" | undefined;
      if (filters.insurancePlanId) {
        const affiliation = Array.from(networkAffiliations.values()).find(
          (a) => a.providerId === p.id && a.insurancePlanId === filters.insurancePlanId
        );
        networkStatus = affiliation?.networkStatus;
      }

      const nextSlot = Array.from(availabilitySlots.values())
        .filter((s) => s.providerId === p.id && s.status === "available")
        .sort((a, b) => new Date(`${a.date}T${a.startTime}`).getTime() - new Date(`${b.date}T${b.startTime}`).getTime())[0];

      return {
        ...p,
        primaryLocation: primaryLocation!,
        networkStatus,
        nextAvailable: nextSlot ? `${nextSlot.date} ${nextSlot.startTime}` : undefined,
      };
    });

    return {
      providers: providersWithLocations.filter((p) => p.primaryLocation),
      totalCount: results.length,
      page,
      pageSize,
      hasMore: startIndex + pageSize < results.length,
    };
  },

  getProvider(providerId: string): HealthcareProvider | undefined {
    return providers.get(providerId);
  },

  getProviderLocations(providerId: string): ProviderLocation[] {
    return Array.from(locations.values()).filter((l) => l.providerId === providerId);
  },

  getSpecialties(): { id: ProviderSpecialty; name: string }[] {
    const specialtyNames: Record<ProviderSpecialty, string> = {
      family_medicine: "Family Medicine",
      internal_medicine: "Internal Medicine",
      pediatrics: "Pediatrics",
      cardiology: "Cardiology",
      dermatology: "Dermatology",
      endocrinology: "Endocrinology",
      gastroenterology: "Gastroenterology",
      neurology: "Neurology",
      obstetrics_gynecology: "OB/GYN",
      oncology: "Oncology",
      ophthalmology: "Ophthalmology",
      orthopedics: "Orthopedics",
      psychiatry: "Psychiatry",
      pulmonology: "Pulmonology",
      rheumatology: "Rheumatology",
      urology: "Urology",
      allergy_immunology: "Allergy & Immunology",
      emergency_medicine: "Emergency Medicine",
      radiology: "Radiology",
      pathology: "Pathology",
      anesthesiology: "Anesthesiology",
      surgery_general: "General Surgery",
      plastic_surgery: "Plastic Surgery",
      physical_therapy: "Physical Therapy",
      other: "Other",
    };

    return Object.entries(specialtyNames).map(([id, name]) => ({
      id: id as ProviderSpecialty,
      name,
    }));
  },
};

export const prescriptionRoutingService = {
  getPharmacies(zipCode?: string, limit = 20): PharmacyExtended[] {
    let results = Array.from(pharmacies.values());
    if (zipCode) {
      results = results.filter((p) => p.zipCode.startsWith(zipCode.substring(0, 3)));
    }
    return results.slice(0, limit);
  },

  getPharmacy(pharmacyId: string): PharmacyExtended | undefined {
    return pharmacies.get(pharmacyId);
  },

  getPatientPrescriptions(patientId: string): EPrescription[] {
    return Array.from(ePrescriptions.values())
      .filter((p) => p.patientId === patientId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  createPrescription(data: Omit<EPrescription, "id" | "status" | "refillsRemaining" | "createdAt" | "updatedAt">): EPrescription {
    const now = new Date().toISOString();
    const prescription: EPrescription = {
      ...data,
      id: `rx-${Date.now()}`,
      status: "pending",
      refillsRemaining: data.refillsAuthorized,
      createdAt: now,
      updatedAt: now,
    };
    ePrescriptions.set(prescription.id, prescription);
    return prescription;
  },

  async sendPrescription(prescriptionId: string): Promise<EPrescription> {
    const prescription = ePrescriptions.get(prescriptionId);
    if (!prescription) throw new Error("Prescription not found");

    await new Promise((resolve) => setTimeout(resolve, 100));

    prescription.status = "sent";
    prescription.transmittedAt = new Date().toISOString();
    prescription.updatedAt = prescription.transmittedAt;

    return prescription;
  },

  updatePrescriptionStatus(prescriptionId: string, status: EPrescriptionStatus, notes?: string): EPrescription | undefined {
    const prescription = ePrescriptions.get(prescriptionId);
    if (!prescription) return undefined;

    prescription.status = status;
    prescription.updatedAt = new Date().toISOString();
    if (notes) prescription.pharmacyNotes = notes;

    if (status === "filled") prescription.filledAt = prescription.updatedAt;
    if (status === "ready_pickup") prescription.readyAt = prescription.updatedAt;
    if (status === "picked_up") prescription.pickedUpAt = prescription.updatedAt;
    if (status === "delivered") prescription.deliveredAt = prescription.updatedAt;

    return prescription;
  },

  trackPrescription(prescriptionId: string): { status: EPrescriptionStatus; timeline: { status: string; timestamp: string }[] } | undefined {
    const prescription = ePrescriptions.get(prescriptionId);
    if (!prescription) return undefined;

    const timeline: { status: string; timestamp: string }[] = [];
    timeline.push({ status: "created", timestamp: prescription.createdAt });
    if (prescription.transmittedAt) timeline.push({ status: "sent", timestamp: prescription.transmittedAt });
    if (prescription.receivedAt) timeline.push({ status: "received", timestamp: prescription.receivedAt });
    if (prescription.filledAt) timeline.push({ status: "filled", timestamp: prescription.filledAt });
    if (prescription.readyAt) timeline.push({ status: "ready", timestamp: prescription.readyAt });
    if (prescription.pickedUpAt) timeline.push({ status: "picked_up", timestamp: prescription.pickedUpAt });
    if (prescription.deliveredAt) timeline.push({ status: "delivered", timestamp: prescription.deliveredAt });

    return { status: prescription.status, timeline };
  },
};

export const referralManagementService = {
  getPatientReferrals(patientId: string): SpecialistReferral[] {
    return Array.from(referrals.values())
      .filter((r) => r.patientId === patientId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  getProviderReferrals(providerId: string, role: "referring" | "specialist"): SpecialistReferral[] {
    return Array.from(referrals.values())
      .filter((r) =>
        role === "referring" ? r.referringProviderId === providerId : r.specialistProviderId === providerId
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  getReferral(referralId: string): SpecialistReferral | undefined {
    return referrals.get(referralId);
  },

  createReferral(data: Omit<SpecialistReferral, "id" | "status" | "visitsUsed" | "appointmentScheduled" | "documents" | "communicationLog" | "createdAt" | "updatedAt">): SpecialistReferral {
    const now = new Date().toISOString();
    const referral: SpecialistReferral = {
      ...data,
      id: `ref-${Date.now()}`,
      status: "draft",
      visitsUsed: 0,
      appointmentScheduled: false,
      documents: [],
      communicationLog: [],
      createdAt: now,
      updatedAt: now,
    };
    referrals.set(referral.id, referral);
    return referral;
  },

  updateReferralStatus(referralId: string, status: ReferralStatus, notes?: string): SpecialistReferral | undefined {
    const referral = referrals.get(referralId);
    if (!referral) return undefined;

    referral.status = status;
    referral.updatedAt = new Date().toISOString();

    if (status === "completed" && notes) {
      referral.consultationReport = notes;
      referral.completedDate = referral.updatedAt;
    }

    return referral;
  },

  assignSpecialist(referralId: string, specialistProviderId: string): SpecialistReferral | undefined {
    const referral = referrals.get(referralId);
    const specialist = providers.get(specialistProviderId);
    if (!referral || !specialist) return undefined;

    referral.specialistProviderId = specialistProviderId;
    referral.specialistProviderName = `Dr. ${specialist.firstName} ${specialist.lastName}`;
    referral.specialistProviderNpi = specialist.npi;
    referral.status = "submitted";
    referral.updatedAt = new Date().toISOString();

    return referral;
  },

  addCommunicationLog(referralId: string, from: string, to: string, message: string, method: string): SpecialistReferral | undefined {
    const referral = referrals.get(referralId);
    if (!referral) return undefined;

    referral.communicationLog.push({
      date: new Date().toISOString(),
      from,
      to,
      message,
      method,
    });
    referral.updatedAt = new Date().toISOString();

    return referral;
  },
};

export const availabilityService = {
  getProviderSlots(providerId: string, startDate: string, endDate: string): ProviderAvailabilitySlot[] {
    return Array.from(availabilitySlots.values())
      .filter(
        (s) =>
          s.providerId === providerId &&
          s.date >= startDate &&
          s.date <= endDate
      )
      .sort((a, b) => {
        const dateCompare = a.date.localeCompare(b.date);
        return dateCompare !== 0 ? dateCompare : a.startTime.localeCompare(b.startTime);
      });
  },

  getAvailableSlots(providerId: string, startDate: string, endDate: string, appointmentType?: string): ProviderAvailabilitySlot[] {
    return this.getProviderSlots(providerId, startDate, endDate).filter(
      (s) =>
        s.status === "available" &&
        (!appointmentType || s.appointmentTypes.includes(appointmentType as any))
    );
  },

  bookSlot(slotId: string, patientId: string, appointmentId: string): ProviderAvailabilitySlot | undefined {
    const slot = availabilitySlots.get(slotId);
    if (!slot || slot.status !== "available") return undefined;

    slot.status = "booked";
    slot.bookedPatientId = patientId;
    slot.bookedAppointmentId = appointmentId;
    slot.updatedAt = new Date().toISOString();

    return slot;
  },

  cancelSlotBooking(slotId: string): ProviderAvailabilitySlot | undefined {
    const slot = availabilitySlots.get(slotId);
    if (!slot) return undefined;

    slot.status = "available";
    slot.bookedPatientId = undefined;
    slot.bookedAppointmentId = undefined;
    slot.updatedAt = new Date().toISOString();

    return slot;
  },

  blockSlot(slotId: string, reason: string): ProviderAvailabilitySlot | undefined {
    const slot = availabilitySlots.get(slotId);
    if (!slot) return undefined;

    slot.status = "blocked";
    slot.blockReason = reason;
    slot.updatedAt = new Date().toISOString();

    return slot;
  },

  getCalendarSyncs(providerId: string): ExternalCalendarSync[] {
    return Array.from(calendarSyncs.values()).filter((c) => c.providerId === providerId);
  },

  async syncExternalCalendar(syncId: string): Promise<{ success: boolean; slotsImported: number }> {
    const sync = calendarSyncs.get(syncId);
    if (!sync) throw new Error("Calendar sync not found");

    await new Promise((resolve) => setTimeout(resolve, 100));

    sync.lastSyncAt = new Date().toISOString();
    sync.lastSyncStatus = "success";

    return { success: true, slotsImported: Math.floor(Math.random() * 20) + 5 };
  },
};

export const insuranceNetworkService = {
  getInsurancePlans(carrierId?: string): InsurancePlan[] {
    let results = Array.from(insurancePlans.values());
    if (carrierId) {
      results = results.filter((p) => p.carrierId === carrierId);
    }
    return results.filter((p) => p.isActive);
  },

  getPatientInsurance(patientId: string): PatientInsurance[] {
    return Array.from(patientInsurance.values())
      .filter((i) => i.patientId === patientId)
      .sort((a, b) => (a.isPrimary ? -1 : 1));
  },

  addPatientInsurance(data: Omit<PatientInsurance, "id" | "createdAt" | "updatedAt">): PatientInsurance {
    const now = new Date().toISOString();
    const insurance: PatientInsurance = {
      ...data,
      id: `ins-${Date.now()}`,
      createdAt: now,
      updatedAt: now,
    };
    patientInsurance.set(insurance.id, insurance);
    return insurance;
  },

  verifyInsurance(insuranceId: string): PatientInsurance | undefined {
    const insurance = patientInsurance.get(insuranceId);
    if (!insurance) return undefined;

    insurance.verifiedAt = new Date().toISOString();
    insurance.updatedAt = insurance.verifiedAt;

    return insurance;
  },

  findInNetworkProviders(insurancePlanId: string, specialty?: ProviderSpecialty): InsuranceNetworkMatch[] {
    const affiliations = Array.from(networkAffiliations.values())
      .filter((a) => a.insurancePlanId === insurancePlanId && a.networkStatus === "in_network");

    const matches: InsuranceNetworkMatch[] = [];

    for (const affiliation of affiliations) {
      const provider = providers.get(affiliation.providerId);
      if (!provider) continue;

      if (specialty && !provider.specialties.includes(specialty) && provider.primarySpecialty !== specialty) {
        continue;
      }

      const location = Array.from(locations.values()).find(
        (l) => l.providerId === provider.id && l.isPrimary
      );
      if (!location) continue;

      matches.push({
        providerId: provider.id,
        provider,
        location,
        networkStatus: affiliation.networkStatus,
        insurancePlanId,
        copay: affiliation.copay,
        coinsurance: affiliation.coinsurance,
        priorAuthRequired: affiliation.priorAuthRequired,
        referralRequired: affiliation.referralRequired,
        matchScore: (provider.averageRating || 0) * 20,
        matchReasons: [
          "In-network provider",
          provider.acceptingNewPatients ? "Accepting new patients" : "",
          provider.appointmentModes.includes("telehealth") ? "Telehealth available" : "",
        ].filter(Boolean),
      });
    }

    return matches.sort((a, b) => b.matchScore - a.matchScore);
  },

  checkNetworkStatus(providerId: string, insurancePlanId: string): ProviderNetworkAffiliation | undefined {
    return Array.from(networkAffiliations.values()).find(
      (a) => a.providerId === providerId && a.insurancePlanId === insurancePlanId
    );
  },
};

export const appointmentBookingService = {
  getPatientBookings(patientId: string): ProviderAppointmentBooking[] {
    return Array.from(bookings.values())
      .filter((b) => b.patientId === patientId)
      .sort((a, b) => new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime());
  },

  getProviderBookings(providerId: string, date?: string): ProviderAppointmentBooking[] {
    let results = Array.from(bookings.values()).filter((b) => b.providerId === providerId);
    if (date) {
      results = results.filter((b) => b.scheduledDate === date);
    }
    return results.sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));
  },

  getBooking(bookingId: string): ProviderAppointmentBooking | undefined {
    return bookings.get(bookingId);
  },

  createBooking(data: Omit<ProviderAppointmentBooking, "id" | "status" | "insuranceVerified" | "copayCollected" | "priorAuthRequired" | "remindersSent" | "createdAt" | "updatedAt">): ProviderAppointmentBooking {
    const now = new Date().toISOString();
    const booking: ProviderAppointmentBooking = {
      ...data,
      id: `booking-${Date.now()}`,
      status: "scheduled",
      insuranceVerified: false,
      copayCollected: false,
      priorAuthRequired: false,
      remindersSent: [],
      metadata: {},
      createdAt: now,
      updatedAt: now,
    };

    availabilityService.bookSlot(data.slotId, data.patientId, booking.id);
    bookings.set(booking.id, booking);

    return booking;
  },

  confirmBooking(bookingId: string): ProviderAppointmentBooking | undefined {
    const booking = bookings.get(bookingId);
    if (!booking) return undefined;

    booking.status = "confirmed";
    booking.updatedAt = new Date().toISOString();

    return booking;
  },

  checkInPatient(bookingId: string): ProviderAppointmentBooking | undefined {
    const booking = bookings.get(bookingId);
    if (!booking) return undefined;

    booking.status = "checked_in";
    booking.checkInTime = new Date().toISOString();
    booking.updatedAt = booking.checkInTime;

    return booking;
  },

  startAppointment(bookingId: string): ProviderAppointmentBooking | undefined {
    const booking = bookings.get(bookingId);
    if (!booking) return undefined;

    booking.status = "in_progress";
    booking.startTime = new Date().toISOString();
    booking.updatedAt = booking.startTime;

    return booking;
  },

  completeAppointment(bookingId: string, notes?: string): ProviderAppointmentBooking | undefined {
    const booking = bookings.get(bookingId);
    if (!booking) return undefined;

    booking.status = "completed";
    booking.endTime = new Date().toISOString();
    if (notes) booking.notes = notes;
    booking.updatedAt = booking.endTime;

    return booking;
  },

  cancelBooking(bookingId: string, reason: string, cancelledBy: string): ProviderAppointmentBooking | undefined {
    const booking = bookings.get(bookingId);
    if (!booking) return undefined;

    booking.status = "cancelled";
    booking.cancellationReason = reason;
    booking.cancelledBy = cancelledBy;
    booking.cancelledAt = new Date().toISOString();
    booking.updatedAt = booking.cancelledAt;

    availabilityService.cancelSlotBooking(booking.slotId);

    return booking;
  },

  markNoShow(bookingId: string): ProviderAppointmentBooking | undefined {
    const booking = bookings.get(bookingId);
    if (!booking) return undefined;

    booking.status = "no_show";
    booking.updatedAt = new Date().toISOString();

    return booking;
  },
};
