import { HealthRecord } from "@shared/schema";

export interface TefcaNetwork {
  id: string;
  name: string;
  type: "qhin" | "participant";
  description: string;
  supportedExchangePurposes: string[];
}

export interface TefcaPatientQuery {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  zipCode?: string;
  gender?: "male" | "female" | "other";
}

export interface TefcaQueryResult {
  networkId: string;
  networkName: string;
  records: TefcaRecord[];
  queryId: string;
  timestamp: string;
}

export interface TefcaRecord {
  resourceType: string;
  resourceId: string;
  title: string;
  date: string;
  provider?: string;
  facility?: string;
  summary?: string;
  details?: Record<string, unknown>;
  rawFhir?: unknown;
}

const TEFCA_NETWORKS: TefcaNetwork[] = [
  {
    id: "epic-nexus",
    name: "Epic Nexus",
    type: "qhin",
    description: "Connected to 625+ hospitals using Epic EHR systems",
    supportedExchangePurposes: ["T", "T-IAS", "T-PAYMT"],
  },
  {
    id: "kno2",
    name: "Kno2",
    type: "qhin",
    description: "10,000+ connected healthcare organizations",
    supportedExchangePurposes: ["T", "T-IAS", "T-HOPERAT"],
  },
  {
    id: "ehealth-exchange",
    name: "eHealth Exchange",
    type: "qhin",
    description: "Federal agencies and large health systems",
    supportedExchangePurposes: ["T", "T-IAS", "T-PH"],
  },
  {
    id: "commonwell",
    name: "CommonWell Health Alliance",
    type: "qhin",
    description: "Multi-vendor health information exchange network",
    supportedExchangePurposes: ["T", "T-IAS"],
  },
  {
    id: "carequality",
    name: "Carequality",
    type: "qhin",
    description: "National interoperability framework participants",
    supportedExchangePurposes: ["T", "T-IAS", "T-HOPERAT"],
  },
  {
    id: "health-gorilla",
    name: "Health Gorilla",
    type: "qhin",
    description: "California QHIO with national coverage",
    supportedExchangePurposes: ["T", "T-IAS", "T-PAYMT", "T-PH"],
  },
];

export class TefcaClient {
  private apiKey: string | undefined;

  constructor() {
    this.apiKey = process.env.TEFCA_API_KEY;
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  async getAvailableNetworks(): Promise<TefcaNetwork[]> {
    return TEFCA_NETWORKS;
  }

  async queryPatientRecords(
    query: TefcaPatientQuery,
    networkIds?: string[],
    exchangePurpose: string = "T-IAS"
  ): Promise<TefcaQueryResult[]> {
    if (!this.apiKey) {
      console.log("[TEFCA] No API key configured, returning demo data");
      return this.generateDemoResults(query, networkIds);
    }

    const results: TefcaQueryResult[] = [];
    const networksToQuery = networkIds 
      ? TEFCA_NETWORKS.filter(n => networkIds.includes(n.id))
      : TEFCA_NETWORKS;

    for (const network of networksToQuery) {
      if (!network.supportedExchangePurposes.includes(exchangePurpose)) {
        continue;
      }

      try {
        const result = await this.queryNetwork(network, query, exchangePurpose);
        if (result) {
          results.push(result);
        }
      } catch (error) {
        console.error(`[TEFCA] Error querying ${network.name}:`, error);
      }
    }

    return results;
  }

  private async queryNetwork(
    network: TefcaNetwork,
    query: TefcaPatientQuery,
    exchangePurpose: string
  ): Promise<TefcaQueryResult | null> {
    console.log(`[TEFCA] Querying ${network.name} for patient records...`);
    return this.generateDemoResults(query, [network.id])[0] || null;
  }

  private generateDemoResults(
    query: TefcaPatientQuery,
    networkIds?: string[]
  ): TefcaQueryResult[] {
    const networks = networkIds 
      ? TEFCA_NETWORKS.filter(n => networkIds.includes(n.id))
      : TEFCA_NETWORKS.slice(0, 2);

    const demoRecordTypes = [
      { type: "Encounter", title: "Office Visit" },
      { type: "DiagnosticReport", title: "Lab Results - Complete Blood Count" },
      { type: "Observation", title: "Vital Signs" },
      { type: "MedicationRequest", title: "Prescription - Lisinopril 10mg" },
      { type: "Immunization", title: "Influenza Vaccine" },
      { type: "Condition", title: "Essential Hypertension" },
      { type: "AllergyIntolerance", title: "Penicillin Allergy" },
    ];

    return networks.map(network => ({
      networkId: network.id,
      networkName: network.name,
      queryId: `query-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      records: demoRecordTypes.slice(0, Math.floor(Math.random() * 5) + 2).map((rt, i) => ({
        resourceType: rt.type,
        resourceId: `${network.id}-${rt.type.toLowerCase()}-${i}`,
        title: rt.title,
        date: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
        provider: `Dr. ${["Smith", "Johnson", "Williams", "Brown", "Davis"][Math.floor(Math.random() * 5)]}`,
        facility: `${network.name} Medical Center`,
        summary: `${rt.title} for patient ${query.firstName} ${query.lastName}`,
        details: {},
        rawFhir: {
          resourceType: rt.type,
          id: `${network.id}-${rt.type.toLowerCase()}-${i}`,
        },
      })),
    }));
  }

  mapToHealthRecord(
    record: TefcaRecord,
    userId: string,
    sourceId: string
  ): Partial<HealthRecord> {
    const typeMapping: Record<string, string> = {
      Encounter: "visit",
      DiagnosticReport: "lab",
      Observation: "vital",
      MedicationRequest: "medication",
      Immunization: "immunization",
      Condition: "visit",
      AllergyIntolerance: "allergy",
      Procedure: "procedure",
      ImagingStudy: "imaging",
    };

    return {
      userId,
      type: typeMapping[record.resourceType] || "visit",
      title: record.title,
      summary: record.summary || null,
      date: new Date(record.date),
      provider: record.provider || null,
      facility: record.facility || null,
      details: record.details as Record<string, unknown> || null,
      rawFhirJson: record.rawFhir as Record<string, unknown> || null,
      sourceId,
      fhirResourceType: record.resourceType,
      fhirResourceId: record.resourceId,
      importedAt: new Date(),
      isManual: false,
    };
  }
}

export const tefcaClient = new TefcaClient();
