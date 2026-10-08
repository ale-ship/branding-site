// @ts-check
import { nairobiToday } from '@noorcom-branding/shared/rules/calendar.js';
import { AppError } from '../../lib/errors.js';
import { bookedFrom } from './repo.js';

/**
 * The capacity calendar (docs/BACKEND_RUNBOOK.md, step B2): what the order form, the price and a new
 * order read, so only deadlines the workshop can meet are offered. Machine time comes from orders
 * (`capacity_bookings`); the workshop's other work joins it when staff can enter it (B4).
 *
 * @typedef {import('@noorcom-branding/shared/rules/capacity.js').CapacityCalendar} CapacityCalendar
 */

/**
 * @param {{ pool: import('pg').Pool | null }} deps
 * @param {string} [today]
 * @returns {Promise<CapacityCalendar>}
 */
export async function getCapacity({ pool }, today = nairobiToday()) {
  if (!pool) throw new AppError(503, 'unavailable', 'Ordering is unavailable for a moment. Please try again shortly.');
  return bookedFrom(pool, today);
}
