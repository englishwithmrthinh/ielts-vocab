/**
 * Infographic của một buổi — dùng chung cho admin (Claude 3) và học sinh (Claude 2).
 *
 * Ảnh do AI vẽ KHÔNG có chữ; component đặt từng ảnh ô vào lưới CSS và chèn
 * chữ (từ + nghĩa) bằng HTML, nên chữ luôn đúng chính tả và sửa được ngay.
 * Bố cục lưới theo đặc tả: ≤20 từ 4 cột, 21–25 từ 5 cột, >25 tách 2 bảng.
 *
 *   <Infographic items={words.map(w => ({ id: w.id, word: w.word, meaningVi: w.meaning_vi, imageUrl: w.image_url }))} />
 */
export interface InfographicItem {
  id: string;
  word: string;
  meaningVi: string;
  imageUrl: string | null;
  pos?: string;
}

export interface InfographicProps {
  items: InfographicItem[];
  /** Tiêu đề trên mỗi bảng, ví dụ "Buổi 3" */
  title?: string;
  /** Bấm vào ô (ví dụ phát audio) */
  onSelect?: (item: InfographicItem) => void;
  /** Ẩn nghĩa tiếng Việt (chế độ tự kiểm tra) */
  hideMeaning?: boolean;
  className?: string;
}

function split(n: number): { cols: number; count: number }[] {
  if (n <= 0) return [];
  if (n <= 20) return [{ cols: 4, count: n }];
  if (n <= 25) return [{ cols: 5, count: n }];
  const first = Math.ceil(n / 2);
  return [...split(first), ...split(n - first)];
}

export default function Infographic({ items, title, onSelect, hideMeaning, className = '' }: InfographicProps) {
  const boards = split(items.length);
  let offset = 0;
  return (
    <div className={`space-y-4 ${className}`}>
      {boards.map((b, bi) => {
        const group = items.slice(offset, offset + b.count);
        offset += b.count;
        return (
          <figure key={bi} className="rounded-2xl bg-white p-2 shadow-sm ring-1 ring-slate-200 sm:p-3">
            {title && (
              <figcaption className="px-1 pb-2 text-sm font-semibold text-slate-700">
                {title}
                {boards.length > 1 && <span className="font-normal text-slate-400"> · {bi + 1}/{boards.length}</span>}
              </figcaption>
            )}
            <ul className="grid gap-1.5 sm:gap-2" style={{ gridTemplateColumns: `repeat(${b.cols}, minmax(0, 1fr))` }}>
              {group.map((it) => {
                const Tag = onSelect ? 'button' : 'div';
                return (
                  <li key={it.id}>
                    <Tag
                      {...(onSelect ? { type: 'button' as const, onClick: () => onSelect(it) } : {})}
                      className="group relative block aspect-square w-full overflow-hidden rounded-lg bg-slate-100 text-left"
                    >
                      {it.imageUrl ? (
                        <img src={it.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover transition group-hover:scale-[1.03]" />
                      ) : (
                        <span className="grid h-full w-full place-items-center bg-gradient-to-br from-slate-100 to-slate-200 text-3xl font-bold text-slate-300">
                          {it.word.charAt(0).toUpperCase()}
                        </span>
                      )}
                      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/45 to-transparent px-1.5 pt-5 pb-1 sm:px-2 sm:pb-1.5">
                        <span className="block truncate text-[11px] font-bold leading-tight text-white sm:text-sm">{it.word}</span>
                        {!hideMeaning && <span className="block truncate text-[10px] leading-tight text-white/85 sm:text-xs">{it.meaningVi}</span>}
                      </span>
                    </Tag>
                  </li>
                );
              })}
            </ul>
          </figure>
        );
      })}
    </div>
  );
}
