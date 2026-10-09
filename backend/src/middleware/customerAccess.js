// @ts-check

/**
 * How a request proves an order is the customer's (docs/BACKEND_RUNBOOK.md, section 4): the secret
 * link's token in `X-Order-Token`, the phone the order was placed with in `X-Order-Phone` (order
 * number + phone), or a signed-in account's session in `X-Account-Session` (the site's server passes
 * it on from its cookie; the email always comes from the session, never from the request). Headers,
 * never the URL, so none of them end up in access logs.
 *
 * @typedef {{ token: string } | { phone: string } | { session: string }} Access
 * @param {import('express').Request} req
 * @returns {Access}
 */
export function accessFrom(req) {
  const token = req.get('x-order-token');
  const phone = req.get('x-order-phone');
  const session = req.get('x-account-session');
  if (token) return { token };
  if (phone) return { phone };
  if (session) return { session };
  return { token: '' };
}
