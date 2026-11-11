import {
  GetObjectCommand,
  ListObjectsV2Command,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import type { State } from '../domain/model';
import { RAW_PREFIX, STATE_KEY, type Storage } from './storage';

/** 자격 증명은 EC2 역할(SafeRole)에서 SDK가 자동으로 얻는다 */
export const createS3Storage = (bucket: string, region: string): Storage => {
  const s3 = new S3Client({ region });

  const putJson = (key: string, body: unknown) =>
    s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: JSON.stringify(body),
        ContentType: 'application/json; charset=utf-8',
      }),
    );

  const getJson = async (key: string) => {
    const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    return JSON.parse(await res.Body!.transformToString('utf-8')) as unknown;
  };

  return {
    async readState() {
      try {
        return (await getJson(STATE_KEY)) as State;
      } catch (error) {
        if (error instanceof NoSuchKey) return null;
        throw error;
      }
    },
    async writeState(state) {
      await putJson(STATE_KEY, state);
    },
    async putRaw(key, body) {
      await putJson(key, body);
    },
    getRaw: key => getJson(key),
    async listRaw() {
      const keys: string[] = [];
      let token: string | undefined;
      do {
        const res = await s3.send(
          new ListObjectsV2Command({ Bucket: bucket, Prefix: RAW_PREFIX, ContinuationToken: token }),
        );
        for (const item of res.Contents ?? []) if (item.Key) keys.push(item.Key);
        token = res.IsTruncated ? res.NextContinuationToken : undefined;
      } while (token);
      return keys.sort();
    },
  };
};
