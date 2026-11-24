/**
 * 저장된 모든 세션(실제·더미)의 표적 사진을 지금 그리기 방식으로 다시 만든다.
 * 사진 모양을 바꾼 뒤 실행한다. 서버가 상태를 덮어쓰지 않도록 서버를 끈 상태에서 실행할 것.
 */
import { bootstrap } from '../bootstrap';

const { repo, photos } = await bootstrap();

if (!photos.enabled) {
  console.error('표적 사진 재료(assets/)가 없어 다시 만들 수 없습니다');
  process.exit(1);
}

console.log('표적 사진을 다시 만드는 중...');
const keys = await photos.renderMany(repo.state.sessions, 8, (done, total) => {
  if (done % 100 === 0 || done === total) console.log(`  ${done}/${total}`);
});
await repo.setPhotoKeys(keys);
console.log(`표적 사진 ${Object.keys(keys).length}장을 다시 만들었습니다`);
