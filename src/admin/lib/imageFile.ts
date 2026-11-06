/**
 * Đọc ảnh giáo viên chọn và thu nhỏ trong trình duyệt (cạnh dài ≤2048px) trước khi gửi,
 * để dưới giới hạn body ~6 MB của Netlify Functions. Xuất JPEG chất lượng cao:
 * rãnh trắng vẫn trắng, file nhỏ hơn PNG nhiều.
 */
const ACCEPT = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_INPUT = 15 * 1024 * 1024;

export async function prepareImage(file: File, maxSide = 2048): Promise<string> {
  if (!ACCEPT.includes(file.type)) throw new Error('Chỉ nhận ảnh PNG, JPG hoặc WEBP');
  if (file.size > MAX_INPUT) throw new Error('Ảnh quá lớn (tối đa 15 MB)');
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', 0.92);
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // trình duyệt chặn clipboard: chọn sẵn chữ để giáo viên tự Ctrl+C
    return false;
  }
}
