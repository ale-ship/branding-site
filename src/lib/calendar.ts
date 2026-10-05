/**
 * Working days for promised dates. Dates are YYYY-MM-DD strings in Nairobi time.
 *
 * TODO(business): confirm the workshop works Monday to Saturday, and keep the holiday list up to
 * date (Eid dates are gazetted each year; a holiday on a Sunday moves to the Monday).
 */

/** Kenyan public holidays, 2026 and 2027. */
const HOLIDAYS = new Set([
  '2026-01-01', '2026-03-20', '2026-04-03', '2026-04-06', '2026-05-01', '2026-05-27', '2026-06-01',
  '2026-10-10', '2026-10-20', '2026-12-12', '2026-12-25', '2026-12-26',
  '2027-01-01', '2027-03-10', '2027-03-26', '2027-03-29', '2027-05-01', '2027-05-17', '2027-06-01',
  '2027-10-11', '2027-10-20', '2027-12-13', '2027-12-25', '2027-12-27',
]);

const toUtc = (date: string) => new Date(`${date}T00:00:00Z`);
const fromUtc = (d: Date) => d.toISOString().slice(0, 10);

export function addDays(date: string, days: number): string {
  const d = toUtc(date);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUtc(d);
}

/** Monday to Saturday, not a public holiday. */
export function isWorkingDay(date: string): boolean {
  return toUtc(date).getUTCDay() !== 0 && !HOLIDAYS.has(date);
}

/** The date `n` working days after `date` (`date` itself doesn't count). */
export function addWorkingDays(date: string, n: number): string {
  let d = date;
  let left = n;
  while (left > 0) {
    d = addDays(d, 1);
    if (isWorkingDay(d)) left--;
  }
  return d;
}

/** `2026-10-12` -> `Monday 12 October`. */
export function formatDay(date: string): string {
  return new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(toUtc(date));
}

/** `2026-10-12` -> `12/10/2026`, as on Noorcom's invoices. */
export function formatDateShort(date: string): string {
  const [y, m, d] = date.split('-');
  return `${d}/${m}/${y}`;
}
