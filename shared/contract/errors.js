// @ts-check

/** @typedef {import('./order-types.js').OrderErrorCode} OrderErrorCode */

/** Thrown by the order methods; the message is safe to show the customer. */
export class OrderError extends Error {
  /**
   * @param {OrderErrorCode} code
   * @param {string} message
   */
  constructor(code, message) {
    super(message);
    /** @type {OrderErrorCode} */
    this.code = code;
    this.name = 'OrderError';
  }
}
