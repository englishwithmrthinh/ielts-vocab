// Kéo thả nhẹ bằng Pointer Events (chuột + cảm ứng), không cần thư viện.
// Chạm nhanh = "tap" (cách bấm chọn thay kéo); kéo quá 6px = kéo thả.
// Vùng thả: phần tử có data-drop="<id>".
import { useRef, useState, type PointerEvent as RPointerEvent, type ReactNode } from 'react';

interface Ghost {
  id: string;
  label: ReactNode;
  x: number;
  y: number;
  w: number;
  h: number;
}

export function useDragDrop(opts: { onDrop: (dragId: string, dropId: string) => void; onTap: (dragId: string) => void; disabled?: boolean }) {
  const [ghost, setGhost] = useState<Ghost | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const st = useRef<{ id: string; label: ReactNode; sx: number; sy: number; dx: number; dy: number; w: number; h: number; dragging: boolean } | null>(null);

  const dropAt = (x: number, y: number) => {
    const el = document.elementFromPoint(x, y)?.closest('[data-drop]') as HTMLElement | null;
    return el?.dataset.drop ?? null;
  };

  const dragProps = (id: string, label: ReactNode) => ({
    onPointerDown: (e: RPointerEvent<HTMLElement>) => {
      if (opts.disabled || (e.pointerType === 'mouse' && e.button !== 0)) return;
      const r = e.currentTarget.getBoundingClientRect();
      st.current = { id, label, sx: e.clientX, sy: e.clientY, dx: e.clientX - r.left, dy: e.clientY - r.top, w: r.width, h: r.height, dragging: false };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    onPointerMove: (e: RPointerEvent<HTMLElement>) => {
      const s = st.current;
      if (!s || s.id !== id) return;
      if (!s.dragging && Math.hypot(e.clientX - s.sx, e.clientY - s.sy) < 6) return;
      s.dragging = true;
      setGhost({ id, label: s.label, x: e.clientX - s.dx, y: e.clientY - s.dy, w: s.w, h: s.h });
      setOverId(dropAt(e.clientX, e.clientY));
    },
    onPointerUp: (e: RPointerEvent<HTMLElement>) => {
      const s = st.current;
      st.current = null;
      setGhost(null);
      setOverId(null);
      if (!s || s.id !== id) return;
      if (!s.dragging) {
        opts.onTap(id);
        return;
      }
      const d = dropAt(e.clientX, e.clientY);
      if (d) opts.onDrop(id, d);
    },
    onPointerCancel: () => {
      st.current = null;
      setGhost(null);
      setOverId(null);
    },
    style: { touchAction: 'none' as const },
    'data-dragging': ghost?.id === id ? 'true' : undefined,
  });

  const overlay = ghost ? (
    <div
      aria-hidden
      className="pointer-events-none fixed z-50 flex items-center justify-center rounded-xl bg-primary px-3 font-semibold text-white shadow-lg"
      style={{ left: ghost.x, top: ghost.y, width: ghost.w, height: ghost.h, transform: 'rotate(-2deg) scale(1.05)' }}
    >
      {ghost.label}
    </div>
  ) : null;

  return { dragProps, overlay, overId, draggingId: ghost?.id ?? null };
}
