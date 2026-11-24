/**
 * 발표용 더미 200명(10개 소대 × 20명)과 세션을 넣는다. 이전 더미는 지우고 오늘 기준 지난 30일로 새로 만든다.
 * 표적 사진 재료가 저장소에 있으면 더미 세션마다 사진도 만들어 photos/dummy/ 에 둔다.
 * --clear 를 붙이면 더미(와 더미 사진)만 지운다. 실제 명단·세션은 그대로 남는다.
 * 서버가 상태를 덮어쓰지 않도록 서버를 끈 상태에서 실행할 것.
 */
import { bootstrap } from '../bootstrap';
import { generateDummy } from '../domain/dummy';

const { repo, photos } = await bootstrap();

const clearDummyPhotos = async () => {
  try {
    return await photos.clearDummy();
  } catch (error) {
    console.warn(`더미 사진을 지우지 못했습니다 (S3 삭제 권한 확인). ${(error as Error).message}`);
    return 0;
  }
};

if (process.argv.includes('--clear')) {
  const { members, sessions } = await repo.clearDummy();
  const removed = await clearDummyPhotos();
  console.log(`더미 ${members}명, 세션 ${sessions}개, 사진 ${removed}장을 지웠습니다. 실제 기록은 그대로입니다`);
} else {
  await clearDummyPhotos();
  const existingIds = new Set(repo.state.members.filter(m => !m.dummy).map(m => m.id));
  const { members, sessions } = await repo.seedDummy(generateDummy(new Date(), { existingIds }));
  console.log(`더미 ${members}명과 세션 ${sessions}개를 넣었습니다 (이전 더미는 지움)`);

  if (photos.enabled) {
    console.log('더미 세션의 표적 사진을 만드는 중...');
    const keys = await photos.renderMany(
      repo.state.sessions.filter(s => s.dummy),
      8,
      (done, total) => {
        if (done % 100 === 0 || done === total) console.log(`  ${done}/${total}`);
      },
    );
    await repo.setPhotoKeys(keys);
    console.log(`표적 사진 ${Object.keys(keys).length}장을 저장했습니다`);
  } else {
    console.log('표적 사진 재료(assets/)가 없어 사진은 건너뜁니다');
  }
}
