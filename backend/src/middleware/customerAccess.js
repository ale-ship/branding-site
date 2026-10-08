// @ts-check

/**
 * How a request proves an order is the customer's (docs/BACKEND_RUNBOOK.md, section 4): the secret
 * link's token in `X-Order-Token`, or the phone the order was placed with in `X-Order-Phone` (order
 * number + phone). Headers, never the URL, so neither ends up in access logs. Access by a signed-in
 * account comes with sessions (B5).
 *
 * @param {import('express').Request} req
 * @returns {{ token: string } | { phone: string }}
 */
export function accessFrom(req) {
  const phone = req.get('x-order-phone');
  if (phone && !req.get('x-order-token')) return { phone };
  return { token: req.get('x-order-token') ?? '' };
}
