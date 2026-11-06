# Prompt vẽ lưới ảnh cho một buổi

Pipeline (Claude 3) đọc khối `text` đầu tiên dưới đây và thay biến:
`{{cols}}` số cột · `{{rows}}` số hàng · `{{count}}` số ô có hình · `{{items}}` danh sách mô tả, mỗi dòng "1. ...", theo thứ tự trái sang phải, trên xuống dưới · `{{emptyNote}}` câu dặn về ô trống (có thể rỗng).

Ghi chú (chạy thử thật 06/11): lưới 20 ô cho kết quả rất tốt (rãnh trắng sạch, không lọt chữ), nhưng model có thể vẽ xoay thành 5 cột × 4 hàng. Pipeline chấp nhận cả lưới xoay khi tổng số ô đúng. Ảnh mẫu: docs/samples/gemini-grid-environment-5x4.png

```text
Create ONE image: a perfectly even grid of exactly {{cols}} columns and {{rows}} rows ({{count}} square illustrations in total).

GRID RULES
- Pure white gutters of equal width separate every cell. Each gutter is a straight line running from one edge of the image to the opposite edge.
- No borders, frames, outlines or shadows crossing a gutter. Nothing is drawn on the gutters.
- Each cell has its own very light pastel background (never pure white) so the white gutters stand out.
- All cells are the same size.

STYLE
- Modern flat vector illustration, bright clean colours, one consistent style across all cells.
- One clear main subject per cell, large enough to recognise on a small phone screen.

STRICT TEXT RULE
- Absolutely no text, letters, numbers, labels, signs, logos, user-interface elements, icons or typographic symbols anywhere in the image. Book covers, screens and papers must be blank or show simple shapes only.

CELL CONTENTS (left to right, top to bottom)
{{items}}
{{emptyNote}}
```
