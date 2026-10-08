/** Formatting for the back office, in Nairobi time and Kenyan shillings. */

export const kes = (n) => (n == null ? '—' : `KES ${Number(n).toLocaleString('en-KE')}`);

export const when = (iso) =>
  iso ? new Date(iso).toLocaleString('en-KE', { timeZone: 'Africa/Nairobi', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

export const day = (ymd) => (ymd ? new Date(`${ymd}T12:00:00+03:00`).toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short' }) : '—');

export const STATUS = {
  awaiting_payment: 'Awaiting payment',
  in_design: 'In design',
  awaiting_approval: 'Awaiting approval',
  awaiting_balance: 'Awaiting balance',
  in_production: 'In production',
  ready: 'Ready',
  out_for_handover: 'Out for handover',
  completed: 'Completed',
  expired: 'Expired',
  on_hold: 'On hold',
  cancelled: 'Cancelled',
};

export const COLUMNS = [
  ['new', 'New'],
  ['design', 'In design'],
  ['approval', 'Approval'],
  ['production', 'Production'],
  ['ready', 'Ready'],
  ['out', 'Out'],
  ['done', 'Done'],
];

/** Which board column a status sits in (the API's COLUMNS). */
export const columnOf = {
  awaiting_payment: 'new',
  in_design: 'design',
  on_hold: 'design',
  awaiting_approval: 'approval',
  awaiting_balance: 'approval',
  in_production: 'production',
  ready: 'ready',
  out_for_handover: 'out',
  completed: 'done',
  cancelled: 'done',
  expired: 'done',
};

export const ATTENTION = {
  'paid-after-close': 'Paid after it closed',
  'refund-due': 'Refund due',
};

export const ROLE = { admin: 'Admin', sales: 'Sales / front desk', designer: 'Designer', production: 'Production', installer: 'Installer / rider' };
