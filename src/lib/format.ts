export function fmtTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const s = Math.floor(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  return `${m}:${String(ss).padStart(2, '0')}`;
}

/** 把秒數轉成「1 小時 5 分」這種人看的寫法 */
export function fmtDuration(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return '0 分';
  const totalMin = Math.round(sec / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return m > 0 ? `${h} 小時 ${m} 分` : `${h} 小時`;
  return `${m} 分`;
}

/** 段落長度（秒）加總，用於計算學習時數 */
export function segmentSeconds(
  segments: { startSec: number; endSec: number }[],
  indexes: number[]
): number {
  return indexes.reduce((sum, i) => {
    const seg = segments[i];
    return sum + (seg ? Math.max(seg.endSec - seg.startSec, 0) : 0);
  }, 0);
}

/** 把「1:30」「01:02:03」「90」等字串轉成秒，供後台輸入用 */
export function parseTime(text: string): number | null {
  const t = text.trim();
  if (!t) return null;
  if (/^\d+(\.\d+)?$/.test(t)) return Number(t);
  const parts = t.split(':').map((p) => Number(p));
  if (parts.some((p) => !Number.isFinite(p) || p < 0)) return null;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}
