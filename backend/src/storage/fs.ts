import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { State } from '../domain/model';
import { RAW_PREFIX, STATE_KEY, type Storage } from './storage';

const isMissing = (error: unknown) => (error as NodeJS.ErrnoException).code === 'ENOENT';

export const createFsStorage = (dir: string): Storage => {
  const root = path.resolve(dir);
  // 서버가 sudo로 돌기 때문에 저장 폴더 밖을 가리키는 키(.. 등)는 읽지도 쓰지도 않는다
  const file = (key: string) => {
    const target = path.resolve(root, ...key.split('/'));
    if (!target.startsWith(root + path.sep)) throw new Error(`저장소 밖을 가리키는 키입니다: ${key}`);
    return target;
  };

  const write = async (key: string, body: string | Buffer) => {
    const target = file(key);
    await mkdir(path.dirname(target), { recursive: true });
    // 쓰다가 끊겨도 기존 파일이 깨지지 않게 임시 파일에 쓰고 바꿔 넣는다
    const temp = `${target}.tmp`;
    await writeFile(temp, body);
    await rename(temp, target);
  };

  const readJson = async (key: string) => JSON.parse(await readFile(file(key), 'utf8')) as unknown;

  /** 접두어 폴더 아래 파일 키 목록 */
  const listFiles = async (prefix: string, extension = '') => {
    try {
      const entries = await readdir(file(prefix), { recursive: true, withFileTypes: true });
      return entries
        .filter(e => e.isFile() && e.name.endsWith(extension) && !e.name.endsWith('.tmp'))
        .map(e => path.relative(root, path.join(e.parentPath, e.name)).split(path.sep).join('/'))
        .sort();
    } catch (error) {
      if (isMissing(error)) return [];
      throw error;
    }
  };

  return {
    async readState() {
      try {
        return (await readJson(STATE_KEY)) as State;
      } catch (error) {
        if (isMissing(error)) return null;
        throw error;
      }
    },
    writeState: state => write(STATE_KEY, JSON.stringify(state)),
    putRaw: (key, body) => write(key, JSON.stringify(body)),
    getRaw: key => readJson(key),
    listRaw: () => listFiles(RAW_PREFIX, '.json'),
    putObject: (key, body) => write(key, body),
    async getObject(key) {
      try {
        return await readFile(file(key));
      } catch (error) {
        if (isMissing(error)) return null;
        throw error;
      }
    },
    async deletePrefix(prefix) {
      const keys = await listFiles(prefix);
      await rm(file(prefix), { recursive: true, force: true });
      return keys.length;
    },
    presign: async () => null,
  };
};
