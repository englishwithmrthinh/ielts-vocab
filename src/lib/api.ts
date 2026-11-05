/**
 * Gọi API từ trình duyệt — chủ sở hữu: Sếp. Dùng chung cho mọi khu.
 *   const home = await api<HomeResponse>('GET', '/api/home');
 * Lỗi ném ApiCallError có `status` và `code` (xem ApiError trong shared/types).
 */
import type { ApiError } from '@shared/types';

export class ApiCallError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export async function api<T>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) {
    const e = (data ?? {}) as Partial<ApiError>;
    throw new ApiCallError(res.status, e.code ?? 'http_' + res.status, e.error ?? 'Không kết nối được máy chủ');
  }
  return data as T;
}
