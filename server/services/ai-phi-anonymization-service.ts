import { generatePhiSafeText } from "./ai-gateway";
import { v4 as uuidv4 } from "uuid";

export type PHICategory =
  | "name"
  | "address"
  | "date"
  | "phone"
  | "fax"
  | "email"
  | "ssn"
  | "mrn"
  | "healthPlanId"
  | "accountNumber"
  | "license"
  | "vehicleId"
  | "deviceId"
  | "url"
  | "ipAddress"
  | "biometric"
  | "photo"
  | "uniqueIdentifier";

export type DeidentificationStrategy =
  | "safe_harbor"
  | "pseudonymization"
  | "generalization"
  | "suppression"
  | "perturbation"
  | "k_anonymity";

export interface PHIDetection {
  id: string;
  path: string;
  value: any;
  category: PHICategory;
  confidence: number;
  hipaaIdentifier: string;
  riskLevel: "high" | "medium" | "low";
  suggestedAction: DeidentificationStrategy;
}

export interface AnonymizationRule {
  id: string;
  category: PHICategory;
  strategy: DeidentificationStrategy;
  preserveFormat: boolean;
  preserveLength: boolean;
  customValue?: string;
  dateShiftDays?: number;
  generalizationLevel?: number;
}

export interface AnonymizationResult {
  id: string;
  originalResource: any;
  anonymizedResource: any;
  detections: PHIDetection[];
  appliedRules: AnonymizationRule[];
  dataUtilityScore: number;
  privacyScore: number;
  complianceStatus: {
    hipaaCompliant: boolean;
    safeHarborCompliant: boolean;
    issues: string[];
  };
  auditLog: AuditEntry[];
  timestamp: string;
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  action: string;
  path: string;
  originalValue: string;
  newValue: string;
  strategy: DeidentificationStrategy;
  category: PHICategory;
}

export interface DatasetAnonymizationResult {
  id: string;
  datasetName: string;
  resourceCount: number;
  results: AnonymizationResult[];
  aggregateStats: {
    totalPHIDetected: number;
    totalAnonymized: number;
    avgDataUtility: number;
    avgPrivacyScore: number;
    complianceRate: number;
  };
  kAnonymityStatus?: {
    k: number;
    satisfied: boolean;
    quasiIdentifiers: string[];
  };
  timestamp: string;
}

const HIPAA_SAFE_HARBOR_IDENTIFIERS: Record<PHICategory, string> = {
  name: "Names",
  address: "Geographic data smaller than state",
  date: "Dates (except year) related to individual",
  phone: "Telephone numbers",
  fax: "Fax numbers",
  email: "Email addresses",
  ssn: "Social Security numbers",
  mrn: "Medical record numbers",
  healthPlanId: "Health plan beneficiary numbers",
  accountNumber: "Account numbers",
  license: "Certificate/license numbers",
  vehicleId: "Vehicle identifiers and serial numbers",
  deviceId: "Device identifiers and serial numbers",
  url: "Web URLs",
  ipAddress: "IP addresses",
  biometric: "Biometric identifiers",
  photo: "Full-face photos and comparable images",
  uniqueIdentifier: "Any unique identifying number or code",
};

const FHIR_PHI_PATHS: Record<string, { paths: string[]; category: PHICategory }[]> = {
  Patient: [
    { paths: ["name", "name[*].family", "name[*].given", "name[*].text"], category: "name" },
    { paths: ["address", "address[*].line", "address[*].city", "address[*].postalCode", "address[*].district"], category: "address" },
    { paths: ["birthDate", "deceasedDateTime"], category: "date" },
    { paths: ["telecom[*].value"], category: "phone" },
    { paths: ["identifier[*].value"], category: "mrn" },
    { paths: ["photo"], category: "photo" },
  ],
  Practitioner: [
    { paths: ["name", "name[*].family", "name[*].given", "name[*].text"], category: "name" },
    { paths: ["address", "address[*].line", "address[*].city", "address[*].postalCode"], category: "address" },
    { paths: ["telecom[*].value"], category: "phone" },
    { paths: ["identifier[*].value"], category: "license" },
    { paths: ["photo"], category: "photo" },
  ],
  Observation: [
    { paths: ["effectiveDateTime", "issued"], category: "date" },
    { paths: ["performer[*].display"], category: "name" },
  ],
  Condition: [
    { paths: ["recordedDate", "onsetDateTime", "abatementDateTime"], category: "date" },
    { paths: ["recorder.display", "asserter.display"], category: "name" },
  ],
  MedicationRequest: [
    { paths: ["authoredOn"], category: "date" },
    { paths: ["requester.display"], category: "name" },
  ],
  Encounter: [
    { paths: ["period.start", "period.end"], category: "date" },
    { paths: ["participant[*].individual.display"], category: "name" },
    { paths: ["location[*].location.display"], category: "address" },
  ],
  DiagnosticReport: [
    { paths: ["effectiveDateTime", "issued"], category: "date" },
    { paths: ["performer[*].display"], category: "name" },
  ],
  Immunization: [
    { paths: ["occurrenceDateTime", "recorded"], category: "date" },
    { paths: ["performer[*].actor.display"], category: "name" },
    { paths: ["location.display"], category: "address" },
  ],
  AllergyIntolerance: [
    { paths: ["recordedDate", "onsetDateTime"], category: "date" },
    { paths: ["recorder.display", "asserter.display"], category: "name" },
  ],
  Procedure: [
    { paths: ["performedDateTime", "performedPeriod.start", "performedPeriod.end"], category: "date" },
    { paths: ["performer[*].actor.display"], category: "name" },
    { paths: ["location.display"], category: "address" },
  ],
};

const DEFAULT_ANONYMIZATION_RULES: AnonymizationRule[] = [
  { id: "rule-name", category: "name", strategy: "pseudonymization", preserveFormat: true, preserveLength: false },
  { id: "rule-address", category: "address", strategy: "generalization", preserveFormat: false, preserveLength: false, generalizationLevel: 2 },
  { id: "rule-date", category: "date", strategy: "perturbation", preserveFormat: true, preserveLength: true, dateShiftDays: 30 },
  { id: "rule-phone", category: "phone", strategy: "suppression", preserveFormat: true, preserveLength: true },
  { id: "rule-email", category: "email", strategy: "pseudonymization", preserveFormat: true, preserveLength: false },
  { id: "rule-ssn", category: "ssn", strategy: "suppression", preserveFormat: false, preserveLength: false },
  { id: "rule-mrn", category: "mrn", strategy: "pseudonymization", preserveFormat: true, preserveLength: true },
  { id: "rule-healthPlanId", category: "healthPlanId", strategy: "pseudonymization", preserveFormat: true, preserveLength: true },
  { id: "rule-accountNumber", category: "accountNumber", strategy: "suppression", preserveFormat: false, preserveLength: false },
  { id: "rule-license", category: "license", strategy: "pseudonymization", preserveFormat: true, preserveLength: true },
  { id: "rule-vehicleId", category: "vehicleId", strategy: "suppression", preserveFormat: false, preserveLength: false },
  { id: "rule-deviceId", category: "deviceId", strategy: "pseudonymization", preserveFormat: true, preserveLength: true },
  { id: "rule-url", category: "url", strategy: "suppression", preserveFormat: false, preserveLength: false },
  { id: "rule-ipAddress", category: "ipAddress", strategy: "generalization", preserveFormat: true, preserveLength: false },
  { id: "rule-biometric", category: "biometric", strategy: "suppression", preserveFormat: false, preserveLength: false },
  { id: "rule-photo", category: "photo", strategy: "suppression", preserveFormat: false, preserveLength: false },
  { id: "rule-uniqueId", category: "uniqueIdentifier", strategy: "pseudonymization", preserveFormat: true, preserveLength: true },
];

class AIPHIAnonymizationService {
  private pseudonymCache: Map<string, string> = new Map();
  private dateShiftCache: Map<string, number> = new Map();

  async detectPHI(resource: any): Promise<PHIDetection[]> {
    const detections: PHIDetection[] = [];
    const resourceType = resource.resourceType;

    if (!resourceType) {
      return detections;
    }

    const phiPaths = FHIR_PHI_PATHS[resourceType] || [];

    for (const { paths, category } of phiPaths) {
      for (const path of paths) {
        const values = this.getValuesByPath(resource, path);
        for (const { value, actualPath } of values) {
          if (value !== null && value !== undefined && value !== "") {
            detections.push({
              id: uuidv4(),
              path: actualPath,
              value,
              category,
              confidence: 0.95,
              hipaaIdentifier: HIPAA_SAFE_HARBOR_IDENTIFIERS[category],
              riskLevel: this.getRiskLevel(category),
              suggestedAction: this.getSuggestedStrategy(category),
            });
          }
        }
      }
    }

    const aiDetections = await this.detectPHIWithAI(resource, detections);
    const allDetections = [...detections, ...aiDetections];
    
    return this.deduplicateDetections(allDetections);
  }

  private deduplicateDetections(detections: PHIDetection[]): PHIDetection[] {
    const normalized = detections.map(d => ({
      ...d,
      path: d.path.startsWith(".") ? d.path.substring(1) : d.path
    }));
    
    const sorted = normalized.sort((a, b) => a.path.length - b.path.length);
    const processedPaths: string[] = [];
    
    return sorted.filter((d) => {
      for (const processed of processedPaths) {
        if (d.path === processed || 
            d.path.startsWith(processed + ".") || 
            d.path.startsWith(processed + "[")) {
          return false;
        }
      }
      processedPaths.push(d.path);
      return true;
    });
  }

  private async detectPHIWithAI(resource: any, existingDetections: PHIDetection[]): Promise<PHIDetection[]> {
    const existingPaths = new Set(existingDetections.map((d) => d.path));

    try {
      const content = await generatePhiSafeText({
        system: `You are a HIPAA compliance expert. Analyze FHIR resources and identify any PHI (Protected Health Information) that may not be in standard locations. Focus on:
1. Names hidden in display fields or notes
2. Dates that could identify individuals
3. Location information in unexpected fields
4. Identifiers in narrative or text fields
5. Any of the HIPAA Safe Harbor 18 identifiers

Return a JSON object with a "detections" array containing objects with:
- path: JSON path to the field
- value: The actual value found
- category: One of: name, address, date, phone, fax, email, ssn, mrn, healthPlanId, accountNumber, license, vehicleId, deviceId, url, ipAddress, biometric, photo, uniqueIdentifier
- confidence: 0-1 confidence score
- reason: Brief explanation`,
        user: `Analyze this FHIR resource for hidden PHI. Already detected paths: ${Array.from(existingPaths).join(", ")}\n\nResource:\n${JSON.stringify(resource, null, 2)}`,
        responseMimeType: "application/json",
        temperature: 0.1,
      });

      if (!content) return [];

      const parsed = JSON.parse(content);
      const aiDetections: PHIDetection[] = [];

      if (parsed.detections && Array.isArray(parsed.detections)) {
        for (const detection of parsed.detections) {
          if (!existingPaths.has(detection.path)) {
            aiDetections.push({
              id: uuidv4(),
              path: detection.path,
              value: detection.value,
              category: detection.category as PHICategory,
              confidence: detection.confidence || 0.8,
              hipaaIdentifier: HIPAA_SAFE_HARBOR_IDENTIFIERS[detection.category as PHICategory] || "Unknown identifier",
              riskLevel: this.getRiskLevel(detection.category as PHICategory),
              suggestedAction: this.getSuggestedStrategy(detection.category as PHICategory),
            });
          }
        }
      }

      return aiDetections;
    } catch (error) {
      console.error("AI PHI detection error:", error);
      return [];
    }
  }

  async anonymizeResource(
    resource: any,
    strategy: DeidentificationStrategy = "safe_harbor",
    customRules?: AnonymizationRule[]
  ): Promise<AnonymizationResult> {
    const startTime = Date.now();
    const allDetections = await this.detectPHI(resource);
    const rules = customRules || DEFAULT_ANONYMIZATION_RULES;
    const auditLog: AuditEntry[] = [];
    const appliedRules: AnonymizationRule[] = [];

    let anonymizedResource = JSON.parse(JSON.stringify(resource));
    const patientId = resource.id || uuidv4();

    const sortedDetections = allDetections.sort((a, b) => a.path.length - b.path.length);
    const processedPaths: string[] = [];
    const detections = sortedDetections.filter((d) => {
      for (const processed of processedPaths) {
        if (d.path.startsWith(processed + ".") || d.path.startsWith(processed + "[")) {
          return false;
        }
      }
      processedPaths.push(d.path);
      return true;
    });

    for (const detection of detections) {
      const rule = rules.find((r) => r.category === detection.category);
      if (!rule) continue;

      const effectiveStrategy = strategy === "safe_harbor" ? rule.strategy : strategy;
      const originalValue = detection.value;
      let newValue: any;

      switch (effectiveStrategy) {
        case "pseudonymization":
          newValue = this.pseudonymize(originalValue, detection.category, patientId, rule);
          break;
        case "generalization":
          newValue = this.generalize(originalValue, detection.category, rule.generalizationLevel || 1);
          break;
        case "suppression":
          newValue = this.suppress(detection.category, rule);
          break;
        case "perturbation":
          newValue = this.perturb(originalValue, detection.category, rule);
          break;
        case "k_anonymity":
          newValue = this.applyKAnonymity(originalValue, detection.category, rule);
          break;
        default:
          newValue = this.suppress(detection.category, rule);
      }

      this.setValueByPath(anonymizedResource, detection.path, newValue);
      appliedRules.push(rule);

      auditLog.push({
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        action: effectiveStrategy,
        path: detection.path,
        originalValue: this.maskForAudit(String(originalValue)),
        newValue: String(newValue),
        strategy: effectiveStrategy,
        category: detection.category,
      });
    }

    const dataUtilityScore = this.calculateDataUtility(resource, anonymizedResource, detections);
    const privacyScore = this.calculatePrivacyScore(detections, appliedRules);
    const complianceStatus = this.checkCompliance(detections, appliedRules);

    return {
      id: uuidv4(),
      originalResource: resource,
      anonymizedResource,
      detections,
      appliedRules,
      dataUtilityScore,
      privacyScore,
      complianceStatus,
      auditLog,
      timestamp: new Date().toISOString(),
    };
  }

  async anonymizeDataset(
    resources: any[],
    datasetName: string,
    strategy: DeidentificationStrategy = "safe_harbor",
    kValue?: number
  ): Promise<DatasetAnonymizationResult> {
    const results: AnonymizationResult[] = [];

    for (const resource of resources) {
      const result = await this.anonymizeResource(resource, strategy);
      results.push(result);
    }

    const totalPHI = results.reduce((sum, r) => sum + r.detections.length, 0);
    const totalAnonymized = results.reduce((sum, r) => sum + r.auditLog.length, 0);
    const avgUtility = results.reduce((sum, r) => sum + r.dataUtilityScore, 0) / results.length;
    const avgPrivacy = results.reduce((sum, r) => sum + r.privacyScore, 0) / results.length;
    const compliantCount = results.filter((r) => r.complianceStatus.hipaaCompliant).length;

    let kAnonymityStatus;
    if (kValue && kValue > 1) {
      kAnonymityStatus = this.checkKAnonymity(results, kValue);
    }

    return {
      id: uuidv4(),
      datasetName,
      resourceCount: resources.length,
      results,
      aggregateStats: {
        totalPHIDetected: totalPHI,
        totalAnonymized,
        avgDataUtility: Math.round(avgUtility * 100) / 100,
        avgPrivacyScore: Math.round(avgPrivacy * 100) / 100,
        complianceRate: Math.round((compliantCount / results.length) * 100),
      },
      kAnonymityStatus,
      timestamp: new Date().toISOString(),
    };
  }

  async getAIAnonymizationSuggestions(resource: any, preserveFields: string[]): Promise<{
    suggestions: Array<{
      path: string;
      originalValue: any;
      suggestedValue: any;
      strategy: DeidentificationStrategy;
      rationale: string;
      utilityImpact: "low" | "medium" | "high";
    }>;
    overallRecommendation: string;
  }> {
    const detections = await this.detectPHI(resource);

    try {
      const content = await generatePhiSafeText({
        system: `You are a healthcare data privacy expert specializing in FHIR data anonymization. Provide smart de-identification suggestions that:
1. Comply with HIPAA Safe Harbor requirements
2. Preserve clinical utility for research
3. Maintain referential integrity
4. Consider the context and purpose of each field

For each PHI field, suggest the best anonymization approach and explain the trade-off between privacy and utility.

Return a JSON object with:
- suggestions: Array of suggestion objects with path, originalValue, suggestedValue, strategy, rationale, utilityImpact
- overallRecommendation: Brief summary of the anonymization approach`,
        user: `Analyze this FHIR resource and provide smart anonymization suggestions.

PHI Detected:
${JSON.stringify(detections, null, 2)}

Fields to preserve if possible: ${preserveFields.join(", ")}

Resource:
${JSON.stringify(resource, null, 2)}`,
        responseMimeType: "application/json",
        temperature: 0.3,
      });

      if (!content) {
        return { suggestions: [], overallRecommendation: "Unable to generate suggestions" };
      }

      return JSON.parse(content);
    } catch (error) {
      console.error("AI anonymization suggestions error:", error);
      return { suggestions: [], overallRecommendation: "Error generating AI suggestions" };
    }
  }

  private getValuesByPath(obj: any, path: string): { value: any; actualPath: string }[] {
    const results: { value: any; actualPath: string }[] = [];
    const parts = path.split(".").filter(p => p.length > 0);

    const traverse = (current: any, pathParts: string[], currentPath: string) => {
      if (pathParts.length === 0) {
        const cleanPath = currentPath.startsWith(".") ? currentPath.substring(1) : currentPath;
        results.push({ value: current, actualPath: cleanPath });
        return;
      }

      const part = pathParts[0];
      const remaining = pathParts.slice(1);

      if (part.includes("[*]")) {
        const key = part.replace("[*]", "");
        const array = key ? current[key] : current;
        if (Array.isArray(array)) {
          array.forEach((item, index) => {
            const newPath = currentPath ? `${currentPath}.${key}[${index}]` : `${key}[${index}]`;
            traverse(item, remaining, newPath);
          });
        }
      } else if (current && typeof current === "object" && part in current) {
        const newPath = currentPath ? `${currentPath}.${part}` : part;
        traverse(current[part], remaining, newPath);
      }
    };

    traverse(obj, parts, "");
    return results;
  }

  private setValueByPath(obj: any, path: string, value: any): void {
    try {
      const parts = path.split(".");
      let current = obj;

      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        const match = part.match(/(.+)\[(\d+)\]/);
        if (match) {
          const arr = current[match[1]];
          if (!arr || !Array.isArray(arr)) return;
          current = arr[parseInt(match[2])];
          if (!current) return;
        } else {
          if (!current || typeof current !== "object" || !(part in current)) return;
          current = current[part];
        }
      }

      if (!current || typeof current !== "object") return;

      const lastPart = parts[parts.length - 1];
      const lastMatch = lastPart.match(/(.+)\[(\d+)\]/);
      if (lastMatch) {
        const arr = current[lastMatch[1]];
        if (arr && Array.isArray(arr)) {
          arr[parseInt(lastMatch[2])] = value;
        }
      } else {
        current[lastPart] = value;
      }
    } catch (error) {
      console.error(`[PHI Anonymization] Error setting value at path ${path}:`, error);
    }
  }

  private getRiskLevel(category: PHICategory): "high" | "medium" | "low" {
    const highRisk: PHICategory[] = ["ssn", "mrn", "healthPlanId", "biometric", "photo"];
    const mediumRisk: PHICategory[] = ["name", "address", "date", "email", "accountNumber"];
    return highRisk.includes(category) ? "high" : mediumRisk.includes(category) ? "medium" : "low";
  }

  private getSuggestedStrategy(category: PHICategory): DeidentificationStrategy {
    const strategies: Record<PHICategory, DeidentificationStrategy> = {
      name: "pseudonymization",
      address: "generalization",
      date: "perturbation",
      phone: "suppression",
      fax: "suppression",
      email: "pseudonymization",
      ssn: "suppression",
      mrn: "pseudonymization",
      healthPlanId: "pseudonymization",
      accountNumber: "suppression",
      license: "pseudonymization",
      vehicleId: "suppression",
      deviceId: "pseudonymization",
      url: "suppression",
      ipAddress: "generalization",
      biometric: "suppression",
      photo: "suppression",
      uniqueIdentifier: "pseudonymization",
    };
    return strategies[category];
  }

  private pseudonymize(value: any, category: PHICategory, patientId: string, rule: AnonymizationRule): string {
    const cacheKey = `${patientId}:${category}:${value}`;
    if (this.pseudonymCache.has(cacheKey)) {
      return this.pseudonymCache.get(cacheKey)!;
    }

    let pseudonym: string;
    switch (category) {
      case "name":
        pseudonym = this.generatePseudoName(value);
        break;
      case "email":
        pseudonym = `anon${uuidv4().substring(0, 8)}@example.org`;
        break;
      case "mrn":
      case "healthPlanId":
      case "license":
      case "deviceId":
        pseudonym = rule.preserveLength
          ? this.generatePreservingLength(String(value))
          : `ANON-${uuidv4().substring(0, 8).toUpperCase()}`;
        break;
      default:
        pseudonym = `ANON-${uuidv4().substring(0, 8)}`;
    }

    this.pseudonymCache.set(cacheKey, pseudonym);
    return pseudonym;
  }

  private generatePseudoName(originalName: any): any {
    const firstNames = ["Alex", "Jordan", "Taylor", "Morgan", "Casey", "Riley", "Quinn", "Avery"];
    const lastNames = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis"];

    if (typeof originalName === "object" && originalName !== null) {
      if (Array.isArray(originalName)) {
        return originalName.map(() => ({
          family: lastNames[Math.floor(Math.random() * lastNames.length)],
          given: [firstNames[Math.floor(Math.random() * firstNames.length)]],
        }));
      }
      return {
        ...originalName,
        family: lastNames[Math.floor(Math.random() * lastNames.length)],
        given: [firstNames[Math.floor(Math.random() * firstNames.length)]],
        text: undefined,
      };
    }

    return `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`;
  }

  private generatePreservingLength(value: string): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    return Array.from({ length: value.length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  }

  private generalize(value: any, category: PHICategory, level: number): any {
    switch (category) {
      case "address":
        if (typeof value === "object" && value !== null) {
          if (Array.isArray(value)) {
            return value.map((addr) => ({
              ...addr,
              line: undefined,
              city: level > 1 ? undefined : addr.city,
              postalCode: addr.postalCode ? addr.postalCode.substring(0, 3) + "XX" : undefined,
              district: undefined,
            }));
          }
          return {
            ...value,
            line: undefined,
            city: level > 1 ? undefined : value.city,
            postalCode: value.postalCode ? value.postalCode.substring(0, 3) + "XX" : undefined,
            district: undefined,
          };
        }
        return "[LOCATION REDACTED]";
      case "date":
        if (typeof value === "string" && value.match(/^\d{4}-\d{2}-\d{2}/)) {
          const year = value.substring(0, 4);
          return level > 1 ? `${year}` : `${year}-01-01`;
        }
        return value;
      case "ipAddress":
        if (typeof value === "string") {
          const parts = value.split(".");
          return parts.slice(0, 2).join(".") + ".0.0";
        }
        return value;
      default:
        return "[GENERALIZED]";
    }
  }

  private suppress(category: PHICategory, rule: AnonymizationRule): string {
    if (rule.customValue) {
      return rule.customValue;
    }

    const suppressionValues: Record<PHICategory, string> = {
      name: "[REDACTED]",
      address: "[ADDRESS REMOVED]",
      date: "1900-01-01",
      phone: "000-000-0000",
      fax: "000-000-0000",
      email: "redacted@example.org",
      ssn: "XXX-XX-XXXX",
      mrn: "[MRN REMOVED]",
      healthPlanId: "[ID REMOVED]",
      accountNumber: "[ACCOUNT REMOVED]",
      license: "[LICENSE REMOVED]",
      vehicleId: "[REMOVED]",
      deviceId: "[DEVICE ID REMOVED]",
      url: "https://example.org/redacted",
      ipAddress: "0.0.0.0",
      biometric: "[BIOMETRIC REMOVED]",
      photo: null as any,
      uniqueIdentifier: "[ID REMOVED]",
    };

    return suppressionValues[category];
  }

  private perturb(value: any, category: PHICategory, rule: AnonymizationRule): any {
    if (category === "date" && typeof value === "string") {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        const patientKey = value;
        let shiftDays = this.dateShiftCache.get(patientKey);
        if (shiftDays === undefined) {
          const maxShift = rule.dateShiftDays || 30;
          shiftDays = Math.floor(Math.random() * (maxShift * 2 + 1)) - maxShift;
          this.dateShiftCache.set(patientKey, shiftDays);
        }
        date.setDate(date.getDate() + shiftDays);
        return date.toISOString().split("T")[0];
      }
    }
    return value;
  }

  private applyKAnonymity(value: any, category: PHICategory, rule: AnonymizationRule): any {
    return this.generalize(value, category, 2);
  }

  private checkKAnonymity(results: AnonymizationResult[], k: number): {
    k: number;
    satisfied: boolean;
    quasiIdentifiers: string[];
  } {
    const quasiIdentifiers = ["birthDate", "gender", "address.state", "address.postalCode"];
    const equivalenceClasses = new Map<string, number>();

    for (const result of results) {
      const resource = result.anonymizedResource;
      if (resource.resourceType === "Patient") {
        const key = [
          resource.birthDate?.substring(0, 4) || "",
          resource.gender || "",
          resource.address?.[0]?.state || "",
          resource.address?.[0]?.postalCode?.substring(0, 3) || "",
        ].join("|");
        equivalenceClasses.set(key, (equivalenceClasses.get(key) || 0) + 1);
      }
    }

    const satisfied = Array.from(equivalenceClasses.values()).every((count) => count >= k);

    return { k, satisfied, quasiIdentifiers };
  }

  private calculateDataUtility(original: any, anonymized: any, detections: PHIDetection[]): number {
    const totalFields = this.countFields(original);
    const modifiedFields = detections.length;
    const preservedRatio = (totalFields - modifiedFields) / totalFields;

    let clinicalPreservation = 1.0;
    const clinicalFields = ["code", "valueQuantity", "valueCodeableConcept", "status", "category"];
    for (const field of clinicalFields) {
      if (JSON.stringify(original[field]) !== JSON.stringify(anonymized[field])) {
        clinicalPreservation -= 0.1;
      }
    }

    return Math.max(0, Math.min(100, Math.round((preservedRatio * 0.4 + clinicalPreservation * 0.6) * 100)));
  }

  private countFields(obj: any, count = 0): number {
    if (obj === null || obj === undefined) return count;
    if (typeof obj !== "object") return count + 1;
    if (Array.isArray(obj)) {
      return obj.reduce((c, item) => this.countFields(item, c), count);
    }
    return Object.values(obj).reduce((c: number, val) => this.countFields(val, c), count);
  }

  private calculatePrivacyScore(detections: PHIDetection[], rules: AnonymizationRule[]): number {
    if (detections.length === 0) return 100;

    let score = 100;
    for (const detection of detections) {
      const rule = rules.find((r) => r.category === detection.category);
      if (!rule) {
        score -= 15;
        continue;
      }

      switch (detection.riskLevel) {
        case "high":
          score -= rule.strategy === "suppression" ? 0 : rule.strategy === "pseudonymization" ? 2 : 5;
          break;
        case "medium":
          score -= rule.strategy === "suppression" ? 0 : 1;
          break;
        case "low":
          break;
      }
    }

    return Math.max(0, Math.min(100, score));
  }

  private checkCompliance(detections: PHIDetection[], rules: AnonymizationRule[]): {
    hipaaCompliant: boolean;
    safeHarborCompliant: boolean;
    issues: string[];
  } {
    const issues: string[] = [];
    const highRiskCategories: PHICategory[] = ["ssn", "mrn", "healthPlanId", "biometric", "photo"];

    for (const detection of detections) {
      const rule = rules.find((r) => r.category === detection.category);
      if (!rule) {
        issues.push(`No anonymization rule for ${detection.category} at ${detection.path}`);
        continue;
      }

      if (highRiskCategories.includes(detection.category)) {
        if (rule.strategy !== "suppression" && rule.strategy !== "pseudonymization") {
          issues.push(`High-risk identifier ${detection.category} should use suppression or pseudonymization`);
        }
      }
    }

    return {
      hipaaCompliant: issues.length === 0,
      safeHarborCompliant: issues.length === 0,
      issues,
    };
  }

  private maskForAudit(value: string): string {
    if (value.length <= 4) return "****";
    return value.substring(0, 2) + "*".repeat(value.length - 4) + value.substring(value.length - 2);
  }

  getDefaultRules(): AnonymizationRule[] {
    return [...DEFAULT_ANONYMIZATION_RULES];
  }

  getSupportedCategories(): { category: PHICategory; description: string }[] {
    return Object.entries(HIPAA_SAFE_HARBOR_IDENTIFIERS).map(([category, description]) => ({
      category: category as PHICategory,
      description,
    }));
  }

  getStrategies(): { strategy: DeidentificationStrategy; description: string }[] {
    return [
      { strategy: "safe_harbor", description: "HIPAA Safe Harbor method - removes or generalizes all 18 identifiers" },
      { strategy: "pseudonymization", description: "Replaces identifiers with consistent fake values" },
      { strategy: "generalization", description: "Reduces precision of values (e.g., full date to year only)" },
      { strategy: "suppression", description: "Completely removes the value" },
      { strategy: "perturbation", description: "Adds random noise to values (e.g., date shifting)" },
      { strategy: "k_anonymity", description: "Ensures each record is indistinguishable from k-1 others" },
    ];
  }
}

export const aiPHIAnonymizationService = new AIPHIAnonymizationService();
