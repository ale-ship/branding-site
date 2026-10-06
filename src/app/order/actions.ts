'use server';

import { cookies } from 'next/headers';
import { api, demo, OrderError, type Order, type OrderAccess, type OrderPayment } from '@/lib/api';
import { coerceOrderDraft, toOrderInput, validateOrderDraft, type OrderErrors } from '@/lib/order';
import { normaliseKenyanPhone } from '@/lib/quote';
import { accessCookie, parseAccess } from './access';

/**
 * The order flow's server side. Everything the browser sends is coerced and checked again; prices
 * are worked out by the API, never taken from the browser (docs/ORDER_WORKFLOW_SPEC.md).
 */

type Fail = { ok: false; message: string; errors?: OrderErrors };

const COOKIE_OPTIONS = { httpOnly: true, sameSite: 'lax' as const, secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 90 };

async function remember(ref: string, value: OrderAccess) {
  (await cookies()).set(accessCookie(ref), 'token' in value ? `t:${value.token}` : `p:${value.phone}`, COOKIE_OPTIONS);
}

/** The token from the link if there is one, else what this browser remembers for the order. */
async function resolveAccess(ref: string, token: string): Promise<OrderAccess> {
  if (token) return { token: String(token) };
  return parseAccess((await cookies()).get(accessCookie(String(ref)))?.value) ?? { token: '' };
}

const failure = (e: unknown, fallback: string): Fail =>
  e instanceof OrderError ? { ok: false, message: e.message } : { ok: false, message: fallback };

export async function createOrderAction(productSlug: string, input: unknown): Promise<{ ok: true; ref: string; token: string } | Fail> {
  const product = await api.getOrderProduct(String(productSlug));
  if (!product) return { ok: false, message: 'That item can’t be ordered online.' };
  const draft = coerceOrderDraft(input, product);
  const errors = validateOrderDraft(draft, product);
  if (Object.keys(errors).length) return { ok: false, message: 'Some details need another look.', errors };
  try {
    const { ref, token } = await api.createOrder(toOrderInput(draft, product));
    await remember(ref, { token });
    return { ok: true, ref, token };
  } catch (e) {
    return failure(e, 'We couldn’t place your order just now. Please try again, or WhatsApp us.');
  }
}

export async function startPaymentAction(ref: string, token: string, phone: string): Promise<{ ok: true; payment: OrderPayment } | Fail> {
  try {
    return { ok: true, payment: await api.startPayment(String(ref), await resolveAccess(ref, token), String(phone)) };
  } catch (e) {
    return failure(e, 'We couldn’t send the M-Pesa prompt. Please try again, or pay by Paybill.');
  }
}

/** What the payment panel polls while waiting for the phone. */
export async function paymentStatusAction(ref: string, token: string): Promise<Pick<Order, 'status' | 'dueNow' | 'payments'> | null> {
  const order = await api.getOrder(String(ref), await resolveAccess(ref, token));
  return order ? { status: order.status, dueNow: order.dueNow, payments: order.payments } : null;
}

/** "Find my order": order number and the phone used to order. */
export async function lookupOrderAction(ref: string, phone: string): Promise<{ ok: true; ref: string } | Fail> {
  const clean = String(ref).trim().toUpperCase();
  const msisdn = normaliseKenyanPhone(String(phone));
  if (!/^NB-\d{6}$/.test(clean)) return { ok: false, message: 'Order numbers look like NB-123456.' };
  if (!msisdn) return { ok: false, message: 'Enter the phone number you ordered with.' };
  const order = await api.getOrder(clean, { phone: msisdn });
  // One message for both cases, so the form can't be used to test which numbers exist.
  if (!order) return { ok: false, message: 'We couldn’t find an order with that number and phone.' };
  await remember(clean, { phone: msisdn });
  return { ok: true, ref: clean };
}

export type DemoAction = 'paybill-full' | 'paybill-part' | 'paybill-no-ref' | 'repeat-callback' | 'upload-proof' | 'approve-proof' | 'request-changes' | 'log-progress' | 'hand-over' | 'skip-wait';

/** Mock only: plays the parts of M-Pesa and the staff, so the flow can be tried end to end. */
export async function demoAction(ref: string, token: string, action: DemoAction): Promise<{ ok: true; message: string } | Fail> {
  if (!demo) return { ok: false, message: 'Demo controls are off.' };
  const access = await resolveAccess(ref, token);
  try {
    const order = await api.getOrder(String(ref), access);
    if (!order) return { ok: false, message: 'Order not found.' };
    switch (action) {
      case 'paybill-full':
        demo.paybill(order.ref, order.dueNow || 1000);
        return { ok: true, message: `Paybill payment of KES ${(order.dueNow || 1000).toLocaleString('en-KE')} received.` };
      case 'paybill-no-ref': {
        const route = demo.paybillWithoutReference(order.ref, order.dueNow || 1000);
        return {
          ok: true,
          message:
            route.kind === 'matched'
              ? 'Paybill payment without the order number: matched by phone and amount.'
              : `Paybill payment without the order number: not matched (${route.reason}); held for staff.`,
        };
      }
      case 'paybill-part': {
        const part = Math.max(100, Math.floor(order.dueNow / 2));
        demo.paybill(order.ref, part);
        return { ok: true, message: `Part payment of KES ${part.toLocaleString('en-KE')} received.` };
      }
      case 'repeat-callback':
        return { ok: true, message: demo.repeatLastCallback(order.ref) ? 'Credited (unexpected).' : 'Repeated callback ignored: the receipt was already used.' };
      case 'upload-proof':
        demo.uploadProof(order.ref);
        return { ok: true, message: 'Proof uploaded.' };
      case 'approve-proof': {
        const proof = order.proofs.at(-1);
        if (!proof) return { ok: false, message: 'No proof yet.' };
        await api.approveProof(order.ref, access, proof.version);
        return { ok: true, message: `Proof v${proof.version} approved.` };
      }
      case 'request-changes': {
        const proof = order.proofs.at(-1);
        if (!proof) return { ok: false, message: 'No proof yet.' };
        await api.requestChanges(order.ref, access, proof.version, 'Please make the logo bigger.');
        return { ok: true, message: 'Changes requested.' };
      }
      case 'log-progress':
        demo.logProgress(order.ref, Math.max(1, Math.ceil(order.quantity / 3)));
        return { ok: true, message: 'Production logged.' };
      case 'hand-over':
        demo.handOver(order.ref);
        return { ok: true, message: 'Handed over.' };
      case 'skip-wait':
        demo.fastForward(order.ref, 61_000);
        return { ok: true, message: 'Skipped the wait.' };
    }
  } catch (e) {
    return failure(e, 'That didn’t work.');
  }
}
