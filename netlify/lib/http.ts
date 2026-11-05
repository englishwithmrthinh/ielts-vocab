/** Tiện ích HTTP cho Netlify Functions (dạng v2: nhận Request, trả Response). */
import type { ApiError } from '../../shared/types';

export class HttpError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
}

export function errorResponse(e: unknown): Response {
  if (e instanceof HttpError) {
    return json({ error: e.message, code: e.code } satisfies ApiError, e.status);
  }
  console.error(e);
  return json({ error: 'Có lỗi phía máy chủ, thử lại sau.', code: 'server_error' } satisfies ApiError, 500);
}

/** Bọc handler: bắt lỗi, kiểm tra method */
export function handler(
  methods: string[],
  fn: (req: Request) => Promise<Response>,
): (req: Request) => Promise<Response> {
  return async (req) => {
    try {
      if (!methods.includes(req.method)) throw new HttpError(405, 'method_not_allowed', 'Phương thức không hỗ trợ');
      return await fn(req);
    } catch (e) {
      return errorResponse(e);
    }
  };
}

export async function readJson<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError(400, 'bad_json', 'Dữ liệu gửi lên không hợp lệ');
  }
}
