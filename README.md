# Ôn từ vựng IELTS

Web ôn từ vựng theo lặp lại ngắt quãng cho lớp IELTS. Học sinh nộp 3 bài mỗi tuần (Thứ 3, Thứ 6, Chủ nhật). Lịch ôn từng từ tính theo số mốc. Kết quả ghi vào Google Sheet và có báo cáo tháng gửi phụ huynh.

Đặc tả đầy đủ nằm trong file giao việc mỗi AI nhận được (phần Phụ lục).

## Ai sửa thư mục nào

| Thư mục | Chủ sở hữu |
| --- | --- |
| `shared/`, `supabase/`, `netlify/lib/`, `netlify/functions/` (trừ `pipeline-*`, `admin-*`), `scripts/`, file gốc repo, `src/App.tsx`, `src/main.tsx`, `src/lib/` | Sếp (Claude 1) |
| `src/student/`, `src/parent/`, `src/questions/` | Claude 2 |
| `src/admin/`, `src/shared-ui/`, `netlify/functions/pipeline-*`, `netlify/functions/admin-*` | Claude 3 |
| `skill/`, `prompts/`, `seed/` | Gemini (sếp đưa vào repo) |

Cần sửa ngoài phần của mình: ghi "Câu hỏi cho sếp" trong báo cáo, không tự sửa.

## Quy trình Git

1. Tạo nhánh từ `main`: `claude2/<việc>`, `claude3/<việc>`.
2. Commit nhỏ, message tiếng Việt hoặc tiếng Anh đều được.
3. Mở pull request vào `main`, dán "BÁO CÁO GỬI SẾP" vào phần mô tả.
4. Sếp review và gộp. Không ai tự gộp vào `main`.

## Chạy trên máy

```bash
npm install
cp .env.example .env      # điền giá trị
npm run dev               # chỉ giao diện (Vite)
npx netlify dev           # giao diện + functions
npm test                  # test thuật toán
npm run typecheck
```

## Thiết lập database (làm một lần)

Supabase → SQL Editor, chạy lần lượt:

1. `supabase/schema.sql`
2. `supabase/seed-milestones.sql` (mốc tháng 11–12/2026)

Sau đó job `cron-milestones` tự tạo mốc tháng mới vào ngày 25 hằng tháng.

## Dùng lại phần dùng chung

**Kiểu dữ liệu**: `import type { Question, HomeResponse } from '@shared/types'` (trong `src/`), hoặc đường dẫn tương đối `../../shared/types` (trong `netlify/`).

**Gọi API từ giao diện**: `api<T>(method, path, body?)` trong `src/lib/api.ts`. Lỗi ném `ApiCallError` có `status`, `code`.

**Viết function mới** (Netlify Functions dạng v2, đường dẫn khai báo trong `config.path`):

```ts
import type { Config } from '@netlify/functions';
import { requireAdmin } from '../lib/auth';
import { handler, json } from '../lib/http';
import { db, must } from '../lib/supabase';

export default handler(['GET'], async (req) => {
  requireAdmin(req);            // hoặc: const studentId = requireStudent(req);
  const rows = must(await db().from('students').select('id,code,name,active'));
  return json({ students: rows });
});

export const config: Config = { path: '/api/admin/students' };
```

Các hàm có sẵn trong `netlify/lib/auth.ts`: `requireStudent`, `requireAdmin`, `hashPin`, `randomPin`, `isValidPin`.

Phát hành buổi: `publishLesson(lessonId, studentIds)` trong `netlify/lib/publish.ts` → `{ assigned, skipped, dueIdx }`.

Thuật toán (hàm thuần, dùng được ở cả server và trình duyệt): `shared/srs.ts` (`applyAnswer`), `shared/grading.ts` (`gradeTyping`, `HINT_TEXT`), `shared/lateness.ts`, `shared/milestones.ts`.

## API đã có

| Đường dẫn | Việc |
| --- | --- |
| `POST /api/login` `{code, pin}` | Học sinh đăng nhập (khoá 15 phút sau 10 lần sai) |
| `GET /api/me` · `POST /api/logout` | Phiên học sinh |
| `POST /api/admin/login` `{password}` · `POST /api/admin/logout` · `GET /api/admin/me` | Phiên quản trị |
| `GET /api/admin/milestones?month=YYYY-MM` | Danh sách mốc của tháng (tự tạo nếu thiếu) |
| `POST /api/admin/milestones/off` `{id, off}` | Bật/tắt Nghỉ (chỉ mốc từ hôm nay trở đi) |
