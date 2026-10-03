const kes = new Intl.NumberFormat('en-KE', { maximumFractionDigits: 0 });

/** Whole shillings: `KES 1,200`. */
export function formatKes(amount: number): string {
  return `KES ${kes.format(Math.round(amount))}`;
}

/** Two-digit index for numbered lists: 1 -> `01`. */
export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}
