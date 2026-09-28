import { randomUUID } from "crypto";
import type { SpeechAcousticFeatures, SustainedVowelFeatures, ReadingPassageFeatures } from "../../shared/speech-acoustics";

const DISCLAIMER =
  "This speech screening tool is NOT a diagnostic test and cannot diagnose, rule out, or predict Parkinson's disease. It is an educational, self-tracking aid that looks for acoustic patterns sometimes associated with Parkinsonian speech changes (hypokinetic dysarthria) in the movement-disorder literature. Voice quality is affected by many things besides Parkinson's — microphone quality, background noise, colds, allergies, fatigue, and normal aging all change these measurements. This tool has not been clinically validated for Parkinson's screening and is not FDA cleared. Always discuss any speech or voice changes, and any result from this tool, with a physician, neurologist, or speech-language pathologist.";

// Widely used clinical voice-quality thresholds (comparable to MDVP/Praat normative
// cutoffs for sustained-vowel dysphonia measures). These flag general voice-quality
// change, not Parkinson's specifically — many conditions elevate jitter/shimmer or
// reduce HNR.
const JITTER_FLAG_PERCENT = 1.04;
const SHIMMER_FLAG_PERCENT = 3.81;
const HNR_FLAG_DB = 20;

export type ScreeningFlagLevel = "typical" | "atypical";

export interface ScreeningFlag {
  metric: string;
  value: number;
  unit: string;
  level: ScreeningFlagLevel;
  note: string;
}

export interface SpeechScreeningResult {
  id: string;
  profileId: string;
  taskType: "sustained_vowel" | "reading_passage";
  features: SpeechAcousticFeatures;
  flags: ScreeningFlag[];
  atypicalCount: number;
  summary: string;
  trend?: {
    metric: string;
    direction: "increased" | "decreased" | "stable";
    changePercent: number;
  }[];
  assessedAt: string;
  disclaimer: string;
}

function scoreVowelFeatures(features: SustainedVowelFeatures): ScreeningFlag[] {
  const flags: ScreeningFlag[] = [];

  flags.push({
    metric: "jitter",
    value: features.jitterPercent,
    unit: "%",
    level: features.jitterPercent > JITTER_FLAG_PERCENT ? "atypical" : "typical",
    note: `Cycle-to-cycle pitch-period variability. Common clinical reference threshold: ≤${JITTER_FLAG_PERCENT}%.`,
  });

  flags.push({
    metric: "shimmer",
    value: features.shimmerPercent,
    unit: "%",
    level: features.shimmerPercent > SHIMMER_FLAG_PERCENT ? "atypical" : "typical",
    note: `Cycle-to-cycle amplitude variability. Common clinical reference threshold: ≤${SHIMMER_FLAG_PERCENT}%.`,
  });

  flags.push({
    metric: "hnr",
    value: features.hnrDb,
    unit: "dB",
    level: features.hnrDb < HNR_FLAG_DB ? "atypical" : "typical",
    note: `Harmonics-to-noise ratio (voice clarity/breathiness). Common clinical reference threshold: ≥${HNR_FLAG_DB} dB.`,
  });

  return flags;
}

function scorePassageFeatures(features: ReadingPassageFeatures): ScreeningFlag[] {
  // Connected-speech prosody measures don't have a single widely-agreed absolute
  // cutoff the way sustained-vowel dysphonia measures do, so these are reported
  // descriptively (no fixed pass/fail line) and are best interpreted as a trend
  // against the patient's own prior assessments.
  return [
    {
      metric: "pitchVariability",
      value: features.f0SdSemitones,
      unit: "semitones",
      level: "typical",
      note: "Pitch (intonation) variability across the passage. Reduced pitch variability (a flatter, more monotone voice) has been described in Parkinsonian speech — track this against your own prior results.",
    },
    {
      metric: "loudnessVariability",
      value: features.intensitySdDb,
      unit: "dB",
      level: "typical",
      note: "Loudness variability across the passage. Reduced loudness and loudness variability (hypophonia) has been described in Parkinsonian speech — track this against your own prior results.",
    },
    {
      metric: "pauseRatio",
      value: features.pauseRatio * 100,
      unit: "%",
      level: "typical",
      note: "Proportion of the recording spent in pauses of 150ms or longer. Increased pausing has been described in Parkinsonian speech — track this against your own prior results.",
    },
  ];
}

function buildSummary(taskType: SpeechAcousticFeatures["taskType"], flags: ScreeningFlag[]): string {
  const atypical = flags.filter(f => f.level === "atypical");
  if (taskType === "sustained_vowel") {
    if (atypical.length === 0) {
      return "Voice-quality measures from this recording are within common clinical reference ranges.";
    }
    return `${atypical.length} of ${flags.length} voice-quality measure(s) fall outside common clinical reference ranges (${atypical.map(f => f.metric).join(", ")}). This reflects general voice-quality change, not a Parkinson's-specific finding — discuss with a clinician, especially if this persists or you notice other symptoms.`;
  }
  return "Reading-passage measures are reported for trend tracking. Review the trend section (once more than one assessment exists) and discuss any consistent directional change with your care team.";
}

const historyCache = new Map<string, SpeechScreeningResult[]>();

function computeTrend(profileId: string, taskType: SpeechAcousticFeatures["taskType"], features: SpeechAcousticFeatures): SpeechScreeningResult["trend"] {
  const previous = historyCache.get(profileId)?.filter(r => r.taskType === taskType).sort((a, b) => new Date(b.assessedAt).getTime() - new Date(a.assessedAt).getTime())[0];
  if (!previous) return undefined;

  const metricsToTrack: (keyof SustainedVowelFeatures | keyof ReadingPassageFeatures)[] =
    taskType === "sustained_vowel"
      ? ["jitterPercent", "shimmerPercent", "hnrDb"]
      : ["f0SdSemitones", "intensitySdDb", "pauseRatio", "speakingRateEstimate"];

  const prevFeatures = previous.features as Record<string, number>;
  const currFeatures = features as unknown as Record<string, number>;

  return metricsToTrack.map(metric => {
    const prevValue = prevFeatures[metric as string];
    const currValue = currFeatures[metric as string];
    const changePercent = prevValue !== 0 ? ((currValue - prevValue) / Math.abs(prevValue)) * 100 : 0;
    let direction: "increased" | "decreased" | "stable" = "stable";
    if (Math.abs(changePercent) >= 5) direction = changePercent > 0 ? "increased" : "decreased";
    return { metric: metric as string, direction, changePercent };
  });
}

export const speechScreeningService = {
  analyze(profileId: string, features: SpeechAcousticFeatures): SpeechScreeningResult {
    if (features.durationSec < 1) {
      throw new Error("Recording is too short to analyze (minimum 1 second).");
    }
    if (features.voicedRatio < 0.05) {
      throw new Error("No voiced speech was detected in this recording. Please re-record in a quiet environment, speaking clearly into the microphone.");
    }

    const flags = features.taskType === "sustained_vowel" ? scoreVowelFeatures(features) : scorePassageFeatures(features);
    const atypicalCount = flags.filter(f => f.level === "atypical").length;
    const summary = buildSummary(features.taskType, flags);
    const trend = computeTrend(profileId, features.taskType, features);

    const result: SpeechScreeningResult = {
      id: randomUUID(),
      profileId,
      taskType: features.taskType,
      features,
      flags,
      atypicalCount,
      summary,
      trend,
      assessedAt: new Date().toISOString(),
      disclaimer: DISCLAIMER,
    };

    const existing = historyCache.get(profileId) || [];
    existing.push(result);
    historyCache.set(profileId, existing);

    return result;
  },

  getHistory(profileId: string, taskType?: SpeechAcousticFeatures["taskType"]): SpeechScreeningResult[] {
    const all = (historyCache.get(profileId) || []).slice().sort((a, b) => new Date(b.assessedAt).getTime() - new Date(a.assessedAt).getTime());
    return taskType ? all.filter(r => r.taskType === taskType) : all;
  },

  getLatest(profileId: string, taskType?: SpeechAcousticFeatures["taskType"]): SpeechScreeningResult | undefined {
    return this.getHistory(profileId, taskType)[0];
  },

  getTaskInfo() {
    return {
      disclaimer: DISCLAIMER,
      tasks: [
        {
          taskType: "sustained_vowel" as const,
          title: "Sustained Vowel",
          instructions: "Take a deep breath and say \"ahh\" in a comfortable, steady voice for as long as you can, up to 10 seconds. Hold the microphone about 6-8 inches from your mouth in a quiet room.",
          minDurationSec: 3,
          maxDurationSec: 10,
        },
        {
          taskType: "reading_passage" as const,
          title: "Reading Passage",
          instructions: "Read the following passage aloud at your normal speaking pace and volume: \"The rainbow is a division of white light into many beautiful colors. These take the shape of a long round arch, with its path high above, and its two ends apparently beyond the horizon.\"",
          minDurationSec: 8,
          maxDurationSec: 30,
        },
      ],
    };
  },
};
