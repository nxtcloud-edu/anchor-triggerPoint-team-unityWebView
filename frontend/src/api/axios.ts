import { USE_MOCK, SERVER_URL } from '@/api/config';
import { ApiRequestError } from '@/api/errors';
import { clearToken, getToken } from '@/utils/auth';
import axios, { AxiosError } from 'axios';

export const api = axios.create({
  baseURL: `${USE_MOCK ? '' : SERVER_URL}/api`,
  timeout: 15000,
});

api.interceptors.request.use(config => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  res => res,
  (err: AxiosError<{ message?: string }>) => {
    const status = err.response?.status ?? 0;
    if (status === 401) clearToken();
    const message = err.response?.data?.message ?? err.message ?? '요청에 실패했습니다';
    return Promise.reject(new ApiRequestError(message, status));
  },
);
