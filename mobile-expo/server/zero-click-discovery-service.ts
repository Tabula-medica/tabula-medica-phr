import { createHash } from "crypto";

interface PatientDemographics {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  middleName?: string;
  gender?: "male" | "female" | "other" | "unknown";
  ssn4?: string;
  phone?: string;
  email?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
  };
}

interface DiscoveredSource {
  id: string;
  name: string;
  type: "ehr" | "lab" | "imaging" | "pharmacy" | "insurance" | "wearable" | "phr";
  ehrSystem?: string;
  confidence: number;
  matchMethod: "deterministic" | "probabilistic" | "network_inference";
  estimatedRecordCount?: number;
  lastKnownActivity?: Date;
  connectionStatus: "available" | "requires_consent" | "pending" | "connected";
  capabilities: string[];
}

interface DiscoveryResult {
  discoveryId: string;
  patientHash: string;
  sources: DiscoveredSource[];
  totalEstimatedRecords: number;
  coverageYears: number;
  confidenceScore: number;
  discoveryMethod: string;
  processingTimeMs: number;
  networkExpansionSuggestions: string[];
}

interface RecordRetrievalProgress {
  discoveryId: string;
  totalSources: number;
  completedSources: number;
  pendingSources: number;
  failedSources: number;
  recordsRetrieved: number;
  status: "discovering" | "retrieving" | "processing" | "complete" | "partial" | "failed";
  estimatedCompletionTime?: Date;
  errors: Array<{ source: string; error: string }>;
}

interface NetworkNode {
  id: string;
  type: "health_system" | "lab_network" | "pharmacy_chain" | "payer" | "hie";
  name: string;
  coverage: string[];
  ehrSystems: string[];
  participatesIn: string[];
}

const healthcareNetworkGraph: NetworkNode[] = [
  {
    id: "commonwell",
    type: "hie",
    name: "CommonWell Health Alliance",
    coverage: ["national"],
    ehrSystems: ["epic", "cerner", "athena", "meditech", "allscripts"],
    participatesIn: ["tefca", "carequality"]
  },
  {
    id: "carequality",
    type: "hie",
    name: "Carequality",
    coverage: ["national"],
    ehrSystems: ["epic", "cerner", "athena", "eclinicalworks"],
    participatesIn: ["tefca"]
  },
  {
    id: "epic_care_everywhere",
    type: "health_system",
    name: "Epic Care Everywhere Network",
    coverage: ["national", "international"],
    ehrSystems: ["epic"],
    participatesIn: ["commonwell", "carequality"]
  },
  {
    id: "surescripts",
    type: "pharmacy_chain",
    name: "Surescripts",
    coverage: ["national"],
    ehrSystems: [],
    participatesIn: ["medication_history", "eligibility"]
  },
  {
    id: "quest_diagnostics",
    type: "lab_network",
    name: "Quest Diagnostics",
    coverage: ["national"],
    ehrSystems: [],
    participatesIn: ["commonwell", "carequality"]
  },
  {
    id: "labcorp",
    type: "lab_network",
    name: "LabCorp",
    coverage: ["national"],
    ehrSystems: [],
    participatesIn: ["commonwell", "carequality"]
  }
];

const ehrSystemLocator: Record<string, { regions: string[]; healthSystems: string[] }> = {
  epic: {
    regions: ["all"],
    healthSystems: [
      "Kaiser Permanente", "Mayo Clinic", "Cleveland Clinic", "Johns Hopkins",
      "UCSF Health", "Duke Health", "Partners HealthCare", "Cedars-Sinai",
      "Stanford Health Care", "NYU Langone", "Mount Sinai", "UCLA Health"
    ]
  },
  cerner: {
    regions: ["all"],
    healthSystems: [
      "VA Health System", "Adventist Health", "CHI Health", "Community Health Systems",
      "Tenet Healthcare", "HCA Healthcare"
    ]
  },
  athena: {
    regions: ["all"],
    healthSystems: ["Physician practices", "Ambulatory networks", "Urgent care chains"]
  },
  eclinicalworks: {
    regions: ["all"],
    healthSystems: ["Independent practices", "Community health centers"]
  }
};

class ZeroClickDiscoveryService {
  private discoveryCache: Map<string, DiscoveryResult> = new Map();
  private retrievalProgress: Map<string, RecordRetrievalProgress> = new Map();
  private patientSourceHistory: Map<string, Set<string>> = new Map();

  generatePatientHash(demographics: PatientDemographics): string {
    const normalized = {
      firstName: demographics.firstName.toLowerCase().trim(),
      lastName: demographics.lastName.toLowerCase().trim(),
      dob: demographics.dateOfBirth,
      ssn4: demographics.ssn4 || ""
    };
    
    const hashInput = `${normalized.firstName}|${normalized.lastName}|${normalized.dob}|${normalized.ssn4}`;
    return createHash("sha256").update(hashInput).digest("hex").substring(0, 32);
  }

  async discoverSources(demographics: PatientDemographics): Promise<DiscoveryResult> {
    const startTime = Date.now();
    const patientHash = this.generatePatientHash(demographics);
    const discoveryId = `disc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const sources: DiscoveredSource[] = [];

    const networkSources = await this.queryHealthInformationExchanges(demographics);
    sources.push(...networkSources);

    const inferredSources = await this.inferSourcesFromDemographics(demographics);
    sources.push(...inferredSources);

    const pharmacySources = await this.discoverPharmacySources(demographics);
    sources.push(...pharmacySources);

    const labSources = await this.discoverLabSources(demographics);
    sources.push(...labSources);

    const insuranceSources = await this.discoverInsuranceSources(demographics);
    sources.push(...insuranceSources);

    const uniqueSources = this.deduplicateSources(sources);
    const rankedSources = this.rankSourcesByRelevance(uniqueSources, demographics);

    const result: DiscoveryResult = {
      discoveryId,
      patientHash,
      sources: rankedSources,
      totalEstimatedRecords: rankedSources.reduce((sum, s) => sum + (s.estimatedRecordCount || 0), 0),
      coverageYears: this.estimateCoverageYears(rankedSources),
      confidenceScore: this.calculateOverallConfidence(rankedSources),
      discoveryMethod: "multi_network_probabilistic",
      processingTimeMs: Date.now() - startTime,
      networkExpansionSuggestions: this.suggestNetworkExpansion(rankedSources, demographics)
    };

    this.discoveryCache.set(discoveryId, result);
    return result;
  }

  private async queryHealthInformationExchanges(demographics: PatientDemographics): Promise<DiscoveredSource[]> {
    const sources: DiscoveredSource[] = [];
    
    sources.push({
      id: `hie_commonwell_${Date.now()}`,
      name: "CommonWell Health Alliance",
      type: "ehr",
      confidence: 0.85,
      matchMethod: "probabilistic",
      estimatedRecordCount: Math.floor(Math.random() * 50) + 10,
      connectionStatus: "available",
      capabilities: ["clinical_summary", "medications", "allergies", "conditions", "encounters"]
    });

    sources.push({
      id: `hie_carequality_${Date.now()}`,
      name: "Carequality Network",
      type: "ehr",
      confidence: 0.82,
      matchMethod: "probabilistic",
      estimatedRecordCount: Math.floor(Math.random() * 40) + 5,
      connectionStatus: "available",
      capabilities: ["clinical_summary", "lab_results", "imaging_reports"]
    });

    return sources;
  }

  private async inferSourcesFromDemographics(demographics: PatientDemographics): Promise<DiscoveredSource[]> {
    const sources: DiscoveredSource[] = [];

    if (demographics.address?.state) {
      const stateHealthSystems = this.getHealthSystemsByState(demographics.address.state);
      
      for (const system of stateHealthSystems.slice(0, 3)) {
        sources.push({
          id: `inferred_${system.id}_${Date.now()}`,
          name: system.name,
          type: "ehr",
          ehrSystem: system.ehrSystem,
          confidence: 0.6 + (Math.random() * 0.2),
          matchMethod: "network_inference",
          estimatedRecordCount: Math.floor(Math.random() * 30) + 5,
          connectionStatus: "requires_consent",
          capabilities: system.capabilities
        });
      }
    }

    return sources;
  }

  private async discoverPharmacySources(demographics: PatientDemographics): Promise<DiscoveredSource[]> {
    return [
      {
        id: `pharmacy_surescripts_${Date.now()}`,
        name: "Surescripts Medication History",
        type: "pharmacy",
        confidence: 0.95,
        matchMethod: "deterministic",
        estimatedRecordCount: Math.floor(Math.random() * 100) + 20,
        connectionStatus: "available",
        capabilities: ["medication_history", "fill_history", "pharmacy_locations"]
      },
      {
        id: `pharmacy_cvs_${Date.now()}`,
        name: "CVS Pharmacy",
        type: "pharmacy",
        confidence: 0.75,
        matchMethod: "probabilistic",
        estimatedRecordCount: Math.floor(Math.random() * 50) + 10,
        connectionStatus: "requires_consent",
        capabilities: ["prescriptions", "immunizations", "otc_purchases"]
      },
      {
        id: `pharmacy_walgreens_${Date.now()}`,
        name: "Walgreens",
        type: "pharmacy",
        confidence: 0.72,
        matchMethod: "probabilistic",
        estimatedRecordCount: Math.floor(Math.random() * 40) + 5,
        connectionStatus: "requires_consent",
        capabilities: ["prescriptions", "immunizations", "health_screenings"]
      }
    ];
  }

  private async discoverLabSources(demographics: PatientDemographics): Promise<DiscoveredSource[]> {
    return [
      {
        id: `lab_quest_${Date.now()}`,
        name: "Quest Diagnostics",
        type: "lab",
        confidence: 0.88,
        matchMethod: "probabilistic",
        estimatedRecordCount: Math.floor(Math.random() * 60) + 15,
        lastKnownActivity: new Date(Date.now() - Math.random() * 180 * 24 * 60 * 60 * 1000),
        connectionStatus: "available",
        capabilities: ["lab_results", "panel_history", "trending", "critical_values"]
      },
      {
        id: `lab_labcorp_${Date.now()}`,
        name: "LabCorp",
        type: "lab",
        confidence: 0.85,
        matchMethod: "probabilistic",
        estimatedRecordCount: Math.floor(Math.random() * 50) + 10,
        connectionStatus: "available",
        capabilities: ["lab_results", "genetic_testing", "drug_screening"]
      }
    ];
  }

  private async discoverInsuranceSources(demographics: PatientDemographics): Promise<DiscoveredSource[]> {
    return [
      {
        id: `insurance_claims_${Date.now()}`,
        name: "Claims History (via Flexpa)",
        type: "insurance",
        confidence: 0.92,
        matchMethod: "deterministic",
        estimatedRecordCount: Math.floor(Math.random() * 200) + 50,
        connectionStatus: "requires_consent",
        capabilities: ["claims_history", "eob", "coverage_info", "provider_visits", "cost_transparency"]
      }
    ];
  }

  private getHealthSystemsByState(state: string): Array<{ id: string; name: string; ehrSystem: string; capabilities: string[] }> {
    const systems: Record<string, Array<{ id: string; name: string; ehrSystem: string; capabilities: string[] }>> = {
      CA: [
        { id: "kaiser_ca", name: "Kaiser Permanente California", ehrSystem: "epic", capabilities: ["full_record", "appointments", "messaging"] },
        { id: "ucsf", name: "UCSF Health", ehrSystem: "epic", capabilities: ["full_record", "research_data"] },
        { id: "cedars", name: "Cedars-Sinai", ehrSystem: "epic", capabilities: ["full_record", "imaging"] }
      ],
      NY: [
        { id: "nyu_langone", name: "NYU Langone Health", ehrSystem: "epic", capabilities: ["full_record", "research_data"] },
        { id: "mount_sinai", name: "Mount Sinai Health System", ehrSystem: "epic", capabilities: ["full_record", "genetic_data"] },
        { id: "northwell", name: "Northwell Health", ehrSystem: "cerner", capabilities: ["full_record", "urgent_care"] }
      ],
      TX: [
        { id: "md_anderson", name: "MD Anderson Cancer Center", ehrSystem: "epic", capabilities: ["oncology_records", "research_data"] },
        { id: "memorial_hermann", name: "Memorial Hermann", ehrSystem: "epic", capabilities: ["full_record", "trauma_center"] },
        { id: "baylor", name: "Baylor Scott & White", ehrSystem: "epic", capabilities: ["full_record", "research_data"] }
      ],
      FL: [
        { id: "cleveland_clinic_fl", name: "Cleveland Clinic Florida", ehrSystem: "epic", capabilities: ["full_record", "cardiology"] },
        { id: "baptist_health", name: "Baptist Health South Florida", ehrSystem: "cerner", capabilities: ["full_record", "imaging"] }
      ],
      MA: [
        { id: "mass_general", name: "Massachusetts General Hospital", ehrSystem: "epic", capabilities: ["full_record", "research_data"] },
        { id: "brigham", name: "Brigham and Women's Hospital", ehrSystem: "epic", capabilities: ["full_record", "clinical_trials"] }
      ],
      OH: [
        { id: "cleveland_clinic", name: "Cleveland Clinic", ehrSystem: "epic", capabilities: ["full_record", "cardiology", "research_data"] },
        { id: "osu_wexner", name: "Ohio State Wexner Medical Center", ehrSystem: "epic", capabilities: ["full_record", "cancer_care"] }
      ],
      MN: [
        { id: "mayo_clinic", name: "Mayo Clinic", ehrSystem: "epic", capabilities: ["full_record", "research_data", "second_opinions"] }
      ]
    };

    return systems[state] || [
      { id: `generic_${state.toLowerCase()}`, name: `${state} Health Network`, ehrSystem: "epic", capabilities: ["clinical_summary"] }
    ];
  }

  private deduplicateSources(sources: DiscoveredSource[]): DiscoveredSource[] {
    const seen = new Map<string, DiscoveredSource>();
    
    for (const source of sources) {
      const key = `${source.name.toLowerCase().replace(/\s+/g, "_")}_${source.type}`;
      const existing = seen.get(key);
      
      if (!existing || source.confidence > existing.confidence) {
        seen.set(key, source);
      }
    }
    
    return Array.from(seen.values());
  }

  private rankSourcesByRelevance(sources: DiscoveredSource[], demographics: PatientDemographics): DiscoveredSource[] {
    return sources.sort((a, b) => {
      const aScore = this.calculateSourceScore(a, demographics);
      const bScore = this.calculateSourceScore(b, demographics);
      return bScore - aScore;
    });
  }

  private calculateSourceScore(source: DiscoveredSource, demographics: PatientDemographics): number {
    let score = source.confidence * 100;
    
    if (source.matchMethod === "deterministic") score += 20;
    if (source.lastKnownActivity) {
      const recency = (Date.now() - source.lastKnownActivity.getTime()) / (365 * 24 * 60 * 60 * 1000);
      score += Math.max(0, 15 - recency * 5);
    }
    
    if (source.estimatedRecordCount) {
      score += Math.min(20, source.estimatedRecordCount / 5);
    }
    
    if (source.connectionStatus === "available") score += 10;
    if (source.connectionStatus === "connected") score += 15;
    
    return score;
  }

  private estimateCoverageYears(sources: DiscoveredSource[]): number {
    const oldestActivity = sources
      .filter(s => s.lastKnownActivity)
      .map(s => s.lastKnownActivity!.getTime())
      .sort()[0];
    
    if (oldestActivity) {
      return Math.ceil((Date.now() - oldestActivity) / (365 * 24 * 60 * 60 * 1000));
    }
    
    return Math.min(10, Math.floor(sources.length / 2) + 3);
  }

  private calculateOverallConfidence(sources: DiscoveredSource[]): number {
    if (sources.length === 0) return 0;
    
    const weightedSum = sources.reduce((sum, source) => {
      const weight = source.matchMethod === "deterministic" ? 1.5 : 
                     source.matchMethod === "probabilistic" ? 1.0 : 0.7;
      return sum + source.confidence * weight;
    }, 0);
    
    const totalWeight = sources.reduce((sum, source) => {
      return sum + (source.matchMethod === "deterministic" ? 1.5 : 
                    source.matchMethod === "probabilistic" ? 1.0 : 0.7);
    }, 0);
    
    return Math.min(0.99, weightedSum / totalWeight);
  }

  private suggestNetworkExpansion(sources: DiscoveredSource[], demographics: PatientDemographics): string[] {
    const suggestions: string[] = [];
    
    const hasLabs = sources.some(s => s.type === "lab");
    const hasPharmacy = sources.some(s => s.type === "pharmacy");
    const hasInsurance = sources.some(s => s.type === "insurance");
    const hasEHR = sources.some(s => s.type === "ehr");
    
    if (!hasLabs) {
      suggestions.push("Connect Quest Diagnostics or LabCorp for comprehensive lab history");
    }
    if (!hasPharmacy) {
      suggestions.push("Link pharmacy accounts for complete medication history");
    }
    if (!hasInsurance) {
      suggestions.push("Connect insurance for claims history and cost transparency");
    }
    if (!hasEHR) {
      suggestions.push("Connect to your primary care portal for clinical records");
    }
    
    if (sources.filter(s => s.type === "ehr").length < 3) {
      suggestions.push("More health system connections may reveal additional records from specialists");
    }
    
    return suggestions;
  }

  async initiateZeroClickRetrieval(discoveryId: string, patientId: string): Promise<RecordRetrievalProgress> {
    const discovery = this.discoveryCache.get(discoveryId);
    if (!discovery) {
      throw new Error("Discovery not found");
    }

    const progress: RecordRetrievalProgress = {
      discoveryId,
      totalSources: discovery.sources.filter(s => s.connectionStatus === "available" || s.connectionStatus === "connected").length,
      completedSources: 0,
      pendingSources: discovery.sources.filter(s => s.connectionStatus === "available" || s.connectionStatus === "connected").length,
      failedSources: 0,
      recordsRetrieved: 0,
      status: "retrieving",
      estimatedCompletionTime: new Date(Date.now() + 30000),
      errors: []
    };

    this.retrievalProgress.set(discoveryId, progress);

    this.simulateRetrieval(discoveryId, discovery.sources);

    return progress;
  }

  private async simulateRetrieval(discoveryId: string, sources: DiscoveredSource[]): Promise<void> {
    const progress = this.retrievalProgress.get(discoveryId);
    if (!progress) return;

    const availableSources = sources.filter(s => 
      s.connectionStatus === "available" || s.connectionStatus === "connected"
    );

    for (const source of availableSources) {
      await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
      
      const success = Math.random() > 0.1;
      
      if (success) {
        progress.completedSources++;
        progress.recordsRetrieved += source.estimatedRecordCount || 0;
      } else {
        progress.failedSources++;
        progress.errors.push({ source: source.name, error: "Connection timeout" });
      }
      
      progress.pendingSources--;
    }

    progress.status = progress.failedSources === 0 ? "complete" : 
                      progress.completedSources > 0 ? "partial" : "failed";
    progress.estimatedCompletionTime = undefined;
  }

  getRetrievalProgress(discoveryId: string): RecordRetrievalProgress | null {
    return this.retrievalProgress.get(discoveryId) || null;
  }

  getDiscoveryResult(discoveryId: string): DiscoveryResult | null {
    return this.discoveryCache.get(discoveryId) || null;
  }

  async performProbabilisticMatch(
    demographics: PatientDemographics,
    targetSource: string
  ): Promise<{ matched: boolean; confidence: number; matchDetails: object }> {
    const matchDetails: Record<string, { matched: boolean; weight: number }> = {};
    let totalScore = 0;
    let maxScore = 0;

    if (demographics.firstName && demographics.lastName) {
      matchDetails.name = { matched: true, weight: 0.25 };
      totalScore += 0.25;
    }
    maxScore += 0.25;

    if (demographics.dateOfBirth) {
      matchDetails.dob = { matched: true, weight: 0.30 };
      totalScore += 0.30;
    }
    maxScore += 0.30;

    if (demographics.ssn4) {
      matchDetails.ssn4 = { matched: true, weight: 0.20 };
      totalScore += 0.20;
    }
    maxScore += 0.20;

    if (demographics.phone) {
      matchDetails.phone = { matched: Math.random() > 0.3, weight: 0.10 };
      if (matchDetails.phone.matched) totalScore += 0.10;
    }
    maxScore += 0.10;

    if (demographics.address?.zipCode) {
      matchDetails.address = { matched: Math.random() > 0.2, weight: 0.15 };
      if (matchDetails.address.matched) totalScore += 0.15;
    }
    maxScore += 0.15;

    const confidence = totalScore / maxScore;
    const matched = confidence >= 0.7;

    return { matched, confidence, matchDetails };
  }

  getNetworkGraph(): NetworkNode[] {
    return healthcareNetworkGraph;
  }

  getSupportedEHRSystems(): typeof ehrSystemLocator {
    return ehrSystemLocator;
  }
}

export const zeroClickDiscoveryService = new ZeroClickDiscoveryService();

export function initializeZeroClickDiscovery() {
  console.log("Zero-click record discovery service initialized");
}
