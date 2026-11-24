import { readFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import type { UnitySession } from '../src/domain/unity';
import { PHOTO_ASSET_KEYS } from '../src/photos';
import type { Storage } from '../src/storage/storage';

/** 실제 유니티 세션 (에디터 · Stage01 · 10m). hit10: 10발 모두 명중, hit0: 10발 모두 빗나감 */
export const loadFixture = (name: 'hit10' | 'hit0'): UnitySession =>
  JSON.parse(
    readFileSync(path.join(import.meta.dirname, 'fixtures', `unity-session-${name}.json`), 'utf8'),
  ) as UnitySession;

export const withTraces = (
  raw: UnitySession,
  make: (shotIndex: number) => { RightMrad: number[]; UpMrad: number[] },
): UnitySession => ({
  ...raw,
  Shots: raw.Shots.map((shot, i) => ({
    ...shot,
    Trace: { StartMs: -500, StepMs: 20, ...make(i) },
  })),
});

export const SAMPLES = 36;

/** 테스트 저장소에 합성 재료를 올린다 */
export const putAssets = async (storage: Storage) => {
  const assets = await makeAssets();
  await storage.putObject(PHOTO_ASSET_KEYS.target, assets.target, 'image/png');
  await storage.putObject(PHOTO_ASSET_KEYS.sheet, assets.sheet, 'image/png');
};

/** 흰 표적(352×498)과 6칸 모두 검게 칠한 탄흔 시트(171×1026) — 실제 유니티 그림 대신 쓴다 */
export const makeAssets = async () => ({
  target: await sharp({ create: { width: 352, height: 498, channels: 3, background: '#ffffff' } })
    .png()
    .toBuffer(),
  sheet: await sharp({ create: { width: 171, height: 1026, channels: 4, background: '#000000ff' } })
    .png()
    .toBuffer(),
});
