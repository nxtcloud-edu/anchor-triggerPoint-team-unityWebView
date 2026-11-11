import { serve } from '@hono/node-server';
import { createApp } from './app';
import { bootstrap } from './bootstrap';

const { config, repo } = await bootstrap();

if (!config.adminPassword || !config.authSecret) {
  console.warn('ADMIN_PASSWORD 또는 AUTH_SECRET이 비어 있어 관리자 로그인이 막혀 있습니다 (.env 확인)');
}
if (config.storage === 'fs') {
  console.warn(`로컬 폴더(${config.dataDir})에 저장합니다. EC2에서는 .env에 STORAGE=s3를 넣으세요`);
}

serve({ fetch: createApp(repo, config).fetch, port: config.port, hostname: '0.0.0.0' }, info => {
  const where = config.storage === 's3' ? `s3://${config.bucket}` : config.dataDir;
  console.log(`Trigger_Point 서버 :${info.port} · 저장소 ${where} · 세션 ${repo.state.sessions.length}개`);
});
