/**
 * FHIR Journey Export Service
 * Generates FHIR-compliant JSON bundles for data portability
 */

import { db } from "./db";
import { healthRecords, users, patientProfiles } from "@shared/schema";
import { eq, desc, and, gte, lte } from "drizzle-orm";
import { medicalJourneyService, type MedicalJourney } from "./medical-journey-service";
import { semanticNormalizationService } from "./semantic-normalization-service";

export interface FhirBundle {
  resourceType: "Bundle";
  id: string;
  type: "collection" | "document" | "transaction";
  timestamp: string;
  meta: {
    lastUpdated: string;
    profile: string[];
    security: Array<{ system: string; code: string; display: string }>;
  };
  identifier: {
    system: string;
    value: string;
  };
  total: number;
  entry: Array<{
    fullUrl: string;
    resource: FhirResource;
  }>;
}

export interface FhirResource {
  resourceType: string;
  id: string;
  meta?: {
    lastUpdated?: string;
    profile?: string[];
  };
  [key: string]: unknown;
}

export class FhirJourneyExportService {
  private static instance: FhirJourneyExportService;

  static getInstance(): FhirJourneyExportService {
    if (!FhirJourneyExportService.instance) {
      FhirJourneyExportService.instance = new FhirJourneyExportService();
    }
    return FhirJourneyExportService.instance;
  }

  /**
   * Export the complete medical journey as a FHIR Bundle
   */
  async exportMedicalJourneyBundle(
    userId: string,
    options?: {
      startDate?: Date;
      endDate?: Date;
      includeRawFhir?: boolean;
      profileVersion?: "R4" | "R4B" | "R5";
    }
  ): Promise<FhirBundle> {
    const { startDate, endDate, includeRawFhir = true, profileVersion = "R4" } = options || {};

    const journey = await medicalJourneyService.buildMedicalJourney(userId, startDate, endDate);

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const [profile] = await db
      .select()
      .from(patientProfiles)
      .where(eq(patientProfiles.userId, userId))
      .limit(1);

    const bundleId = `journey-${userId}-${Date.now()}`;
    const timestamp = new Date().toISOString();

    const entries: FhirBundle["entry"] = [];

    const patientResource = this.createPatientResource(user, profile);
    entries.push({
      fullUrl: `urn:uuid:${patientResource.id}`,
      resource: patientResource,
    });

    const compositionResource = this.createCompositionResource(
      bundleId,
      patientResource.id,
      journey,
      timestamp
    );
    entries.push({
      fullUrl: `urn:uuid:${compositionResource.id}`,
      resource: compositionResource,
    });

    for (const event of journey.timelineEvents) {
      const resource = this.convertEventToFhirResource(event, patientResource.id, includeRawFhir);
      if (resource) {
        entries.push({
          fullUrl: `urn:uuid:${resource.id}`,
          resource,
        });
      }
    }

    for (const med of journey.medicationHistory) {
      const resource = this.createMedicationStatementResource(med, patientResource.id);
      entries.push({
        fullUrl: `urn:uuid:${resource.id}`,
        resource,
      });
    }

    for (const trend of journey.vitalTrends) {
      if (trend.dataPoints.length > 0) {
        const resource = this.createObservationResource(trend, patientResource.id);
        entries.push({
          fullUrl: `urn:uuid:${resource.id}`,
          resource,
        });
      }
    }

    return {
      resourceType: "Bundle",
      id: bundleId,
      type: "collection",
      timestamp,
      meta: {
        lastUpdated: timestamp,
        profile: [
          `http://hl7.org/fhir/us/core/StructureDefinition/us-core-bundle`,
        ],
        security: [
          {
            system: "http://terminology.hl7.org/CodeSystem/v3-Confidentiality",
            code: "R",
            display: "Restricted",
          },
        ],
      },
      identifier: {
        system: "urn:ietf:rfc:3986",
        value: `urn:uuid:${bundleId}`,
      },
      total: entries.length,
      entry: entries,
    };
  }

  /**
   * Create a FHIR Patient resource
   */
  private createPatientResource(
    user: typeof users.$inferSelect,
    profile?: typeof patientProfiles.$inferSelect | null
  ): FhirResource {
    const nameParts = user.name.split(" ");
    const givenNames = nameParts.slice(0, -1);
    const familyName = nameParts[nameParts.length - 1];

    const resource: FhirResource = {
      resourceType: "Patient",
      id: user.id,
      meta: {
        profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient"],
      },
      identifier: [
        {
          system: "urn:tabula-medica:patient-id",
          value: user.id,
        },
      ],
      name: [
        {
          use: "official",
          family: familyName,
          given: givenNames,
        },
      ],
      telecom: [
        {
          system: "email",
          value: user.email,
          use: "home",
        },
      ],
      active: true,
    };

    if (profile) {
      if ((profile as any).dateOfBirth) {
        resource.birthDate = (profile as any).dateOfBirth;
      }
      if ((profile as any).gender) {
        resource.gender = (profile as any).gender;
      }
      if ((profile as any).address) {
        resource.address = [
          {
            use: "home",
            type: "physical",
            text: (profile as any).address,
          },
        ];
      }
    }

    return resource;
  }

  /**
   * Create a FHIR Composition resource for the journey summary
   */
  private createCompositionResource(
    bundleId: string,
    patientId: string,
    journey: MedicalJourney,
    timestamp: string
  ): FhirResource {
    return {
      resourceType: "Composition",
      id: `composition-${bundleId}`,
      meta: {
        profile: ["http://hl7.org/fhir/us/ccda/StructureDefinition/CCD"],
      },
      status: "final",
      type: {
        coding: [
          {
            system: "http://loinc.org",
            code: "34133-9",
            display: "Summary of episode note",
          },
        ],
      },
      subject: {
        reference: `Patient/${patientId}`,
      },
      date: timestamp,
      title: "Longitudinal Medical Journey",
      confidentiality: "R",
      section: [
        {
          title: "Health Status Summary",
          code: {
            coding: [
              {
                system: "http://loinc.org",
                code: "11348-0",
                display: "History of past illness",
              },
            ],
          },
          text: {
            status: "generated",
            div: `<div xmlns="http://www.w3.org/1999/xhtml">${journey.statusSummary}</div>`,
          },
        },
        {
          title: "Statistics",
          code: {
            coding: [
              {
                system: "http://loinc.org",
                code: "55188-7",
                display: "Patient summary",
              },
            ],
          },
          text: {
            status: "generated",
            div: `<div xmlns="http://www.w3.org/1999/xhtml">
              <p>Total Events: ${journey.statistics.totalEvents}</p>
              <p>Lab Tests: ${journey.statistics.totalLabTests}</p>
              <p>Medications: ${journey.statistics.totalMedications}</p>
              <p>Visits: ${journey.statistics.totalVisits}</p>
              <p>Major Events: ${journey.statistics.majorEvents}</p>
            </div>`,
          },
        },
      ],
    };
  }

  /**
   * Convert a timeline event to a FHIR resource
   */
  private convertEventToFhirResource(
    event: MedicalJourney["timelineEvents"][0],
    patientId: string,
    includeRawFhir: boolean
  ): FhirResource | null {
    switch (event.type) {
      case "clinical_event":
        return this.createEncounterResource(event, patientId);
      case "lab":
        return this.createDiagnosticReportResource(event, patientId);
      case "immunization":
        return this.createImmunizationResource(event, patientId);
      case "imaging":
        return this.createImagingStudyResource(event, patientId);
      default:
        return null;
    }
  }

  /**
   * Create a FHIR Encounter resource
   */
  private createEncounterResource(
    event: MedicalJourney["timelineEvents"][0],
    patientId: string
  ): FhirResource {
    const severityCode = event.severity === "major" ? "EMER" : event.severity === "urgent" ? "URGENT" : "AMB";
    
    return {
      resourceType: "Encounter",
      id: event.id,
      meta: {
        profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-encounter"],
      },
      status: "finished",
      class: {
        system: "http://terminology.hl7.org/CodeSystem/v3-ActCode",
        code: severityCode,
        display: event.severity || "routine",
      },
      type: [
        {
          text: event.normalizedTitle,
        },
      ],
      subject: {
        reference: `Patient/${patientId}`,
      },
      period: {
        start: new Date(event.date).toISOString(),
      },
      serviceProvider: event.facility ? { display: event.facility } : undefined,
      participant: event.provider
        ? [
            {
              individual: {
                display: event.provider,
              },
            },
          ]
        : undefined,
    };
  }

  /**
   * Create a FHIR DiagnosticReport resource for lab results
   */
  private createDiagnosticReportResource(
    event: MedicalJourney["timelineEvents"][0],
    patientId: string
  ): FhirResource {
    const normalizedLab = semanticNormalizationService.normalizeLabTest(event.title);
    
    return {
      resourceType: "DiagnosticReport",
      id: event.id,
      meta: {
        profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-diagnosticreport-lab"],
      },
      status: "final",
      category: [
        {
          coding: [
            {
              system: "http://terminology.hl7.org/CodeSystem/v2-0074",
              code: "LAB",
              display: "Laboratory",
            },
          ],
        },
      ],
      code: {
        coding: normalizedLab.loincCode
          ? [
              {
                system: "http://loinc.org",
                code: normalizedLab.loincCode,
                display: normalizedLab.displayName,
              },
            ]
          : [],
        text: normalizedLab.displayName,
      },
      subject: {
        reference: `Patient/${patientId}`,
      },
      effectiveDateTime: new Date(event.date).toISOString(),
      issued: new Date(event.date).toISOString(),
    };
  }

  /**
   * Create a FHIR Immunization resource
   */
  private createImmunizationResource(
    event: MedicalJourney["timelineEvents"][0],
    patientId: string
  ): FhirResource {
    return {
      resourceType: "Immunization",
      id: event.id,
      meta: {
        profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-immunization"],
      },
      status: "completed",
      vaccineCode: {
        text: event.normalizedTitle,
      },
      patient: {
        reference: `Patient/${patientId}`,
      },
      occurrenceDateTime: new Date(event.date).toISOString(),
      performer: event.provider
        ? [
            {
              actor: {
                display: event.provider,
              },
            },
          ]
        : undefined,
    };
  }

  /**
   * Create a FHIR ImagingStudy resource
   */
  private createImagingStudyResource(
    event: MedicalJourney["timelineEvents"][0],
    patientId: string
  ): FhirResource {
    return {
      resourceType: "ImagingStudy",
      id: event.id,
      status: "available",
      subject: {
        reference: `Patient/${patientId}`,
      },
      started: new Date(event.date).toISOString(),
      description: event.normalizedTitle,
    };
  }

  /**
   * Create a FHIR MedicationStatement resource
   */
  private createMedicationStatementResource(
    med: MedicalJourney["medicationHistory"][0],
    patientId: string
  ): FhirResource {
    const normalizedMed = semanticNormalizationService.normalizeMedication(med.genericName);
    const activePeriod = med.periods.find(p => p.isActive);
    const mostRecentPeriod = med.periods[med.periods.length - 1];

    return {
      resourceType: "MedicationStatement",
      id: `medication-${med.genericName.toLowerCase().replace(/\s+/g, "-")}`,
      meta: {
        profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-medicationstatement"],
      },
      status: activePeriod ? "active" : "completed",
      medicationCodeableConcept: {
        coding: normalizedMed.rxcui
          ? [
              {
                system: "http://www.nlm.nih.gov/research/umls/rxnorm",
                code: normalizedMed.rxcui,
                display: normalizedMed.genericName,
              },
            ]
          : [],
        text: normalizedMed.genericName,
      },
      subject: {
        reference: `Patient/${patientId}`,
      },
      effectivePeriod: {
        start: mostRecentPeriod?.startDate
          ? new Date(mostRecentPeriod.startDate).toISOString()
          : undefined,
        end: mostRecentPeriod?.endDate
          ? new Date(mostRecentPeriod.endDate).toISOString()
          : undefined,
      },
      dosage: mostRecentPeriod?.dosage
        ? [
            {
              text: mostRecentPeriod.dosage,
            },
          ]
        : undefined,
    };
  }

  /**
   * Create a FHIR Observation resource for vital trends
   */
  private createObservationResource(
    trend: MedicalJourney["vitalTrends"][0],
    patientId: string
  ): FhirResource {
    const normalizedLab = semanticNormalizationService.normalizeLabTest(trend.name);
    const latestPoint = trend.dataPoints[trend.dataPoints.length - 1];

    return {
      resourceType: "Observation",
      id: `observation-${trend.name.toLowerCase().replace(/\s+/g, "-")}`,
      meta: {
        profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-observation-lab"],
      },
      status: "final",
      category: [
        {
          coding: [
            {
              system: "http://terminology.hl7.org/CodeSystem/observation-category",
              code: "laboratory",
              display: "Laboratory",
            },
          ],
        },
      ],
      code: {
        coding: normalizedLab.loincCode
          ? [
              {
                system: "http://loinc.org",
                code: normalizedLab.loincCode,
                display: normalizedLab.displayName,
              },
            ]
          : [],
        text: trend.normalizedName,
      },
      subject: {
        reference: `Patient/${patientId}`,
      },
      effectiveDateTime: latestPoint ? new Date(latestPoint.date).toISOString() : undefined,
      valueQuantity: trend.latestValue
        ? {
            value: trend.latestValue,
            unit: trend.unit,
            system: "http://unitsofmeasure.org",
            code: trend.unit,
          }
        : undefined,
      interpretation: trend.trend
        ? [
            {
              coding: [
                {
                  system: "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation",
                  code: trend.trend === "improving" ? "B" : trend.trend === "declining" ? "W" : "N",
                  display:
                    trend.trend === "improving"
                      ? "Better"
                      : trend.trend === "declining"
                      ? "Worse"
                      : "Normal",
                },
              ],
            },
          ]
        : undefined,
    };
  }

  /**
   * Generate a portable health summary document
   */
  async generatePortableSummary(userId: string): Promise<{
    bundle: FhirBundle;
    summary: {
      patientName: string;
      generatedAt: string;
      recordCount: number;
      dateRange: { start: string; end: string };
      exportFormat: string;
      complianceVersion: string;
    };
  }> {
    const bundle = await this.exportMedicalJourneyBundle(userId);

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const journey = await medicalJourneyService.buildMedicalJourney(userId);

    return {
      bundle,
      summary: {
        patientName: user?.name || "Unknown",
        generatedAt: new Date().toISOString(),
        recordCount: bundle.total,
        dateRange: {
          start: journey.dateRange.start.toISOString(),
          end: journey.dateRange.end.toISOString(),
        },
        exportFormat: "FHIR R4 Bundle",
        complianceVersion: "US Core 4.0.0",
      },
    };
  }
}

export const fhirJourneyExportService = FhirJourneyExportService.getInstance();
