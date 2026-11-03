import { api } from '@/api/axios';
import { handlers } from '@/mocks/handlers';
import { AxiosError, AxiosHeaders, type AxiosAdapter } from 'axios';
import { getResponse } from 'msw';

/**
 * 더미 데이터 어댑터 — axios 요청을 MSW 핸들러로 바로 넘긴다.
 * 서비스 워커를 쓰지 않으므로 HTTP(S3 웹사이트)와 Unity WebView 에서도 동작한다.
 */
export const mockAdapter: AxiosAdapter = async config => {
  const url = new URL(api.getUri(config), window.location.origin);
  const headers = new Headers();
  Object.entries(AxiosHeaders.from(config.headers).toJSON()).forEach(([k, v]) => {
    if (v != null) headers.set(k, String(v));
  });
  const method = (config.method ?? 'get').toUpperCase();
  const body =
    method === 'GET' || method === 'HEAD' ? undefined : (config.data as BodyInit | undefined);
  if (body && !headers.has('content-type')) headers.set('content-type', 'application/json');

  const res = await getResponse(handlers, new Request(url, { method, headers, body }));
  const status = res?.status ?? 404;
  const text = res ? await res.text() : '{"message":"목 핸들러가 없습니다"}';
  const resHeaders: Record<string, string> = {};
  res?.headers.forEach((v, k) => {
    resHeaders[k] = v;
  });
  const response = {
    data: text ? JSON.parse(text) : null,
    status,
    statusText: res?.statusText ?? 'Not Found',
    headers: resHeaders,
    config,
    request: null,
  };
  if (status >= 400) {
    throw new AxiosError(
      `Request failed with status code ${status}`,
      undefined,
      config,
      null,
      response,
    );
  }
  return response;
};
