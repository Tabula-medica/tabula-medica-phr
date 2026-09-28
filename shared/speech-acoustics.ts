/**
 * Pure acoustic-analysis functions for the Parkinson's speech screening tool.
 * Operates on raw PCM samples (Float32Array, range [-1, 1]) so it runs both in the
 * browser (Web Audio API output) and under plain Node for testing — no DOM dependency.
 *
 * Voice-quality measures (jitter/shimmer/HNR) follow the standard clinical
 * definitions used in voice-pathology tools such as Praat/MDVP.
 */

export interface FrameF0 {
  f0Hz: number;
  voicingStrength: number;
  startSample: number;
}

export interface SustainedVowelFeatures {
  taskType: "sustained_vowel";
  f0MeanHz: number;
  f0SdSemitones: number;
  jitterPercent: number;
  shimmerPercent: number;
  hnrDb: number;
  voicedRatio: number;
  durationSec: number;
}

export interface ReadingPassageFeatures {
  taskType: "reading_passage";
  f0MeanHz: number;
  f0SdSemitones: number;
  intensityMeanDb: number;
  intensitySdDb: number;
  pauseRatio: number;
  speakingRateEstimate: number;
  voicedRatio: number;
  durationSec: number;
}

export type SpeechAcousticFeatures = SustainedVowelFeatures | ReadingPassageFeatures;

const MIN_F0_HZ = 75;
const MAX_F0_HZ = 500;
const VOICING_THRESHOLD = 0.3;
const SILENCE_RMS_THRESHOLD = 0.02;
const MIN_PAUSE_SEC = 0.15;

export function computeRMS(frame: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < frame.length; i++) sum += frame[i] * frame[i];
  return Math.sqrt(sum / frame.length);
}

export function rmsToDb(rms: number, reference = 1): number {
  if (rms <= 0) return -Infinity;
  return 20 * Math.log10(rms / reference);
}

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance = values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

export function hzToSemitones(hz: number, referenceHz: number): number {
  return 12 * Math.log2(hz / referenceHz);
}

/**
 * Autocorrelation-based pitch estimate for a single analysis frame.
 * Returns null when the frame is unvoiced (too quiet or no clear periodicity).
 */
export function estimateFrameF0(frame: Float32Array, sampleRate: number): { f0Hz: number; voicingStrength: number } | null {
  const rms = computeRMS(frame);
  if (rms < SILENCE_RMS_THRESHOLD) return null;

  const minLag = Math.floor(sampleRate / MAX_F0_HZ);
  const maxLag = Math.min(Math.floor(sampleRate / MIN_F0_HZ), frame.length - 1);
  if (maxLag <= minLag) return null;

  let bestLag = -1;
  let bestNormCorr = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let corrSum = 0;
    let energy0 = 0;
    let energyLag = 0;
    for (let i = 0; i < frame.length - lag; i++) {
      corrSum += frame[i] * frame[i + lag];
      energy0 += frame[i] * frame[i];
      energyLag += frame[i + lag] * frame[i + lag];
    }
    const denom = Math.sqrt(energy0 * energyLag);
    const normCorr = denom > 0 ? corrSum / denom : 0;
    if (normCorr > bestNormCorr) {
      bestNormCorr = normCorr;
      bestLag = lag;
    }
  }

  if (bestLag <= 0 || bestNormCorr < VOICING_THRESHOLD) return null;

  return { f0Hz: sampleRate / bestLag, voicingStrength: Math.min(bestNormCorr, 0.999999) };
}

export function frameSignal(samples: Float32Array, frameSize: number, hopSize: number): { frame: Float32Array; start: number }[] {
  const frames: { frame: Float32Array; start: number }[] = [];
  for (let start = 0; start + frameSize <= samples.length; start += hopSize) {
    frames.push({ frame: samples.subarray(start, start + frameSize), start });
  }
  return frames;
}

/**
 * Pitch-synchronous peak picking: given an approximate expected F0, walks the
 * waveform searching for the true local maximum near each expected cycle boundary.
 * Used for cycle-accurate jitter/shimmer, which frame-based F0 estimates are too
 * coarse to support.
 */
export function detectCyclePeaks(samples: Float32Array, sampleRate: number, expectedF0Hz: number): number[] {
  const period = sampleRate / expectedF0Hz;
  const searchWindow = Math.max(1, Math.floor(period * 0.3));
  const peaks: number[] = [];
  let cursor = Math.floor(period / 2);

  while (cursor < samples.length) {
    const searchStart = Math.max(0, cursor - searchWindow);
    const searchEnd = Math.min(samples.length, cursor + searchWindow);
    let maxIdx = -1;
    let maxVal = -Infinity;
    for (let i = searchStart; i < searchEnd; i++) {
      if (samples[i] > maxVal) {
        maxVal = samples[i];
        maxIdx = i;
      }
    }
    if (maxIdx === -1) break;
    peaks.push(maxIdx);
    cursor = maxIdx + Math.round(period);
  }

  return peaks;
}

export function analyzeSustainedVowel(samples: Float32Array, sampleRate: number): SustainedVowelFeatures {
  const durationSec = samples.length / sampleRate;
  const frameSize = Math.round(sampleRate * 0.04);
  const hopSize = Math.round(sampleRate * 0.01);
  const frames = frameSignal(samples, frameSize, hopSize);

  const voicedF0s: number[] = [];
  const voicingStrengths: number[] = [];
  for (const { frame } of frames) {
    const est = estimateFrameF0(frame, sampleRate);
    if (est) {
      voicedF0s.push(est.f0Hz);
      voicingStrengths.push(est.voicingStrength);
    }
  }

  const voicedRatio = frames.length > 0 ? voicedF0s.length / frames.length : 0;
  const f0MeanHz = mean(voicedF0s) || 0;
  const semitoneValues = f0MeanHz > 0 ? voicedF0s.map(f => hzToSemitones(f, f0MeanHz)) : [];
  const f0SdSemitones = standardDeviation(semitoneValues);

  let jitterPercent = 0;
  let shimmerPercent = 0;
  let hnrDb = 0;

  if (f0MeanHz > 0 && voicedF0s.length > 0) {
    const peaks = detectCyclePeaks(samples, sampleRate, f0MeanHz);
    if (peaks.length >= 3) {
      const periods: number[] = [];
      const amplitudes: number[] = [];
      for (let i = 1; i < peaks.length; i++) {
        periods.push(peaks[i] - peaks[i - 1]);
      }
      for (const p of peaks) amplitudes.push(Math.abs(samples[p]));

      const periodDiffs: number[] = [];
      for (let i = 1; i < periods.length; i++) periodDiffs.push(Math.abs(periods[i] - periods[i - 1]));
      const meanPeriod = mean(periods);
      jitterPercent = meanPeriod > 0 ? (mean(periodDiffs) / meanPeriod) * 100 : 0;

      const ampDiffs: number[] = [];
      for (let i = 1; i < amplitudes.length; i++) ampDiffs.push(Math.abs(amplitudes[i] - amplitudes[i - 1]));
      const meanAmp = mean(amplitudes);
      shimmerPercent = meanAmp > 0 ? (mean(ampDiffs) / meanAmp) * 100 : 0;
    }

    const maxVoicingStrength = voicingStrengths.length > 0 ? Math.max(...voicingStrengths) : 0;
    const r = Math.min(maxVoicingStrength, 0.999999);
    hnrDb = r > 0 && r < 1 ? 10 * Math.log10(r / (1 - r)) : 0;
  }

  return {
    taskType: "sustained_vowel",
    f0MeanHz,
    f0SdSemitones,
    jitterPercent,
    shimmerPercent,
    hnrDb,
    voicedRatio,
    durationSec,
  };
}

export function analyzeReadingPassage(samples: Float32Array, sampleRate: number): ReadingPassageFeatures {
  const durationSec = samples.length / sampleRate;
  const frameSize = Math.round(sampleRate * 0.04);
  const hopSize = Math.round(sampleRate * 0.02);
  const frames = frameSignal(samples, frameSize, hopSize);

  const voicedF0s: number[] = [];
  const dbValues: number[] = [];
  const voicedFlags: boolean[] = [];

  for (const { frame } of frames) {
    const rms = computeRMS(frame);
    const isVoiced = rms >= SILENCE_RMS_THRESHOLD;
    voicedFlags.push(isVoiced);
    if (isVoiced) {
      dbValues.push(rmsToDb(rms));
      const est = estimateFrameF0(frame, sampleRate);
      if (est) voicedF0s.push(est.f0Hz);
    }
  }

  const voicedRatio = frames.length > 0 ? voicedFlags.filter(Boolean).length / frames.length : 0;
  const f0MeanHz = mean(voicedF0s) || 0;
  const semitoneValues = f0MeanHz > 0 ? voicedF0s.map(f => hzToSemitones(f, f0MeanHz)) : [];
  const f0SdSemitones = standardDeviation(semitoneValues);
  const intensityMeanDb = mean(dbValues);
  const intensitySdDb = standardDeviation(dbValues);

  const hopSec = hopSize / sampleRate;
  const minPauseFrames = Math.max(1, Math.round(MIN_PAUSE_SEC / hopSec));

  const unvoicedRunLengths: number[] = [];
  let runLength = 0;
  for (const isVoiced of voicedFlags) {
    if (!isVoiced) {
      runLength++;
    } else {
      if (runLength > 0) unvoicedRunLengths.push(runLength);
      runLength = 0;
    }
  }
  if (runLength > 0) unvoicedRunLengths.push(runLength);
  const pauseFrameCount = unvoicedRunLengths.filter(len => len >= minPauseFrames).reduce((a, b) => a + b, 0);

  let voicedSegmentCount = 0;
  let wasVoiced = false;
  for (const isVoiced of voicedFlags) {
    if (isVoiced && !wasVoiced) voicedSegmentCount++;
    wasVoiced = isVoiced;
  }

  const pauseRatio = frames.length > 0 ? pauseFrameCount / frames.length : 0;
  const speakingRateEstimate = durationSec > 0 ? voicedSegmentCount / durationSec : 0;

  return {
    taskType: "reading_passage",
    f0MeanHz,
    f0SdSemitones,
    intensityMeanDb,
    intensitySdDb,
    pauseRatio,
    speakingRateEstimate,
    voicedRatio,
    durationSec,
  };
}
