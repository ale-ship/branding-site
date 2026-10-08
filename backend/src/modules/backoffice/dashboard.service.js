// @ts-check
import { addDays, nairobiToday } from '@noorcom-branding/shared/rules/calendar.js';
import { AppError } from '../../lib/errors.js';
import * as repo from './dashboard.repo.js';
import { board, COLUMNS } from './service.js';

/**
 * The back office's home: this month against last month, the last 30 days of money received, where
 * orders are in the pipeline, what needs a hand (overdue, flagged, unmatched payments), what sells,
 * and the newest orders. Everything from Postgres, counted in Nairobi days.
 *
 * @typedef {import('../../deps.js').Deps} Deps
 */

/**
 * @param {Deps} deps
 * @param {Date} [now]
 */
export async function dashboard(deps, now = new Date()) {
  const pool = deps.pool;
  if (!pool) throw new AppError(503, 'unavailable', 'The back office is unavailable for a moment.');
  const today = nairobiToday(now);
  const monthStart = `${today.slice(0, 8)}01`;
  // The same stretch of last month (1st to today's date), so the comparison is fair mid-month.
  const lastMonthStart = addDays(monthStart, -1).slice(0, 8) + '01';
  const lastMonthSameDay = (() => {
    const end = `${lastMonthStart.slice(0, 8)}${today.slice(8)}`;
    const lastDay = addDays(monthStart, -1);
    return end > lastDay ? lastDay : end;
  })();

  const [thisMonth, lastMonth, daily, pipe, categories, recent] = await Promise.all([
    repo.totals(pool, monthStart, today),
    repo.totals(pool, lastMonthStart, lastMonthSameDay),
    repo.revenueByDay(pool, addDays(today, -29), today),
    repo.pipeline(pool, today),
    repo.byCategory(pool, monthStart, today),
    board(deps, {}, now),
  ]);

  const stages = Object.fromEntries(
    Object.entries(COLUMNS).map(([column, statuses]) => [column, statuses.reduce((n, s) => n + (pipe.byStatus[s] ?? 0), 0)]),
  );
  return {
    today,
    month: { from: monthStart, revenue: thisMonth.revenue, orders: thisMonth.orders },
    lastMonth: { from: lastMonthStart, to: lastMonthSameDay, revenue: lastMonth.revenue, orders: lastMonth.orders },
    awaiting: pipe.awaiting,
    inProduction: pipe.byStatus.in_production ?? 0,
    overdue: pipe.overdue,
    attention: pipe.attention,
    unmatched: pipe.unmatched,
    stages,
    revenueByDay: daily,
    byCategory: categories,
    recent: recent.slice(0, 8),
  };
}
