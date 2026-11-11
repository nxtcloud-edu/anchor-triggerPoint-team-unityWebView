/**
 * 저장된 원본(raw/)으로 세션 계산 결과를 다시 만든다. 지표 기준값(METRIC_THRESHOLDS)이나
 * 집계 대상 설정을 바꾼 뒤, 또는 상태 저장이 실패해 대시보드에서 빠진 세션을 되살릴 때 실행한다.
 * 서버가 상태를 덮어쓰지 않도록 서버를 끈 상태에서 실행할 것.
 */
import { bootstrap } from '../bootstrap';

const { repo } = await bootstrap();
const { recomputed, restored } = await repo.recompute();
console.log(`세션 ${recomputed}개를 다시 계산하고, 빠져 있던 ${restored}개를 미배정으로 되살렸습니다`);
