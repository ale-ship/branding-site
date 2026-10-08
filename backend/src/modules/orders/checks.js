// @ts-check
import { OrderError } from '@noorcom-branding/shared/contract/errors.js';

/**
 * What the request schema can't know: checks against the product being ordered. Pure; the service
 * runs them before it opens a transaction. The browser ran the same rules (src/lib/order.ts), but
 * only the server's answer counts.
 *
 * @typedef {import('@noorcom-branding/shared/contract/order-types.js').OrderProduct} OrderProduct
 * @typedef {import('@noorcom-branding/shared/contract/order-types.js').OrderInput} OrderInput
 * @typedef {import('@noorcom-branding/shared/contract/order-types.js').BriefValue} BriefValue
 */

/** @param {BriefValue | undefined} v */
function answered(v) {
  if (v == null || v === '') return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object' && !('widthCm' in v)) return Object.values(v).some((n) => n > 0);
  return true;
}

/**
 * @param {OrderProduct} product
 * @param {Pick<OrderInput, 'quantity' | 'brief' | 'handover'>} input
 */
export function checkOrderInput(product, input) {
  if (product.mechanism === 'A' && input.quantity < product.minQuantity) {
    throw new OrderError('invalid', `The smallest order is ${product.minQuantity.toLocaleString('en-KE')} pieces.`);
  }
  const missing = product.brief.find((f) => f.required && !answered(input.brief[f.id]));
  if (missing) throw new OrderError('invalid', `Please answer “${missing.label}” in the brief.`);
  // Site jobs are installed, design jobs delivered as files, the rest collected or delivered.
  const method = input.handover.method;
  const allowed = product.mechanism === 'B' ? method === 'install' : product.mechanism === 'C' ? method === 'digital' : method === 'pickup' || method === 'delivery';
  if (!allowed) throw new OrderError('invalid', 'That way of receiving the work isn’t offered for this item.');
  if ((method === 'delivery' || method === 'install') && !('address' in input.handover && input.handover.address)) {
    throw new OrderError('invalid', method === 'install' ? 'Please give the site’s address.' : 'Please give the delivery address.');
  }
}
