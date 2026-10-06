import type { Mechanism, Order, OrderStatus, PaymentPurpose, PaymentStatus } from './api/order-types';

/** What customers read for each status (docs/ORDER_WORKFLOW_SPEC.md, "Order statuses"). */
export const STATUS_LABEL: Record<OrderStatus, string> = {
  awaiting_payment: 'Awaiting payment',
  in_design: 'In design',
  awaiting_approval: 'Awaiting your approval',
  awaiting_balance: 'Awaiting balance',
  in_production: 'In production',
  ready: 'Ready',
  out_for_handover: 'On its way to you',
  completed: 'Completed',
  expired: 'Expired',
  on_hold: 'On hold',
  cancelled: 'Cancelled',
};

/** Statuses that end the order. */
export const CLOSED: OrderStatus[] = ['completed', 'expired', 'cancelled'];

type Step = { label: string; statuses: OrderStatus[] };

/** The main track for each mechanism; side statuses (expired, on hold, cancelled) sit outside it. */
export const TRACKS: Record<Mechanism, Step[]> = {
  A: [
    { label: 'Deposit', statuses: ['awaiting_payment'] },
    { label: 'Design', statuses: ['in_design'] },
    { label: 'Your approval', statuses: ['awaiting_approval'] },
    { label: 'Balance', statuses: ['awaiting_balance'] },
    { label: 'Printing', statuses: ['in_production'] },
    { label: 'Ready', statuses: ['ready'] },
    { label: 'Pickup or delivery', statuses: ['out_for_handover'] },
    { label: 'Done', statuses: ['completed'] },
  ],
  B: [
    { label: 'Survey fee', statuses: ['awaiting_payment'] },
    { label: 'Survey and firm quote', statuses: ['in_design'] },
    { label: 'Deposit', statuses: [] },
    { label: 'Design approval', statuses: ['awaiting_approval'] },
    { label: 'Production and installation', statuses: ['in_production', 'ready', 'out_for_handover'] },
    { label: 'Sign-off and balance', statuses: ['awaiting_balance'] },
    { label: 'Done', statuses: ['completed'] },
  ],
  C: [
    { label: 'Payment', statuses: ['awaiting_payment'] },
    { label: 'Design', statuses: ['in_design'] },
    { label: 'Your approval', statuses: ['awaiting_approval'] },
    { label: 'Download', statuses: ['out_for_handover'] },
    { label: 'Done', statuses: ['completed'] },
  ],
};

/**
 * The current step for an order. Site jobs pass through "awaiting payment" and "in design" twice
 * (survey fee then deposit; survey then design), so the firm quote decides which step it is.
 */
export function orderTrackIndex(order: Pick<Order, 'mechanism' | 'status' | 'duePurpose' | 'siteQuote'>): number {
  if (order.mechanism === 'B') {
    if (order.status === 'awaiting_payment' && order.duePurpose === 'deposit') return 2;
    if (order.status === 'in_design' && order.siteQuote?.status === 'accepted') return 3;
  }
  return trackIndex(order.mechanism, order.status);
}

/** Index of the current step on the track, or -1 for a side status. */
export function trackIndex(mechanism: Mechanism, status: OrderStatus): number {
  return TRACKS[mechanism].findIndex((s) => s.statuses.includes(status));
}

export const PURPOSE_LABEL: Record<PaymentPurpose, string> = {
  deposit: 'Deposit',
  full: 'Full payment',
  survey_fee: 'Survey fee',
  balance: 'Balance',
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  pending: 'Waiting for the phone',
  confirmed: 'Paid',
  failed: 'Failed',
  cancelled: 'Cancelled',
  timeout: 'No answer',
};

/** `+254722530301` -> `0722 530 301`, for showing and prefilling. */
export function localPhone(msisdn: string): string {
  const m = /^\+254(\d{3})(\d{3})(\d{3})$/.exec(msisdn);
  return m ? `0${m[1]} ${m[2]} ${m[3]}` : msisdn;
}
