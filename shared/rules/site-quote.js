// @ts-check
import { addDays, addWorkingDays, isWorkingDay } from './calendar.js';

/**
 * @typedef {import('../contract/order-types.js').PriceLine} PriceLine
 * @typedef {import('../contract/order-types.js').SiteMaterial} SiteMaterial
 * @typedef {import('../contract/order-types.js').SiteQuoteItem} SiteQuoteItem
 */

/**
 * Site jobs (Mechanism B): the quote builder staff use after the survey, and the installation date
 * rules (docs/ORDER_WORKFLOW_SPEC.md, "Order mechanisms" B and "Staff dashboard": quote builder). Pure,
 * so the backend's quote builder and the site's explanation agree.
 */

/**
 * Price per square metre, printed and fitted, with a minimum per item. TODO(business): real rates.
 * @type {Record<SiteMaterial, { label: string; perSqm: number; minimum: number }>}
 */
export const SITE_MATERIALS = {
  vinyl: { label: 'Printed vinyl', perSqm: 1800, minimum: 2500 },
  wallpaper: { label: 'Printed wallpaper', perSqm: 2400, minimum: 4000 },
  frosted: { label: 'Frosted glass film', perSqm: 2200, minimum: 3000 },
  'acp-sign': { label: 'ACP sign with 3D letters', perSqm: 9500, minimum: 15000 },
  lightbox: { label: 'Light box', perSqm: 14000, minimum: 20000 },
  'flex-banner': { label: 'Flex banner on frame', perSqm: 1200, minimum: 3000 },
  'vehicle-wrap': { label: 'Cast vehicle wrap vinyl', perSqm: 3200, minimum: 6000 },
};

/** Fitting on site: per square metre, with a call-out minimum. TODO(business). */
export const INSTALL_PER_SQM = 350;
export const INSTALL_MINIMUM = 3000;
export const QUOTE_VALID_DAYS = 14;
export const SITE_DEPOSIT_RATE = 0.5;
/** Installation is booked at least this many working days ahead, so materials are ready. */
export const INSTALL_NOTICE_DAYS = 2;

/** @param {Pick<SiteQuoteItem, 'widthCm' | 'heightCm'>} i */
export const areaSqm = (i) => Math.round(((i.widthCm * i.heightCm) / 10_000) * 100) / 100;

/**
 * @param {SiteQuoteItem} i
 * @returns {number}
 */
export function itemPrice(i) {
  const m = SITE_MATERIALS[i.material];
  return Math.max(m.minimum, Math.round(areaSqm(i) * m.perSqm)) * i.quantity;
}

/**
 * What's wrong with the measured items, or null.
 * @param {SiteQuoteItem[]} items
 * @returns {string | null}
 */
export function siteItemsError(items) {
  if (!items.length) return 'Add at least one measured item.';
  for (const i of items) {
    if (!i.label.trim()) return 'Every item needs a name.';
    if (!(i.material in SITE_MATERIALS)) return `Unknown material for ${i.label}.`;
    if (!(i.widthCm > 0 && i.heightCm > 0 && i.widthCm <= 10_000 && i.heightCm <= 10_000)) return `Check the size of ${i.label}.`;
    if (!Number.isInteger(i.quantity) || i.quantity < 1) return `Check the quantity of ${i.label}.`;
  }
  return null;
}

/**
 * The firm quote: one line per measured item, fitting by total area, and any extras (a county permit,
 * night work). The deposit is half; the survey fee already paid comes off the balance.
 * @param {SiteQuoteItem[]} items
 * @param {PriceLine[]} extras
 * @param {string} today
 * @returns {{ lines: PriceLine[]; total: number; deposit: number; validUntil: string }}
 */
export function buildSiteQuote(items, extras, today) {
  const problem = siteItemsError(items);
  if (problem) throw new Error(problem);
  /** @type {PriceLine[]} */
  const lines = items.map((i) => ({
    label: i.label,
    detail: `${SITE_MATERIALS[i.material].label}, ${(i.widthCm / 100).toFixed(2)} × ${(i.heightCm / 100).toFixed(2)} m${i.quantity > 1 ? `, ${i.quantity} of them` : ''}`,
    amount: itemPrice(i),
    quantity: i.quantity,
    unitPrice: itemPrice(i) / i.quantity,
  }));
  const area = items.reduce((s, i) => s + areaSqm(i) * i.quantity, 0);
  lines.push({ label: 'Installation', detail: `${Math.round(area * 100) / 100} m² fitted on site`, amount: Math.max(INSTALL_MINIMUM, Math.round(area * INSTALL_PER_SQM)) });
  lines.push(...extras);
  const total = lines.reduce((s, l) => s + l.amount, 0);
  return { lines, total, deposit: Math.round(total * SITE_DEPOSIT_RATE), validUntil: addDays(today, QUOTE_VALID_DAYS) };
}

/**
 * The first date an installation can be booked.
 * @param {string} today
 */
export const earliestInstall = (today) => addWorkingDays(today, INSTALL_NOTICE_DAYS);

/**
 * Why `date` can't be the installation date, or null.
 * @param {string} date
 * @param {string} today
 * @returns {string | null}
 */
export function installDateError(date, today) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return 'Choose a date.';
  if (date < earliestInstall(today)) return 'Choose a date at least two working days from today, so the materials are ready.';
  if (date > addDays(today, 120)) return 'Choose a date within the next four months.';
  if (!isWorkingDay(date)) return 'We install Monday to Saturday, not on public holidays.';
  return null;
}
