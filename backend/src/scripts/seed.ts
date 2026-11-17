/**
 * 발표용 더미 200명(10개 소대 × 20명)과 세션을 넣는다. 이전 더미는 지우고 오늘 기준 지난 30일로 새로 만든다.
 * --clear 를 붙이면 더미만 지운다. 실제 명단·세션은 그대로 남는다.
 * 서버가 상태를 덮어쓰지 않도록 서버를 끈 상태에서 실행할 것.
 */
import { bootstrap } from '../bootstrap';
import { generateDummy } from '../domain/dummy';

const { repo } = await bootstrap();

if (process.argv.includes('--clear')) {
  const { members, sessions } = await repo.clearDummy();
  console.log(`더미 ${members}명과 세션 ${sessions}개를 지웠습니다. 실제 기록은 그대로입니다`);
} else {
  const existingIds = new Set(repo.state.members.filter(m => !m.dummy).map(m => m.id));
  const { members, sessions } = await repo.seedDummy(generateDummy(new Date(), { existingIds }));
  console.log(`더미 ${members}명과 세션 ${sessions}개를 넣었습니다 (이전 더미는 지움)`);
}
