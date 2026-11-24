import sharp from 'sharp';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  holeCenter,
  holeFrame,
  renderTargetPhoto,
  TARGET_STAGE01,
  type PhotoAssets,
  type PhotoShot,
} from '../src/photo/render';
import { makeAssets } from './helpers';

const shot = (over: Partial<PhotoShot>): PhotoShot => ({ hit: true, xM: 0, yM: 0, index: 1, ...over });

const pixelAt = async (jpeg: Buffer, x: number, y: number) => {
  const { data, info } = await sharp(jpeg).greyscale().raw().toBuffer({ resolveWithObject: true });
  return data[Math.round(y) * info.width + Math.round(x)];
};

describe('holeCenter', () => {
  it('uses the scoring-ring calibration for X/Y in metres', () => {
    expect(holeCenter(shot({}), 2)).toEqual({ x: 174.8 * 2, y: 236.8 * 2 });
    const c = holeCenter(shot({ xM: 0.01, yM: 0.02 }), 1)!;
    expect(c.x).toBeCloseTo(174.8 + 16.59, 5);
    expect(c.y).toBeCloseTo(236.8 - 33.18, 5);
  });

  it('prefers the face position the result screen uses', () => {
    expect(holeCenter(shot({ faceX: 0.1, faceY: -0.1 }), 2)).toEqual({ x: 0.6 * 704, y: 0.6 * 996 });
  });

  it('skips misses', () => {
    expect(holeCenter(shot({ hit: false }), 2)).toBeNull();
  });
});

describe('holeFrame', () => {
  it('picks one of 6 frames, always the same for the same shot', () => {
    const frames = Array.from({ length: 30 }, (_, i) => holeFrame('abc', i));
    expect(frames.every(f => f >= 0 && f < TARGET_STAGE01.frames)).toBe(true);
    expect(new Set(frames).size).toBeGreaterThan(1);
    expect(holeFrame('abc', 3)).toBe(holeFrame('abc', 3));
  });
});

describe('renderTargetPhoto', () => {
  let assets: PhotoAssets;
  beforeAll(async () => {
    assets = await makeAssets();
  });

  it('draws holes where the shots hit on a 2x JPEG', async () => {
    const jpeg = await renderTargetPhoto('s1', [shot({}), shot({ faceX: 0.1, faceY: -0.1, index: 2 })], assets);
    const meta = await sharp(jpeg).metadata();
    expect(meta.format).toBe('jpeg');
    expect([meta.width, meta.height]).toEqual([704, 996]);

    expect(await pixelAt(jpeg, 174.8 * 2, 236.8 * 2)).toBeLessThan(60);
    expect(await pixelAt(jpeg, 0.6 * 704, 0.6 * 996)).toBeLessThan(60);
    expect(await pixelAt(jpeg, 40, 40)).toBeGreaterThan(200);
  });

  it('draws nothing for misses or an empty session', async () => {
    const jpeg = await renderTargetPhoto('s2', [shot({ hit: false })], assets);
    expect(await pixelAt(jpeg, 174.8 * 2, 236.8 * 2)).toBeGreaterThan(200);
  });

  it('leaves out holes off the paper and keeps edge holes inside the image', async () => {
    const off = await renderTargetPhoto('s3', [shot({ xM: 5, yM: -5 })], assets);
    expect(await pixelAt(off, 700, 992)).toBeGreaterThan(200);

    const edge = await renderTargetPhoto('s3', [shot({ faceX: 0.499, faceY: -0.499 })], assets);
    expect(await pixelAt(edge, 700, 992)).toBeLessThan(60);
  });

  it('is the same picture for the same input', async () => {
    const shots = [shot({ xM: 0.02 }), shot({ yM: -0.03, index: 2 })];
    expect(await renderTargetPhoto('s4', shots, assets)).toEqual(await renderTargetPhoto('s4', shots, assets));
  });
});
