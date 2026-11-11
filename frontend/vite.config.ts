import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, import.meta.dirname, 'VITE_');
  // VITE_SERVER_URL 을 비우면 화면은 같은 주소의 /api 로 요청하고, 개발 서버가 데이터 서버로 넘긴다
  const proxy = { '/api': env.VITE_PROXY_TARGET || 'http://localhost:80' };

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { '@': path.resolve(import.meta.dirname, 'src') },
    },
    server: { proxy },
    preview: { proxy },
  };
});
