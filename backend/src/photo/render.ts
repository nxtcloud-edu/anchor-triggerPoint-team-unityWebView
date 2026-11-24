import sharp from 'sharp';

/*
 * 유니티 결과 창(ResultUIPresenter · UIBulletHoleMirror)과 같은 그림을 만든다.
 * 결과 창은 표적 이미지(569×805 UI 단위)를 표적 상자 앞면과 1:1로 놓고, 탄흔을
 * 앞면 비율 좌표 × 이미지 크기에 얹는다. 탄흔은 Plane(10) × 0.0006 × BulletScale 4000 = 24 UI 단위.
 */

export const TARGET_STAGE01 = {
  /** Assets/Art/UI/Tablet_ShootingTarget.png 원본 크기 */
  width: 352,
  height: 498,
  /** 이미지 속 채점 링 중심과 1m당 픽셀 — 바깥 링(반지름 0.097m)을 재서 정한 값 */
  ringCx: 174.8,
  ringCy: 236.8,
  pxPerM: 1659,
  /** 탄흔 지름 ÷ 이미지 폭 */
  holeRatio: 24 / 569,
  /** Assets/Art/Bullet_hole/BulletHoleSheet.png 세로 칸 수 (재질 타일링 y = 1/6) */
  frames: 6,
} as const;

export interface PhotoShot {
  hit: boolean;
  /** 채점 중심 기준 m (세션 X, Y) */
  xM: number;
  yM: number;
  /** 결과 창이 쓰는 표적 상자 앞면 비율 좌표 (-0.5 ~ 0.5). 유니티가 보낸 경우에만 */
  faceX?: number;
  faceY?: number;
  index: number;
}

export interface PhotoAssets {
  target: Buffer;
  sheet: Buffer;
}

/** 출력 이미지(원본 × scale) 위의 탄흔 중심 픽셀. 빗나간 탄은 null */
export const holeCenter = (shot: PhotoShot, scale = 2, t = TARGET_STAGE01) => {
  if (!shot.hit) return null;
  if (shot.faceX !== undefined && shot.faceY !== undefined) {
    return { x: (0.5 + shot.faceX) * t.width * scale, y: (0.5 - shot.faceY) * t.height * scale };
  }
  return { x: (t.ringCx + shot.xM * t.pxPerM) * scale, y: (t.ringCy - shot.yM * t.pxPerM) * scale };
};

/** VR은 탄흔 칸을 무작위로 고른다 — 사진은 세션 Id와 탄 번호로 정해서 늘 같은 그림이 되게 한다 */
export const holeFrame = (sessionId: string, index: number, frames: number = TARGET_STAGE01.frames) => {
  let h = 0x811c9dc5;
  for (const ch of `${sessionId}:${index}`) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193) >>> 0;
  return h % frames;
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export const renderTargetPhoto = async (
  sessionId: string,
  shots: PhotoShot[],
  assets: PhotoAssets,
  scale = 2,
): Promise<Buffer> => {
  const t = TARGET_STAGE01;
  const width = t.width * scale;
  const height = t.height * scale;
  const size = Math.round(width * t.holeRatio);

  const sheet = sharp(assets.sheet);
  const { width: sheetW = 0, height: sheetH = 0 } = await sheet.metadata();
  const frameH = sheetH / t.frames;

  // 칸 k 는 UV 아래에서 k번째 = 이미지 위에서 (frames - 1 - k)번째
  const frameCache = new Map<number, Promise<Buffer>>();
  const frameImage = (k: number) => {
    if (!frameCache.has(k)) {
      const top = Math.round(sheetH - (k + 1) * frameH);
      frameCache.set(
        k,
        sharp(assets.sheet)
          .extract({ left: 0, top, width: sheetW, height: Math.round(frameH) })
          .resize(size, size)
          .png()
          .toBuffer(),
      );
    }
    return frameCache.get(k)!;
  };

  // 결과 창이 352×498 원본을 크게 늘려 보여 주듯, 부드럽게 늘린 뒤 탄흔을 얹는다
  const base = await sharp(assets.target).resize(width, height, { kernel: 'lanczos3' }).png().toBuffer();
  const grey = await sharp(base).greyscale().raw().toBuffer();
  const rim = await holeRim(size);

  const rims = [];
  const holes = [];
  for (const shot of shots) {
    const c = holeCenter(shot, scale);
    // 결과 창은 표적 종이(상자 앞면)에 맞은 탄만 그린다 — 종이 밖 좌표는 빼고, 가장자리 탄은 안쪽으로 맞춘다
    if (!c || c.x < 0 || c.y < 0 || c.x > width || c.y > height) continue;
    const left = clamp(Math.round(c.x - size / 2), 0, width - size);
    const top = clamp(Math.round(c.y - size / 2), 0, height - size);
    // 검은 원(7~10점) 위의 탄흔은 검은 바탕에 묻힌다 — 실제 종이처럼 구멍 가장자리를 밝게 비춘다
    if (meanLuminance(grey, width, left, top, size) < DARK_BACKGROUND) rims.push({ input: rim, left, top });
    holes.push({ input: await frameImage(holeFrame(sessionId, shot.index)), left, top });
  }

  // 겹친 탄흔이 다른 탄흔의 밝은 가장자리에 가려지지 않도록 가장자리를 모두 먼저 깐다
  return sharp(base)
    .composite([...rims, ...holes])
    .jpeg({ quality: 85 })
    .toBuffer();
};

/** 이 값보다 어두운 바탕(평균 밝기 0~255)에만 밝은 가장자리를 깐다 */
const DARK_BACKGROUND = 100;

/** 탄흔 칸 안에서 실제 구멍은 60~80% — 그보다 조금 큰 밝은 원을 구멍 밑에 깐다 */
const holeRim = (size: number) => {
  const r = size * 0.45;
  return sharp(
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
        `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="#e9e7e0" fill-opacity="0.92"/></svg>`,
    ),
  )
    .png()
    .toBuffer();
};

const meanLuminance = (grey: Buffer, width: number, left: number, top: number, size: number) => {
  let sum = 0;
  for (let y = top; y < top + size; y++) {
    for (let x = left; x < left + size; x++) sum += grey[y * width + x];
  }
  return sum / (size * size);
};
