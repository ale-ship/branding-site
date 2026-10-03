'use server';

import { api } from '@/lib/api';
import { coerceContact, toContactMessage, validateContact, type ContactErrors } from '@/lib/contact';

export type SendMessageResult = { ok: true; reference: string } | { ok: false; errors: ContactErrors; message: string };

/** Receives the contact form. Checked again here; the browser's checks are only for speed. */
export async function sendMessageAction(input: unknown): Promise<SendMessageResult> {
  const draft = coerceContact(input);
  const errors = validateContact(draft);
  if (Object.keys(errors).length) return { ok: false, errors, message: 'Some details need another look.' };
  try {
    const { reference } = await api.sendMessage(toContactMessage(draft));
    return { ok: true, reference };
  } catch {
    return { ok: false, errors: {}, message: 'We couldn’t send your message just now. Please try again, or WhatsApp us.' };
  }
}
