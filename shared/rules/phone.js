// @ts-check

/**
 * Any Kenyan mobile number as typed (`0722 530 301`, `+254 722…`, `722530301`) to `+254722530301`,
 * or null when it isn't one.
 * @param {string} input
 * @returns {string | null}
 */
export function normaliseKenyanPhone(input) {
  const digits = input.replace(/[\s\-().]/g, '').replace(/^\+/, '');
  if (!/^\d+$/.test(digits)) return null;
  /** @type {string} */
  let local;
  if (digits.startsWith('254')) local = digits.slice(3);
  else if (digits.startsWith('0')) local = digits.slice(1);
  else local = digits;
  return /^[17]\d{8}$/.test(local) ? `+254${local}` : null;
}

/**
 * `+254722530301` -> `0722 530 301`, for showing and prefilling.
 * @param {string} msisdn
 * @returns {string}
 */
export function localPhone(msisdn) {
  const m = /^\+254(\d{3})(\d{3})(\d{3})$/.exec(msisdn);
  return m ? `0${m[1]} ${m[2]} ${m[3]}` : msisdn;
}

/**
 * For logs: `+254722530301` -> `+254722***301`.
 * @param {string} msisdn
 * @returns {string}
 */
export function maskForLogs(msisdn) {
  return msisdn.replace(/(\+?254|0)(\d{3})\d{3}(\d{3})/g, '$1$2***$3');
}
