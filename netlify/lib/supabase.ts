/** Client Supabase phía server (service key). KHÔNG import file này từ src/. */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from './env';

let client: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (!client) {
    client = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

/** Ném lỗi nếu truy vấn Supabase lỗi, trả về data */
export function must<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

/** Đọc hết mọi dòng (Supabase trả tối đa 1000 dòng/lần) — gọi q(from, to) với .range(from, to). */
export async function allRows<T>(q: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const rows = must(await q(from, from + 999) as never) as T[];
    out.push(...rows);
    if (rows.length < 1000) return out;
  }
}
