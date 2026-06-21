import { GoogleAuth } from "google-auth-library";

export interface MedicalTranscriptionRequest {
  audioContent?: string;
  audioUri?: string;
  encoding: "LINEAR16" | "FLAC" | "MULAW" | "AMR" | "AMR_WB" | "OGG_OPUS" | "WEBM_OPUS" | "MP3";
  sampleRateHertz: number;
  languageCode: string;
  model?: "medical_dictation" | "medical_conversation" | "default";
  speakerDiarization?: boolean;
  maxSpeakers?: number;
  punctuation?: boolean;
  profanityFilter?: boolean;
}

export interface MedicalTranscriptionResponse {
  transcript: string;
  confidence: number;
  words: TranscriptionWord[];
  speakers?: SpeakerSegment[];
  medicalTerms: MedicalTermDetection[];
  processingTimeMs: number;
  model: string;
}

export interface TranscriptionWord {
  word: string;
  startTime: number;
  endTime: number;
  confidence: number;
  speakerTag?: number;
}

export interface SpeakerSegment {
  speakerTag: number;
  role: "clinician" | "patient" | "unknown";
  segments: { startTime: number; endTime: number; text: string }[];
}

export interface MedicalTermDetection {
  term: string;
  category: "medication" | "diagnosis" | "procedure" | "anatomy" | "lab_test" | "vital_sign" | "dosage";
  position: { start: number; end: number };
  normalizedTerm?: string;
  snomedCode?: string;
  icdCode?: string;
  rxNormCode?: string;
}

export interface TranscriptionSession {
  id: string;
  status: "active" | "completed" | "failed";
  startedAt: string;
  completedAt?: string;
  transcriptions: MedicalTranscriptionResponse[];
  totalDurationMs: number;
  context: "clinical_note" | "patient_intake" | "consultation" | "dictation";
}

const MEDICAL_TERMS_DB: { pattern: RegExp; term: string; category: MedicalTermDetection["category"]; normalizedTerm?: string; snomedCode?: string; icdCode?: string; rxNormCode?: string }[] = [
  { pattern: /\bestradiol\b/gi, term: "estradiol", category: "medication", normalizedTerm: "Estradiol", rxNormCode: "4083" },
  { pattern: /\bprogesterone\b/gi, term: "progesterone", category: "medication", normalizedTerm: "Progesterone", rxNormCode: "8886" },
  { pattern: /\btestosterone\b/gi, term: "testosterone", category: "medication", normalizedTerm: "Testosterone", rxNormCode: "10372" },
  { pattern: /\blevothyroxine\b/gi, term: "levothyroxine", category: "medication", normalizedTerm: "Levothyroxine", rxNormCode: "6247" },
  { pattern: /\bmetformin\b/gi, term: "metformin", category: "medication", normalizedTerm: "Metformin", rxNormCode: "6809" },
  { pattern: /\blisinopril\b/gi, term: "lisinopril", category: "medication", normalizedTerm: "Lisinopril", rxNormCode: "29046" },
  { pattern: /\batorvastatin\b/gi, term: "atorvastatin", category: "medication", normalizedTerm: "Atorvastatin", rxNormCode: "83367" },
  { pattern: /\balendronate\b/gi, term: "alendronate", category: "medication", normalizedTerm: "Alendronate", rxNormCode: "1655" },
  { pattern: /\bdenosumab\b/gi, term: "denosumab", category: "medication", normalizedTerm: "Denosumab", rxNormCode: "845458" },
  { pattern: /\braloxifene\b/gi, term: "raloxifene", category: "medication", normalizedTerm: "Raloxifene", rxNormCode: "77387" },
  { pattern: /\bhypertension\b/gi, term: "hypertension", category: "diagnosis", normalizedTerm: "Essential hypertension", snomedCode: "59621000", icdCode: "I10" },
  { pattern: /\btype\s*2\s*diabetes\b/gi, term: "type 2 diabetes", category: "diagnosis", normalizedTerm: "Type 2 diabetes mellitus", snomedCode: "44054006", icdCode: "E11" },
  { pattern: /\bosteoporosis\b/gi, term: "osteoporosis", category: "diagnosis", normalizedTerm: "Osteoporosis", snomedCode: "64859006", icdCode: "M81" },
  { pattern: /\bosteopenia\b/gi, term: "osteopenia", category: "diagnosis", normalizedTerm: "Osteopenia", snomedCode: "312894000", icdCode: "M85.80" },
  { pattern: /\bhypothyroidism\b/gi, term: "hypothyroidism", category: "diagnosis", normalizedTerm: "Hypothyroidism", snomedCode: "40930008", icdCode: "E03.9" },
  { pattern: /\bhyperthyroidism\b/gi, term: "hyperthyroidism", category: "diagnosis", normalizedTerm: "Hyperthyroidism", snomedCode: "34486009", icdCode: "E05.90" },
  { pattern: /\bmenopause\b/gi, term: "menopause", category: "diagnosis", normalizedTerm: "Menopause", snomedCode: "161712005", icdCode: "N95.1" },
  { pattern: /\bperimenopause\b/gi, term: "perimenopause", category: "diagnosis", normalizedTerm: "Perimenopause", snomedCode: "419099009", icdCode: "N95.1" },
  { pattern: /\batrial\s*fibrillation\b/gi, term: "atrial fibrillation", category: "diagnosis", normalizedTerm: "Atrial fibrillation", snomedCode: "49436004", icdCode: "I48" },
  { pattern: /\bdexa\s*scan\b/gi, term: "DEXA scan", category: "procedure", normalizedTerm: "Dual-energy X-ray absorptiometry", snomedCode: "312681000" },
  { pattern: /\bmammography\b/gi, term: "mammography", category: "procedure", normalizedTerm: "Mammography", snomedCode: "71651007" },
  { pattern: /\bcolonoscopy\b/gi, term: "colonoscopy", category: "procedure", normalizedTerm: "Colonoscopy", snomedCode: "73761001" },
  { pattern: /\bechocardiogram\b/gi, term: "echocardiogram", category: "procedure", normalizedTerm: "Echocardiography", snomedCode: "40701008" },
  { pattern: /\bblood\s*pressure\b/gi, term: "blood pressure", category: "vital_sign", normalizedTerm: "Blood pressure", snomedCode: "75367002" },
  { pattern: /\bheart\s*rate\b/gi, term: "heart rate", category: "vital_sign", normalizedTerm: "Heart rate", snomedCode: "364075005" },
  { pattern: /\bBMI\b/g, term: "BMI", category: "vital_sign", normalizedTerm: "Body mass index", snomedCode: "60621009" },
  { pattern: /\bTSH\b/g, term: "TSH", category: "lab_test", normalizedTerm: "Thyroid-stimulating hormone", snomedCode: "61167004" },
  { pattern: /\bfree\s*T[34]\b/gi, term: "free T3/T4", category: "lab_test", normalizedTerm: "Free thyroxine/triiodothyronine" },
  { pattern: /\bHbA1c\b/gi, term: "HbA1c", category: "lab_test", normalizedTerm: "Hemoglobin A1c", snomedCode: "43396009" },
  { pattern: /\bApoB\b/g, term: "ApoB", category: "lab_test", normalizedTerm: "Apolipoprotein B", snomedCode: "250695001" },
  { pattern: /\bLDL\b/g, term: "LDL", category: "lab_test", normalizedTerm: "Low-density lipoprotein cholesterol", snomedCode: "113079009" },
  { pattern: /\bHDL\b/g, term: "HDL", category: "lab_test", normalizedTerm: "High-density lipoprotein cholesterol", snomedCode: "102739008" },
  { pattern: /\b\d+\s*(?:mg|mcg|µg|ml|mL|units?|iu|IU)\b/gi, term: "dosage", category: "dosage" },
  { pattern: /\b(?:twice|once|three\s*times)\s*(?:daily|a\s*day|per\s*day)\b/gi, term: "frequency", category: "dosage" },
  { pattern: /\bb\.?i\.?d\.?\b/gi, term: "BID", category: "dosage", normalizedTerm: "Twice daily" },
  { pattern: /\bt\.?i\.?d\.?\b/gi, term: "TID", category: "dosage", normalizedTerm: "Three times daily" },
  { pattern: /\bq\.?d\.?\b/gi, term: "QD", category: "dosage", normalizedTerm: "Once daily" },
  { pattern: /\bfemur\b/gi, term: "femur", category: "anatomy", normalizedTerm: "Femur", snomedCode: "71341001" },
  { pattern: /\blumbar\s*spine\b/gi, term: "lumbar spine", category: "anatomy", normalizedTerm: "Lumbar spine", snomedCode: "122496007" },
  { pattern: /\bthyroid\b/gi, term: "thyroid", category: "anatomy", normalizedTerm: "Thyroid gland", snomedCode: "69748006" },
];

export class MedicalSpeechToTextService {
  private auth: GoogleAuth | null = null;
  private projectId: string;
  private location: string;
  private sessions: Map<string, TranscriptionSession> = new Map();
  private gcpAvailable = false;

  constructor() {
    this.projectId = process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || "united-planet-485003-n7";
    this.location = process.env.GCP_LOCATION || "us-central1";
  }

  async initialize(): Promise<boolean> {
    try {
      if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && !process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
        console.log("[MedASR] No GCP credentials — NLP term detection available, real-time transcription requires GCP");
        return false;
      }
      this.auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
      this.gcpAvailable = true;
      console.log("[MedASR] Initialized with GCP Speech-to-Text Medical model");
      return true;
    } catch (err: any) {
      console.warn("[MedASR] GCP init failed:", err.message);
      return false;
    }
  }

  async transcribe(request: MedicalTranscriptionRequest): Promise<MedicalTranscriptionResponse> {
    const startTime = Date.now();

    if (this.gcpAvailable && this.auth) {
      return this.transcribeWithGcp(request, startTime);
    }

    return this.transcribeLocal(request, startTime);
  }

  private async transcribeWithGcp(request: MedicalTranscriptionRequest, startTime: number): Promise<MedicalTranscriptionResponse> {
    try {
      const client = await this.auth!.getClient();
      const accessToken = await client.getAccessToken();
      const token = typeof accessToken === "string" ? accessToken : accessToken.token;

      const model = request.model === "medical_dictation"
        ? "medical_dictation"
        : request.model === "medical_conversation"
          ? "medical_conversation"
          : "default";

      const speechConfig: any = {
        config: {
          encoding: request.encoding,
          sampleRateHertz: request.sampleRateHertz,
          languageCode: request.languageCode,
          model,
          useEnhanced: true,
          enableAutomaticPunctuation: request.punctuation !== false,
          enableWordTimeOffsets: true,
          profanityFilter: request.profanityFilter || false,
          metadata: {
            interactionType: model === "medical_conversation" ? "DISCUSSION" : "DICTATION",
            industryNaicsCodeOfAudio: 621111,
            microphoneDistance: "NEARFIELD",
            recordingDeviceType: "PC",
          },
        },
      };

      if (request.speakerDiarization) {
        speechConfig.config.diarizationConfig = {
          enableSpeakerDiarization: true,
          minSpeakerCount: 2,
          maxSpeakerCount: request.maxSpeakers || 4,
        };
      }

      if (request.audioContent) {
        speechConfig.audio = { content: request.audioContent };
      } else if (request.audioUri) {
        speechConfig.audio = { uri: request.audioUri };
      }

      const url = `https://speech.googleapis.com/v1p1beta1/speech:recognize`;
      const response = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(speechConfig),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`GCP Speech API error: ${response.status} ${error}`);
      }

      const data = await response.json() as any;
      const results = data.results || [];
      const allWords: TranscriptionWord[] = [];
      let fullTranscript = "";
      let totalConfidence = 0;
      let confidenceCount = 0;

      for (const result of results) {
        const alt = result.alternatives?.[0];
        if (!alt) continue;
        fullTranscript += (fullTranscript ? " " : "") + alt.transcript;
        if (alt.confidence) { totalConfidence += alt.confidence; confidenceCount++; }

        for (const w of alt.words || []) {
          allWords.push({
            word: w.word,
            startTime: parseFloat(w.startTime?.replace("s", "") || "0"),
            endTime: parseFloat(w.endTime?.replace("s", "") || "0"),
            confidence: alt.confidence || 0,
            speakerTag: w.speakerTag,
          });
        }
      }

      const medicalTerms = this.detectMedicalTerms(fullTranscript);
      const speakers = request.speakerDiarization ? this.buildSpeakerSegments(allWords) : undefined;

      return {
        transcript: fullTranscript,
        confidence: confidenceCount > 0 ? totalConfidence / confidenceCount : 0,
        words: allWords,
        speakers,
        medicalTerms,
        processingTimeMs: Date.now() - startTime,
        model: `gcp-medasr-${request.model || "default"}`,
      };
    } catch (err: any) {
      console.error("[MedASR] GCP transcription failed, falling back to local:", err.message);
      return this.transcribeLocal(request, startTime);
    }
  }

  private async transcribeLocal(_request: MedicalTranscriptionRequest, startTime: number): Promise<MedicalTranscriptionResponse> {
    return {
      transcript: "[MedASR requires GCP credentials for audio transcription. Medical NLP term detection is available for text input via detectMedicalTerms().]",
      confidence: 0,
      words: [],
      medicalTerms: [],
      processingTimeMs: Date.now() - startTime,
      model: "local-fallback",
    };
  }

  detectMedicalTerms(text: string): MedicalTermDetection[] {
    const detections: MedicalTermDetection[] = [];
    const seen = new Set<string>();

    for (const entry of MEDICAL_TERMS_DB) {
      let match;
      const regex = new RegExp(entry.pattern.source, entry.pattern.flags);
      while ((match = regex.exec(text)) !== null) {
        const key = `${entry.term}-${match.index}`;
        if (seen.has(key)) continue;
        seen.add(key);

        detections.push({
          term: match[0],
          category: entry.category,
          position: { start: match.index, end: match.index + match[0].length },
          normalizedTerm: entry.normalizedTerm,
          snomedCode: entry.snomedCode,
          icdCode: entry.icdCode,
          rxNormCode: entry.rxNormCode,
        });
      }
    }

    return detections.sort((a, b) => a.position.start - b.position.start);
  }

  private buildSpeakerSegments(words: TranscriptionWord[]): SpeakerSegment[] {
    const speakerMap = new Map<number, TranscriptionWord[]>();
    for (const word of words) {
      const tag = word.speakerTag || 0;
      if (!speakerMap.has(tag)) speakerMap.set(tag, []);
      speakerMap.get(tag)!.push(word);
    }

    const segments: SpeakerSegment[] = [];
    for (const [tag, speakerWords] of speakerMap.entries()) {
      const textSegments: SpeakerSegment["segments"] = [];
      let currentSegment = { startTime: speakerWords[0].startTime, endTime: speakerWords[0].endTime, text: speakerWords[0].word };

      for (let i = 1; i < speakerWords.length; i++) {
        const gap = speakerWords[i].startTime - currentSegment.endTime;
        if (gap < 2.0) {
          currentSegment.endTime = speakerWords[i].endTime;
          currentSegment.text += " " + speakerWords[i].word;
        } else {
          textSegments.push({ ...currentSegment });
          currentSegment = { startTime: speakerWords[i].startTime, endTime: speakerWords[i].endTime, text: speakerWords[i].word };
        }
      }
      textSegments.push(currentSegment);

      segments.push({
        speakerTag: tag,
        role: tag === 1 ? "clinician" : tag === 2 ? "patient" : "unknown",
        segments: textSegments,
      });
    }

    return segments;
  }

  createSession(context: TranscriptionSession["context"]): TranscriptionSession {
    const session: TranscriptionSession = {
      id: `medasr-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      status: "active",
      startedAt: new Date().toISOString(),
      transcriptions: [],
      totalDurationMs: 0,
      context,
    };
    this.sessions.set(session.id, session);
    return session;
  }

  async addToSession(sessionId: string, request: MedicalTranscriptionRequest): Promise<MedicalTranscriptionResponse | null> {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== "active") return null;

    const result = await this.transcribe(request);
    session.transcriptions.push(result);
    session.totalDurationMs += result.processingTimeMs;
    return result;
  }

  completeSession(sessionId: string): TranscriptionSession | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    session.status = "completed";
    session.completedAt = new Date().toISOString();
    return session;
  }

  getSession(sessionId: string): TranscriptionSession | null {
    return this.sessions.get(sessionId) || null;
  }

  getStatus(): { gcpAvailable: boolean; projectId: string; models: string[]; termDatabaseSize: number } {
    return {
      gcpAvailable: this.gcpAvailable,
      projectId: this.projectId,
      models: ["medical_dictation", "medical_conversation", "default"],
      termDatabaseSize: MEDICAL_TERMS_DB.length,
    };
  }
}

export const medicalSpeechToTextService = new MedicalSpeechToTextService();
