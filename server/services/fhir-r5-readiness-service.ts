export interface FHIRR5Feature {
  id: string;
  name: string;
  category: string;
  r4Status: "supported" | "partial" | "not-available";
  r5Status: "ready" | "partial" | "pending" | "not-planned";
  migrationComplexity: "low" | "medium" | "high" | "critical";
  description: string;
  breakingChanges: string[];
}

export interface FHIRR5ReadinessReport {
  overallScore: number;
  totalFeatures: number;
  readyCount: number;
  partialCount: number;
  pendingCount: number;
  features: FHIRR5Feature[];
  recommendations: string[];
  generatedAt: string;
}

export interface FHIRR5MigrationPlan {
  phases: MigrationPhase[];
  estimatedTimeline: string;
  risks: MigrationRisk[];
  prerequisites: string[];
}

interface MigrationPhase {
  id: string;
  name: string;
  description: string;
  duration: string;
  tasks: string[];
  dependencies: string[];
  status: "not-started" | "in-progress" | "completed";
}

interface MigrationRisk {
  id: string;
  title: string;
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  mitigation: string;
}

interface ResourceCompatibility {
  resourceType: string;
  r4Supported: boolean;
  r5Compatible: boolean;
  changesRequired: string[];
  newFields: string[];
  removedFields: string[];
  renamedFields: { old: string; new: string }[];
  migrationNotes: string;
}

interface VersionNegotiationConfig {
  currentVersion: string;
  supportedVersions: string[];
  acceptHeaderFormat: string;
  defaultVersion: string;
  negotiationStrategy: string;
  mimeTypes: { version: string; mimeType: string }[];
  fallbackBehavior: string;
}

const r5Features: FHIRR5Feature[] = [
  {
    id: "subscription-framework",
    name: "Topic-Based Subscription Framework",
    category: "Subscriptions",
    r4Status: "supported",
    r5Status: "partial",
    migrationComplexity: "critical",
    description: "R5 replaces the R4 Subscription resource with a topic-based subscription model using SubscriptionTopic and Subscription resources. This is a fundamental architectural change.",
    breakingChanges: [
      "R4 Subscription resource replaced by R5 Subscription + SubscriptionTopic",
      "Channel types restructured (rest-hook, websocket, email, message)",
      "Filter criteria now defined in SubscriptionTopic, not inline",
      "Payload content options changed to empty, id-only, full-resource",
      "Heartbeat and timeout parameters added",
    ],
  },
  {
    id: "search-parameter-enhancements",
    name: "Search Parameter Enhancements",
    category: "Search",
    r4Status: "supported",
    r5Status: "ready",
    migrationComplexity: "medium",
    description: "R5 introduces enhanced search capabilities including _filter parameter improvements, composite search parameters, and reverse chaining enhancements.",
    breakingChanges: [
      "New _filter syntax extensions",
      "Modified _include and _revinclude behavior for versioned references",
      "New _sort parameter capabilities for nested fields",
      "Search result Bundle.entry.search.mode semantics clarified",
    ],
  },
  {
    id: "operations-framework",
    name: "Operations Framework Updates",
    category: "Operations",
    r4Status: "supported",
    r5Status: "partial",
    migrationComplexity: "medium",
    description: "R5 refines the operations framework with updated $validate, $convert, and new operations like $graph and $merge.",
    breakingChanges: [
      "OperationDefinition resource updated with new fields",
      "$validate operation response format changes",
      "$convert operation supports additional format targets",
      "New $graph operation for GraphDefinition-based retrieval",
    ],
  },
  {
    id: "new-resource-types",
    name: "New R5 Resource Types",
    category: "Resources",
    r4Status: "not-available",
    r5Status: "pending",
    migrationComplexity: "high",
    description: "R5 introduces several new resource types including SubscriptionTopic, Evidence, EvidenceReport, EvidenceVariable, Citation, NutritionIntake, and InventoryReport.",
    breakingChanges: [
      "SubscriptionTopic is a new required resource for subscriptions",
      "Evidence resources replace parts of the EBM framework",
      "EvidenceReport replaces some uses of Composition for evidence",
      "NutritionIntake replaces NutritionOrder for intake tracking",
      "InventoryReport is new for supply chain management",
    ],
  },
  {
    id: "bundle-transaction-improvements",
    name: "Bundle Transaction Improvements",
    category: "Infrastructure",
    r4Status: "supported",
    r5Status: "ready",
    migrationComplexity: "low",
    description: "R5 enhances Bundle processing with improved transaction semantics, conditional reference resolution, and better error reporting in batch responses.",
    breakingChanges: [
      "Bundle.entry.request.ifNoneExist behavior refined",
      "Transaction atomicity requirements clarified",
      "Batch response error reporting enhanced",
      "Conditional reference resolution ordering specified",
    ],
  },
  {
    id: "version-negotiation",
    name: "REST API Version Negotiation",
    category: "Infrastructure",
    r4Status: "not-available",
    r5Status: "ready",
    migrationComplexity: "low",
    description: "R5 formalizes version negotiation via the Accept header using FHIR MIME type parameters, allowing clients to request specific FHIR versions.",
    breakingChanges: [
      "Accept header must support fhirVersion parameter",
      "Content-Type must include fhirVersion in responses",
      "Servers must support version negotiation or return 406",
      "New MIME type format: application/fhir+json; fhirVersion=5.0",
    ],
  },
  {
    id: "graph-definition",
    name: "GraphDefinition Improvements",
    category: "Infrastructure",
    r4Status: "supported",
    r5Status: "partial",
    migrationComplexity: "medium",
    description: "R5 significantly enhances GraphDefinition with node-based modeling replacing link-based, supporting more complex graph traversals and the $graph operation.",
    breakingChanges: [
      "GraphDefinition structure changed from link-based to node-based",
      "New node element replaces link hierarchy",
      "Compartment rules updated for graph traversal",
      "$graph operation introduced for server-side graph resolution",
    ],
  },
  {
    id: "terminology-updates",
    name: "Terminology Service Updates",
    category: "Terminology",
    r4Status: "supported",
    r5Status: "partial",
    migrationComplexity: "medium",
    description: "R5 introduces CodeSystem supplements, improved ValueSet expansion parameters, and enhanced ConceptMap capabilities for terminology management.",
    breakingChanges: [
      "CodeSystem supplements replace some extension-based approaches",
      "ValueSet $expand parameter additions",
      "ConceptMap structure updated with sourceScope/targetScope",
      "ConceptMap.group.element.target.relationship replaces equivalence",
      "New $translate operation parameters",
    ],
  },
];

const resourceCompatibilityMap: Record<string, ResourceCompatibility> = {
  Patient: {
    resourceType: "Patient",
    r4Supported: true,
    r5Compatible: true,
    changesRequired: ["Update link.type value set binding", "Review deceased[x] usage"],
    newFields: ["Patient.communication.preferred updates"],
    removedFields: [],
    renamedFields: [],
    migrationNotes: "Patient resource is largely stable between R4 and R5 with minor value set updates.",
  },
  Observation: {
    resourceType: "Observation",
    r4Supported: true,
    r5Compatible: true,
    changesRequired: ["Update Observation.status value set", "Review component structure"],
    newFields: ["Observation.triggeredBy", "Observation.instantiates[x]"],
    removedFields: [],
    renamedFields: [],
    migrationNotes: "Observation gains triggeredBy and instantiates references in R5. Core structure remains compatible.",
  },
  Condition: {
    resourceType: "Condition",
    r4Supported: true,
    r5Compatible: true,
    changesRequired: ["Update clinicalStatus and verificationStatus bindings"],
    newFields: ["Condition.participant"],
    removedFields: ["Condition.recorder (moved to participant)"],
    renamedFields: [{ old: "recorder", new: "participant (role=author)" }],
    migrationNotes: "Condition.recorder is replaced by the participant element with role-based attribution.",
  },
  Encounter: {
    resourceType: "Encounter",
    r4Supported: true,
    r5Compatible: true,
    changesRequired: ["Update Encounter.status value set", "Restructure hospitalization to admission"],
    newFields: ["Encounter.plannedStartDate", "Encounter.plannedEndDate", "Encounter.virtualService"],
    removedFields: ["Encounter.hospitalization (replaced by admission)"],
    renamedFields: [{ old: "hospitalization", new: "admission" }],
    migrationNotes: "Encounter undergoes significant restructuring with hospitalization renamed to admission and new telehealth support fields.",
  },
  MedicationRequest: {
    resourceType: "MedicationRequest",
    r4Supported: true,
    r5Compatible: true,
    changesRequired: ["Update status value set", "Review intent codes"],
    newFields: ["MedicationRequest.renderedDosageInstruction", "MedicationRequest.effectiveDosePeriod"],
    removedFields: [],
    renamedFields: [],
    migrationNotes: "MedicationRequest gains rendered dosage support but is otherwise backward compatible.",
  },
  Subscription: {
    resourceType: "Subscription",
    r4Supported: true,
    r5Compatible: false,
    changesRequired: [
      "Complete rewrite required",
      "Create SubscriptionTopic resources",
      "Update channel configuration",
      "Migrate filter criteria to SubscriptionTopic",
    ],
    newFields: ["topic", "filterBy", "channelType", "heartbeatPeriod", "timeout", "contentType", "content"],
    removedFields: ["criteria", "channel.type", "channel.endpoint", "channel.payload", "channel.header"],
    renamedFields: [],
    migrationNotes: "Subscription is completely restructured in R5. This is one of the most significant breaking changes. Migration requires creating SubscriptionTopic resources and rewriting all subscription logic.",
  },
  Bundle: {
    resourceType: "Bundle",
    r4Supported: true,
    r5Compatible: true,
    changesRequired: ["Review transaction processing logic"],
    newFields: ["Bundle.issues"],
    removedFields: [],
    renamedFields: [],
    migrationNotes: "Bundle gains an issues element for better error reporting. Transaction semantics are refined but largely backward compatible.",
  },
  SubscriptionTopic: {
    resourceType: "SubscriptionTopic",
    r4Supported: false,
    r5Compatible: true,
    changesRequired: ["New resource implementation required"],
    newFields: ["All fields are new"],
    removedFields: [],
    renamedFields: [],
    migrationNotes: "SubscriptionTopic is a new R5 resource that defines subscribable events. Required for the R5 subscription framework.",
  },
  Evidence: {
    resourceType: "Evidence",
    r4Supported: false,
    r5Compatible: true,
    changesRequired: ["New resource implementation required"],
    newFields: ["All fields are new"],
    removedFields: [],
    renamedFields: [],
    migrationNotes: "Evidence is a new R5 resource for representing clinical evidence and statistics.",
  },
  EvidenceReport: {
    resourceType: "EvidenceReport",
    r4Supported: false,
    r5Compatible: true,
    changesRequired: ["New resource implementation required"],
    newFields: ["All fields are new"],
    removedFields: [],
    renamedFields: [],
    migrationNotes: "EvidenceReport is a new R5 resource for structured evidence reporting and synthesis.",
  },
};

export function getFHIRR5Features(): FHIRR5Feature[] {
  return r5Features;
}

export function getFHIRR5ReadinessReport(): FHIRR5ReadinessReport {
  const features = getFHIRR5Features();
  const readyCount = features.filter((f) => f.r5Status === "ready").length;
  const partialCount = features.filter((f) => f.r5Status === "partial").length;
  const pendingCount = features.filter((f) => f.r5Status === "pending" || f.r5Status === "not-planned").length;
  const totalFeatures = features.length;

  const readyWeight = 1.0;
  const partialWeight = 0.5;
  const overallScore = Math.round(((readyCount * readyWeight + partialCount * partialWeight) / totalFeatures) * 100);

  const recommendations: string[] = [
    "Begin SubscriptionTopic resource modeling for existing subscription use cases",
    "Implement Accept header version negotiation to support dual R4/R5 operation",
    "Audit all Encounter resources for hospitalization-to-admission migration",
    "Create a terminology migration plan for ConceptMap equivalence-to-relationship change",
    "Establish a parallel testing environment for R5 validation",
    "Review all GraphDefinition resources for node-based restructuring",
    "Inventory all custom operations for OperationDefinition updates",
    "Plan phased rollout starting with infrastructure changes (Bundle, version negotiation)",
  ];

  return {
    overallScore,
    totalFeatures,
    readyCount,
    partialCount,
    pendingCount,
    features,
    recommendations,
    generatedAt: new Date().toISOString(),
  };
}

export function getFHIRR5MigrationPlan(): FHIRR5MigrationPlan {
  const phases: MigrationPhase[] = [
    {
      id: "phase-1",
      name: "Assessment & Foundation",
      description: "Evaluate current R4 usage, identify all affected resources, and establish R5 testing infrastructure.",
      duration: "4-6 weeks",
      tasks: [
        "Inventory all FHIR R4 resources in use",
        "Map current Subscription usage patterns",
        "Set up R5 validation environment",
        "Identify custom extensions requiring migration",
        "Document all API consumers and their version requirements",
      ],
      dependencies: [],
      status: "in-progress",
    },
    {
      id: "phase-2",
      name: "Infrastructure Migration",
      description: "Implement version negotiation, update Bundle processing, and prepare dual-version support.",
      duration: "6-8 weeks",
      tasks: [
        "Implement Accept header version negotiation",
        "Update Bundle transaction processing for R5 semantics",
        "Add fhirVersion parameter to Content-Type responses",
        "Create version-aware routing layer",
        "Deploy R5-compatible FHIR server instance",
      ],
      dependencies: ["phase-1"],
      status: "not-started",
    },
    {
      id: "phase-3",
      name: "Resource Migration",
      description: "Migrate core resources (Patient, Observation, Condition, Encounter) to R5 format with backward compatibility.",
      duration: "8-12 weeks",
      tasks: [
        "Migrate Encounter.hospitalization to Encounter.admission",
        "Update Condition.recorder to Condition.participant",
        "Add new Observation fields (triggeredBy, instantiates)",
        "Update value set bindings across all resources",
        "Implement resource version transformation layer",
      ],
      dependencies: ["phase-2"],
      status: "not-started",
    },
    {
      id: "phase-4",
      name: "Subscription Framework Overhaul",
      description: "Replace R4 Subscription with R5 topic-based subscription model. This is the most complex migration phase.",
      duration: "10-14 weeks",
      tasks: [
        "Design SubscriptionTopic resources for all existing subscription patterns",
        "Implement SubscriptionTopic CRUD operations",
        "Migrate Subscription resources to R5 format",
        "Update notification delivery channels",
        "Implement heartbeat and timeout mechanisms",
        "Create subscription migration tooling for existing subscribers",
      ],
      dependencies: ["phase-2"],
      status: "not-started",
    },
    {
      id: "phase-5",
      name: "Terminology & Operations",
      description: "Update terminology services and operations framework to R5 specifications.",
      duration: "6-8 weeks",
      tasks: [
        "Migrate ConceptMap equivalence to relationship model",
        "Implement CodeSystem supplements",
        "Update $validate operation responses",
        "Implement $graph operation",
        "Update GraphDefinition to node-based model",
        "Enhance ValueSet $expand parameters",
      ],
      dependencies: ["phase-3"],
      status: "not-started",
    },
    {
      id: "phase-6",
      name: "Testing & Cutover",
      description: "Comprehensive testing, performance validation, and production cutover with rollback plan.",
      duration: "4-6 weeks",
      tasks: [
        "Execute full regression test suite against R5",
        "Performance benchmark R5 vs R4",
        "Validate all API consumers with R5 responses",
        "Execute phased production cutover",
        "Monitor and validate post-migration",
        "Deprecate R4-only endpoints after stabilization",
      ],
      dependencies: ["phase-4", "phase-5"],
      status: "not-started",
    },
  ];

  const risks: MigrationRisk[] = [
    {
      id: "risk-1",
      title: "Subscription Framework Breaking Changes",
      severity: "critical",
      description: "The complete restructuring of the Subscription resource may break all existing subscription integrations simultaneously.",
      mitigation: "Implement dual-mode subscription support during transition. Maintain R4 subscription endpoints while R5 endpoints are validated.",
    },
    {
      id: "risk-2",
      title: "Third-Party Client Compatibility",
      severity: "high",
      description: "External API consumers may not support R5 format, causing integration failures.",
      mitigation: "Implement version negotiation and maintain R4 compatibility layer. Communicate timeline to all API consumers 6+ months in advance.",
    },
    {
      id: "risk-3",
      title: "Data Migration Integrity",
      severity: "high",
      description: "Resource structure changes (e.g., Encounter.hospitalization to admission) may cause data loss if not properly mapped.",
      mitigation: "Create comprehensive data migration scripts with validation. Run parallel systems during transition with automated comparison.",
    },
    {
      id: "risk-4",
      title: "Terminology Binding Changes",
      severity: "medium",
      description: "Updated value set bindings may invalidate existing coded data.",
      mitigation: "Audit all existing coded data against R5 value sets before migration. Create automated code mapping where value sets differ.",
    },
    {
      id: "risk-5",
      title: "Performance Regression",
      severity: "medium",
      description: "New R5 features and validation requirements may impact system performance.",
      mitigation: "Establish performance baselines before migration. Conduct load testing at each phase. Optimize query patterns for R5 search enhancements.",
    },
  ];

  const prerequisites: string[] = [
    "FHIR R5 specification review completed by development team",
    "R5-compatible FHIR server software available and tested",
    "All API consumer inventory documented with version requirements",
    "Automated test suite covering all FHIR interactions",
    "Rollback procedures documented and tested",
    "Stakeholder sign-off on migration timeline",
    "Budget allocation for dual-version support period",
    "Staff training on R5 changes completed",
  ];

  return {
    phases,
    estimatedTimeline: "38-54 weeks (9-13 months)",
    risks,
    prerequisites,
  };
}

export function getFHIRR5BreakingChanges(): { category: string; changes: { title: string; description: string; severity: string; affectedResources: string[] }[] }[] {
  return [
    {
      category: "Subscriptions",
      changes: [
        {
          title: "Subscription Resource Restructured",
          description: "R4 Subscription is replaced by a combination of SubscriptionTopic (defining events) and Subscription (client registration). The criteria field, channel configuration, and filtering are completely redesigned.",
          severity: "critical",
          affectedResources: ["Subscription", "SubscriptionTopic", "SubscriptionStatus"],
        },
      ],
    },
    {
      category: "Clinical Resources",
      changes: [
        {
          title: "Encounter.hospitalization Renamed",
          description: "Encounter.hospitalization is renamed to Encounter.admission with structural changes to child elements.",
          severity: "high",
          affectedResources: ["Encounter"],
        },
        {
          title: "Condition.recorder Replaced",
          description: "Condition.recorder is replaced by Condition.participant with role-based attribution supporting multiple participants.",
          severity: "medium",
          affectedResources: ["Condition"],
        },
      ],
    },
    {
      category: "Terminology",
      changes: [
        {
          title: "ConceptMap Equivalence Replaced",
          description: "ConceptMap.group.element.target.equivalence is replaced by ConceptMap.group.element.target.relationship with updated value set.",
          severity: "high",
          affectedResources: ["ConceptMap"],
        },
        {
          title: "ConceptMap Source/Target Scope",
          description: "ConceptMap.source[x] and .target[x] replaced by .sourceScope[x] and .targetScope[x].",
          severity: "medium",
          affectedResources: ["ConceptMap"],
        },
      ],
    },
    {
      category: "Infrastructure",
      changes: [
        {
          title: "GraphDefinition Node-Based Model",
          description: "GraphDefinition changes from a link-based to a node-based model, requiring restructuring of all graph definitions.",
          severity: "medium",
          affectedResources: ["GraphDefinition"],
        },
        {
          title: "MIME Type Version Parameter",
          description: "FHIR MIME types now include a fhirVersion parameter. Servers must support version negotiation via Accept header.",
          severity: "low",
          affectedResources: ["CapabilityStatement"],
        },
      ],
    },
    {
      category: "New Resources",
      changes: [
        {
          title: "SubscriptionTopic (New)",
          description: "New resource defining subscribable events, required for R5 subscription framework.",
          severity: "high",
          affectedResources: ["SubscriptionTopic"],
        },
        {
          title: "Evidence Resources (New)",
          description: "New Evidence, EvidenceReport, and EvidenceVariable resources for clinical evidence representation.",
          severity: "low",
          affectedResources: ["Evidence", "EvidenceReport", "EvidenceVariable"],
        },
      ],
    },
  ];
}

export function checkResourceCompatibility(resourceType: string): ResourceCompatibility | null {
  return resourceCompatibilityMap[resourceType] || null;
}

export function getVersionNegotiationConfig(): VersionNegotiationConfig {
  return {
    currentVersion: "4.0.1",
    supportedVersions: ["4.0.1"],
    acceptHeaderFormat: "application/fhir+json; fhirVersion=<version>",
    defaultVersion: "4.0.1",
    negotiationStrategy: "server-driven",
    mimeTypes: [
      { version: "4.0.1", mimeType: "application/fhir+json; fhirVersion=4.0" },
      { version: "5.0.0", mimeType: "application/fhir+json; fhirVersion=5.0" },
    ],
    fallbackBehavior: "If no fhirVersion parameter is specified in the Accept header, the server responds with the default version (R4 4.0.1). If a requested version is not supported, the server returns HTTP 406 Not Acceptable with an OperationOutcome detailing supported versions.",
  };
}
