export function todayIso() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');

  return `${yyyy}-${mm}-${dd}`;
}

export function toIsoDate(value) {
  if (!value) return '';

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const yyyy = value.getFullYear();
    const mm = String(value.getMonth() + 1).padStart(2, '0');
    const dd = String(value.getDate()).padStart(2, '0');

    return `${yyyy}-${mm}-${dd}`;
  }

  const text = String(value).trim();
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const display = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (display) {
    const day = Number(display[1]);
    const month = Number(display[2]);
    const year = Number(display[3]);
    const parsed = new Date(year, month - 1, day);

    if (parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  return text;
}

export function formatDate(value, fallback = '') {
  const isoDate = toIsoDate(value);
  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) return fallback;

  return `${match[3]}/${match[2]}/${match[1]}`;
}
