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
}
