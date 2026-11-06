/**
 * Cắt ảnh lưới theo RÃNH TRẮNG THẬT (không cắt mù theo tỷ lệ).
 *
 * 1. Đổi ảnh sang xám, quét từng hàng / cột: tỷ lệ điểm "gần trắng".
 * 2. Hàng (cột) có ≥ WHITE_FRACTION điểm gần trắng là rãnh. Các dải nội dung
 *    nằm giữa các rãnh là hàng (cột) ô.
 * 3. Bỏ dải quá mỏng (vệt nhiễu), kiểm tra số hàng × số cột đúng yêu cầu và
 *    kích thước các dải không lệch nhau quá nhiều.
 * 4. Đúng thì cắt từng ô, chừa viền ~2% mỗi phía, xuất webp.
 *
 * Hàm thuần (vào: Buffer ảnh, ra: Buffer từng ô) để test không cần mạng.
 */
import sharp from 'sharp';

export interface GridSpec { cols: number; rows: number }

export interface Band { start: number; end: number } // [start, end) theo pixel

export type GridDetect =
  | { ok: true; rows: Band[]; cols: Band[]; width: number; height: number }
  | { ok: false; reason: string; foundRows: number; foundCols: number };

const WHITE_LEVEL = 232;      // xám ≥ mức này coi là gần trắng
const WHITE_FRACTION = 0.97;  // tỷ lệ điểm gần trắng để coi cả hàng/cột là rãnh
const MIN_BAND_FRAC = 0.04;   // dải nội dung mỏng hơn 4% cạnh ảnh là nhiễu
const MAX_SIZE_SKEW = 0.45;   // mỗi dải lệch tối đa ±45% so với trung vị
const ANALYSIS_SIZE = 1000;   // thu nhỏ để quét nhanh (đỡ tốn thời gian function)

function bands(profile: number[], length: number): Band[] {
  const out: Band[] = [];
  let start = -1;
  for (let i = 0; i <= length; i++) {
    const content = i < length && profile[i]! < WHITE_FRACTION;
    if (content && start < 0) start = i;
    if (!content && start >= 0) {
      out.push({ start, end: i });
      start = -1;
    }
  }
  const min = Math.max(2, Math.round(length * MIN_BAND_FRAC));
  return out.filter((b) => b.end - b.start >= min);
}

function skewed(list: Band[]): boolean {
  const sizes = list.map((b) => b.end - b.start).sort((a, b) => a - b);
  const median = sizes[Math.floor(sizes.length / 2)]!;
  return sizes.some((s) => Math.abs(s - median) / median > MAX_SIZE_SKEW);
}

/** Tìm lưới thật trong ảnh. Toạ độ trả về theo kích thước ảnh gốc. */
export async function detectGrid(image: Buffer, spec: GridSpec): Promise<GridDetect> {
  const meta = await sharp(image).metadata();
  const W = meta.width ?? 0;
  const H = meta.height ?? 0;
  if (!W || !H) return { ok: false, reason: 'Không đọc được ảnh', foundRows: 0, foundCols: 0 };

  const scale = Math.min(1, ANALYSIS_SIZE / Math.max(W, H));
  const w = Math.max(1, Math.round(W * scale));
  const h = Math.max(1, Math.round(H * scale));
  const { data } = await sharp(image).flatten({ background: '#ffffff' }).resize(w, h, { fit: 'fill' }).greyscale().raw().toBuffer({ resolveWithObject: true });

  const rowWhite = new Array<number>(h).fill(0);
  const colWhite = new Array<number>(w).fill(0);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[y * w + x]! >= WHITE_LEVEL) {
        rowWhite[y]!++;
        colWhite[x]!++;
      }
    }
  }
  const rowProfile = rowWhite.map((c) => c / w);
  const colProfile = colWhite.map((c) => c / h);

  const rows = bands(rowProfile, h);
  const cols = bands(colProfile, w);
  const fail = (reason: string): GridDetect => ({ ok: false, reason, foundRows: rows.length, foundCols: cols.length });

  // Model hay vẽ xoay (5 cột × 4 hàng thay vì 4×5): chấp nhận khi đúng số ô.
  const exact = rows.length === spec.rows && cols.length === spec.cols;
  const rotated = rows.length === spec.cols && cols.length === spec.rows;
  if (!exact && !rotated) {
    return fail(`Lưới vẽ ra ${cols.length}×${rows.length}, cần ${spec.cols}×${spec.rows}`);
  }
  if (skewed(rows) || skewed(cols)) return fail('Các ô lệch kích thước quá nhiều');

  const up = (b: Band, max: number): Band => ({ start: Math.round(b.start / scale), end: Math.min(max, Math.round(b.end / scale)) });
  return { ok: true, rows: rows.map((b) => up(b, H)), cols: cols.map((b) => up(b, W)), width: W, height: H };
}

/**
 * Cắt `count` ô đầu tiên (theo thứ tự đọc: trái → phải, trên → dưới).
 * Chừa viền `insetFrac` mỗi phía để không dính nét ô bên cạnh.
 */
export async function cutCells(
  image: Buffer,
  grid: Extract<GridDetect, { ok: true }>,
  count: number,
  opts: { insetFrac?: number; maxSide?: number; quality?: number } = {},
): Promise<Buffer[]> {
  const inset = opts.insetFrac ?? 0.02;
  const maxSide = opts.maxSide ?? 512;
  const out: Buffer[] = [];
  for (const r of grid.rows) {
    for (const c of grid.cols) {
      if (out.length >= count) return out;
      const cw = c.end - c.start;
      const ch = r.end - r.start;
      const dx = Math.round(cw * inset);
      const dy = Math.round(ch * inset);
      const buf = await sharp(image)
        .extract({ left: c.start + dx, top: r.start + dy, width: Math.max(1, cw - 2 * dx), height: Math.max(1, ch - 2 * dy) })
        .resize(maxSide, maxSide, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: opts.quality ?? 80 })
        .toBuffer();
      out.push(buf);
    }
  }
  return out;
}

/** Bản infographic đầy đủ để lưu (webp, cạnh dài tối đa 1600px) */
export async function toInfographic(image: Buffer): Promise<Buffer> {
  return sharp(image).resize(1600, 1600, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
}

/** Ảnh lẻ → cắt vuông giữa ảnh, webp ≤512px (cùng cỡ ô cắt từ lưới) */
export async function toCell(image: Buffer, maxSide = 512): Promise<Buffer> {
  return sharp(image).flatten({ background: '#ffffff' }).resize(maxSide, maxSide, { fit: 'cover', position: 'centre', withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
}
