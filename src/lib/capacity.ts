import type { BriefAnswers, OrderProduct } from './api/order-types';
import { addWorkingDays, isWorkingDay } from './calendar';

/**
 * The capacity calendar (docs/ORDER_WORKFLOW_SPEC.md, "Deadlines": capacity calendar): how many pieces
 * each machine turns out a day, and what is already booked. It decides which deadlines the order form
 * offers and when an order can really be finished, so the site never sells a rush job the printers
 * can't deliver. Pure: the form, the API and the production ETA share it.
 */

export type Machine = 'screen-press' | 'dtf' | 'embroidery' | 'sublimation' | 'engraving' | 'digital-press' | 'binding' | 'wide-format';

/** Pieces a day per machine at a normal shift. TODO(business): real figures from the workshop. */
export const MACHINES: Record<Machine, { label: string; dailyUnits: number }> = {
  'screen-press': { label: 'Screen press', dailyUnits: 300 },
  dtf: { label: 'DTF and heat press', dailyUnits: 150 },
  embroidery: { label: 'Embroidery', dailyUnits: 80 },
  sublimation: { label: 'Sublimation', dailyUnits: 120 },
  engraving: { label: 'Laser engraving', dailyUnits: 100 },
  'digital-press': { label: 'Digital press', dailyUnits: 3000 },
  binding: { label: 'Binding', dailyUnits: 150 },
  'wide-format': { label: 'Wide-format printer', dailyUnits: 25 },
};

/** Which machine a quantity run goes through, from its product and brief. Null for site jobs and design. */
export function machineFor(product: OrderProduct, brief: BriefAnswers): Machine | null {
  if (product.mechanism !== 'A') return null;
  switch (product.category) {
    case 'apparel':
      return brief.method === 'embroidery' ? 'embroidery' : brief.method === 'screen' ? 'screen-press' : 'dtf';
    case 'corporate-gifts':
      if (product.slug === 'mug-branding') return 'sublimation';
      if (brief.method === 'engrave') return 'engraving';
      return 'screen-press';
    case 'books':
      return 'binding';
    case 'large-format':
      return 'wide-format';
    default:
      return 'digital-press';
  }
}

/** Pieces already booked per machine per day (YYYY-MM-DD). Days not listed are free. */
export type CapacityCalendar = Partial<Record<Machine, Record<string, number>>>;

const MAX_DAYS = 250;

/**
 * Books `units` on `machine` from `start` (counted if it's a working day), using what's free each
 * day. Returns the day the last piece is done and the pieces per day.
 */
export function allocate(units: number, machine: Machine, start: string, calendar: CapacityCalendar): { finish: string; days: Record<string, number> } {
  const daily = MACHINES[machine].dailyUnits;
  const booked = calendar[machine] ?? {};
  const days: Record<string, number> = {};
  let left = Math.max(0, Math.ceil(units));
  let day = isWorkingDay(start) ? start : addWorkingDays(start, 1);
  for (let i = 0; i < MAX_DAYS; i++) {
    const free = Math.max(0, daily - (booked[day] ?? 0));
    const take = Math.min(free, left);
    if (take > 0) {
      days[day] = take;
      left -= take;
    }
    if (left === 0) return { finish: day, days };
    day = addWorkingDays(day, 1);
  }
  return { finish: day, days };
}

/** The earliest day an order could be finished if its proof is approved the next working day. */
export function capacityFinish(product: OrderProduct, quantity: number, brief: BriefAnswers, today: string, calendar: CapacityCalendar): string | null {
  const machine = machineFor(product, brief);
  if (!machine) return null;
  return allocate(quantity, machine, addWorkingDays(today, 1), calendar).finish;
}

/** Adds an allocation to a calendar (booking) or takes it away (releasing an expired order's slot). */
export function book(calendar: CapacityCalendar, machine: Machine, days: Record<string, number>, sign: 1 | -1 = 1): void {
  const m = (calendar[machine] ??= {});
  for (const [day, n] of Object.entries(days)) {
    const next = (m[day] ?? 0) + sign * n;
    if (next > 0) m[day] = next;
    else delete m[day];
  }
}

/** Share of a machine's day already booked, 0 to 1, for showing how busy the workshop is. */
export const loadOn = (calendar: CapacityCalendar, machine: Machine, day: string) => Math.min(1, (calendar[machine]?.[day] ?? 0) / MACHINES[machine].dailyUnits);
