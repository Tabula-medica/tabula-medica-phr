import { logPhiAccess } from "../security/hipaa-audit";

export interface ImmunizationRecord {
  id: string;
  patientId: string;
  vaccineCode: string;
  vaccineName: string;
  vaccineType: string;
  lotNumber: string;
  manufacturerCode: string;
  manufacturer: string;
  administeredDate: string;
  expirationDate?: string;
  doseNumber: number;
  doseSequence: string;
  status: "completed" | "entered-in-error" | "not-done";
  site?: string;
  route?: string;
  performerId?: string;
  performerName?: string;
  facilityId?: string;
  facilityName?: string;
  patientAgeAtVaccination: number;
  patientAgeGroup: "0-4" | "5-11" | "12-17" | "18-64" | "65+";
  patientGender: "male" | "female" | "other" | "unknown";
  patientState: string;
  patientCounty?: string;
  patientZipCode?: string;
  reportedToIIS: boolean;
  iisSubmissionDate?: string;
}

export interface AggregationCriteria {
  vaccineTypes?: string[];
  ageGroups?: ("0-4" | "5-11" | "12-17" | "18-64" | "65+")[];
  regions?: string[];
  states?: string[];
  counties?: string[];
  statuses?: ("completed" | "entered-in-error" | "not-done")[];
  dateRange?: {
    startDate: string;
    endDate: string;
  };
  facilityIds?: string[];
  reportedToIIS?: boolean;
}

export interface AggregatedMetrics {
  totalVaccinations: number;
  uniquePatients: number;
  byVaccineType: Record<string, number>;
  byAgeGroup: Record<string, number>;
  byRegion: Record<string, number>;
  byStatus: Record<string, number>;
  byMonth: Record<string, number>;
  byManufacturer: Record<string, number>;
  iisReportingRate: number;
  completionRate: number;
}

export interface PublicHealthReport {
  id: string;
  reportType: "coverage" | "distribution" | "compliance" | "trend" | "comprehensive";
  title: string;
  description: string;
  generatedAt: string;
  generatedBy: string;
  criteria: AggregationCriteria;
  metrics: AggregatedMetrics;
  records: ImmunizationRecord[];
  summary: ReportSummary;
  disclaimer: string;
}

export interface ReportSummary {
  keyFindings: string[];
  coverageRates: Record<string, number>;
  trendsObserved: string[];
  complianceStatus: "compliant" | "needs-attention" | "non-compliant";
  recommendations: string[];
}

export interface DashboardMetrics {
  overallCoverage: number;
  weeklyVaccinations: number;
  monthlyVaccinations: number;
  yearlyVaccinations: number;
  topVaccineTypes: { name: string; count: number; percentage: number }[];
  ageGroupDistribution: { ageGroup: string; count: number; percentage: number }[];
  geographicDistribution: { region: string; count: number; percentage: number }[];
  monthlyTrends: { month: string; count: number; change: number }[];
  iisComplianceRate: number;
  pendingIISSubmissions: number;
}

export interface ExportOptions {
  format: "csv" | "fhir-bundle" | "fhir-ndjson" | "hl7v2";
  includePatientIdentifiers: boolean;
  deidentify: boolean;
  includeMetadata: boolean;
  dateFormat: "iso" | "us" | "eu";
}

const NO_CDS_DISCLAIMER = "IMPORTANT: This report is for public health surveillance and administrative purposes only. It does NOT constitute clinical decision support or medical advice. All clinical decisions must be made by qualified healthcare providers based on individual patient assessment.";

const sampleImmunizationRecords: ImmunizationRecord[] = [
  {
    id: "imm-001",
    patientId: "patient-001",
    vaccineCode: "208",
    vaccineName: "COVID-19 mRNA Vaccine",
    vaccineType: "COVID-19",
    lotNumber: "EK9788",
    manufacturerCode: "PFR",
    manufacturer: "Pfizer-BioNTech",
    administeredDate: "2025-12-15",
    doseNumber: 1,
    doseSequence: "1 of 2",
    status: "completed",
    site: "Left Deltoid",
    route: "Intramuscular",
    performerId: "prov-001",
    performerName: "Dr. Smith",
    facilityId: "fac-001",
    facilityName: "City Health Center",
    patientAgeAtVaccination: 45,
    patientAgeGroup: "18-64",
    patientGender: "male",
    patientState: "CA",
    patientCounty: "Los Angeles",
    patientZipCode: "90210",
    reportedToIIS: true,
    iisSubmissionDate: "2025-12-16"
  },
  {
    id: "imm-002",
    patientId: "patient-002",
    vaccineCode: "140",
    vaccineName: "Influenza Vaccine",
    vaccineType: "Influenza",
    lotNumber: "FL2024A",
    manufacturerCode: "SKB",
    manufacturer: "GlaxoSmithKline",
    administeredDate: "2025-11-01",
    doseNumber: 1,
    doseSequence: "Annual",
    status: "completed",
    site: "Right Deltoid",
    route: "Intramuscular",
    performerId: "prov-002",
    performerName: "Dr. Johnson",
    facilityId: "fac-002",
    facilityName: "Community Clinic",
    patientAgeAtVaccination: 72,
    patientAgeGroup: "65+",
    patientGender: "female",
    patientState: "CA",
    patientCounty: "San Diego",
    patientZipCode: "92101",
    reportedToIIS: true,
    iisSubmissionDate: "2025-11-02"
  },
  {
    id: "imm-003",
    patientId: "patient-003",
    vaccineCode: "03",
    vaccineName: "MMR Vaccine",
    vaccineType: "MMR",
    lotNumber: "MMR2024B",
    manufacturerCode: "MSD",
    manufacturer: "Merck",
    administeredDate: "2025-10-20",
    doseNumber: 2,
    doseSequence: "2 of 2",
    status: "completed",
    site: "Left Deltoid",
    route: "Subcutaneous",
    performerId: "prov-001",
    performerName: "Dr. Smith",
    facilityId: "fac-001",
    facilityName: "City Health Center",
    patientAgeAtVaccination: 6,
    patientAgeGroup: "5-11",
    patientGender: "female",
    patientState: "NY",
    patientCounty: "Kings",
    patientZipCode: "11201",
    reportedToIIS: true,
    iisSubmissionDate: "2025-10-21"
  },
  {
    id: "imm-004",
    patientId: "patient-004",
    vaccineCode: "20",
    vaccineName: "DTaP Vaccine",
    vaccineType: "DTaP",
    lotNumber: "DT2024C",
    manufacturerCode: "PMC",
    manufacturer: "Pfizer",
    administeredDate: "2025-09-15",
    doseNumber: 4,
    doseSequence: "4 of 5",
    status: "completed",
    site: "Left Thigh",
    route: "Intramuscular",
    performerId: "prov-003",
    performerName: "Dr. Williams",
    facilityId: "fac-003",
    facilityName: "Pediatric Associates",
    patientAgeAtVaccination: 2,
    patientAgeGroup: "0-4",
    patientGender: "male",
    patientState: "TX",
    patientCounty: "Harris",
    patientZipCode: "77001",
    reportedToIIS: false
  },
  {
    id: "imm-005",
    patientId: "patient-005",
    vaccineCode: "33",
    vaccineName: "Pneumococcal Vaccine",
    vaccineType: "Pneumococcal",
    lotNumber: "PN2024D",
    manufacturerCode: "PFR",
    manufacturer: "Pfizer",
    administeredDate: "2025-08-10",
    doseNumber: 1,
    doseSequence: "1 of 1",
    status: "completed",
    site: "Left Deltoid",
    route: "Intramuscular",
    performerId: "prov-004",
    performerName: "Dr. Brown",
    facilityId: "fac-004",
    facilityName: "Senior Care Center",
    patientAgeAtVaccination: 68,
    patientAgeGroup: "65+",
    patientGender: "male",
    patientState: "FL",
    patientCounty: "Miami-Dade",
    patientZipCode: "33101",
    reportedToIIS: true,
    iisSubmissionDate: "2025-08-11"
  },
  {
    id: "imm-006",
    patientId: "patient-006",
    vaccineCode: "115",
    vaccineName: "Tdap Vaccine",
    vaccineType: "Tdap",
    lotNumber: "TD2024E",
    manufacturerCode: "SKB",
    manufacturer: "GlaxoSmithKline",
    administeredDate: "2025-07-22",
    doseNumber: 1,
    doseSequence: "Booster",
    status: "completed",
    site: "Right Deltoid",
    route: "Intramuscular",
    performerId: "prov-002",
    performerName: "Dr. Johnson",
    facilityId: "fac-002",
    facilityName: "Community Clinic",
    patientAgeAtVaccination: 15,
    patientAgeGroup: "12-17",
    patientGender: "female",
    patientState: "CA",
    patientCounty: "Orange",
    patientZipCode: "92602",
    reportedToIIS: true,
    iisSubmissionDate: "2025-07-23"
  },
  {
    id: "imm-007",
    patientId: "patient-007",
    vaccineCode: "21",
    vaccineName: "Varicella Vaccine",
    vaccineType: "Varicella",
    lotNumber: "VR2024F",
    manufacturerCode: "MSD",
    manufacturer: "Merck",
    administeredDate: "2025-06-18",
    doseNumber: 1,
    doseSequence: "1 of 2",
    status: "completed",
    site: "Left Deltoid",
    route: "Subcutaneous",
    performerId: "prov-005",
    performerName: "Dr. Davis",
    facilityId: "fac-005",
    facilityName: "Family Medicine Center",
    patientAgeAtVaccination: 4,
    patientAgeGroup: "0-4",
    patientGender: "female",
    patientState: "IL",
    patientCounty: "Cook",
    patientZipCode: "60601",
    reportedToIIS: true,
    iisSubmissionDate: "2025-06-19"
  },
  {
    id: "imm-008",
    patientId: "patient-008",
    vaccineCode: "52",
    vaccineName: "Hepatitis A Vaccine",
    vaccineType: "Hepatitis A",
    lotNumber: "HA2024G",
    manufacturerCode: "MSD",
    manufacturer: "Merck",
    administeredDate: "2025-05-10",
    doseNumber: 2,
    doseSequence: "2 of 2",
    status: "completed",
    site: "Left Deltoid",
    route: "Intramuscular",
    performerId: "prov-001",
    performerName: "Dr. Smith",
    facilityId: "fac-001",
    facilityName: "City Health Center",
    patientAgeAtVaccination: 35,
    patientAgeGroup: "18-64",
    patientGender: "male",
    patientState: "CA",
    patientCounty: "San Francisco",
    patientZipCode: "94102",
    reportedToIIS: false
  },
  {
    id: "imm-009",
    patientId: "patient-009",
    vaccineCode: "62",
    vaccineName: "HPV Vaccine",
    vaccineType: "HPV",
    lotNumber: "HP2024H",
    manufacturerCode: "MSD",
    manufacturer: "Merck",
    administeredDate: "2025-04-05",
    doseNumber: 2,
    doseSequence: "2 of 3",
    status: "completed",
    site: "Left Deltoid",
    route: "Intramuscular",
    performerId: "prov-003",
    performerName: "Dr. Williams",
    facilityId: "fac-003",
    facilityName: "Pediatric Associates",
    patientAgeAtVaccination: 13,
    patientAgeGroup: "12-17",
    patientGender: "male",
    patientState: "WA",
    patientCounty: "King",
    patientZipCode: "98101",
    reportedToIIS: true,
    iisSubmissionDate: "2025-04-06"
  },
  {
    id: "imm-010",
    patientId: "patient-010",
    vaccineCode: "10",
    vaccineName: "IPV Vaccine",
    vaccineType: "Polio",
    lotNumber: "PV2024I",
    manufacturerCode: "PMC",
    manufacturer: "Sanofi Pasteur",
    administeredDate: "2025-03-12",
    doseNumber: 3,
    doseSequence: "3 of 4",
    status: "completed",
    site: "Left Thigh",
    route: "Intramuscular",
    performerId: "prov-005",
    performerName: "Dr. Davis",
    facilityId: "fac-005",
    facilityName: "Family Medicine Center",
    patientAgeAtVaccination: 1,
    patientAgeGroup: "0-4",
    patientGender: "male",
    patientState: "GA",
    patientCounty: "Fulton",
    patientZipCode: "30301",
    reportedToIIS: true,
    iisSubmissionDate: "2025-03-13"
  }
];

for (let i = 11; i <= 50; i++) {
  const vaccineTypes = ["COVID-19", "Influenza", "MMR", "DTaP", "Tdap", "Hepatitis A", "Hepatitis B", "HPV", "Pneumococcal", "Varicella", "Polio", "Shingles"];
  const states = ["CA", "NY", "TX", "FL", "IL", "PA", "OH", "GA", "NC", "MI", "WA", "AZ"];
  const ageGroups: ("0-4" | "5-11" | "12-17" | "18-64" | "65+")[] = ["0-4", "5-11", "12-17", "18-64", "65+"];
  const manufacturers = ["Pfizer-BioNTech", "Moderna", "Merck", "GlaxoSmithKline", "Sanofi Pasteur", "Johnson & Johnson"];
  
  const vaccineType = vaccineTypes[i % vaccineTypes.length];
  const state = states[i % states.length];
  const ageGroup = ageGroups[i % ageGroups.length];
  const manufacturer = manufacturers[i % manufacturers.length];
  const month = (i % 12) + 1;
  const day = (i % 28) + 1;
  
  sampleImmunizationRecords.push({
    id: `imm-${String(i).padStart(3, '0')}`,
    patientId: `patient-${String(i).padStart(3, '0')}`,
    vaccineCode: String(100 + i),
    vaccineName: `${vaccineType} Vaccine`,
    vaccineType,
    lotNumber: `LOT${i}2025`,
    manufacturerCode: manufacturer.substring(0, 3).toUpperCase(),
    manufacturer,
    administeredDate: `2025-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    doseNumber: (i % 3) + 1,
    doseSequence: `${(i % 3) + 1} of ${(i % 3) + 2}`,
    status: "completed",
    site: i % 2 === 0 ? "Left Deltoid" : "Right Deltoid",
    route: "Intramuscular",
    performerId: `prov-${String((i % 5) + 1).padStart(3, '0')}`,
    performerName: `Dr. Provider${(i % 5) + 1}`,
    facilityId: `fac-${String((i % 5) + 1).padStart(3, '0')}`,
    facilityName: `Healthcare Facility ${(i % 5) + 1}`,
    patientAgeAtVaccination: ageGroup === "0-4" ? 2 : ageGroup === "5-11" ? 8 : ageGroup === "12-17" ? 14 : ageGroup === "18-64" ? 40 : 70,
    patientAgeGroup: ageGroup,
    patientGender: i % 2 === 0 ? "male" : "female",
    patientState: state,
    patientCounty: `County${i % 10}`,
    patientZipCode: `${10000 + i}`,
    reportedToIIS: i % 4 !== 0,
    iisSubmissionDate: i % 4 !== 0 ? `2025-${String(month).padStart(2, '0')}-${String(day + 1).padStart(2, '0')}` : undefined
  });
}

class PublicHealthReportingService {
  private records: ImmunizationRecord[] = [...sampleImmunizationRecords];
  private reports: Map<string, PublicHealthReport> = new Map();

  constructor() {
    console.log(`[PublicHealthReporting] Service initialized with ${this.records.length} sample immunization records`);
  }

  async filterRecords(criteria: AggregationCriteria): Promise<ImmunizationRecord[]> {
    let filtered = [...this.records];

    if (criteria.vaccineTypes && criteria.vaccineTypes.length > 0) {
      filtered = filtered.filter(r => criteria.vaccineTypes!.includes(r.vaccineType));
    }

    if (criteria.ageGroups && criteria.ageGroups.length > 0) {
      filtered = filtered.filter(r => criteria.ageGroups!.includes(r.patientAgeGroup));
    }

    if (criteria.states && criteria.states.length > 0) {
      filtered = filtered.filter(r => criteria.states!.includes(r.patientState));
    }

    if (criteria.counties && criteria.counties.length > 0) {
      filtered = filtered.filter(r => criteria.counties!.includes(r.patientCounty || ""));
    }

    if (criteria.statuses && criteria.statuses.length > 0) {
      filtered = filtered.filter(r => criteria.statuses!.includes(r.status));
    }

    if (criteria.facilityIds && criteria.facilityIds.length > 0) {
      filtered = filtered.filter(r => criteria.facilityIds!.includes(r.facilityId || ""));
    }

    if (criteria.reportedToIIS !== undefined) {
      filtered = filtered.filter(r => r.reportedToIIS === criteria.reportedToIIS);
    }

    if (criteria.dateRange) {
      const startDate = new Date(criteria.dateRange.startDate);
      const endDate = new Date(criteria.dateRange.endDate);
      filtered = filtered.filter(r => {
        const adminDate = new Date(r.administeredDate);
        return adminDate >= startDate && adminDate <= endDate;
      });
    }

    return filtered;
  }

  async calculateMetrics(records: ImmunizationRecord[]): Promise<AggregatedMetrics> {
    const byVaccineType: Record<string, number> = {};
    const byAgeGroup: Record<string, number> = {};
    const byRegion: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    const byMonth: Record<string, number> = {};
    const byManufacturer: Record<string, number> = {};
    const uniquePatients = new Set<string>();
    let reportedToIIS = 0;
    let completed = 0;

    for (const record of records) {
      uniquePatients.add(record.patientId);

      byVaccineType[record.vaccineType] = (byVaccineType[record.vaccineType] || 0) + 1;
      byAgeGroup[record.patientAgeGroup] = (byAgeGroup[record.patientAgeGroup] || 0) + 1;
      byRegion[record.patientState] = (byRegion[record.patientState] || 0) + 1;
      byStatus[record.status] = (byStatus[record.status] || 0) + 1;
      byManufacturer[record.manufacturer] = (byManufacturer[record.manufacturer] || 0) + 1;

      const month = record.administeredDate.substring(0, 7);
      byMonth[month] = (byMonth[month] || 0) + 1;

      if (record.reportedToIIS) reportedToIIS++;
      if (record.status === "completed") completed++;
    }

    return {
      totalVaccinations: records.length,
      uniquePatients: uniquePatients.size,
      byVaccineType,
      byAgeGroup,
      byRegion,
      byStatus,
      byMonth,
      byManufacturer,
      iisReportingRate: records.length > 0 ? (reportedToIIS / records.length) * 100 : 0,
      completionRate: records.length > 0 ? (completed / records.length) * 100 : 0
    };
  }

  async generateSummary(metrics: AggregatedMetrics, criteria: AggregationCriteria): Promise<ReportSummary> {
    const keyFindings: string[] = [];
    const recommendations: string[] = [];
    const trendsObserved: string[] = [];
    const coverageRates: Record<string, number> = {};

    keyFindings.push(`Total of ${metrics.totalVaccinations} vaccinations administered to ${metrics.uniquePatients} unique patients.`);
    
    const topVaccine = Object.entries(metrics.byVaccineType).sort((a, b) => b[1] - a[1])[0];
    if (topVaccine) {
      keyFindings.push(`${topVaccine[0]} is the most administered vaccine type with ${topVaccine[1]} doses (${((topVaccine[1] / metrics.totalVaccinations) * 100).toFixed(1)}%).`);
    }

    const topAgeGroup = Object.entries(metrics.byAgeGroup).sort((a, b) => b[1] - a[1])[0];
    if (topAgeGroup) {
      keyFindings.push(`Age group ${topAgeGroup[0]} received the most vaccinations with ${topAgeGroup[1]} doses.`);
    }

    keyFindings.push(`IIS reporting compliance rate: ${metrics.iisReportingRate.toFixed(1)}%.`);

    for (const [vaccineType, count] of Object.entries(metrics.byVaccineType)) {
      coverageRates[vaccineType] = (count / metrics.totalVaccinations) * 100;
    }

    const months = Object.keys(metrics.byMonth).sort();
    if (months.length >= 2) {
      const lastMonth = metrics.byMonth[months[months.length - 1]];
      const prevMonth = metrics.byMonth[months[months.length - 2]];
      const change = ((lastMonth - prevMonth) / prevMonth) * 100;
      if (change > 10) {
        trendsObserved.push(`Vaccination rates increased by ${change.toFixed(1)}% compared to previous month.`);
      } else if (change < -10) {
        trendsObserved.push(`Vaccination rates decreased by ${Math.abs(change).toFixed(1)}% compared to previous month.`);
      } else {
        trendsObserved.push(`Vaccination rates remained stable compared to previous month.`);
      }
    }

    if (metrics.iisReportingRate < 95) {
      recommendations.push("Improve IIS reporting compliance to meet the 95% target threshold.");
    }

    const lowCoverageAgeGroups = Object.entries(metrics.byAgeGroup)
      .filter(([_, count]) => count < metrics.totalVaccinations * 0.1);
    if (lowCoverageAgeGroups.length > 0) {
      recommendations.push(`Consider targeted outreach for age groups with lower vaccination rates: ${lowCoverageAgeGroups.map(([g]) => g).join(", ")}.`);
    }

    let complianceStatus: "compliant" | "needs-attention" | "non-compliant" = "compliant";
    if (metrics.iisReportingRate < 80) {
      complianceStatus = "non-compliant";
    } else if (metrics.iisReportingRate < 95) {
      complianceStatus = "needs-attention";
    }

    return {
      keyFindings,
      coverageRates,
      trendsObserved,
      complianceStatus,
      recommendations
    };
  }

  async generateReport(
    userId: string,
    reportType: PublicHealthReport["reportType"],
    criteria: AggregationCriteria,
    title?: string
  ): Promise<PublicHealthReport> {
    await logPhiAccess({
      userId,
      action: "read",
      resourceType: "ImmunizationReport",
      details: `Generated ${reportType} public health report - Public health surveillance and reporting`
    });

    const records = await this.filterRecords(criteria);
    const metrics = await this.calculateMetrics(records);
    const summary = await this.generateSummary(metrics, criteria);

    const deidentifiedRecords = records.map(r => ({
      ...r,
      patientId: `REDACTED-${r.patientId.substring(r.patientId.length - 4)}`,
      patientZipCode: r.patientZipCode ? r.patientZipCode.substring(0, 3) + "XX" : undefined
    }));

    const report: PublicHealthReport = {
      id: `report-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      reportType,
      title: title || `${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report - ${new Date().toLocaleDateString()}`,
      description: `Public health ${reportType} report generated with ${records.length} records matching the specified criteria.`,
      generatedAt: new Date().toISOString(),
      generatedBy: userId,
      criteria,
      metrics,
      records: deidentifiedRecords,
      summary,
      disclaimer: NO_CDS_DISCLAIMER
    };

    this.reports.set(report.id, report);

    console.log(`[PublicHealthReporting] Generated ${reportType} report ${report.id} with ${records.length} records`);

    return report;
  }

  async getDashboardMetrics(userId: string): Promise<DashboardMetrics> {
    await logPhiAccess({
      userId,
      action: "read",
      resourceType: "ImmunizationDashboard",
      details: "Accessed public health immunization dashboard metrics - Public health surveillance"
    });

    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

    const allRecords = this.records.filter(r => r.status === "completed");
    const weeklyRecords = allRecords.filter(r => new Date(r.administeredDate) >= oneWeekAgo);
    const monthlyRecords = allRecords.filter(r => new Date(r.administeredDate) >= oneMonthAgo);
    const yearlyRecords = allRecords.filter(r => new Date(r.administeredDate) >= oneYearAgo);

    const vaccineTypeCounts: Record<string, number> = {};
    const ageGroupCounts: Record<string, number> = {};
    const regionCounts: Record<string, number> = {};
    let iisCompliant = 0;

    for (const record of allRecords) {
      vaccineTypeCounts[record.vaccineType] = (vaccineTypeCounts[record.vaccineType] || 0) + 1;
      ageGroupCounts[record.patientAgeGroup] = (ageGroupCounts[record.patientAgeGroup] || 0) + 1;
      regionCounts[record.patientState] = (regionCounts[record.patientState] || 0) + 1;
      if (record.reportedToIIS) iisCompliant++;
    }

    const topVaccineTypes = Object.entries(vaccineTypeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({
        name,
        count,
        percentage: (count / allRecords.length) * 100
      }));

    const ageGroupDistribution = Object.entries(ageGroupCounts)
      .map(([ageGroup, count]) => ({
        ageGroup,
        count,
        percentage: (count / allRecords.length) * 100
      }));

    const geographicDistribution = Object.entries(regionCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([region, count]) => ({
        region,
        count,
        percentage: (count / allRecords.length) * 100
      }));

    const monthlyData: Record<string, number> = {};
    for (const record of yearlyRecords) {
      const month = record.administeredDate.substring(0, 7);
      monthlyData[month] = (monthlyData[month] || 0) + 1;
    }

    const sortedMonths = Object.keys(monthlyData).sort();
    const monthlyTrends = sortedMonths.map((month, idx) => {
      const count = monthlyData[month];
      const prevCount = idx > 0 ? monthlyData[sortedMonths[idx - 1]] : count;
      const change = prevCount > 0 ? ((count - prevCount) / prevCount) * 100 : 0;
      return { month, count, change };
    });

    const pendingIISSubmissions = allRecords.filter(r => !r.reportedToIIS).length;

    return {
      overallCoverage: (allRecords.length / (allRecords.length * 1.2)) * 100,
      weeklyVaccinations: weeklyRecords.length,
      monthlyVaccinations: monthlyRecords.length,
      yearlyVaccinations: yearlyRecords.length,
      topVaccineTypes,
      ageGroupDistribution,
      geographicDistribution,
      monthlyTrends,
      iisComplianceRate: allRecords.length > 0 ? (iisCompliant / allRecords.length) * 100 : 0,
      pendingIISSubmissions
    };
  }

  async exportToCSV(reportId: string, options: ExportOptions): Promise<string> {
    const report = this.reports.get(reportId);
    if (!report) {
      throw new Error(`Report ${reportId} not found`);
    }

    const headers = [
      "Record ID",
      "Vaccine Code",
      "Vaccine Name",
      "Vaccine Type",
      "Manufacturer",
      "Administered Date",
      "Dose Number",
      "Status",
      "Age Group",
      "State",
      "Reported to IIS"
    ];

    if (options.includePatientIdentifiers && !options.deidentify) {
      headers.splice(1, 0, "Patient ID");
    }

    const rows = report.records.map(r => {
      const row = [
        r.id,
        r.vaccineCode,
        r.vaccineName,
        r.vaccineType,
        r.manufacturer,
        options.dateFormat === "us" 
          ? new Date(r.administeredDate).toLocaleDateString("en-US")
          : options.dateFormat === "eu"
          ? new Date(r.administeredDate).toLocaleDateString("en-GB")
          : r.administeredDate,
        r.doseNumber.toString(),
        r.status,
        r.patientAgeGroup,
        r.patientState,
        r.reportedToIIS ? "Yes" : "No"
      ];

      if (options.includePatientIdentifiers && !options.deidentify) {
        row.splice(1, 0, r.patientId);
      }

      return row;
    });

    let csv = headers.join(",") + "\n";
    csv += rows.map(row => row.map(cell => `"${cell}"`).join(",")).join("\n");

    if (options.includeMetadata) {
      csv += "\n\n# Report Metadata\n";
      csv += `# Report ID: ${report.id}\n`;
      csv += `# Generated At: ${report.generatedAt}\n`;
      csv += `# Total Records: ${report.records.length}\n`;
      csv += `# ${report.disclaimer}\n`;
    }

    return csv;
  }

  async exportToFHIRBundle(reportId: string, options: ExportOptions): Promise<object> {
    const report = this.reports.get(reportId);
    if (!report) {
      throw new Error(`Report ${reportId} not found`);
    }

    const entries = report.records.map(r => ({
      fullUrl: `urn:uuid:${r.id}`,
      resource: {
        resourceType: "Immunization",
        id: r.id,
        status: r.status,
        vaccineCode: {
          coding: [{
            system: "http://hl7.org/fhir/sid/cvx",
            code: r.vaccineCode,
            display: r.vaccineName
          }]
        },
        patient: options.deidentify 
          ? { reference: `Patient/${r.patientId}` }
          : { reference: `Patient/${r.patientId}`, display: `Patient ${r.patientId}` },
        occurrenceDateTime: r.administeredDate,
        lotNumber: r.lotNumber,
        manufacturer: {
          display: r.manufacturer
        },
        site: r.site ? {
          coding: [{
            system: "http://terminology.hl7.org/CodeSystem/v3-ActSite",
            display: r.site
          }]
        } : undefined,
        route: r.route ? {
          coding: [{
            system: "http://terminology.hl7.org/CodeSystem/v3-RouteOfAdministration",
            display: r.route
          }]
        } : undefined,
        doseQuantity: {
          value: r.doseNumber,
          unit: "dose"
        },
        performer: r.performerId ? [{
          actor: {
            reference: `Practitioner/${r.performerId}`,
            display: r.performerName
          }
        }] : undefined,
        location: r.facilityId ? {
          reference: `Location/${r.facilityId}`,
          display: r.facilityName
        } : undefined
      }
    }));

    const bundle = {
      resourceType: "Bundle",
      id: report.id,
      type: "collection",
      timestamp: report.generatedAt,
      total: entries.length,
      meta: {
        lastUpdated: report.generatedAt,
        tag: [{
          system: "http://terminology.hl7.org/CodeSystem/v3-ActReason",
          code: "PUBHLTH",
          display: "Public Health"
        }]
      },
      entry: entries
    };

    return bundle;
  }

  async exportToNDJSON(reportId: string, options: ExportOptions): Promise<string> {
    const bundle = await this.exportToFHIRBundle(reportId, options) as any;
    const lines = bundle.entry.map((e: any) => JSON.stringify(e.resource));
    return lines.join("\n");
  }

  async getReport(reportId: string): Promise<PublicHealthReport | null> {
    return this.reports.get(reportId) || null;
  }

  async listReports(userId: string): Promise<PublicHealthReport[]> {
    return Array.from(this.reports.values())
      .filter(r => r.generatedBy === userId)
      .sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());
  }

  async getAvailableFilters(): Promise<{
    vaccineTypes: string[];
    ageGroups: string[];
    states: string[];
    statuses: string[];
    facilities: { id: string; name: string }[];
  }> {
    const vaccineTypes = Array.from(new Set(this.records.map(r => r.vaccineType)));
    const ageGroups = Array.from(new Set(this.records.map(r => r.patientAgeGroup)));
    const states = Array.from(new Set(this.records.map(r => r.patientState)));
    const statuses = Array.from(new Set(this.records.map(r => r.status)));
    const facilityMap = new Map<string, string>();
    this.records.forEach(r => {
      if (r.facilityId && r.facilityName) {
        facilityMap.set(r.facilityId, r.facilityName);
      }
    });
    const facilities = Array.from(facilityMap.entries()).map(([id, name]) => ({ id, name }));

    return { vaccineTypes, ageGroups, states, statuses, facilities };
  }
}

export const publicHealthReportingService = new PublicHealthReportingService();
