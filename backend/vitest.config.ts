import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // 집계 일치 테스트가 화면의 가짜 데이터(시드·집계)를 그대로 불러온다
    alias: { '@': path.resolve(import.meta.dirname, '../frontend/src') },
  },
  test: {
    env: { TZ: 'Asia/Seoul' },
  },
});
