// @ts-check

const kes = new Intl.NumberFormat('en-KE', { maximumFractionDigits: 0 });

/**
 * Whole shillings: `KES 1,200`.
 * @param {number} amount
 * @returns {string}
 */
export function formatKes(amount) {
  return `KES ${kes.format(Math.round(amount))}`;
}

/**
 * Two-digit index for numbered lists: 1 -> `01`.
 * @param {number} n
 * @returns {string}
 */
export function pad2(n) {
  return String(n).padStart(2, '0');
}
