import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config';

describe('loadConfig', () => {
  it('defaults to fs storage and accepts s3 in any case', () => {
    expect(loadConfig({}).storage).toBe('fs');
    expect(loadConfig({ STORAGE: 'S3' }).storage).toBe('s3');
    expect(loadConfig({ STORAGE: ' fs ' }).storage).toBe('fs');
  });

  it('refuses an unknown storage instead of silently using the local disk', () => {
    expect(() => loadConfig({ STORAGE: 's3 bucket' })).toThrow('STORAGE');
  });
});
