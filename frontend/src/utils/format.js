// The database stores times in UTC like "2026-11-24 10:05:00". This shows them in local time.
export function formatDate(value) {
  if (!value) return '';
  const date = new Date(`${String(value).replace(' ', 'T')}Z`);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}