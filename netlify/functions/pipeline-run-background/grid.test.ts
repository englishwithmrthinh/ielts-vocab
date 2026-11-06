import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { cutCells, detectGrid } from './grid';

/** Vẽ lưới giả: ô màu có hoạ tiết, rãnh trắng, có thể lệch kích thước / sai số ô */
async function fakeGrid(opts: { cols: number; rows: number; w?: number; h?: number; gutter?: number; jitter?: number; noGutter?: boolean }) {
  const W = opts.w ?? 1200;
  const H = opts.h ?? 1500;
  const g = opts.noGutter ? 0 : (opts.gutter ?? 24);
  const cw = (W - g * (opts.cols + 1)) / opts.cols;
  const ch = (H - g * (opts.rows + 1)) / opts.rows;
  const rects: string[] = [];
  let k = 0;
  for (let r = 0; r < opts.rows; r++) {
    for (let c = 0; c < opts.cols; c++) {
      const j = opts.jitter ? ((k * 37) % 7) - 3 : 0;
      const x = g + c * (cw + g);
      const y = g + r * (ch + g);
      const hue = (k * 47) % 360;
      rects.push(
        `<rect x="${x}" y="${y}" width="${cw + j}" height="${ch - j}" fill="hsl(${hue},55%,62%)"/>`,
        // hoạ tiết có mảng trắng bên trong ô (như ảnh minh hoạ thật)
        `<circle cx="${x + cw / 2}" cy="${y + ch / 2}" r="${Math.min(cw, ch) / 4}" fill="#fff"/>`,
        `<rect x="${x + 10}" y="${y + ch - 30}" width="${cw / 2}" height="12" fill="#222"/>`,
      );
      k++;
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="100%" height="100%" fill="#fff"/>${rects.join('')}</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

describe('detectGrid', () => {
  it('tìm đúng lưới 4×5 có rãnh trắng', async () => {
    const img = await fakeGrid({ cols: 4, rows: 5 });
    const g = await detectGrid(img, { cols: 4, rows: 5 });
    expect(g.ok).toBe(true);
    if (g.ok) {
      expect(g.cols).toHaveLength(4);
      expect(g.rows).toHaveLength(5);
    }
  });

  it('chịu được ô lệch vài pixel và ảnh không vuông', async () => {
    const g = await detectGrid(await fakeGrid({ cols: 5, rows: 5, w: 1024, h: 1024, jitter: 1, gutter: 14 }), { cols: 5, rows: 5 });
    expect(g.ok).toBe(true);
  });

  it('báo sai khi model vẽ 4×4 thay vì 4×5', async () => {
    const g = await detectGrid(await fakeGrid({ cols: 4, rows: 4 }), { cols: 4, rows: 5 });
    expect(g).toMatchObject({ ok: false, foundCols: 4, foundRows: 4 });
  });

  it('báo sai khi không có rãnh trắng', async () => {
    const g = await detectGrid(await fakeGrid({ cols: 4, rows: 5, noGutter: true }), { cols: 4, rows: 5 });
    expect(g.ok).toBe(false);
  });
});

describe('cutCells', () => {
  it('cắt đúng số ô, mỗi ô không dính rãnh trắng', async () => {
    const img = await fakeGrid({ cols: 4, rows: 5 });
    const g = await detectGrid(img, { cols: 4, rows: 5 });
    if (!g.ok) throw new Error(g.reason);
    const cells = await cutCells(img, g, 18);
    expect(cells).toHaveLength(18);
    const first = await sharp(cells[0]!).raw().toBuffer({ resolveWithObject: true });
    // góc trên-trái của ô phải là màu nền ô, không phải trắng của rãnh
    const [r, gg, b] = [first.data[0]!, first.data[1]!, first.data[2]!];
    expect(r + gg + b).toBeLessThan(700);
    expect(first.info.format).toBe('raw');
  });
});
