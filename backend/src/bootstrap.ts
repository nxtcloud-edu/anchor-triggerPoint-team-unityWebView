import { loadConfig, type Config } from './config';
import { Photos } from './photos';
import { Repo } from './repo';
import { createFsStorage } from './storage/fs';
import { createS3Storage } from './storage/s3';

/** .env를 읽고 설정·저장소·상태·사진 서비스를 연다 (서버와 스크립트가 같이 쓴다) */
export const bootstrap = async (): Promise<{ config: Config; repo: Repo; photos: Photos }> => {
  try {
    process.loadEnvFile('.env');
  } catch {
    // .env가 없으면 이미 설정된 환경 변수만 쓴다
  }

  const config = loadConfig();
  const storage =
    config.storage === 's3' ? createS3Storage(config.bucket, config.region) : createFsStorage(config.dataDir);
  const repo = await Repo.open(storage, config);

  return { config, repo, photos: await Photos.create(storage, repo, config) };
};
