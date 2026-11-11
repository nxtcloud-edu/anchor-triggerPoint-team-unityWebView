import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { UnitySession } from '../src/domain/unity';

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
