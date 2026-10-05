'use server';

import { api } from '@/lib/api';
import { coerceDraft, toQuoteRequest, validateQuote, type QuoteErrors } from '@/lib/quote';

export type SubmitQuoteResult =
  | { ok: true; reference: string }
  | { ok: false; errors: QuoteErrors; message: string };

/**
 * Receives the quote form. Everything is checked again here: the browser's checks are only for
 * speed. Artwork arrives as file details only; the files themselves are sent on WhatsApp or by
 * email until our backend takes uploads (docs/RUNBOOK.md, Phase 3).
 */
export async function submitQuoteAction(input: unknown): Promise<SubmitQuoteResult> {
  const draft = coerceDraft(input);
  const [services, products] = await Promise.all([api.listServices(), api.listProducts()]);
  const errors = validateQuote(draft, { services: services.map((s) => s.slug), products });
  if (Object.keys(errors).length) {
    return { ok: false, errors, message: 'Some details need another look.' };
  }
  const request = toQuoteRequest(draft);
  try {
    const { reference } = await api.submitQuote(request);
    return { ok: true, reference };
  } catch {
    return { ok: false, errors: {}, message: 'We couldn’t send your request just now. Please try again, or WhatsApp us.' };
  }
}
