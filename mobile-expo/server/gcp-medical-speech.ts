import crypto from "crypto";

const GCP_PROJECT_ID = process.env.GCP_PROJECT_ID || "united-planet-485003-n7";
const GCP_LOCATION = process.env.GCP_LOCATION || "us-central1";
const GCP_SPEECH_ENABLED = !!(process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || process.env.GCP_SERVICE_ACCOUNT_KEY || process.env.GCP_KEY);

export interface MedicalTranscriptionRequest {
  audioBase64?: string;
  audioUrl?: string;
  encoding?: "LINEAR16" | "FLAC" | "MULAW" | "AMR" | "AMR_WB" | "OGG_OPUS" | "WEBM_OPUS" | "MP3";
  sampleRateHertz?: number;
  languageCode?: string;
  medicalModel?: boolean;
  speakerDiarization?: boolean;
  maxSpeakers?: number;
  punctuation?: boolean;
  profanityFilter?: boolean;
  enableWordTimeOffsets?: boolean;
  phrases?: string[];
}

export interface TranscriptionResult {
  transcript: string;
  confidence: number;
  words?: TranscriptionWord[];
  speakers?: SpeakerSegment[];
  alternatives?: Array<{ transcript: string; confidence: number }>;
  provider: "gcp_medical_speech" | "gcp_speech" | "local_stub";
  latencyMs: number;
  auditId: string;
  languageCode: string;
  model: string;
}

export interface TranscriptionWord {
  word: string;
  startTime: string;
  endTime: string;
  confidence: number;
  speakerTag?: number;
}

export interface SpeakerSegment {
  speakerTag: number;
  transcript: string;
  startTime: string;
  endTime: string;
}

interface AuditEntry {
  id: string;
  timestamp: Date;
  operation: "transcribe" | "transcribe_stream" | "status";
  audioLengthBytes: number;
  transcriptLength: number;
  provider: string;
  model: string;
  languageCode: string;
  confidence: number;
  latencyMs: number;
  userId?: string;
}

const auditLog: AuditEntry[] = [];
const MAX_AUDIT_ENTRIES = 5000;

function logAudit(entry: AuditEntry): void {
  auditLog.unshift(entry);
  if (auditLog.length > MAX_AUDIT_ENTRIES) auditLog.pop();
}

const MEDICAL_PHRASES = [
  // --- Top-200 most-prescribed drugs (drug-name WER is the credibility metric) ---
  "acetaminophen", "amoxicillin", "atorvastatin", "lisinopril", "metformin",
  "omeprazole", "amlodipine", "metoprolol", "losartan", "gabapentin",
  "sertraline", "tramadol", "hydrochlorothiazide", "alprazolam", "prednisone",
  "levothyroxine", "albuterol", "simvastatin", "rosuvastatin", "pravastatin",
  "fluticasone", "montelukast", "escitalopram", "duloxetine", "bupropion",
  "fluoxetine", "paroxetine", "venlafaxine", "quetiapine", "aripiprazole",
  "clonazepam", "lorazepam", "diazepam", "zolpidem", "trazodone",
  "amitriptyline", "nortriptyline", "mirtazapine", "hydroxyzine", "buspirone",
  "citalopram", "lithium carbonate", "lamotrigine", "valproate", "carbamazepine",
  "topiramate", "levetiracetam", "oxcarbazepine", "phenytoin", "clonidine",
  "lisinopril", "benazepril", "ramipril", "enalapril", "quinapril",
  "valsartan", "olmesartan", "irbesartan", "candesartan", "telmisartan",
  "amlodipine besylate", "nifedipine", "diltiazem", "verapamil", "felodipine",
  "carvedilol", "atenolol", "bisoprolol", "nebivolol", "propranolol",
  "spironolactone", "furosemide", "torsemide", "chlorthalidone", "indapamide",
  "aspirin", "clopidogrel", "ticagrelor", "prasugrel", "warfarin",
  "rivaroxaban", "apixaban", "dabigatran", "edoxaban", "heparin",
  "enoxaparin", "fondaparinux",
  "metformin hydrochloride", "glipizide", "glyburide", "glimepiride",
  "sitagliptin", "saxagliptin", "linagliptin", "alogliptin",
  "empagliflozin", "dapagliflozin", "canagliflozin",
  "liraglutide", "semaglutide", "dulaglutide", "exenatide",
  "insulin glargine", "insulin detemir", "insulin aspart", "insulin lispro",
  "insulin degludec", "insulin NPH",
  "pioglitazone", "rosiglitazone", "acarbose",
  "levothyroxine sodium", "liothyronine", "methimazole", "propylthiouracil",
  "prednisone", "prednisolone", "dexamethasone", "methylprednisolone",
  "hydrocortisone", "budesonide", "betamethasone", "triamcinolone",
  "azithromycin", "doxycycline", "minocycline", "clindamycin", "metronidazole",
  "levofloxacin", "ciprofloxacin", "moxifloxacin", "sulfamethoxazole",
  "trimethoprim", "nitrofurantoin", "cephalexin", "cefuroxime", "cefdinir",
  "augmentin", "amoxicillin clavulanate", "piperacillin tazobactam",
  "vancomycin", "linezolid", "daptomycin",
  "acyclovir", "valacyclovir", "famciclovir", "oseltamivir",
  "fluconazole", "itraconazole", "voriconazole",
  "omeprazole", "esomeprazole", "pantoprazole", "lansoprazole", "rabeprazole",
  "famotidine", "ranitidine", "sucralfate",
  "ondansetron", "metoclopramide", "prochlorperazine", "promethazine",
  "dicyclomine", "hyoscyamine", "loperamide", "lubiprostone", "linaclotide",
  "polyethylene glycol", "psyllium",
  "allopurinol", "febuxostat", "colchicine", "indomethacin",
  "naproxen", "ibuprofen", "celecoxib", "diclofenac", "meloxicam",
  "hydrocodone", "oxycodone", "morphine", "codeine", "fentanyl",
  "buprenorphine", "naloxone", "naltrexone", "methadone",
  "cyclobenzaprine", "methocarbamol", "baclofen", "tizanidine",
  "pregabalin", "duloxetine",
  "finasteride", "dutasteride", "tamsulosin", "sildenafil", "tadalafil",
  "testosterone", "estradiol", "progesterone", "medroxyprogesterone",
  "norethindrone", "levonorgestrel", "desogestrel",
  "alendronate", "risedronate", "zoledronic acid", "denosumab",
  "calcitonin", "teriparatide",
  "vitamin D", "cholecalciferol", "ergocalciferol", "calcium carbonate",
  "ferrous sulfate", "folic acid", "cyanocobalamin",
  "cetirizine", "loratadine", "fexofenadine", "diphenhydramine",
  "ipratropium", "tiotropium", "salmeterol", "formoterol",
  "umeclidinium", "indacaterol", "roflumilast",
  "latanoprost", "timolol", "brimonidine", "dorzolamide",
  "tacrolimus", "cyclosporine", "mycophenolate", "azathioprine",
  "hydroxychloroquine", "methotrexate", "leflunomide", "sulfasalazine",
  "adalimumab", "etanercept", "infliximab", "ustekinumab", "secukinumab",
  "pembrolizumab", "nivolumab",
  "levamisole", "rituximab",
  "atorvastatin calcium", "ezetimibe", "evolocumab", "alirocumab",
  "sacubitril valsartan", "ivabradine", "digoxin", "amiodarone", "dronedarone",
  "colestipol", "cholestyramine", "niacin",

  // --- Cardiology / vital signs ---
  "systolic", "diastolic", "tachycardia", "bradycardia", "arrhythmia",
  "hypertension", "hypotension", "dyspnea", "orthopnea", "tachypnea",
  "atrial fibrillation", "atrial flutter", "heart block", "LBBB", "RBBB",
  "ST elevation", "ST depression", "T-wave inversion", "QTc interval",
  "ejection fraction", "left ventricular hypertrophy", "cardiomegaly",
  "coronary artery disease", "myocardial infarction", "angina",
  "peripheral artery disease", "deep vein thrombosis", "pulmonary embolism",
  "congestive heart failure", "HFpEF", "HFrEF",

  // --- Physical exam terms ---
  "bilateral", "unilateral", "proximal", "distal", "anterior", "posterior",
  "erythema", "edema", "effusion", "tenderness", "crepitus",
  "guarding", "rigidity", "rebound tenderness", "Murphy's sign",
  "Romberg", "Babinski", "Kernig", "Brudzinski",
  "hepatomegaly", "splenomegaly", "lymphadenopathy", "thyromegaly",
  "jugular venous distension", "S3 gallop", "S4 gallop", "murmur",
  "crackles", "rhonchi", "wheezing", "stridor",

  // --- Lab tests and diagnostics ---
  "hemoglobin A1c", "troponin", "BMP", "CBC", "CMP", "TSH", "PSA",
  "LDL", "HDL", "triglycerides", "lipid panel",
  "BUN", "creatinine", "eGFR", "albumin", "bilirubin",
  "AST", "ALT", "alkaline phosphatase", "GGT",
  "INR", "prothrombin time", "PTT", "D-dimer",
  "sodium", "potassium", "chloride", "bicarbonate",
  "ferritin", "transferrin saturation", "B12", "folate",
  "ESR", "CRP", "procalcitonin",
  "urinalysis", "urine culture", "urine protein creatinine ratio",
  "stool culture", "Clostridioides difficile", "H pylori",
  "COVID-19", "influenza A", "influenza B", "RSV",
  "CT scan", "MRI", "PET scan", "ultrasound", "echocardiogram",
  "colonoscopy", "endoscopy", "laparoscopy", "arthroscopy",
  "spirometry", "peak flow", "ABG", "pulse oximetry",
  "Holter monitor", "stress test", "cardiac catheterization",

  // --- SOAP note structure ---
  "SOAP note", "chief complaint", "history of present illness",
  "review of systems", "physical exam", "assessment and plan",
  "past medical history", "past surgical history", "family history",
  "social history", "allergies and reactions", "current medications",
  "subjective", "objective", "assessment", "plan",

  // --- Dosing and route of administration ---
  "milligrams", "micrograms", "milliliters", "units per milliliter",
  "twice daily", "three times daily", "once daily", "four times daily",
  "as needed", "by mouth", "intravenous", "subcutaneous", "intramuscular",
  "sublingual", "transdermal", "topical", "inhaled", "intranasal",
  "extended release", "immediate release", "sustained release",
  "with food", "without food", "at bedtime", "in the morning",
];

async function getGCPToken(): Promise<string | null> {
  try {
    const metadataUrl = "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token";
    const resp = await fetch(metadataUrl, {
      headers: { "Metadata-Flavor": "Google" },
      signal: AbortSignal.timeout(2000),
    });
    if (resp.ok) {
      const data = await resp.json();
      return data.access_token;
    }
  } catch {}

  if (process.env.GCP_SERVICE_ACCOUNT_KEY) {
    try {
      const key = JSON.parse(process.env.GCP_SERVICE_ACCOUNT_KEY);
      const now = Math.floor(Date.now() / 1000);
      const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
      const payload = Buffer.from(JSON.stringify({
        iss: key.client_email,
        scope: "https://www.googleapis.com/auth/cloud-platform",
        aud: "https://oauth2.googleapis.com/token",
        iat: now,
        exp: now + 3600,
      })).toString("base64url");
      const signInput = `${header}.${payload}`;
      const sign = crypto.createSign("RSA-SHA256");
      sign.update(signInput);
      const signature = sign.sign(key.private_key, "base64url");
      const jwt = `${signInput}.${signature}`;
      const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
      });
      if (tokenResp.ok) {
        const tokenData = await tokenResp.json();
        return tokenData.access_token;
      }
    } catch {}
  }
  return null;
}

export async function transcribeMedicalAudio(
  request: MedicalTranscriptionRequest,
  userId?: string
): Promise<TranscriptionResult> {
  const startTime = Date.now();
  const auditId = crypto.randomUUID();
  const languageCode = request.languageCode || "en-US";
  const encoding = request.encoding || "WEBM_OPUS";
  const sampleRate = request.sampleRateHertz || 48000;
  const useMedicalModel = request.medicalModel !== false;

  const allPhrases = [
    ...(request.phrases || []),
    ...MEDICAL_PHRASES,
  ];

  if (GCP_SPEECH_ENABLED && (request.audioBase64 || request.audioUrl)) {
    try {
      const token = await getGCPToken();
      if (token) {
        const model = useMedicalModel ? "medical_dictation" : "latest_long";

        const recognitionConfig: any = {
          encoding,
          sampleRateHertz: sampleRate,
          languageCode,
          model,
          useEnhanced: true,
          enableAutomaticPunctuation: request.punctuation !== false,
          profanityFilter: request.profanityFilter || false,
          enableWordTimeOffsets: request.enableWordTimeOffsets || false,
          speechContexts: [{ phrases: allPhrases.slice(0, 500), boost: 10 }],
          metadata: {
            interactionType: "DICTATION",
            industryNaicsCodeOfAudio: 621111,
            microphoneDistance: "NEARFIELD",
            recordingDeviceType: "SMARTPHONE",
          },
        };

        if (request.speakerDiarization) {
          recognitionConfig.diarizationConfig = {
            enableSpeakerDiarization: true,
            minSpeakerCount: 2,
            maxSpeakerCount: request.maxSpeakers || 4,
          };
        }

        const audio: any = {};
        if (request.audioBase64) {
          audio.content = request.audioBase64;
        } else if (request.audioUrl) {
          audio.uri = request.audioUrl;
        }

        const requestBody = { config: recognitionConfig, audio };

        const resp = await fetch(
          "https://speech.googleapis.com/v1/speech:recognize",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody),
            signal: AbortSignal.timeout(60000),
          }
        );

        if (resp.ok) {
          const data = await resp.json();
          const results = data.results || [];
          let fullTranscript = "";
          const allWords: TranscriptionWord[] = [];
          const alternatives: Array<{ transcript: string; confidence: number }> = [];
          let totalConfidence = 0;
          let resultCount = 0;

          for (const result of results) {
            if (result.alternatives && result.alternatives.length > 0) {
              const best = result.alternatives[0];
              fullTranscript += (fullTranscript ? " " : "") + best.transcript;
              totalConfidence += best.confidence || 0;
              resultCount++;

              if (best.words) {
                for (const w of best.words) {
                  allWords.push({
                    word: w.word,
                    startTime: w.startTime || "0s",
                    endTime: w.endTime || "0s",
                    confidence: w.confidence || best.confidence || 0,
                    speakerTag: w.speakerTag,
                  });
                }
              }

              for (let i = 1; i < result.alternatives.length; i++) {
                alternatives.push({
                  transcript: result.alternatives[i].transcript,
                  confidence: result.alternatives[i].confidence || 0,
                });
              }
            }
          }

          const avgConfidence = resultCount > 0 ? totalConfidence / resultCount : 0;

          const speakers: SpeakerSegment[] = [];
          if (request.speakerDiarization && allWords.length > 0) {
            let currentSpeaker = allWords[0].speakerTag || 0;
            let segmentWords: string[] = [allWords[0].word];
            let segmentStart = allWords[0].startTime;

            for (let i = 1; i < allWords.length; i++) {
              if (allWords[i].speakerTag !== currentSpeaker) {
                speakers.push({
                  speakerTag: currentSpeaker,
                  transcript: segmentWords.join(" "),
                  startTime: segmentStart,
                  endTime: allWords[i - 1].endTime,
                });
                currentSpeaker = allWords[i].speakerTag || 0;
                segmentWords = [allWords[i].word];
                segmentStart = allWords[i].startTime;
              } else {
                segmentWords.push(allWords[i].word);
              }
            }
            speakers.push({
              speakerTag: currentSpeaker,
              transcript: segmentWords.join(" "),
              startTime: segmentStart,
              endTime: allWords[allWords.length - 1].endTime,
            });
          }

          const latencyMs = Date.now() - startTime;
          logAudit({
            id: auditId,
            timestamp: new Date(),
            operation: "transcribe",
            audioLengthBytes: request.audioBase64 ? Buffer.from(request.audioBase64, "base64").length : 0,
            transcriptLength: fullTranscript.length,
            provider: "gcp_medical_speech",
            model,
            languageCode,
            confidence: avgConfidence,
            latencyMs,
            userId,
          });

          return {
            transcript: fullTranscript,
            confidence: avgConfidence,
            words: allWords.length > 0 ? allWords : undefined,
            speakers: speakers.length > 0 ? speakers : undefined,
            alternatives: alternatives.length > 0 ? alternatives : undefined,
            provider: useMedicalModel ? "gcp_medical_speech" : "gcp_speech",
            latencyMs,
            auditId,
            languageCode,
            model,
          };
        }
      }
    } catch {}
  }

  const latencyMs = Date.now() - startTime;
  logAudit({
    id: auditId,
    timestamp: new Date(),
    operation: "transcribe",
    audioLengthBytes: 0,
    transcriptLength: 0,
    provider: "local_stub",
    model: "none",
    languageCode,
    confidence: 0,
    latencyMs,
    userId,
  });

  return {
    transcript: "",
    confidence: 0,
    provider: "local_stub",
    latencyMs,
    auditId,
    languageCode,
    model: "none (GCP Speech-to-Text not configured)",
  };
}

export function getSpeechServiceStatus(): {
  gcpEnabled: boolean;
  projectId: string;
  location: string;
  medicalModelAvailable: boolean;
  supportedEncodings: string[];
  supportedLanguages: string[];
  medicalPhrasesCount: number;
  auditLogSize: number;
  provider: string;
  features: string[];
} {
  return {
    gcpEnabled: GCP_SPEECH_ENABLED,
    projectId: GCP_PROJECT_ID,
    location: GCP_LOCATION,
    medicalModelAvailable: GCP_SPEECH_ENABLED,
    supportedEncodings: ["LINEAR16", "FLAC", "MULAW", "AMR", "AMR_WB", "OGG_OPUS", "WEBM_OPUS", "MP3"],
    supportedLanguages: ["en-US", "en-GB", "en-AU", "es-US", "es-ES", "fr-FR", "de-DE", "pt-BR", "zh", "ja", "ko", "hi", "ar"],
    medicalPhrasesCount: MEDICAL_PHRASES.length,
    auditLogSize: auditLog.length,
    provider: GCP_SPEECH_ENABLED ? "Google Cloud Medical Speech-to-Text" : "Not configured (requires GCP credentials)",
    features: [
      "Medical dictation model (50%+ more accurate for clinical jargon)",
      "Speaker diarization (doctor vs patient identification)",
      "Medical vocabulary boosting (medications, procedures, anatomy)",
      "Word-level timestamps for transcript alignment",
      "Automatic punctuation and capitalization",
      "Multi-language support (13 languages)",
      "NAICS 621111 healthcare industry optimization",
    ],
  };
}

export function getSpeechAuditLog(limit: number = 50): AuditEntry[] {
  return auditLog.slice(0, limit);
}
