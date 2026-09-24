export function formatDate(dateStr: string | null, long = false): string {
  if (!dateStr) return 'Unknown date';
  if (/^[A-Za-z]/.test(dateStr)) return dateStr;
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return dateStr;
  return long
    ? d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' });
}

// Dates are stored as "Feb 05, 2026" (older rows may be ISO "2026-02-05")
function parseMeetingDate(dateStr: string | null): Date | null {
  if (!dateStr) return null;
  const d = /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? new Date(dateStr + 'T00:00:00') : new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

// 09·19·26
export function formatDotDate(dateStr: string | null): string {
  const d = parseMeetingDate(dateStr);
  if (!d) return dateStr ?? '—';
  const pad = (n: number) => String(n).padStart(2, '0');
  return [pad(d.getMonth() + 1), pad(d.getDate()), String(d.getFullYear()).slice(-2)].join('·');
}

// September 22nd, 2026
export function formatLongDate(dateStr: string | null): string {
  const d = parseMeetingDate(dateStr);
  if (!d) return dateStr ?? 'Unknown date';
  const day = d.getDate();
  const suffix = day % 10 === 1 && day !== 11 ? 'st' : day % 10 === 2 && day !== 12 ? 'nd' : day % 10 === 3 && day !== 13 ? 'rd' : 'th';
  const month = d.toLocaleDateString('en-US', { month: 'long' });
  return `${month} ${day}${suffix}, ${d.getFullYear()}`;
}

export interface ButtonSpot {
  left: number; // % of hero width
  top: number; // % of hero height
}

// Random spots for the hero's two buttons. `left` is where the button sits within the free space
// (applied with a matching translate), so buttons of any width stay inside the hero; they're
// always vertically apart so they never overlap
export function randomButtonSpots(): [ButtonSpot, ButtonSpot] {
  const spot = (): ButtonSpot => ({
    left: Math.round(6 + Math.random() * 88),
    top: Math.round(6 + Math.random() * 74),
  });
  const a = spot();
  let b = spot();
  while (Math.abs(a.top - b.top) < 18) b = spot();
  return [a, b];
}
