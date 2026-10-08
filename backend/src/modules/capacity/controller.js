// @ts-check
import { getCapacity } from './service.js';

/**
 * GET /api/capacity: units booked per machine per day (`CapacityCalendar`).
 * @param {{ pool: import('pg').Pool | null }} deps
 * @returns {import('express').RequestHandler}
 */
export const getCapacityHandler = (deps) => async (_req, res) => {
  res.set('Cache-Control', 'no-store').json(await getCapacity(deps));
};
