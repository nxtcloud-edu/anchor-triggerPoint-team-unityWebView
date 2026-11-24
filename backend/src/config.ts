export interface Config {
  port: number;
  storage: 'fs' | 's3';
  dataDir: string;
  bucket: string;
  region: string;
  adminUsername: string;
  adminPassword: string;
  authSecret: string;
  corsOrigins: string[];
  ingestKey?: string;
  clickCmAt100mH: number;
  clickCmAt100mV: number;
  countedProfiles: string[];
  /** 값이 있으면 시작할 때 저장된 시뮬레이터 대수를 이 값으로 바꾼다 */
  simulatorCount?: number;
  /** S3 임시 주소가 브라우저에서 열리지 않을 때, 서버가 사진을 직접 내주도록 바꾼다 */
  photoProxy: boolean;
}

const list = (value: string | undefined, fallback: string[] = []) =>
  value
    ? value
        .split(',')
        .map(v => v.trim())
        .filter(Boolean)
    : fallback;

const num = (value: string | undefined, fallback: number) => {
  const n = Number(value);
  return value && Number.isFinite(n) ? n : fallback;
};

/** 오타가 나면 조용히 로컬 디스크에 쌓이지 않도록 모르는 값은 거부한다 */
const storageOf = (value: string | undefined): Config['storage'] => {
  const v = (value ?? '').trim().toLowerCase();
  if (v === '' || v === 'fs') return 'fs';
  if (v === 's3') return 's3';
  throw new Error(`STORAGE는 s3 또는 fs여야 합니다 (지금 값: ${value})`);
};

export const loadConfig = (env: NodeJS.ProcessEnv = process.env): Config => {
  // 일별 집계와 날짜 라벨을 한국 시간으로 자른다
  process.env.TZ ??= 'Asia/Seoul';

  return {
    port: num(env.PORT, 80),
    storage: storageOf(env.STORAGE),
    dataDir: env.DATA_DIR || './data',
    bucket: env.S3_BUCKET || 'anchor-edu-01-s3',
    region: env.AWS_REGION || 'us-east-1',
    adminUsername: env.ADMIN_USERNAME || 'admin',
    adminPassword: env.ADMIN_PASSWORD ?? '',
    authSecret: env.AUTH_SECRET ?? '',
    corsOrigins: list(env.CORS_ORIGINS),
    ingestKey: env.INGEST_KEY || undefined,
    clickCmAt100mH: num(env.CLICK_CM_AT_100M_H, 3),
    clickCmAt100mV: num(env.CLICK_CM_AT_100M_V, 3),
    countedProfiles: list(env.COUNTED_TARGET_PROFILES, ['IndoorTargetScore']),
    simulatorCount: env.SIMULATOR_COUNT ? Math.max(1, Math.floor(num(env.SIMULATOR_COUNT, 1))) : undefined,
    photoProxy: env.PHOTO_PROXY === 'true',
  };
};
