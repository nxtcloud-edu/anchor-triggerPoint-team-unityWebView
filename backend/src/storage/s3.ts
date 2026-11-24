import {
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { State } from '../domain/model';
import { RAW_PREFIX, STATE_KEY, type Storage } from './storage';

/** 자격 증명은 EC2 역할(SafeRole)에서 SDK가 자동으로 얻는다 */
export const createS3Storage = (bucket: string, region: string): Storage => {
  const s3 = new S3Client({ region });

  // 버킷 기본 암호화와 별개로, 올리는 객체마다 서버 쪽 암호화를 명시한다
  const put = (key: string, body: string | Buffer, contentType: string) =>
    s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        ServerSideEncryption: 'AES256',
      }),
    );

  const putJson = (key: string, body: unknown) =>
    put(key, JSON.stringify(body), 'application/json; charset=utf-8');

  const getJson = async (key: string) => {
    const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    return JSON.parse(await res.Body!.transformToString('utf-8')) as unknown;
  };

  const listKeys = async (prefix: string) => {
    const keys: string[] = [];
    let token: string | undefined;
    do {
      const res = await s3.send(
        new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: token }),
      );
      for (const item of res.Contents ?? []) if (item.Key) keys.push(item.Key);
      token = res.IsTruncated ? res.NextContinuationToken : undefined;
    } while (token);
    return keys.sort();
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
    listRaw: () => listKeys(RAW_PREFIX),
    async putObject(key, body, contentType) {
      await put(key, body, contentType);
    },
    async getObject(key) {
      try {
        const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        return Buffer.from(await res.Body!.transformToByteArray());
      } catch (error) {
        if (error instanceof NoSuchKey) return null;
        throw error;
      }
    },
    async deletePrefix(prefix) {
      const keys = await listKeys(prefix);
      for (let i = 0; i < keys.length; i += 1000) {
        await s3.send(
          new DeleteObjectsCommand({
            Bucket: bucket,
            Delete: { Objects: keys.slice(i, i + 1000).map(Key => ({ Key })), Quiet: true },
          }),
        );
      }
      return keys.length;
    },
    presign: (key, ttlSeconds) =>
      getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: ttlSeconds }),
  };
};
