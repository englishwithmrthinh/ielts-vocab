// Phản hồi tức thì khi chấm: âm thanh ngắn (Web Audio, không cần file) + rung (Android).
// Gọi trong sự kiện bấm của học sinh nên iPhone cho phép phát.
let ctx: AudioContext | null = null;

function tone(freq: number, start: number, dur: number, gain = 0.06) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, ctx.currentTime + start);
  g.gain.exponentialRampToValueAtTime(gain, ctx.currentTime + start + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
  o.connect(g).connect(ctx.destination);
  o.start(ctx.currentTime + start);
  o.stop(ctx.currentTime + start + dur + 0.02);
}

/** Mở AudioContext ngay trong lúc bấm (iOS yêu cầu) */
export function primeAudio() {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!ctx && AC) ctx = new AC();
    if (ctx?.state === 'suspended') void ctx.resume();
  } catch {
    ctx = null;
  }
}

export function feedback(correct: boolean) {
  try {
    if (correct) {
      tone(784, 0, 0.12); // G5
      tone(1047, 0.09, 0.18); // C6
    } else {
      tone(220, 0, 0.22, 0.07);
    }
    navigator.vibrate?.(correct ? 15 : [30, 40, 30]);
  } catch {
    /* thiết bị không hỗ trợ — bỏ qua */
  }
}
