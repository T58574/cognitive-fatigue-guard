// Biometric Calculations Subsystem for Cognitive Fatigue Evaluation

export function calculateMedian(array) {
  if (!array || array.length === 0) return 0;
  const sorted = [...array].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

export function calculateStandardDeviation(array) {
  if (!array || array.length === 0) return 0;
  const mean = array.reduce((acc, val) => acc + val, 0) / array.length;
  const variance = array.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / array.length;
  return Math.round(Math.sqrt(variance));
}

export function computeFatigueScore({ medianRT, rtvSD, lapses = 0, falseStarts = 0, baselineMedianRT = 260, baselineRTV = 35 }) {
  const rtDiffPerc = Math.max(0, ((medianRT - baselineMedianRT) / baselineMedianRT) * 100);
  const rtvDiffPerc = Math.max(0, ((rtvSD - baselineRTV) / baselineRTV) * 80);
  const penalty = (lapses * 15) + (falseStarts * 12);

  const rawFatigue = Math.round(rtDiffPerc * 0.5 + rtvDiffPerc * 0.3 + penalty);
  return Math.min(100, Math.max(0, rawFatigue));
}

export function evaluateCnsStatus(fatigueScore, lapses, medianRT, baselineMedianRT) {
  if (fatigueScore >= 30 || lapses >= 2 || (medianRT > baselineMedianRT * 1.35)) {
    return 'DEGRADED';
  } else if (fatigueScore >= 15) {
    return 'MILD';
  }
  return 'OPTIMAL';
}
