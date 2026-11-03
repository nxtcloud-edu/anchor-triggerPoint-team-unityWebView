export const SERVER_URL = (import.meta.env.VITE_SERVER_URL as string | undefined) ?? '';

/**
 * 목(더미 데이터) 모드 — 기본값 true. 'false' 로 줄 때만 실제 서버로 보낸다.
 * 실제 배포할 때는 반드시 VITE_USE_MOCK=false 로 빌드한다.
 */
export const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';

export const apiUrl = (path: string) => `${USE_MOCK ? '' : SERVER_URL}/api${path}`;
