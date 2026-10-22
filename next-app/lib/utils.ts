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

// 09·19·26 (or 09/19/26 with sep '/')
export function formatDotDate(dateStr: string | null, sep = '·'): string {
  const d = parseMeetingDate(dateStr);
  if (!d) return dateStr ?? '—';
  const pad = (n: number) => String(n).padStart(2, '0');
  return [pad(d.getMonth() + 1), pad(d.getDate()), String(d.getFullYear()).slice(-2)].join(sep);
}

// "October 2 2026"
export function formatPlainDate(dateStr: string | null): string {
  const d = parseMeetingDate(dateStr);
  if (!d) return dateStr ?? '';
  return `${d.toLocaleString('en-US', { month: 'long' })} ${d.getDate()} ${d.getFullYear()}`;
}
