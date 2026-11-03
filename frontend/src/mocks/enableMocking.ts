import { api } from '@/api/axios';
import { USE_MOCK } from '@/api/config';

/** VITE_USE_MOCK=true 일 때만 더미 데이터 어댑터를 붙인다 */
export const enableMocking = async () => {
  if (!USE_MOCK) return;
  const { mockAdapter } = await import('@/mocks/mockAdapter');
  api.defaults.adapter = mockAdapter;
};
