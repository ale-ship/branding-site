// @ts-check
import { fromDarajaC2B } from '@noorcom-branding/shared/rules/c2b.js';

/**
 * Absa's C2B confirmation → `C2BConfirmation`. Absa is expected to forward Daraja's C2B fields
 * (TransID, TransAmount, MSISDN, BillRefNumber…); if its documentation differs, write the adapter
 * here and keep everything else (shared/rules/c2b.js routes it).
 */
export const fromAbsaC2B = fromDarajaC2B;
