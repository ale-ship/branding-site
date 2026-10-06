/**
 * The online-ordering contract lives in `shared/contract` (the backend uses it too); the site keeps
 * importing it from here.
 */
export type * from '@shared/contract/order-types';
export { OrderError } from '@shared/contract/errors.js';
