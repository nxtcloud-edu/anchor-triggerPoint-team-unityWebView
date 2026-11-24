import { createHmac } from 'node:crypto';
import { safeEqual } from './auth';
import type { Config } from './config';
import type { StoredSession } from './domain/model';
import type { UnitySession } from './domain/unity';
import { renderTargetPhoto, type PhotoAssets, type PhotoShot } from './photo/render';
import type { Repo } from './repo';
import type { Storage } from './storage/storage';

/** 유니티 에셋은 공개 저장소에 넣지 않고 저장소(S3)에 한 번 올려 둔다 */
export const PHOTO_ASSET_KEYS = {
  target: 'assets/stage01-target.png',
  sheet: 'assets/bullet-hole-sheet.png',
} as const;

const URL_TTL_SECONDS = 3600;

const photoKeyOf = (s: StoredSession) => (s.dummy ? `photos/dummy/${s.id}.jpg` : `photos/${s.id}.jpg`);

/** 실내 영점 표적에서 탄창을 다 쏜 세션(대시보드에 보이는 세션)만 사진을 만든다 */
const eligible = (s: StoredSession) => s.counted;

/**
 * 세션별 표적 사진. 결과 창과 같은 그림을 만들어 저장소에 두고, 상태에는 키만 남긴다.
 * 수신 직후·열람 시 요청을 한 줄로 세워 백그라운드에서 만든다.
 */
export class Photos {
  private pending = new Set<string>();
  private chain: Promise<void> = Promise.resolve();

  private constructor(
    private readonly storage: Storage,
    private readonly repo: Repo,
    private readonly assets: PhotoAssets | null,
    private readonly secret: string,
    /** true 면 S3에서도 임시 주소 대신 서버가 서명 주소로 직접 내준다 */
    private readonly proxy: boolean,
  ) {}

  static async create(storage: Storage, repo: Repo, config: Config) {
    const [target, sheet] = await Promise.all([
      storage.getObject(PHOTO_ASSET_KEYS.target),
      storage.getObject(PHOTO_ASSET_KEYS.sheet),
    ]);
    if (!target || !sheet) {
      console.warn(
        `표적 사진 재료가 없어 사진 기능을 끕니다 (${PHOTO_ASSET_KEYS.target}, ${PHOTO_ASSET_KEYS.sheet})`,
      );
    }
    return new Photos(
      storage,
      repo,
      target && sheet ? { target, sheet } : null,
      config.authSecret,
      config.photoProxy,
    );
  }

  get enabled() {
    return this.assets !== null;
  }

  /**
   * 원본이 있으면 유니티가 보낸 앞면 좌표까지 쓰고, 없으면(더미) 상태에 남은 탄착(cm)으로 그린다.
   * 탄흔 모양은 명중 순서로 고른다 — 어느 경로로 만들어도 같은 세션은 같은 사진이 되게.
   */
  private async shotsOf(s: StoredSession): Promise<PhotoShot[]> {
    if (!s.dummy) {
      try {
        const raw = (await this.storage.getRaw(s.rawKey)) as UnitySession;
        return raw.Shots.filter(shot => shot.Hit).map((shot, i) => ({
          hit: true,
          xM: shot.X,
          yM: shot.Y,
          index: i + 1,
          ...(shot.HasFace ? { faceX: shot.FaceX, faceY: shot.FaceY } : {}),
        }));
      } catch {
        // 원본을 못 읽으면 아래 요약 좌표로 그린다
      }
    }
    return (s.rounds[0]?.shots ?? []).map((shot, i) => ({
      hit: true,
      xM: shot.x / 100,
      yM: shot.y / 100,
      index: i + 1,
    }));
  }

  private async render(s: StoredSession) {
    const jpeg = await renderTargetPhoto(s.id, await this.shotsOf(s), this.assets!);
    const key = photoKeyOf(s);
    await this.storage.putObject(key, jpeg, 'image/jpeg');
    return key;
  }

  /** 사진이 없으면 백그라운드에서 만든다. 같은 세션은 한 번만 */
  enqueue(sessionId: string) {
    if (!this.enabled || this.pending.has(sessionId)) return;
    this.pending.add(sessionId);
    this.chain = this.chain.then(async () => {
      try {
        const s = this.repo.state.sessions.find(x => x.id === sessionId);
        if (!s || s.photoKey || !eligible(s)) return;
        await this.repo.setPhotoKeys({ [sessionId]: await this.render(s) });
      } catch (error) {
        console.error(`표적 사진을 만들지 못했습니다 (${sessionId})`, error);
      } finally {
        this.pending.delete(sessionId);
      }
    });
  }

  /** 줄에 선 사진을 다 만들 때까지 기다린다 (테스트·스크립트용) */
  idle() {
    return this.chain;
  }

  /** 여러 세션을 동시에 만든다 (더미 넣기). 세션 Id → 사진 키 */
  async renderMany(
    sessions: readonly StoredSession[],
    concurrency = 8,
    onProgress?: (done: number, total: number) => void,
  ): Promise<Record<string, string>> {
    const targets = this.enabled ? sessions.filter(eligible) : [];
    const keys: Record<string, string> = {};
    let next = 0;
    let done = 0;
    const worker = async () => {
      while (next < targets.length) {
        const s = targets[next++];
        keys[s.id] = await this.render(s);
        onProgress?.(++done, targets.length);
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, targets.length) }, worker));
    return keys;
  }

  private sign(sessionId: string, exp: string) {
    return createHmac('sha256', this.secret).update(`photo:${sessionId}:${exp}`).digest('base64url');
  }

  /** S3면 1시간짜리 https 임시 주소, 로컬 폴더면 서버가 서명해서 직접 내주는 주소 */
  async urlFor(s: StoredSession, now: Date): Promise<string | undefined> {
    if (!this.enabled || !s.photoKey) return undefined;
    const presigned = this.proxy ? null : await this.storage.presign(s.photoKey, URL_TTL_SECONDS);
    if (presigned) return presigned;
    const exp = String(Math.floor(now.getTime() / 1000) + URL_TTL_SECONDS);
    return `/api/photos/${encodeURIComponent(s.id)}?exp=${exp}&sig=${this.sign(s.id, exp)}`;
  }

  verifyLocal(sessionId: string, exp: string, sig: string, now: Date) {
    return Number(exp) * 1000 > now.getTime() && safeEqual(sig, this.sign(sessionId, exp));
  }

  /** 더미 사진 폴더를 비운다. 지운 개수 */
  clearDummy() {
    return this.storage.deletePrefix('photos/dummy/');
  }

  /** 로컬 폴더 저장소에서 사진 바이트를 읽는다 */
  async read(s: StoredSession) {
    return s.photoKey ? this.storage.getObject(s.photoKey) : null;
  }
}
