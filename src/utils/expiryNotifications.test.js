import {
  daysUntilKstExpiry,
  getExpiryNotificationDays,
  isExpiryWithinDays,
  parseCarExpiryDate,
  parseInsuranceExpiryDate,
} from './expiryNotifications';

const KST_2026_09_29 = new Date('2026-09-28T15:00:00.000Z');

describe('expiry notification date rules', () => {
  test.each([
    ['20261006'],
    ['2026-10-06'],
    ['2026-10-6'],
    ['2026.10.06'],
    ['2026.10.6'],
    ['2026/10/06'],
    ['2026/10/6'],
  ])('parses supported car expiry format %s', value => {
    expect(parseCarExpiryDate(value)?.dateKey).toBe('2026-10-06');
  });

  test('uses strict YYYY-MM-DD for insurance expiry', () => {
    expect(parseInsuranceExpiryDate('2026-10-06')?.dateKey).toBe('2026-10-06');
    expect(parseInsuranceExpiryDate('2026-10-6')).toBeNull();
  });

  test.each([
    ['2026-09-29', 0],
    ['2026-10-06', 7],
    ['2026-10-13', 14],
    ['2026-10-29', 30],
    ['2026-10-30', 31],
    ['2026-09-28', -1],
    ['2026-10-01', 2],
    ['2027-01-01', 94],
  ])('calculates KST calendar-day difference for %s', (value, expected) => {
    expect(daysUntilKstExpiry(value, 'insurance', KST_2026_09_29)).toBe(expected);
  });

  test('handles leap day and rejects invalid or empty dates', () => {
    expect(parseCarExpiryDate('20280229')?.dateKey).toBe('2028-02-29');
    expect(parseCarExpiryDate('20260229')).toBeNull();
    expect(parseCarExpiryDate('')).toBeNull();
    expect(parseInsuranceExpiryDate('2026-02-29')).toBeNull();
  });

  test.each([7, 14, 30])('includes exactly %i days and excludes the following day', days => {
    const target = new Date(Date.UTC(2026, 8, 29 + days));
    const next = new Date(Date.UTC(2026, 8, 30 + days));
    const targetKey = target.toISOString().slice(0, 10);
    const nextKey = next.toISOString().slice(0, 10);
    expect(isExpiryWithinDays(targetKey, 'insurance', days, KST_2026_09_29)).toBe(true);
    expect(isExpiryWithinDays(nextKey, 'insurance', days, KST_2026_09_29)).toBe(false);
  });

  test.each([
    ['car', '20261006', 7],
    ['car', '2026.10.13', 14],
    ['car', '2026/10/29', 30],
    ['insurance', '2026-10-06', 7],
    ['insurance', '2026-10-13', 14],
    ['insurance', '2026-10-29', 30],
  ])('applies enabled %s settings for %i days', (type, value, days) => {
    expect(getExpiryNotificationDays(value, type, { enabled: true, days }, KST_2026_09_29)).toBe(days);
  });

  test.each(['car', 'insurance'])('does not show disabled %s expiry notifications', type => {
    const value = type === 'car' ? '20261006' : '2026-10-06';
    expect(getExpiryNotificationDays(value, type, { enabled: false, days: 30 }, KST_2026_09_29)).toBeNull();
  });

  test('handles month-end and year-end boundaries in KST', () => {
    const monthEnd = new Date('2026-09-30T15:00:00.000Z');
    const yearEnd = new Date('2026-12-30T15:00:00.000Z');
    expect(daysUntilKstExpiry('2026-10-01', 'insurance', monthEnd)).toBe(0);
    expect(daysUntilKstExpiry('2027-01-01', 'insurance', yearEnd)).toBe(1);
  });

  test('handles leap-day boundaries in KST', () => {
    const leapEve = new Date('2028-02-27T15:00:00.000Z');
    expect(daysUntilKstExpiry('2028-02-29', 'insurance', leapEve)).toBe(1);
  });

  test('does not include expired dates or disabled-equivalent invalid periods', () => {
    expect(isExpiryWithinDays('2026-09-28', 'insurance', 30, KST_2026_09_29)).toBe(false);
    expect(isExpiryWithinDays('2026-10-06', 'insurance', 10, KST_2026_09_29)).toBe(false);
  });
});
