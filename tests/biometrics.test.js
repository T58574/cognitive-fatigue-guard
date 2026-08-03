import { describe, it, expect } from 'vitest';
import {
  calculateMedian,
  calculateStandardDeviation,
  computeFatigueScore,
  evaluateCnsStatus
} from '../src/modules/biometrics.js';

describe('Biometric Math & CNS Degradation Tests', () => {
  it('correctly calculates median reaction time for odd and even length arrays', () => {
    expect(calculateMedian([250, 260, 270])).toBe(260);
    expect(calculateMedian([200, 300, 220, 280])).toBe(250);
  });

  it('correctly computes standard deviation (RTV variability)', () => {
    const times = [250, 250, 250, 250];
    expect(calculateStandardDeviation(times)).toBe(0);

    const variableTimes = [200, 300];
    expect(calculateStandardDeviation(variableTimes)).toBe(50);
  });

  it('evaluates OPTIMAL status for normal healthy reaction times', () => {
    const fatigue = computeFatigueScore({
      medianRT: 255,
      rtvSD: 30,
      lapses: 0,
      falseStarts: 0,
      baselineMedianRT: 260,
      baselineRTV: 35
    });

    const status = evaluateCnsStatus(fatigue, 0, 255, 260);

    expect(fatigue).toBeLessThan(15);
    expect(status).toBe('OPTIMAL');
  });

  it('triggers DEGRADED status upon attentional lapses or high RTV spikes', () => {
    const fatigue = computeFatigueScore({
      medianRT: 370,
      rtvSD: 85,
      lapses: 2,
      falseStarts: 1,
      baselineMedianRT: 260,
      baselineRTV: 35
    });

    const status = evaluateCnsStatus(fatigue, 2, 370, 260);

    expect(fatigue).toBeGreaterThanOrEqual(30);
    expect(status).toBe('DEGRADED');
  });
});
