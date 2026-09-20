import { describe, expect, it } from "vitest";
import {
  brierScore,
  calibrationBuckets,
  cStatistic,
  expectedCalibrationError,
} from "@shared/quant/calibration";

describe("brierScore", () => {
  it("scores a perfect model as 0", () => {
    const score = brierScore([
      { probability: 1, outcome: true },
      { probability: 0, outcome: false },
    ]);
    expect(score).toBe(0);
  });

  it("scores a maximally wrong model as 1", () => {
    const score = brierScore([
      { probability: 0, outcome: true },
      { probability: 1, outcome: false },
    ]);
    expect(score).toBe(1);
  });

  it("scores a coin-flip model at 0.25 on a balanced population", () => {
    const score = brierScore([
      { probability: 0.5, outcome: true },
      { probability: 0.5, outcome: false },
    ]);
    expect(score).toBeCloseTo(0.25);
  });

  it("throws on empty input", () => {
    expect(() => brierScore([])).toThrow();
  });
});

describe("calibrationBuckets", () => {
  it("buckets predictions and computes observed rate per bucket", () => {
    const buckets = calibrationBuckets(
      [
        { probability: 0.05, outcome: false },
        { probability: 0.05, outcome: false },
        { probability: 0.85, outcome: true },
        { probability: 0.95, outcome: true },
      ],
      10,
    );
    expect(buckets).toHaveLength(10);
    expect(buckets[0].count).toBe(2);
    expect(buckets[0].meanPredicted).toBeCloseTo(0.05);
    expect(buckets[0].observedRate).toBe(0);
    expect(buckets[9].count).toBe(1);
    expect(buckets[9].observedRate).toBe(1);
    expect(buckets[8].count).toBe(1);
    expect(buckets[8].observedRate).toBe(1);
  });

  it("rejects out-of-range probabilities", () => {
    expect(() => calibrationBuckets([{ probability: 1.5, outcome: true }])).toThrow();
  });
});

describe("expectedCalibrationError", () => {
  it("is 0 for a perfectly calibrated set of buckets", () => {
    const buckets = calibrationBuckets([
      { probability: 0.1, outcome: false },
      { probability: 0.1, outcome: false },
      { probability: 0.1, outcome: false },
      { probability: 0.1, outcome: false },
      { probability: 0.1, outcome: true },
      { probability: 0.9, outcome: true },
    ]);
    const ece = expectedCalibrationError(buckets);
    expect(ece).toBeGreaterThanOrEqual(0);
    expect(ece).toBeLessThan(0.2);
  });
});

describe("cStatistic", () => {
  it("is 1.0 when positives always score above negatives", () => {
    const c = cStatistic([
      { probability: 0.9, outcome: true },
      { probability: 0.8, outcome: true },
      { probability: 0.3, outcome: false },
      { probability: 0.1, outcome: false },
    ]);
    expect(c).toBe(1);
  });

  it("is 0.0 when positives always score below negatives", () => {
    const c = cStatistic([
      { probability: 0.1, outcome: true },
      { probability: 0.2, outcome: true },
      { probability: 0.8, outcome: false },
      { probability: 0.9, outcome: false },
    ]);
    expect(c).toBe(0);
  });

  it("is 0.5 for a random/no-discrimination model", () => {
    const c = cStatistic([
      { probability: 0.5, outcome: true },
      { probability: 0.5, outcome: false },
      { probability: 0.5, outcome: true },
      { probability: 0.5, outcome: false },
    ]);
    expect(c).toBeCloseTo(0.5);
  });

  it("handles tied scores via mid-rank averaging", () => {
    const c = cStatistic([
      { probability: 0.5, outcome: true },
      { probability: 0.5, outcome: false },
    ]);
    expect(c).toBeCloseTo(0.5);
  });

  it("throws when only one class is present", () => {
    expect(() =>
      cStatistic([
        { probability: 0.5, outcome: true },
        { probability: 0.6, outcome: true },
      ]),
    ).toThrow();
  });
});
