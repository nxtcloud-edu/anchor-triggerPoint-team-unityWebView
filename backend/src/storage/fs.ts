import { mkdir, readdir, readFile, rename, writeFile } from 'node:fs/promises';
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

  const writeJson = async (key: string, body: unknown) => {
    const target = file(key);
    await mkdir(path.dirname(target), { recursive: true });
    // 쓰다가 끊겨도 기존 파일이 깨지지 않게 임시 파일에 쓰고 바꿔 넣는다
    const temp = `${target}.tmp`;
    await writeFile(temp, JSON.stringify(body), 'utf8');
    await rename(temp, target);
  };

  const readJson = async (key: string) => JSON.parse(await readFile(file(key), 'utf8')) as unknown;

  return {
    async readState() {
      try {
        return (await readJson(STATE_KEY)) as State;
      } catch (error) {
        if (isMissing(error)) return null;
        throw error;
      }
    },
    writeState: state => writeJson(STATE_KEY, state),
    putRaw: (key, body) => writeJson(key, body),
    getRaw: key => readJson(key),
    async listRaw() {
      try {
        const entries = await readdir(path.join(root, RAW_PREFIX), { recursive: true, withFileTypes: true });
        return entries
          .filter(e => e.isFile() && e.name.endsWith('.json'))
          .map(e => path.relative(root, path.join(e.parentPath, e.name)).split(path.sep).join('/'))
          .sort();
      } catch (error) {
        if (isMissing(error)) return [];
        throw error;
      }
    },
  };
};
