/** Đọc biến môi trường; thiếu thì báo lỗi rõ tên biến. Danh sách đầy đủ: .env.example */
export function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Thiếu biến môi trường ${name} (xem .env.example)`);
  return v;
}

export function envOptional(name: string): string | undefined {
  return process.env[name] || undefined;
}
