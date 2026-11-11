import { describe, expect, it } from 'vitest';
import { computeMetrics, correctionOf, scoreOf } from '../src/domain/metrics';
import { loadFixture, SAMPLES, withTraces } from './helpers';

describe('scoreOf', () => {
  it('maps good to 99, bad to 15 and clamps outside', () => {
    expect(scoreOf(0.3, 0.3, 3)).toBe(99);
    expect(scoreOf(0, 0.3, 3)).toBe(99);
    expect(scoreOf(3, 0.3, 3)).toBe(15);
    expect(scoreOf(30, 0.3, 3)).toBe(15);
  });
});

describe('computeMetrics', () => {
  it('scores still muzzle traces 99 for aim, breath and trigger', () => {
    const metrics = computeMetrics(loadFixture('hit10'));
    expect(metrics.slice(0, 3)).toEqual([99, 99, 99]);
    expect(metrics).toHaveLength(5);
  });

  it('lowers aim score for a wobbling muzzle', () => {
    const wobble = Array.from({ length: SAMPLES }, (_, k) => (k % 2 ? 1.5 : -1.5));
    const raw = withTraces(loadFixture('hit10'), () => ({
      RightMrad: wobble,
      UpMrad: Array(SAMPLES).fill(0),
    }));
    expect(computeMetrics(raw)[0]).toBeLessThan(70);
  });

  it('uses 50 when no shot has a usable trace', () => {
    const raw = withTraces(loadFixture('hit10'), () => ({ RightMrad: [], UpMrad: [] }));
    expect(computeMetrics(raw).slice(0, 3)).toEqual([50, 50, 50]);
  });

  it('skips shots whose trace is empty (last shot saved before +200ms)', () => {
    const still = Array(SAMPLES).fill(0);
    const raw = withTraces(loadFixture('hit10'), i =>
      i === 9 ? { RightMrad: [], UpMrad: [] } : { RightMrad: still, UpMrad: still },
    );
    expect(computeMetrics(raw).slice(0, 3)).toEqual([99, 99, 99]);
  });

  it('gives consistency 15 with fewer than 3 hits', () => {
    expect(computeMetrics(loadFixture('hit0'))[4]).toBe(15);
  });
});

describe('correctionOf', () => {
  it('picks the weakest of aim, breath and posture only', () => {
    expect(correctionOf([50, 40, 10, 60, 90])).toBe(1);
    expect(correctionOf([30, 40, 10, 60, 90])).toBe(0);
    expect(correctionOf([80, 90, 10, 20, 90])).toBe(2);
  });
});
