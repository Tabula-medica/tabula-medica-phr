import { randomUUID, createHash } from "crypto";
import type { 
  FhirResource, 
  FhirPatient, 
  FhirObservation, 
  FhirCondition, 
  FhirMedicationRequest, 
  FhirEncounter,
  FhirProcedure,
  FhirImmunization,
  FhirAllergyIntolerance,
  FhirDiagnosticReport,
} from "./integrations/interfaces";
import { getFhirStore, getAnalyticsStore, getAuditLogger } from "./integrations/factory";

const DEIDENTIFY_SALT = process.env.DEIDENTIFY_SALT || randomUUID();

function hashIdentifier(value: string): string {
  return createHash("sha256").update(DEIDENTIFY_SALT + value).digest("hex").slice(0, 32);
}

export interface BigQueryTableSchema {
  tableName: string;
  description: string;
  fields: Array<{
    name: string;
    type: "STRING" | "INTEGER" | "FLOAT" | "BOOLEAN" | "TIMESTAMP" | "DATE" | "RECORD" | "ARRAY";
    mode: "NULLABLE" | "REQUIRED" | "REPEATED";
    description?: string;
    fields?: BigQueryTableSchema["fields"];
  }>;
}

export interface DataWarehouseJob {
  jobId: string;
  type: "schema_creation" | "full_export" | "incremental_export" | "transformation" | "analytics_refresh";
  status: "pending" | "running" | "completed" | "failed";
  tables?: string[];
  recordsProcessed?: number;
  error?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  metadata?: Record<string, unknown>;
}

export interface ScheduledExport {
  id: string;
  name: string;
  schedule: string;
  enabled: boolean;
  exportType: "full" | "incremental";
  tables: string[];
  deIdentify: boolean;
  lastRun?: string;
  nextRun?: string;
  createdAt: string;
}

export interface AnalyticsDashboard {
  patientCohorts: PatientCohortAnalytics[];
  treatmentEffectiveness: TreatmentEffectivenessMetrics[];
  operationalMetrics: OperationalMetrics;
  populationHealth: PopulationHealthSummary;
}

export interface PatientCohortAnalytics {
  cohortId: string;
  name: string;
  description: string;
  patientCount: number;
  avgAge: number;
  genderDistribution: { male: number; female: number; other: number };
  topConditions: Array<{ code: string; display: string; count: number }>;
  riskScores: { high: number; medium: number; low: number };
}

export interface TreatmentEffectivenessMetrics {
  treatmentCode: string;
  treatmentName: string;
  patientCount: number;
  avgDurationDays: number;
  outcomeDistribution: { improved: number; stable: number; worsened: number };
  adherenceRate: number;
  adverseEventRate: number;
}

export interface OperationalMetrics {
  totalEncounters: number;
  avgEncounterDuration: number;
  encountersByType: Record<string, number>;
  readmissionRate30Day: number;
  avgLengthOfStay: number;
  bedOccupancy: number;
  staffUtilization: number;
}

export interface PopulationHealthSummary {
  totalPatients: number;
  activePatients: number;
  avgAge: number;
  chronicConditionPrevalence: Record<string, number>;
  preventiveCareCompliance: number;
  vaccinationCoverage: number;
  averageRiskScore: number;
}

const warehouseJobs: Map<string, DataWarehouseJob> = new Map();
const scheduledExports: Map<string, ScheduledExport> = new Map();
const scheduleTimers: Map<string, NodeJS.Timeout> = new Map();

export const HEALTHCARE_ANALYTICS_SCHEMAS: BigQueryTableSchema[] = [
  {
    tableName: "dim_patients",
    description: "Patient dimension table with de-identified demographics",
    fields: [
      { name: "patient_hash", type: "STRING", mode: "REQUIRED", description: "De-identified patient identifier" },
      { name: "birth_year", type: "INTEGER", mode: "NULLABLE", description: "Year of birth only (HIPAA compliant)" },
      { name: "gender", type: "STRING", mode: "NULLABLE", description: "Administrative gender" },
      { name: "race", type: "STRING", mode: "NULLABLE", description: "Race category" },
      { name: "ethnicity", type: "STRING", mode: "NULLABLE", description: "Ethnicity category" },
      { name: "state", type: "STRING", mode: "NULLABLE", description: "State of residence (3-digit truncation)" },
      { name: "is_deceased", type: "BOOLEAN", mode: "NULLABLE", description: "Deceased flag" },
      { name: "first_encounter_date", type: "DATE", mode: "NULLABLE", description: "Date of first encounter" },
      { name: "last_encounter_date", type: "DATE", mode: "NULLABLE", description: "Date of most recent encounter" },
      { name: "total_encounters", type: "INTEGER", mode: "NULLABLE", description: "Total number of encounters" },
      { name: "active_conditions_count", type: "INTEGER", mode: "NULLABLE", description: "Count of active conditions" },
      { name: "active_medications_count", type: "INTEGER", mode: "NULLABLE", description: "Count of active medications" },
      { name: "risk_score", type: "FLOAT", mode: "NULLABLE", description: "Computed risk score" },
      { name: "cohort_ids", type: "STRING", mode: "REPEATED", description: "Assigned cohort identifiers" },
      { name: "etl_timestamp", type: "TIMESTAMP", mode: "REQUIRED", description: "ETL processing timestamp" },
    ],
  },
  {
    tableName: "fact_encounters",
    description: "Encounter fact table for operational and clinical analytics",
    fields: [
      { name: "encounter_hash", type: "STRING", mode: "REQUIRED", description: "De-identified encounter identifier" },
      { name: "patient_hash", type: "STRING", mode: "REQUIRED", description: "De-identified patient identifier" },
      { name: "encounter_date", type: "DATE", mode: "REQUIRED", description: "Encounter date" },
      { name: "encounter_start", type: "TIMESTAMP", mode: "NULLABLE", description: "Encounter start time" },
      { name: "encounter_end", type: "TIMESTAMP", mode: "NULLABLE", description: "Encounter end time" },
      { name: "duration_minutes", type: "INTEGER", mode: "NULLABLE", description: "Encounter duration in minutes" },
      { name: "encounter_class", type: "STRING", mode: "NULLABLE", description: "Encounter class (ambulatory, emergency, inpatient)" },
      { name: "encounter_type_code", type: "STRING", mode: "NULLABLE", description: "Encounter type code" },
      { name: "encounter_type_display", type: "STRING", mode: "NULLABLE", description: "Encounter type description" },
      { name: "reason_code", type: "STRING", mode: "NULLABLE", description: "Primary reason code" },
      { name: "reason_display", type: "STRING", mode: "NULLABLE", description: "Primary reason description" },
      { name: "discharge_disposition", type: "STRING", mode: "NULLABLE", description: "Discharge disposition code" },
      { name: "facility_hash", type: "STRING", mode: "NULLABLE", description: "De-identified facility identifier" },
      { name: "provider_hash", type: "STRING", mode: "NULLABLE", description: "De-identified provider identifier" },
      { name: "is_readmission", type: "BOOLEAN", mode: "NULLABLE", description: "30-day readmission flag" },
      { name: "length_of_stay_days", type: "INTEGER", mode: "NULLABLE", description: "Length of stay for inpatient" },
      { name: "etl_timestamp", type: "TIMESTAMP", mode: "REQUIRED", description: "ETL processing timestamp" },
    ],
  },
  {
    tableName: "fact_observations",
    description: "Observation fact table for clinical measurements and lab results",
    fields: [
      { name: "observation_hash", type: "STRING", mode: "REQUIRED", description: "De-identified observation identifier" },
      { name: "patient_hash", type: "STRING", mode: "REQUIRED", description: "De-identified patient identifier" },
      { name: "encounter_hash", type: "STRING", mode: "NULLABLE", description: "Related encounter identifier" },
      { name: "observation_date", type: "DATE", mode: "REQUIRED", description: "Observation date" },
      { name: "observation_datetime", type: "TIMESTAMP", mode: "NULLABLE", description: "Observation timestamp" },
      { name: "category", type: "STRING", mode: "NULLABLE", description: "Observation category (vital-signs, laboratory)" },
      { name: "code", type: "STRING", mode: "REQUIRED", description: "LOINC or SNOMED code" },
      { name: "code_display", type: "STRING", mode: "NULLABLE", description: "Code display name" },
      { name: "value_numeric", type: "FLOAT", mode: "NULLABLE", description: "Numeric value" },
      { name: "value_string", type: "STRING", mode: "NULLABLE", description: "String value" },
      { name: "value_unit", type: "STRING", mode: "NULLABLE", description: "Value unit" },
      { name: "reference_range_low", type: "FLOAT", mode: "NULLABLE", description: "Reference range low" },
      { name: "reference_range_high", type: "FLOAT", mode: "NULLABLE", description: "Reference range high" },
      { name: "interpretation", type: "STRING", mode: "NULLABLE", description: "Interpretation code (H, L, N, A)" },
      { name: "status", type: "STRING", mode: "REQUIRED", description: "Observation status" },
      { name: "etl_timestamp", type: "TIMESTAMP", mode: "REQUIRED", description: "ETL processing timestamp" },
    ],
  },
  {
    tableName: "fact_conditions",
    description: "Condition fact table for diagnosis and problem tracking",
    fields: [
      { name: "condition_hash", type: "STRING", mode: "REQUIRED", description: "De-identified condition identifier" },
      { name: "patient_hash", type: "STRING", mode: "REQUIRED", description: "De-identified patient identifier" },
      { name: "encounter_hash", type: "STRING", mode: "NULLABLE", description: "Related encounter identifier" },
      { name: "onset_date", type: "DATE", mode: "NULLABLE", description: "Condition onset date" },
      { name: "recorded_date", type: "DATE", mode: "NULLABLE", description: "Date condition was recorded" },
      { name: "abatement_date", type: "DATE", mode: "NULLABLE", description: "Condition resolution date" },
      { name: "code", type: "STRING", mode: "REQUIRED", description: "ICD-10 or SNOMED code" },
      { name: "code_display", type: "STRING", mode: "NULLABLE", description: "Condition display name" },
      { name: "category", type: "STRING", mode: "NULLABLE", description: "Condition category" },
      { name: "clinical_status", type: "STRING", mode: "NULLABLE", description: "Clinical status (active, resolved, inactive)" },
      { name: "verification_status", type: "STRING", mode: "NULLABLE", description: "Verification status (confirmed, provisional)" },
      { name: "severity", type: "STRING", mode: "NULLABLE", description: "Condition severity" },
      { name: "is_chronic", type: "BOOLEAN", mode: "NULLABLE", description: "Chronic condition flag" },
      { name: "is_primary", type: "BOOLEAN", mode: "NULLABLE", description: "Primary diagnosis flag" },
      { name: "etl_timestamp", type: "TIMESTAMP", mode: "REQUIRED", description: "ETL processing timestamp" },
    ],
  },
  {
    tableName: "fact_medications",
    description: "Medication fact table for prescription and adherence analytics",
    fields: [
      { name: "medication_hash", type: "STRING", mode: "REQUIRED", description: "De-identified medication record identifier" },
      { name: "patient_hash", type: "STRING", mode: "REQUIRED", description: "De-identified patient identifier" },
      { name: "encounter_hash", type: "STRING", mode: "NULLABLE", description: "Related encounter identifier" },
      { name: "authored_date", type: "DATE", mode: "NULLABLE", description: "Prescription date" },
      { name: "start_date", type: "DATE", mode: "NULLABLE", description: "Medication start date" },
      { name: "end_date", type: "DATE", mode: "NULLABLE", description: "Medication end date" },
      { name: "code", type: "STRING", mode: "REQUIRED", description: "RxNorm or NDC code" },
      { name: "code_display", type: "STRING", mode: "NULLABLE", description: "Medication display name" },
      { name: "category", type: "STRING", mode: "NULLABLE", description: "Medication category" },
      { name: "status", type: "STRING", mode: "REQUIRED", description: "Medication status (active, completed, stopped)" },
      { name: "intent", type: "STRING", mode: "NULLABLE", description: "Prescription intent" },
      { name: "dosage_text", type: "STRING", mode: "NULLABLE", description: "Dosage instructions" },
      { name: "frequency_per_day", type: "FLOAT", mode: "NULLABLE", description: "Dosing frequency per day" },
      { name: "duration_days", type: "INTEGER", mode: "NULLABLE", description: "Prescription duration" },
      { name: "refills_allowed", type: "INTEGER", mode: "NULLABLE", description: "Number of refills allowed" },
      { name: "is_controlled", type: "BOOLEAN", mode: "NULLABLE", description: "Controlled substance flag" },
      { name: "therapeutic_class", type: "STRING", mode: "NULLABLE", description: "Therapeutic classification" },
      { name: "etl_timestamp", type: "TIMESTAMP", mode: "REQUIRED", description: "ETL processing timestamp" },
    ],
  },
  {
    tableName: "fact_procedures",
    description: "Procedure fact table for surgical and clinical procedure analytics",
    fields: [
      { name: "procedure_hash", type: "STRING", mode: "REQUIRED", description: "De-identified procedure identifier" },
      { name: "patient_hash", type: "STRING", mode: "REQUIRED", description: "De-identified patient identifier" },
      { name: "encounter_hash", type: "STRING", mode: "NULLABLE", description: "Related encounter identifier" },
      { name: "performed_date", type: "DATE", mode: "NULLABLE", description: "Procedure date" },
      { name: "performed_start", type: "TIMESTAMP", mode: "NULLABLE", description: "Procedure start time" },
      { name: "performed_end", type: "TIMESTAMP", mode: "NULLABLE", description: "Procedure end time" },
      { name: "duration_minutes", type: "INTEGER", mode: "NULLABLE", description: "Procedure duration" },
      { name: "code", type: "STRING", mode: "REQUIRED", description: "CPT or SNOMED code" },
      { name: "code_display", type: "STRING", mode: "NULLABLE", description: "Procedure display name" },
      { name: "category", type: "STRING", mode: "NULLABLE", description: "Procedure category" },
      { name: "status", type: "STRING", mode: "REQUIRED", description: "Procedure status" },
      { name: "outcome", type: "STRING", mode: "NULLABLE", description: "Procedure outcome" },
      { name: "body_site", type: "STRING", mode: "NULLABLE", description: "Body site" },
      { name: "performer_hash", type: "STRING", mode: "NULLABLE", description: "De-identified performer" },
      { name: "etl_timestamp", type: "TIMESTAMP", mode: "REQUIRED", description: "ETL processing timestamp" },
    ],
  },
  {
    tableName: "dim_cohorts",
    description: "Cohort dimension table for patient groupings",
    fields: [
      { name: "cohort_id", type: "STRING", mode: "REQUIRED", description: "Unique cohort identifier" },
      { name: "name", type: "STRING", mode: "REQUIRED", description: "Cohort name" },
      { name: "description", type: "STRING", mode: "NULLABLE", description: "Cohort description" },
      { name: "cohort_type", type: "STRING", mode: "NULLABLE", description: "Cohort type (disease, demographic, treatment)" },
      { name: "criteria_json", type: "STRING", mode: "NULLABLE", description: "JSON criteria definition" },
      { name: "patient_count", type: "INTEGER", mode: "NULLABLE", description: "Number of patients in cohort" },
      { name: "created_date", type: "DATE", mode: "REQUIRED", description: "Cohort creation date" },
      { name: "last_refreshed", type: "TIMESTAMP", mode: "NULLABLE", description: "Last refresh timestamp" },
      { name: "etl_timestamp", type: "TIMESTAMP", mode: "REQUIRED", description: "ETL processing timestamp" },
    ],
  },
  {
    tableName: "agg_treatment_outcomes",
    description: "Aggregated treatment outcomes for effectiveness analysis",
    fields: [
      { name: "treatment_code", type: "STRING", mode: "REQUIRED", description: "Treatment/medication code" },
      { name: "treatment_name", type: "STRING", mode: "REQUIRED", description: "Treatment display name" },
      { name: "condition_code", type: "STRING", mode: "NULLABLE", description: "Target condition code" },
      { name: "time_period", type: "DATE", mode: "REQUIRED", description: "Aggregation period start" },
      { name: "period_type", type: "STRING", mode: "REQUIRED", description: "Period type (daily, weekly, monthly)" },
      { name: "patient_count", type: "INTEGER", mode: "REQUIRED", description: "Number of patients" },
      { name: "avg_duration_days", type: "FLOAT", mode: "NULLABLE", description: "Average treatment duration" },
      { name: "completion_rate", type: "FLOAT", mode: "NULLABLE", description: "Treatment completion rate" },
      { name: "improvement_rate", type: "FLOAT", mode: "NULLABLE", description: "Patient improvement rate" },
      { name: "adverse_event_rate", type: "FLOAT", mode: "NULLABLE", description: "Adverse event rate" },
      { name: "readmission_rate", type: "FLOAT", mode: "NULLABLE", description: "30-day readmission rate" },
      { name: "cost_avg", type: "FLOAT", mode: "NULLABLE", description: "Average treatment cost" },
      { name: "etl_timestamp", type: "TIMESTAMP", mode: "REQUIRED", description: "ETL processing timestamp" },
    ],
  },
  {
    tableName: "agg_operational_metrics",
    description: "Aggregated operational metrics for efficiency analysis",
    fields: [
      { name: "facility_hash", type: "STRING", mode: "NULLABLE", description: "De-identified facility" },
      { name: "department", type: "STRING", mode: "NULLABLE", description: "Department name" },
      { name: "time_period", type: "DATE", mode: "REQUIRED", description: "Aggregation period start" },
      { name: "period_type", type: "STRING", mode: "REQUIRED", description: "Period type (daily, weekly, monthly)" },
      { name: "total_encounters", type: "INTEGER", mode: "REQUIRED", description: "Total encounters" },
      { name: "unique_patients", type: "INTEGER", mode: "NULLABLE", description: "Unique patients seen" },
      { name: "avg_wait_time_minutes", type: "FLOAT", mode: "NULLABLE", description: "Average wait time" },
      { name: "avg_encounter_duration", type: "FLOAT", mode: "NULLABLE", description: "Average encounter duration" },
      { name: "readmission_count", type: "INTEGER", mode: "NULLABLE", description: "30-day readmissions" },
      { name: "ed_visits", type: "INTEGER", mode: "NULLABLE", description: "Emergency department visits" },
      { name: "inpatient_admissions", type: "INTEGER", mode: "NULLABLE", description: "Inpatient admissions" },
      { name: "avg_length_of_stay", type: "FLOAT", mode: "NULLABLE", description: "Average length of stay" },
      { name: "bed_occupancy_rate", type: "FLOAT", mode: "NULLABLE", description: "Bed occupancy rate" },
      { name: "staff_patient_ratio", type: "FLOAT", mode: "NULLABLE", description: "Staff to patient ratio" },
      { name: "etl_timestamp", type: "TIMESTAMP", mode: "REQUIRED", description: "ETL processing timestamp" },
    ],
  },
  {
    tableName: "ml_features",
    description: "Machine learning feature store for model training",
    fields: [
      { name: "patient_hash", type: "STRING", mode: "REQUIRED", description: "De-identified patient identifier" },
      { name: "feature_date", type: "DATE", mode: "REQUIRED", description: "Feature calculation date" },
      { name: "age_years", type: "INTEGER", mode: "NULLABLE", description: "Age in years" },
      { name: "gender_code", type: "INTEGER", mode: "NULLABLE", description: "Gender encoded (0=M, 1=F, 2=O)" },
      { name: "condition_count", type: "INTEGER", mode: "NULLABLE", description: "Active condition count" },
      { name: "medication_count", type: "INTEGER", mode: "NULLABLE", description: "Active medication count" },
      { name: "encounter_count_30d", type: "INTEGER", mode: "NULLABLE", description: "Encounters in last 30 days" },
      { name: "encounter_count_90d", type: "INTEGER", mode: "NULLABLE", description: "Encounters in last 90 days" },
      { name: "ed_visit_count_30d", type: "INTEGER", mode: "NULLABLE", description: "ED visits in last 30 days" },
      { name: "hospitalization_count_90d", type: "INTEGER", mode: "NULLABLE", description: "Hospitalizations in last 90 days" },
      { name: "has_diabetes", type: "BOOLEAN", mode: "NULLABLE", description: "Diabetes diagnosis flag" },
      { name: "has_hypertension", type: "BOOLEAN", mode: "NULLABLE", description: "Hypertension diagnosis flag" },
      { name: "has_heart_disease", type: "BOOLEAN", mode: "NULLABLE", description: "Heart disease flag" },
      { name: "has_copd", type: "BOOLEAN", mode: "NULLABLE", description: "COPD flag" },
      { name: "has_ckd", type: "BOOLEAN", mode: "NULLABLE", description: "Chronic kidney disease flag" },
      { name: "bmi_latest", type: "FLOAT", mode: "NULLABLE", description: "Latest BMI value" },
      { name: "systolic_bp_avg", type: "FLOAT", mode: "NULLABLE", description: "Average systolic BP" },
      { name: "diastolic_bp_avg", type: "FLOAT", mode: "NULLABLE", description: "Average diastolic BP" },
      { name: "a1c_latest", type: "FLOAT", mode: "NULLABLE", description: "Latest HbA1c value" },
      { name: "egfr_latest", type: "FLOAT", mode: "NULLABLE", description: "Latest eGFR value" },
      { name: "cholesterol_total_latest", type: "FLOAT", mode: "NULLABLE", description: "Latest total cholesterol" },
      { name: "ldl_latest", type: "FLOAT", mode: "NULLABLE", description: "Latest LDL cholesterol" },
      { name: "medication_adherence_rate", type: "FLOAT", mode: "NULLABLE", description: "Medication adherence rate" },
      { name: "days_since_last_visit", type: "INTEGER", mode: "NULLABLE", description: "Days since last encounter" },
      { name: "risk_score_cardiovascular", type: "FLOAT", mode: "NULLABLE", description: "Cardiovascular risk score" },
      { name: "risk_score_readmission", type: "FLOAT", mode: "NULLABLE", description: "Readmission risk score" },
      { name: "etl_timestamp", type: "TIMESTAMP", mode: "REQUIRED", description: "ETL processing timestamp" },
    ],
  },
];

function extractPatientId(resource: FhirResource): string | null {
  const patientRef = (resource as any).subject?.reference || (resource as any).patient?.reference;
  if (!patientRef) return null;
  return patientRef.replace("Patient/", "");
}

function parseDate(dateStr: string | undefined): string | null {
  if (!dateStr) return null;
  try {
    const date = new Date(dateStr);
    return date.toISOString().split("T")[0];
  } catch {
    return null;
  }
}

function parseTimestamp(dateStr: string | undefined): string | null {
  if (!dateStr) return null;
  try {
    return new Date(dateStr).toISOString();
  } catch {
    return null;
  }
}

export function transformPatientToAnalytics(patient: FhirPatient): Record<string, unknown> {
  const now = new Date().toISOString();
  return {
    patient_hash: hashIdentifier(patient.id),
    birth_year: patient.birthDate ? new Date(patient.birthDate).getFullYear() : null,
    gender: patient.gender || null,
    race: (patient as any).extension?.find((e: any) => e.url?.includes("race"))?.valueCodeableConcept?.coding?.[0]?.display || null,
    ethnicity: (patient as any).extension?.find((e: any) => e.url?.includes("ethnicity"))?.valueCodeableConcept?.coding?.[0]?.display || null,
    state: patient.address?.[0]?.state?.substring(0, 3) || null,
    is_deceased: !!(patient as any).deceasedBoolean || !!(patient as any).deceasedDateTime,
    first_encounter_date: null,
    last_encounter_date: null,
    total_encounters: 0,
    active_conditions_count: 0,
    active_medications_count: 0,
    risk_score: null,
    cohort_ids: [],
    etl_timestamp: now,
  };
}

export function transformEncounterToAnalytics(encounter: FhirEncounter): Record<string, unknown> {
  const now = new Date().toISOString();
  const startTime = encounter.period?.start ? new Date(encounter.period.start) : null;
  const endTime = encounter.period?.end ? new Date(encounter.period.end) : null;
  const durationMinutes = startTime && endTime ? Math.round((endTime.getTime() - startTime.getTime()) / 60000) : null;
  const lengthOfStay = startTime && endTime ? Math.ceil((endTime.getTime() - startTime.getTime()) / 86400000) : null;

  return {
    encounter_hash: hashIdentifier(encounter.id),
    patient_hash: extractPatientId(encounter) ? hashIdentifier(extractPatientId(encounter)!) : null,
    encounter_date: parseDate(encounter.period?.start),
    encounter_start: parseTimestamp(encounter.period?.start),
    encounter_end: parseTimestamp(encounter.period?.end),
    duration_minutes: durationMinutes,
    encounter_class: encounter.class?.code || null,
    encounter_type_code: encounter.type?.[0]?.coding?.[0]?.code || null,
    encounter_type_display: encounter.type?.[0]?.coding?.[0]?.display || encounter.type?.[0]?.text || null,
    reason_code: encounter.reasonCode?.[0]?.coding?.[0]?.code || null,
    reason_display: encounter.reasonCode?.[0]?.coding?.[0]?.display || encounter.reasonCode?.[0]?.text || null,
    discharge_disposition: encounter.hospitalization?.dischargeDisposition?.coding?.[0]?.code || null,
    facility_hash: encounter.serviceProvider?.reference ? hashIdentifier(encounter.serviceProvider.reference) : null,
    provider_hash: encounter.participant?.[0]?.individual?.reference ? hashIdentifier(encounter.participant[0].individual.reference) : null,
    is_readmission: false,
    length_of_stay_days: lengthOfStay,
    etl_timestamp: now,
  };
}

export function transformObservationToAnalytics(obs: FhirObservation): Record<string, unknown> {
  const now = new Date().toISOString();
  return {
    observation_hash: hashIdentifier(obs.id),
    patient_hash: extractPatientId(obs) ? hashIdentifier(extractPatientId(obs)!) : null,
    encounter_hash: (obs as any).encounter?.reference ? hashIdentifier((obs as any).encounter.reference.replace("Encounter/", "")) : null,
    observation_date: parseDate(obs.effectiveDateTime),
    observation_datetime: parseTimestamp(obs.effectiveDateTime),
    category: obs.category?.[0]?.coding?.[0]?.code || null,
    code: obs.code?.coding?.[0]?.code || "",
    code_display: obs.code?.coding?.[0]?.display || obs.code?.text || null,
    value_numeric: obs.valueQuantity?.value || null,
    value_string: (obs as any).valueString || (obs as any).valueCodeableConcept?.coding?.[0]?.display || null,
    value_unit: obs.valueQuantity?.unit || null,
    reference_range_low: (obs as any).referenceRange?.[0]?.low?.value || null,
    reference_range_high: (obs as any).referenceRange?.[0]?.high?.value || null,
    interpretation: (obs as any).interpretation?.[0]?.coding?.[0]?.code || null,
    status: obs.status,
    etl_timestamp: now,
  };
}

export function transformConditionToAnalytics(condition: FhirCondition): Record<string, unknown> {
  const now = new Date().toISOString();
  const clinicalStatus = condition.clinicalStatus?.coding?.[0]?.code || null;
  const isActive = clinicalStatus === "active";
  
  return {
    condition_hash: hashIdentifier(condition.id),
    patient_hash: extractPatientId(condition) ? hashIdentifier(extractPatientId(condition)!) : null,
    encounter_hash: (condition as any).encounter?.reference ? hashIdentifier((condition as any).encounter.reference.replace("Encounter/", "")) : null,
    onset_date: parseDate(condition.onsetDateTime),
    recorded_date: parseDate(condition.recordedDate),
    abatement_date: parseDate((condition as any).abatementDateTime),
    code: condition.code?.coding?.[0]?.code || "",
    code_display: condition.code?.coding?.[0]?.display || condition.code?.text || null,
    category: (condition as any).category?.[0]?.coding?.[0]?.code || null,
    clinical_status: clinicalStatus,
    verification_status: condition.verificationStatus?.coding?.[0]?.code || null,
    severity: (condition as any).severity?.coding?.[0]?.code || null,
    is_chronic: isActive,
    is_primary: false,
    etl_timestamp: now,
  };
}

export function transformMedicationToAnalytics(med: FhirMedicationRequest): Record<string, unknown> {
  const now = new Date().toISOString();
  const startDate = (med as any).dosageInstruction?.[0]?.timing?.event?.[0] || med.authoredOn;
  const endDate = (med as any).dosageInstruction?.[0]?.timing?.repeat?.boundsPeriod?.end;
  
  let durationDays = null;
  if (startDate && endDate) {
    durationDays = Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000);
  }

  return {
    medication_hash: hashIdentifier(med.id),
    patient_hash: extractPatientId(med) ? hashIdentifier(extractPatientId(med)!) : null,
    encounter_hash: (med as any).encounter?.reference ? hashIdentifier((med as any).encounter.reference.replace("Encounter/", "")) : null,
    authored_date: parseDate(med.authoredOn),
    start_date: parseDate(startDate),
    end_date: parseDate(endDate),
    code: med.medicationCodeableConcept?.coding?.[0]?.code || (med.medicationReference?.reference || ""),
    code_display: med.medicationCodeableConcept?.coding?.[0]?.display || med.medicationCodeableConcept?.text || null,
    category: (med as any).category?.[0]?.coding?.[0]?.code || null,
    status: med.status,
    intent: med.intent,
    dosage_text: med.dosageInstruction?.[0]?.text || null,
    frequency_per_day: med.dosageInstruction?.[0]?.timing?.repeat?.frequency || null,
    duration_days: durationDays,
    refills_allowed: (med as any).dispenseRequest?.numberOfRepeatsAllowed || null,
    is_controlled: false,
    therapeutic_class: null,
    etl_timestamp: now,
  };
}

export function transformProcedureToAnalytics(proc: FhirProcedure): Record<string, unknown> {
  const now = new Date().toISOString();
  const startTime = proc.performedDateTime || proc.performedPeriod?.start;
  const endTime = proc.performedPeriod?.end;
  let durationMinutes = null;
  
  if (startTime && endTime) {
    durationMinutes = Math.round((new Date(endTime).getTime() - new Date(startTime).getTime()) / 60000);
  }

  return {
    procedure_hash: hashIdentifier(proc.id),
    patient_hash: extractPatientId(proc) ? hashIdentifier(extractPatientId(proc)!) : null,
    encounter_hash: (proc as any).encounter?.reference ? hashIdentifier((proc as any).encounter.reference.replace("Encounter/", "")) : null,
    performed_date: parseDate(startTime),
    performed_start: parseTimestamp(startTime),
    performed_end: parseTimestamp(endTime),
    duration_minutes: durationMinutes,
    code: proc.code?.coding?.[0]?.code || "",
    code_display: proc.code?.coding?.[0]?.display || proc.code?.text || null,
    category: (proc as any).category?.coding?.[0]?.code || null,
    status: proc.status,
    outcome: (proc as any).outcome?.coding?.[0]?.display || null,
    body_site: (proc as any).bodySite?.[0]?.coding?.[0]?.display || null,
    performer_hash: (proc as any).performer?.[0]?.actor?.reference ? hashIdentifier((proc as any).performer[0].actor.reference) : null,
    etl_timestamp: now,
  };
}

export function transformResourceToAnalytics(resource: FhirResource): Record<string, unknown> | null {
  switch (resource.resourceType) {
    case "Patient":
      return transformPatientToAnalytics(resource as FhirPatient);
    case "Encounter":
      return transformEncounterToAnalytics(resource as FhirEncounter);
    case "Observation":
      return transformObservationToAnalytics(resource as FhirObservation);
    case "Condition":
      return transformConditionToAnalytics(resource as FhirCondition);
    case "MedicationRequest":
      return transformMedicationToAnalytics(resource as FhirMedicationRequest);
    case "Procedure":
      return transformProcedureToAnalytics(resource as FhirProcedure);
    default:
      return null;
  }
}

function getTableNameForResourceType(resourceType: string): string {
  const mapping: Record<string, string> = {
    Patient: "dim_patients",
    Encounter: "fact_encounters",
    Observation: "fact_observations",
    Condition: "fact_conditions",
    MedicationRequest: "fact_medications",
    Procedure: "fact_procedures",
  };
  return mapping[resourceType] || `raw_${resourceType.toLowerCase()}`;
}

export async function initializeWarehouseSchemas(): Promise<DataWarehouseJob> {
  const job: DataWarehouseJob = {
    jobId: randomUUID(),
    type: "schema_creation",
    status: "pending",
    tables: HEALTHCARE_ANALYTICS_SCHEMAS.map(s => s.tableName),
    createdAt: new Date().toISOString(),
  };

  warehouseJobs.set(job.jobId, job);
  
  processSchemaCreation(job.jobId);
  
  return job;
}

async function processSchemaCreation(jobId: string): Promise<void> {
  const job = warehouseJobs.get(jobId);
  if (!job) return;

  job.status = "running";
  job.startedAt = new Date().toISOString();
  warehouseJobs.set(jobId, job);

  const analyticsStore = getAnalyticsStore();
  const auditLogger = getAuditLogger();

  try {
    let tablesCreated = 0;

    for (const schema of HEALTHCARE_ANALYTICS_SCHEMAS) {
      try {
        const bqFields = schema.fields.map(f => ({
          name: f.name,
          type: f.type,
          mode: f.mode,
        }));
        
        await analyticsStore.createTable(schema.tableName, bqFields);
        tablesCreated++;
        console.log(`[DataWarehouse] Created table: ${schema.tableName}`);
      } catch (error: any) {
        if (error.code !== 409) {
          console.error(`[DataWarehouse] Failed to create table ${schema.tableName}:`, error.message);
        }
      }
    }

    job.status = "completed";
    job.completedAt = new Date().toISOString();
    job.recordsProcessed = tablesCreated;
    warehouseJobs.set(jobId, job);

    await auditLogger.log({
      userId: "system",
      userRole: "system",
      action: "export",
      resourceType: "DataWarehouseSchema",
      resourceId: jobId,
      ipAddress: "internal",
      userAgent: "data-warehouse-service",
      requestPath: `/internal/warehouse/schema/${jobId}`,
      requestMethod: "POST",
      responseStatus: 200,
      responseTimeMs: Date.now() - new Date(job.startedAt!).getTime(),
      phiAccessed: false,
      details: { tablesCreated, schemas: HEALTHCARE_ANALYTICS_SCHEMAS.map(s => s.tableName) },
    });

    console.log(`[DataWarehouse] Schema creation completed: ${tablesCreated} tables`);
  } catch (error: any) {
    job.status = "failed";
    job.completedAt = new Date().toISOString();
    job.error = error.message;
    warehouseJobs.set(jobId, job);
    console.error(`[DataWarehouse] Schema creation failed:`, error);
  }
}

export async function runFullWarehouseExport(deIdentify: boolean = true): Promise<DataWarehouseJob> {
  const resourceTypes = ["Patient", "Encounter", "Observation", "Condition", "MedicationRequest", "Procedure"];
  
  const job: DataWarehouseJob = {
    jobId: randomUUID(),
    type: "full_export",
    status: "pending",
    tables: resourceTypes.map(getTableNameForResourceType),
    createdAt: new Date().toISOString(),
    metadata: { deIdentify },
  };

  warehouseJobs.set(job.jobId, job);
  
  processFullExport(job.jobId, resourceTypes, deIdentify);
  
  return job;
}

async function processFullExport(jobId: string, resourceTypes: string[], deIdentify: boolean): Promise<void> {
  const job = warehouseJobs.get(jobId);
  if (!job) return;

  job.status = "running";
  job.startedAt = new Date().toISOString();
  warehouseJobs.set(jobId, job);

  const fhirStore = getFhirStore();
  const analyticsStore = getAnalyticsStore();
  const auditLogger = getAuditLogger();

  try {
    let totalRecords = 0;

    for (const resourceType of resourceTypes) {
      const bundle = await fhirStore.searchResources(resourceType, { _count: 10000 });
      const resources = (bundle.entry || []).map(e => e.resource);

      if (resources.length === 0) continue;

      const tableName = getTableNameForResourceType(resourceType);
      const transformedRows = resources
        .map(r => transformResourceToAnalytics(r))
        .filter((r): r is Record<string, unknown> => r !== null);

      if (transformedRows.length > 0) {
        try {
          await analyticsStore.insertData(tableName, transformedRows);
          totalRecords += transformedRows.length;
          console.log(`[DataWarehouse] Exported ${transformedRows.length} ${resourceType} records to ${tableName}`);
        } catch (error: any) {
          console.error(`[DataWarehouse] Failed to insert ${resourceType}:`, error.message);
        }
      }
    }

    job.status = "completed";
    job.completedAt = new Date().toISOString();
    job.recordsProcessed = totalRecords;
    warehouseJobs.set(jobId, job);

    await auditLogger.log({
      userId: "system",
      userRole: "system",
      action: "export",
      resourceType: "DataWarehouseExport",
      resourceId: jobId,
      ipAddress: "internal",
      userAgent: "data-warehouse-service",
      requestPath: `/internal/warehouse/export/${jobId}`,
      requestMethod: "POST",
      responseStatus: 200,
      responseTimeMs: Date.now() - new Date(job.startedAt!).getTime(),
      phiAccessed: !deIdentify,
      details: { recordsExported: totalRecords, resourceTypes, deIdentify },
    });

    console.log(`[DataWarehouse] Full export completed: ${totalRecords} total records`);
  } catch (error: any) {
    job.status = "failed";
    job.completedAt = new Date().toISOString();
    job.error = error.message;
    warehouseJobs.set(jobId, job);
    console.error(`[DataWarehouse] Full export failed:`, error);
  }
}

export async function runIncrementalExport(since: string, deIdentify: boolean = true): Promise<DataWarehouseJob> {
  const resourceTypes = ["Patient", "Encounter", "Observation", "Condition", "MedicationRequest", "Procedure"];
  
  const job: DataWarehouseJob = {
    jobId: randomUUID(),
    type: "incremental_export",
    status: "pending",
    tables: resourceTypes.map(getTableNameForResourceType),
    createdAt: new Date().toISOString(),
    metadata: { deIdentify, since },
  };

  warehouseJobs.set(job.jobId, job);
  
  processIncrementalExport(job.jobId, resourceTypes, since, deIdentify);
  
  return job;
}

async function processIncrementalExport(jobId: string, resourceTypes: string[], since: string, deIdentify: boolean): Promise<void> {
  const job = warehouseJobs.get(jobId);
  if (!job) return;

  job.status = "running";
  job.startedAt = new Date().toISOString();
  warehouseJobs.set(jobId, job);

  const fhirStore = getFhirStore();
  const analyticsStore = getAnalyticsStore();
  const auditLogger = getAuditLogger();

  try {
    let totalRecords = 0;

    for (const resourceType of resourceTypes) {
      const bundle = await fhirStore.searchResources(resourceType, { 
        _count: 10000,
        _lastUpdated: `ge${since}`,
      });
      const resources = (bundle.entry || []).map(e => e.resource);

      if (resources.length === 0) continue;

      const tableName = getTableNameForResourceType(resourceType);
      const transformedRows = resources
        .map(r => transformResourceToAnalytics(r))
        .filter((r): r is Record<string, unknown> => r !== null);

      if (transformedRows.length > 0) {
        try {
          await analyticsStore.insertData(tableName, transformedRows);
          totalRecords += transformedRows.length;
        } catch (error: any) {
          console.error(`[DataWarehouse] Failed to insert ${resourceType}:`, error.message);
        }
      }
    }

    job.status = "completed";
    job.completedAt = new Date().toISOString();
    job.recordsProcessed = totalRecords;
    warehouseJobs.set(jobId, job);

    await auditLogger.log({
      userId: "system",
      userRole: "system",
      action: "export",
      resourceType: "DataWarehouseIncrementalExport",
      resourceId: jobId,
      ipAddress: "internal",
      userAgent: "data-warehouse-service",
      requestPath: `/internal/warehouse/export/incremental/${jobId}`,
      requestMethod: "POST",
      responseStatus: 200,
      responseTimeMs: Date.now() - new Date(job.startedAt!).getTime(),
      phiAccessed: !deIdentify,
      details: { recordsExported: totalRecords, since, resourceTypes, deIdentify },
    });

    console.log(`[DataWarehouse] Incremental export completed: ${totalRecords} records since ${since}`);
  } catch (error: any) {
    job.status = "failed";
    job.completedAt = new Date().toISOString();
    job.error = error.message;
    warehouseJobs.set(jobId, job);
    console.error(`[DataWarehouse] Incremental export failed:`, error);
  }
}

export function createScheduledExport(params: {
  name: string;
  schedule: string;
  exportType: "full" | "incremental";
  tables: string[];
  deIdentify: boolean;
}): ScheduledExport {
  const id = randomUUID();
  const now = new Date();
  
  const scheduled: ScheduledExport = {
    id,
    name: params.name,
    schedule: params.schedule,
    enabled: true,
    exportType: params.exportType,
    tables: params.tables,
    deIdentify: params.deIdentify,
    nextRun: calculateNextRun(params.schedule, now),
    createdAt: now.toISOString(),
  };

  scheduledExports.set(id, scheduled);
  
  scheduleExport(scheduled);
  
  return scheduled;
}

function calculateNextRun(schedule: string, from: Date): string {
  const [hours, minutes] = schedule.split(" ")[0]?.split(":").map(Number) || [0, 0];
  const next = new Date(from);
  next.setHours(hours || 0, minutes || 0, 0, 0);
  if (next <= from) {
    next.setDate(next.getDate() + 1);
  }
  return next.toISOString();
}

function scheduleExport(scheduled: ScheduledExport): void {
  const existingTimer = scheduleTimers.get(scheduled.id);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  if (!scheduled.enabled || !scheduled.nextRun) return;

  const nextRun = new Date(scheduled.nextRun);
  const now = new Date();
  const delay = nextRun.getTime() - now.getTime();

  if (delay > 0 && delay < 24 * 60 * 60 * 1000) {
    const timer = setTimeout(async () => {
      const current = scheduledExports.get(scheduled.id);
      if (!current || !current.enabled) return;

      console.log(`[DataWarehouse] Running scheduled export: ${current.name}`);
      
      if (current.exportType === "full") {
        await runFullWarehouseExport(current.deIdentify);
      } else {
        const since = current.lastRun || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        await runIncrementalExport(since, current.deIdentify);
      }

      current.lastRun = new Date().toISOString();
      current.nextRun = calculateNextRun(current.schedule, new Date());
      scheduledExports.set(current.id, current);
      
      scheduleExport(current);
    }, delay);

    scheduleTimers.set(scheduled.id, timer);
  }
}

export function getScheduledExport(id: string): ScheduledExport | null {
  return scheduledExports.get(id) || null;
}

export function listScheduledExports(): ScheduledExport[] {
  return Array.from(scheduledExports.values());
}

export function updateScheduledExport(id: string, updates: Partial<ScheduledExport>): ScheduledExport | null {
  const existing = scheduledExports.get(id);
  if (!existing) return null;

  const updated = { ...existing, ...updates };
  scheduledExports.set(id, updated);
  
  scheduleExport(updated);
  
  return updated;
}

export function deleteScheduledExport(id: string): boolean {
  const timer = scheduleTimers.get(id);
  if (timer) {
    clearTimeout(timer);
    scheduleTimers.delete(id);
  }
  return scheduledExports.delete(id);
}

export function getWarehouseJob(jobId: string): DataWarehouseJob | null {
  return warehouseJobs.get(jobId) || null;
}

export function listWarehouseJobs(status?: DataWarehouseJob["status"]): DataWarehouseJob[] {
  const jobs = Array.from(warehouseJobs.values());
  if (status) {
    return jobs.filter(j => j.status === status);
  }
  return jobs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getWarehouseSchemas(): BigQueryTableSchema[] {
  return HEALTHCARE_ANALYTICS_SCHEMAS;
}

export async function runAnalyticsQuery(sql: string): Promise<{ rows: Record<string, unknown>[]; executionTimeMs: number }> {
  const analyticsStore = getAnalyticsStore();
  const start = Date.now();
  
  const result = await analyticsStore.query({ sql });
  
  return {
    rows: result.rows,
    executionTimeMs: Date.now() - start,
  };
}

export async function getPopulationHealthDashboard(): Promise<AnalyticsDashboard> {
  const analyticsStore = getAnalyticsStore();

  const populationHealth = await analyticsStore.getPopulationHealthMetrics();

  return {
    patientCohorts: [],
    treatmentEffectiveness: [],
    operationalMetrics: {
      totalEncounters: 0,
      avgEncounterDuration: 0,
      encountersByType: {},
      readmissionRate30Day: 0,
      avgLengthOfStay: 0,
      bedOccupancy: 0,
      staffUtilization: 0,
    },
    populationHealth: {
      totalPatients: populationHealth.totalPatients,
      activePatients: populationHealth.totalPatients,
      avgAge: populationHealth.avgAge,
      chronicConditionPrevalence: {},
      preventiveCareCompliance: 0,
      vaccinationCoverage: 0,
      averageRiskScore: 0,
    },
  };
}
