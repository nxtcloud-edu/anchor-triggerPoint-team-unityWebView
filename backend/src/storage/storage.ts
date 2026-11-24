import type { State } from '../domain/model';

export const STATE_KEY = 'db/state.json';
export const RAW_PREFIX = 'raw/';

/** S3 버킷(운영)과 로컬 폴더(개발·테스트)가 같은 키 구조를 쓴다 */
export interface Storage {
  readState(): Promise<State | null>;
  writeState(state: State): Promise<void>;
  putRaw(key: string, body: unknown): Promise<void>;
  getRaw(key: string): Promise<unknown>;
  listRaw(): Promise<string[]>;
  /** 이미지 같은 바이너리 */
  putObject(key: string, body: Buffer, contentType: string): Promise<void>;
  /** 없으면 null */
  getObject(key: string): Promise<Buffer | null>;
  /** 접두어 아래 객체를 지우고 지운 개수를 돌려준다 */
  deletePrefix(prefix: string): Promise<number>;
  /** 브라우저가 직접 받을 수 있는 임시 https 주소. 로컬 폴더 저장소는 null */
  presign(key: string, ttlSeconds: number): Promise<string | null>;
}
