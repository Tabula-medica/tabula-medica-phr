/**
 * Domain-agnostic model-validation primitives for quantitative risk scoring.
 *
 * These are the standard tools used to backtest any probabilistic risk model
 * against realized outcomes — clinical (e.g. did a "high ASCVD risk" patient
 * have an event) or financial (e.g. did a "high default risk" position
 * default). They compute nothing about a single prediction in isolation;
 * all of them require a labeled outcome to compare against, which is what
 * makes them real quantitative validation rather than another heuristic.
 */

export interface ScoredOutcome {
  /** Model's predicted probability of the outcome, in [0, 1]. */
  probability: number;
  /** Whether the outcome actually occurred. */
  outcome: boolean;
}

/**
 * Brier score: mean squared error between predicted probability and the
 * realized outcome. Lower is better; 0 is a perfect model, 0.25 is what a
 * coin-flip model scores on a balanced population.
 */
export function brierScore(scored: ScoredOutcome[]): number {
  if (scored.length === 0) {
    throw new Error("brierScore requires at least one scored outcome");
  }
  const sumSquaredError = scored.reduce((sum, { probability, outcome }) => {
    const label = outcome ? 1 : 0;
    return sum + (probability - label) ** 2;
  }, 0);
  return sumSquaredError / scored.length;
}

export interface CalibrationBucket {
  /** Lower bound (inclusive) of the predicted-probability bucket. */
  bucketStart: number;
  /** Upper bound (exclusive, except the last bucket) of the bucket. */
  bucketEnd: number;
  /** Number of predictions falling in this bucket. */
  count: number;
  /** Mean predicted probability of predictions in this bucket. */
  meanPredicted: number;
  /** Observed event rate among predictions in this bucket. */
  observedRate: number;
}

/**
 * Buckets predictions by predicted probability and compares mean predicted
 * probability against observed event rate per bucket — the standard
 * reliability-diagram input. A well-calibrated model has meanPredicted
 * close to observedRate in every non-empty bucket.
 */
export function calibrationBuckets(
  scored: ScoredOutcome[],
  numBuckets = 10,
): CalibrationBucket[] {
  if (numBuckets < 1) {
    throw new Error("numBuckets must be >= 1");
  }
  const width = 1 / numBuckets;
  const buckets: { probabilities: number[]; outcomes: boolean[] }[] = Array.from(
    { length: numBuckets },
    () => ({ probabilities: [], outcomes: [] }),
  );

  for (const { probability, outcome } of scored) {
    if (probability < 0 || probability > 1) {
      throw new Error(`probability out of range [0,1]: ${probability}`);
    }
    const index = Math.min(Math.floor(probability / width), numBuckets - 1);
    buckets[index].probabilities.push(probability);
    buckets[index].outcomes.push(outcome);
  }

  return buckets.map(({ probabilities, outcomes }, index) => {
    const count = probabilities.length;
    const meanPredicted = count === 0 ? 0 : probabilities.reduce((a, b) => a + b, 0) / count;
    const observedRate = count === 0 ? 0 : outcomes.filter(Boolean).length / count;
    return {
      bucketStart: index * width,
      bucketEnd: (index + 1) * width,
      count,
      meanPredicted,
      observedRate,
    };
  });
}

/**
 * Expected Calibration Error: the count-weighted average gap between
 * predicted and observed rates across buckets. Empty buckets are ignored.
 */
export function expectedCalibrationError(buckets: CalibrationBucket[]): number {
  const total = buckets.reduce((sum, b) => sum + b.count, 0);
  if (total === 0) {
    throw new Error("expectedCalibrationError requires at least one non-empty bucket");
  }
  const weightedGap = buckets.reduce(
    (sum, b) => sum + b.count * Math.abs(b.meanPredicted - b.observedRate),
    0,
  );
  return weightedGap / total;
}

/**
 * C-statistic (AUC-ROC): probability that a randomly chosen
 * outcome-positive case is scored higher than a randomly chosen
 * outcome-negative case. 0.5 is no better than chance, 1.0 is perfect
 * discrimination. Computed via the Mann-Whitney U rank-sum method, which
 * is exact and O(n log n) rather than the naive O(n^2) pairwise count.
 */
export function cStatistic(scored: ScoredOutcome[]): number {
  const positives = scored.filter((s) => s.outcome);
  const negatives = scored.filter((s) => !s.outcome);
  if (positives.length === 0 || negatives.length === 0) {
    throw new Error("cStatistic requires at least one positive and one negative outcome");
  }

  const ranked = [...scored]
    .map((s, originalIndex) => ({ ...s, originalIndex }))
    .sort((a, b) => a.probability - b.probability);

  const ranks = new Array<number>(ranked.length);
  let i = 0;
  while (i < ranked.length) {
    let j = i;
    while (j + 1 < ranked.length && ranked[j + 1].probability === ranked[i].probability) {
      j++;
    }
    const averageRank = (i + 1 + j + 1) / 2;
    for (let k = i; k <= j; k++) {
      ranks[ranked[k].originalIndex] = averageRank;
    }
    i = j + 1;
  }

  const rankSumPositives = scored.reduce(
    (sum, s, index) => (s.outcome ? sum + ranks[index] : sum),
    0,
  );

  const n1 = positives.length;
  const n0 = negatives.length;
  const u = rankSumPositives - (n1 * (n1 + 1)) / 2;
  return u / (n1 * n0);
}
