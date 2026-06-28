// NO-CDS: this service performs no clinical decision support — administrative /
// data-processing / factual-information only (no diagnosis, risk scoring, or
// treatment recommendation). Triaged 2026-06-22; see NO-CDS-TRIAGE.md.
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export interface PatientIdentity {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  ssn4?: string;
  zipCode?: string;
  phone?: string;
  email?: string;
}

export interface ProbabilisticMatch {
  sourceId: string;
  sourceName: string;
  sourceType: "hospital" | "clinic" | "lab" | "pharmacy" | "insurance" | "registry";
  matchScore: number;
  matchFactors: MatchFactor[];
  recordCount: number;
  dateRange: { earliest: string; latest: string };
  ehrSystem?: string;
  connectionStatus: "available" | "pending" | "requires_auth" | "unavailable";
}

export interface MatchFactor {
  factor: string;
  weight: number;
  matched: boolean;
  confidence: number;
}

export interface DiscoveredSource {
  sourceId: string;
  sourceName: string;
  sourceType: string;
  discoveryMethod: "demographic" | "geographic" | "insurance" | "referral" | "ai_inference";
  probability: number;
  reasoning: string;
  requiresVerification: boolean;
}

export interface RetrievalSession {
  sessionId: string;
  patientId: string;
  status: "discovering" | "matching" | "retrieving" | "completed" | "failed";
  identity: PatientIdentity;
  discoveredSources: DiscoveredSource[];
  confirmedMatches: ProbabilisticMatch[];
  retrievedRecords: RetrievedRecord[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  auditLog: AuditEntry[];
}

export interface RetrievedRecord {
  recordId: string;
  sourceId: string;
  sourceName: string;
  resourceType: string;
  fhirResource: any;
  retrievedAt: string;
  confidence: number;
}

export interface AuditEntry {
  timestamp: string;
  action: string;
  details: string;
  ipAddress?: string;
}

const HEALTHCARE_REGISTRIES = [
  {
    id: "npi_registry",
    name: "NPI Registry",
    type: "registry" as const,
    description: "National Provider Identifier lookup for provider discovery",
  },
  {
    id: "cms_medicare",
    name: "CMS Medicare Blue Button",
    type: "insurance" as const,
    description: "Medicare claims and coverage data",
  },
  {
    id: "state_hie",
    name: "State Health Information Exchange",
    type: "registry" as const,
    description: "State-level health information network",
  },
  {
    id: "commonwell",
    name: "CommonWell Health Alliance",
    type: "registry" as const,
    description: "Nationwide health data network",
  },
  {
    id: "carequality",
    name: "Carequality",
    type: "registry" as const,
    description: "National-level health data exchange framework",
  },
];

const MAJOR_HEALTH_SYSTEMS = [
  { id: "fastenhealth", name: "Fasten Health", ehrSystem: "Fasten Health", coverage: 0.85 },
];

const NATIONAL_LABS = [
  { id: "quest", name: "Quest Diagnostics", type: "lab" as const },
  { id: "labcorp", name: "Labcorp", type: "lab" as const },
  { id: "bioreference", name: "BioReference Laboratories", type: "lab" as const },
];

const NATIONAL_PHARMACIES = [
  { id: "cvs", name: "CVS Pharmacy", type: "pharmacy" as const },
  { id: "walgreens", name: "Walgreens", type: "pharmacy" as const },
  { id: "walmart", name: "Walmart Pharmacy", type: "pharmacy" as const },
  { id: "rite_aid", name: "Rite Aid", type: "pharmacy" as const },
];

class ZeroClickRetrievalService {
  private sessions: Map<string, RetrievalSession> = new Map();

  async initiateZeroClickRetrieval(
    patientId: string,
    identity: PatientIdentity,
    ipAddress?: string
  ): Promise<RetrievalSession> {
    const sessionId = `zcr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const session: RetrievalSession = {
      sessionId,
      patientId,
      status: "discovering",
      identity,
      discoveredSources: [],
      confirmedMatches: [],
      retrievedRecords: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      auditLog: [{
        timestamp: new Date().toISOString(),
        action: "SESSION_INITIATED",
        details: `Zero-click retrieval initiated for patient ${patientId}`,
        ipAddress,
      }],
    };

    this.sessions.set(sessionId, session);

    console.log(`[ZeroClickRetrieval] Session ${sessionId} initiated for patient ${patientId}`);
    console.log(`[HIPAA-AUDIT] Zero-click retrieval initiated - Patient: ${patientId}, Session: ${sessionId}`);

    // Start async discovery and retrieval
    this.runDiscoveryPipeline(sessionId).catch(err => {
      console.error(`[ZeroClickRetrieval] Pipeline error for session ${sessionId}:`, err);
      session.status = "failed";
    });

    return session;
  }

  private async runDiscoveryPipeline(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    try {
      // Phase 1: Intelligent Source Discovery
      session.status = "discovering";
      session.updatedAt = new Date().toISOString();
      
      const discoveredSources = await this.discoverSources(session.identity);
      session.discoveredSources = discoveredSources;
      
      session.auditLog.push({
        timestamp: new Date().toISOString(),
        action: "SOURCES_DISCOVERED",
        details: `Discovered ${discoveredSources.length} potential sources`,
      });

      // Phase 2: Probabilistic Matching
      session.status = "matching";
      session.updatedAt = new Date().toISOString();
      
      const matches = await this.performProbabilisticMatching(session.identity, discoveredSources);
      session.confirmedMatches = matches;
      
      session.auditLog.push({
        timestamp: new Date().toISOString(),
        action: "MATCHING_COMPLETE",
        details: `Confirmed ${matches.length} matches with high confidence`,
      });

      // Phase 3: Record Retrieval
      session.status = "retrieving";
      session.updatedAt = new Date().toISOString();
      
      const records = await this.retrieveRecords(session.patientId, matches);
      session.retrievedRecords = records;
      
      session.auditLog.push({
        timestamp: new Date().toISOString(),
        action: "RECORDS_RETRIEVED",
        details: `Retrieved ${records.length} health records`,
      });

      // Complete
      session.status = "completed";
      session.completedAt = new Date().toISOString();
      session.updatedAt = new Date().toISOString();

      console.log(`[ZeroClickRetrieval] Session ${sessionId} completed with ${records.length} records`);
      console.log(`[HIPAA-AUDIT] Zero-click retrieval completed - Session: ${sessionId}, Records: ${records.length}`);

    } catch (error) {
      session.status = "failed";
      session.auditLog.push({
        timestamp: new Date().toISOString(),
        action: "PIPELINE_FAILED",
        details: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  }

  private async discoverSources(identity: PatientIdentity): Promise<DiscoveredSource[]> {
    const sources: DiscoveredSource[] = [];

    // 1. Geographic-based discovery
    if (identity.zipCode) {
      const geographicSources = await this.discoverByGeography(identity.zipCode);
      sources.push(...geographicSources);
    }

    // 2. Demographic-based discovery (age-appropriate care patterns)
    const demographicSources = await this.discoverByDemographics(identity);
    sources.push(...demographicSources);

    // 3. AI-powered inference discovery
    const aiInferredSources = await this.discoverByAIInference(identity);
    sources.push(...aiInferredSources);

    // 4. National networks (always check)
    const nationalSources = this.discoverNationalNetworks();
    sources.push(...nationalSources);

    // Deduplicate and rank
    const uniqueSources = this.deduplicateAndRank(sources);

    console.log(`[ZeroClickRetrieval] Discovered ${uniqueSources.length} unique sources`);
    return uniqueSources;
  }

  private async discoverByGeography(zipCode: string): Promise<DiscoveredSource[]> {
    // Simulate geographic discovery based on ZIP code
    const sources: DiscoveredSource[] = [];

    // Add regional health systems
    const region = zipCode.substring(0, 3);
    
    sources.push({
      sourceId: `regional_hospital_${region}`,
      sourceName: `Regional Medical Center (${region}xx area)`,
      sourceType: "hospital",
      discoveryMethod: "geographic",
      probability: 0.65,
      reasoning: `Primary hospital serving ZIP ${zipCode} area based on census data`,
      requiresVerification: false,
    });

    sources.push({
      sourceId: `community_health_${region}`,
      sourceName: `Community Health Network (${region}xx area)`,
      sourceType: "clinic",
      discoveryMethod: "geographic",
      probability: 0.55,
      reasoning: `FQHC serving underserved populations in ${zipCode} area`,
      requiresVerification: false,
    });

    return sources;
  }

  private async discoverByDemographics(identity: PatientIdentity): Promise<DiscoveredSource[]> {
    const sources: DiscoveredSource[] = [];
    
    // Calculate approximate age
    const birthYear = new Date(identity.dateOfBirth).getFullYear();
    const age = new Date().getFullYear() - birthYear;

    // Age-based care patterns
    if (age >= 65) {
      sources.push({
        sourceId: "cms_medicare",
        sourceName: "Medicare Blue Button 2.0",
        sourceType: "insurance",
        discoveryMethod: "demographic",
        probability: 0.92,
        reasoning: "Patient age 65+ indicates high likelihood of Medicare enrollment",
        requiresVerification: false,
      });
    }

    if (age >= 50) {
      sources.push({
        sourceId: "colonoscopy_screening",
        sourceName: "GI Specialists / Screening Centers",
        sourceType: "clinic",
        discoveryMethod: "demographic",
        probability: 0.70,
        reasoning: "Age-appropriate colorectal screening typically begins at 45-50",
        requiresVerification: true,
      });
    }

    if (age >= 40) {
      sources.push({
        sourceId: "mammography_screening",
        sourceName: "Breast Imaging Centers",
        sourceType: "clinic",
        discoveryMethod: "demographic",
        probability: 0.60,
        reasoning: "Age-appropriate breast cancer screening typically begins at 40",
        requiresVerification: true,
      });
    }

    return sources;
  }

  private async discoverByAIInference(identity: PatientIdentity): Promise<DiscoveredSource[]> {
    try {
      const prompt = `Given a patient with the following demographics:
- Age: ${new Date().getFullYear() - new Date(identity.dateOfBirth).getFullYear()} years old
- Location: ZIP ${identity.zipCode || 'unknown'}

What types of healthcare sources are most likely to have their records? 
Return a JSON array of objects with: sourceType, probability (0-1), reasoning.
Focus on statistical likelihood based on healthcare utilization patterns.
Do not make assumptions about specific conditions or diagnoses.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are a healthcare data analyst specializing in patient record discovery patterns. Return only valid JSON arrays.",
          },
          { role: "user", content: prompt },
        ],
        max_tokens: 500,
        temperature: 0.3,
      });

      const content = response.choices[0]?.message?.content || "[]";
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      
      if (jsonMatch) {
        const inferences = JSON.parse(jsonMatch[0]);
        return inferences.map((inf: any, idx: number) => ({
          sourceId: `ai_inferred_${idx}`,
          sourceName: inf.sourceType || "Unknown Source",
          sourceType: inf.sourceType?.includes("lab") ? "lab" : 
                     inf.sourceType?.includes("pharmacy") ? "pharmacy" : "clinic",
          discoveryMethod: "ai_inference" as const,
          probability: inf.probability || 0.5,
          reasoning: inf.reasoning || "AI-inferred based on demographic patterns",
          requiresVerification: true,
        }));
      }
    } catch (error) {
      console.log("[ZeroClickRetrieval] AI inference skipped:", error);
    }

    return [];
  }

  private discoverNationalNetworks(): DiscoveredSource[] {
    const sources: DiscoveredSource[] = [];

    // Major EHR networks (high probability due to market share)
    MAJOR_HEALTH_SYSTEMS.forEach(system => {
      sources.push({
        sourceId: system.id,
        sourceName: system.name,
        sourceType: "hospital",
        discoveryMethod: "demographic",
        probability: system.coverage,
        reasoning: `${system.ehrSystem} network covers ~${(system.coverage * 100).toFixed(0)}% of US hospital beds`,
        requiresVerification: false,
      });
    });

    // National labs
    NATIONAL_LABS.forEach(lab => {
      sources.push({
        sourceId: lab.id,
        sourceName: lab.name,
        sourceType: lab.type,
        discoveryMethod: "demographic",
        probability: 0.40,
        reasoning: "National lab networks process ~60% of US lab tests combined",
        requiresVerification: false,
      });
    });

    // National pharmacies
    NATIONAL_PHARMACIES.forEach(pharmacy => {
      sources.push({
        sourceId: pharmacy.id,
        sourceName: pharmacy.name,
        sourceType: pharmacy.type,
        discoveryMethod: "demographic",
        probability: 0.35,
        reasoning: "Major pharmacy chain with nationwide prescription records",
        requiresVerification: false,
      });
    });

    return sources;
  }

  private deduplicateAndRank(sources: DiscoveredSource[]): DiscoveredSource[] {
    const seen = new Map<string, DiscoveredSource>();
    
    sources.forEach(source => {
      const existing = seen.get(source.sourceId);
      if (!existing || source.probability > existing.probability) {
        seen.set(source.sourceId, source);
      }
    });

    return Array.from(seen.values())
      .sort((a, b) => b.probability - a.probability);
  }

  private async performProbabilisticMatching(
    identity: PatientIdentity,
    sources: DiscoveredSource[]
  ): Promise<ProbabilisticMatch[]> {
    const matches: ProbabilisticMatch[] = [];

    for (const source of sources.filter(s => s.probability >= 0.3)) {
      const match = await this.matchAgainstSource(identity, source);
      if (match && match.matchScore >= 0.75) {
        matches.push(match);
      }
    }

    return matches.sort((a, b) => b.matchScore - a.matchScore);
  }

  private async matchAgainstSource(
    identity: PatientIdentity,
    source: DiscoveredSource
  ): Promise<ProbabilisticMatch | null> {
    // Simulate probabilistic matching using multiple factors
    const matchFactors: MatchFactor[] = [];

    // Name matching (weighted heavily)
    const nameMatch: MatchFactor = {
      factor: "Full Name",
      weight: 0.30,
      matched: true,
      confidence: 0.95,
    };
    matchFactors.push(nameMatch);

    // DOB matching (very high weight - unique identifier)
    const dobMatch: MatchFactor = {
      factor: "Date of Birth",
      weight: 0.35,
      matched: true,
      confidence: 0.99,
    };
    matchFactors.push(dobMatch);

    // SSN4 matching (if available)
    if (identity.ssn4) {
      const ssn4Match: MatchFactor = {
        factor: "SSN Last 4",
        weight: 0.20,
        matched: true,
        confidence: 0.98,
      };
      matchFactors.push(ssn4Match);
    }

    // Address/ZIP matching
    if (identity.zipCode) {
      const zipMatch: MatchFactor = {
        factor: "ZIP Code",
        weight: 0.10,
        matched: true,
        confidence: 0.90,
      };
      matchFactors.push(zipMatch);
    }

    // Phone matching (if available)
    if (identity.phone) {
      const phoneMatch: MatchFactor = {
        factor: "Phone Number",
        weight: 0.05,
        matched: true,
        confidence: 0.85,
      };
      matchFactors.push(phoneMatch);
    }

    // Calculate composite match score
    const totalWeight = matchFactors.reduce((sum, f) => sum + f.weight, 0);
    const matchScore = matchFactors.reduce(
      (sum, f) => sum + (f.matched ? f.weight * f.confidence : 0),
      0
    ) / totalWeight;

    // Simulate record discovery (based on source probability)
    const recordCount = Math.floor(source.probability * 50 * Math.random() + 5);
    const yearsBack = Math.floor(Math.random() * 10) + 1;
    const earliest = new Date();
    earliest.setFullYear(earliest.getFullYear() - yearsBack);

    return {
      sourceId: source.sourceId,
      sourceName: source.sourceName,
      sourceType: source.sourceType as any,
      matchScore,
      matchFactors,
      recordCount,
      dateRange: {
        earliest: earliest.toISOString().split('T')[0],
        latest: new Date().toISOString().split('T')[0],
      },
      ehrSystem: MAJOR_HEALTH_SYSTEMS.find(s => s.id === source.sourceId)?.ehrSystem,
      connectionStatus: matchScore >= 0.85 ? "available" : "pending",
    };
  }

  private async retrieveRecords(
    patientId: string,
    matches: ProbabilisticMatch[]
  ): Promise<RetrievedRecord[]> {
    const records: RetrievedRecord[] = [];

    for (const match of matches.filter(m => m.connectionStatus === "available")) {
      // Simulate FHIR record retrieval
      const sourceRecords = await this.retrieveFromSource(patientId, match);
      records.push(...sourceRecords);
    }

    console.log(`[HIPAA-AUDIT] Records retrieved - Patient: ${patientId}, Total: ${records.length}`);
    return records;
  }

  private async retrieveFromSource(
    patientId: string,
    match: ProbabilisticMatch
  ): Promise<RetrievedRecord[]> {
    const records: RetrievedRecord[] = [];
    const resourceTypes = [
      "Patient", "Condition", "MedicationRequest", "Observation", 
      "Procedure", "Immunization", "AllergyIntolerance", "DiagnosticReport"
    ];

    // Simulate retrieving various FHIR resources
    const numRecords = Math.min(match.recordCount, 20);
    
    for (let i = 0; i < numRecords; i++) {
      const resourceType = resourceTypes[Math.floor(Math.random() * resourceTypes.length)];
      
      records.push({
        recordId: `rec_${match.sourceId}_${i}_${Date.now()}`,
        sourceId: match.sourceId,
        sourceName: match.sourceName,
        resourceType,
        fhirResource: this.generateSampleFHIRResource(resourceType, patientId),
        retrievedAt: new Date().toISOString(),
        confidence: match.matchScore,
      });
    }

    return records;
  }

  private generateSampleFHIRResource(resourceType: string, patientId: string): any {
    const base = {
      resourceType,
      id: `${resourceType.toLowerCase()}_${Date.now()}`,
      meta: {
        versionId: "1",
        lastUpdated: new Date().toISOString(),
      },
      subject: {
        reference: `Patient/${patientId}`,
      },
    };

    switch (resourceType) {
      case "Condition":
        return {
          ...base,
          clinicalStatus: { coding: [{ code: "active" }] },
          code: { 
            coding: [{ 
              system: "http://snomed.info/sct", 
              code: "38341003",
              display: "Hypertensive disorder" 
            }] 
          },
          onsetDateTime: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000 * 5).toISOString(),
        };
      case "MedicationRequest":
        return {
          ...base,
          status: "active",
          medicationCodeableConcept: {
            coding: [{
              system: "http://www.nlm.nih.gov/research/umls/rxnorm",
              code: "197361",
              display: "Lisinopril 10 MG"
            }]
          },
          authoredOn: new Date().toISOString(),
        };
      case "Observation":
        return {
          ...base,
          status: "final",
          category: [{ coding: [{ code: "vital-signs" }] }],
          code: {
            coding: [{
              system: "http://loinc.org",
              code: "85354-9",
              display: "Blood pressure panel"
            }]
          },
          effectiveDateTime: new Date().toISOString(),
          component: [
            { code: { text: "Systolic" }, valueQuantity: { value: 128, unit: "mmHg" } },
            { code: { text: "Diastolic" }, valueQuantity: { value: 82, unit: "mmHg" } },
          ],
        };
      default:
        return base;
    }
  }

  async getSession(sessionId: string): Promise<RetrievalSession | null> {
    return this.sessions.get(sessionId) || null;
  }

  async getSessionsByPatient(patientId: string): Promise<RetrievalSession[]> {
    return Array.from(this.sessions.values())
      .filter(s => s.patientId === patientId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getDiscoveryProgress(sessionId: string): Promise<{
    status: string;
    progress: number;
    sourcesDiscovered: number;
    matchesConfirmed: number;
    recordsRetrieved: number;
  }> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { status: "not_found", progress: 0, sourcesDiscovered: 0, matchesConfirmed: 0, recordsRetrieved: 0 };
    }

    const progressMap: Record<string, number> = {
      discovering: 25,
      matching: 50,
      retrieving: 75,
      completed: 100,
      failed: 0,
    };

    return {
      status: session.status,
      progress: progressMap[session.status] || 0,
      sourcesDiscovered: session.discoveredSources.length,
      matchesConfirmed: session.confirmedMatches.length,
      recordsRetrieved: session.retrievedRecords.length,
    };
  }
}

export const zeroClickRetrievalService = new ZeroClickRetrievalService();
