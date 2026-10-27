import { type GCPCredentials } from "./gcp-healthcare-client";

const GCP_PROJECT_ID = process.env.GCP_PROJECT_ID || "united-planet-485003-n7";
const GCP_LOCATION = "global";
const SEARCH_ENGINE_ID = process.env.VERTEX_SEARCH_ENGINE_ID || "tabula-medica-standard";
const SEARCH_DATASTORE_ID = process.env.VERTEX_SEARCH_DATASTORE_ID || SEARCH_ENGINE_ID;

const VERTEX_SEARCH_SCOPE = "https://www.googleapis.com/auth/cloud-platform";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

let cachedToken: { token: string; expiry: number } | null = null;

async function getVertexAccessToken(credentials: GCPCredentials): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiry - 60000) {
    return cachedToken.token;
  }

  const now = Math.floor(Date.now() / 1000);
  const expiry = now + 3600;

  const header = { alg: "RS256", typ: "JWT", kid: credentials.private_key_id };
  const payload = {
    iss: credentials.client_email,
    sub: credentials.client_email,
    aud: TOKEN_ENDPOINT,
    iat: now,
    exp: expiry,
    scope: VERTEX_SEARCH_SCOPE,
  };

  const b64url = (str: string) =>
    Buffer.from(str).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");

  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const crypto = await import("crypto");
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(unsigned);
  const signature = sign.sign(credentials.private_key, "base64url");
  const jwt = `${unsigned}.${signature}`;

  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!response.ok) {
    throw new Error(`Token exchange failed: ${response.status}`);
  }

  const data = await response.json();
  cachedToken = { token: data.access_token, expiry: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

interface SearchResult {
  id: string;
  title: string;
  snippet: string;
  link?: string;
  metadata: Record<string, string>;
  relevanceScore?: number;
}

interface SearchResponse {
  results: SearchResult[];
  totalSize: number;
  query: string;
  correctedQuery?: string;
  searchTime: number;
  summary?: string;
}

function getGCPCredentials(): GCPCredentials | null {
  const credsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || process.env.GCP_SERVICE_ACCOUNT_KEY;
  if (credsJson) {
    try {
      return JSON.parse(credsJson);
    } catch {
      return null;
    }
  }
  return null;
}

export async function searchVertexAI(
  query: string,
  options: {
    pageSize?: number;
    offset?: number;
    filter?: string;
    boostSpec?: object;
    contentSearchSpec?: object;
  } = {}
): Promise<SearchResponse> {
  const startTime = Date.now();
  const pageSize = Math.min(Math.max(Number(options.pageSize) || 10, 1), 20);
  const offset = Math.max(Number(options.offset) || 0, 0);

  const credentials = getGCPCredentials();

  if (!credentials) {
    console.log("[VertexSearch] No GCP credentials configured, using demo results");
    return getDemoResults(query, startTime);
  }

  try {
    const accessToken = await getVertexAccessToken(credentials);

    const servingConfigPath = `projects/${GCP_PROJECT_ID}/locations/${GCP_LOCATION}/collections/default_collection/engines/${SEARCH_ENGINE_ID}/servingConfigs/default_serving_config`;

    const url = `https://discoveryengine.googleapis.com/v1/${servingConfigPath}:search`;

    const requestBody: any = {
      query,
      pageSize,
      offset,
      contentSearchSpec: options.contentSearchSpec || {
        snippetSpec: { returnSnippet: true, maxSnippetCount: 3 },
        summarySpec: {
          summaryResultCount: 5,
          includeCitations: true,
          ignoreAdversarialQuery: true,
          ignoreNonSummarySeekingQuery: false,
        },
        extractiveContentSpec: {
          maxExtractiveAnswerCount: 3,
          maxExtractiveSegmentCount: 3,
        },
      },
      queryExpansionSpec: { condition: "AUTO" },
      spellCorrectionSpec: { mode: "AUTO" },
    };

    if (options.filter) {
      requestBody.filter = options.filter;
    }
    if (options.boostSpec) {
      requestBody.boostSpec = options.boostSpec;
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[VertexSearch] API error ${response.status}: ${errorText}`);
      throw new Error(`Vertex AI Search API error: ${response.status}`);
    }

    const data = await response.json();

    const results: SearchResult[] = (data.results || []).map((result: any, index: number) => {
      const doc = result.document || {};
      const structData = doc.structData || {};
      const derivedStructData = doc.derivedStructData || {};

      const snippets = derivedStructData.snippets || [];
      const extractiveAnswers = derivedStructData.extractive_answers || [];
      const extractiveSegments = derivedStructData.extractive_segments || [];

      let snippet = "";
      if (snippets.length > 0) {
        snippet = snippets.map((s: any) => s.snippet || "").join(" ");
      } else if (extractiveAnswers.length > 0) {
        snippet = extractiveAnswers.map((a: any) => a.content || "").join(" ");
      } else if (extractiveSegments.length > 0) {
        snippet = extractiveSegments.map((s: any) => s.content || "").join(" ");
      }

      return {
        id: doc.id || `result-${index}`,
        title: structData.title || derivedStructData.title || doc.name || `Result ${index + 1}`,
        snippet: snippet.replace(/<\/?[^>]+(>|$)/g, ""),
        link: derivedStructData.link || structData.url || structData.link || undefined,
        metadata: {
          ...structData,
          source: structData.source || "Vertex AI Search",
          category: structData.category || structData.type || "general",
        },
        relevanceScore: result.relevanceScore || undefined,
      };
    });

    return {
      results,
      totalSize: data.totalSize || results.length,
      query,
      correctedQuery: data.correctedQuery || undefined,
      searchTime: Date.now() - startTime,
      summary: data.summary?.summaryText || undefined,
    };
  } catch (error: any) {
    console.error("[VertexSearch] Search failed:", error.message);
    if (credentials) {
      throw new Error(`Vertex AI Search unavailable: ${error.message}`);
    }
    return getDemoResults(query, startTime);
  }
}

function getDemoResults(query: string, startTime: number): SearchResponse {
  const lowerQuery = query.toLowerCase();

  const demoData: SearchResult[] = [
    {
      id: "demo-fhir-r4",
      title: "FHIR R4 Patient Resources",
      snippet: "Fast Healthcare Interoperability Resources (FHIR) R4 specification for Patient resource type. Includes demographics, contacts, communication preferences, and care provider references.",
      metadata: { category: "Standards", source: "HL7 FHIR" },
    },
    {
      id: "demo-hipaa",
      title: "HIPAA Privacy Rule Overview",
      snippet: "The HIPAA Privacy Rule establishes national standards to protect individuals' medical records and other individually identifiable health information. Covers use and disclosure provisions, patient rights, and administrative requirements.",
      metadata: { category: "Compliance", source: "HHS.gov" },
    },
    {
      id: "demo-icd10",
      title: "ICD-10-CM Code Lookup",
      snippet: "International Classification of Diseases, 10th Revision, Clinical Modification. Used for medical coding and reporting diagnoses in healthcare settings across the United States.",
      metadata: { category: "Coding", source: "CMS" },
    },
    {
      id: "demo-uscdi",
      title: "USCDI v6 Data Elements",
      snippet: "United States Core Data for Interoperability version 6 defines standardized health data classes and elements required for nationwide health information exchange, including clinical notes, procedures, and health status assessments.",
      metadata: { category: "Standards", source: "ONC" },
    },
    {
      id: "demo-cpt",
      title: "CPT Code Reference Guide",
      snippet: "Current Procedural Terminology codes maintained by the AMA. Used to report medical, surgical, and diagnostic procedures and services to insurance companies for reimbursement.",
      metadata: { category: "Coding", source: "AMA" },
    },
    {
      id: "demo-medications",
      title: "Medication Interaction Database",
      snippet: "Comprehensive drug interaction checking system covering major, moderate, and minor interactions. Cross-references FDA drug labels, DailyMed, and pharmacological databases.",
      metadata: { category: "Clinical", source: "FDA" },
    },
    {
      id: "demo-preventive",
      title: "USPSTF Preventive Care Guidelines",
      snippet: "United States Preventive Services Task Force recommendations for preventive screenings, counseling services, and preventive medications. Grade A and B recommendations for evidence-based care.",
      metadata: { category: "Clinical", source: "USPSTF" },
    },
    {
      id: "demo-telehealth",
      title: "Telehealth Best Practices 2026",
      snippet: "Current telehealth guidelines covering virtual visit protocols, remote patient monitoring, asynchronous consultations, and interstate medical licensure compact for cross-state telehealth delivery.",
      metadata: { category: "Practice", source: "AMA Telehealth" },
    },
  ];

  const filtered = demoData.filter(
    (item) =>
      item.title.toLowerCase().includes(lowerQuery) ||
      item.snippet.toLowerCase().includes(lowerQuery) ||
      item.metadata.category?.toLowerCase().includes(lowerQuery) ||
      lowerQuery.split(" ").some((word) => word.length > 2 && (item.title.toLowerCase().includes(word) || item.snippet.toLowerCase().includes(word)))
  );

  const results = filtered.length > 0 ? filtered : demoData.slice(0, 4);

  return {
    results,
    totalSize: results.length,
    query,
    searchTime: Date.now() - startTime,
    summary: `Found ${results.length} results related to "${query}" from the Tabula Medica knowledge base.`,
  };
}

export async function getSearchSuggestions(prefix: string): Promise<string[]> {
  const suggestions = [
    "FHIR R4 resources",
    "HIPAA compliance requirements",
    "ICD-10 diagnosis codes",
    "CPT procedure codes",
    "medication interactions",
    "preventive care guidelines",
    "lab results interpretation",
    "insurance claims",
    "prior authorization",
    "telehealth visits",
    "immunization schedules",
    "USCDI data elements",
    "care gap analysis",
    "patient portal access",
    "health record sharing",
  ];

  const lower = prefix.toLowerCase();
  return suggestions.filter((s) => s.toLowerCase().includes(lower)).slice(0, 5);
}
