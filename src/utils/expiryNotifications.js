const DAY_MS = 24 * 60 * 60 * 1000;
const VALID_EXPIRY_DAYS = new Set([7, 14, 30]);

function isValidCalendarDate(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function parsedDate(yearText, monthText, dayText) {
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (!isValidCalendarDate(year, month, day)) return null;

  return {
    dateKey: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    utcDay: Date.UTC(year, month - 1, day),
  };
}

export function parseCarExpiryDate(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;

  const compact = raw.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compact) return parsedDate(compact[1], compact[2], compact[3]);

  const separated = raw.match(/^(\d{4})([-./])(\d{1,2})\2(\d{1,2})$/);
  if (!separated) return null;
  return parsedDate(separated[1], separated[3], separated[4]);
}

export function parseInsuranceExpiryDate(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;

  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return parsedDate(match[1], match[2], match[3]);
}

export function getKstDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
  };
}

export function daysUntilKstExpiry(value, type, now = new Date()) {
  const parsed = type === 'insurance'
    ? parseInsuranceExpiryDate(value)
    : parseCarExpiryDate(value);
  if (!parsed) return null;

  const today = getKstDateParts(now);
  const todayUtcDay = Date.UTC(today.year, today.month - 1, today.day);
  return Math.round((parsed.utcDay - todayUtcDay) / DAY_MS);
}

export function isExpiryWithinDays(value, type, days, now = new Date()) {
  const normalizedDays = Number(days);
  if (!VALID_EXPIRY_DAYS.has(normalizedDays)) return false;
  const remaining = daysUntilKstExpiry(value, type, now);
  return remaining !== null && remaining >= 0 && remaining <= normalizedDays;
}

export function getExpiryNotificationDays(value, type, settings, now = new Date()) {
  if (settings?.enabled !== true) return null;
  const days = Number(settings.days);
  if (!isExpiryWithinDays(value, type, days, now)) return null;
  return daysUntilKstExpiry(value, type, now);
}
