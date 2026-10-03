import type { ContactMessage } from './api/types';
import { normaliseKenyanPhone } from './quote';

/** The contact form's rules, shared by the form and its server action. Tests in contact.test.ts. */

export type ContactDraft = { name: string; phone: string; email: string; message: string };
export type ContactField = keyof ContactDraft;
export type ContactErrors = Partial<Record<ContactField, string>>;

export const MESSAGE_MAX = 2000;
export const CONTACT_FIELDS: readonly ContactField[] = ['name', 'phone', 'email', 'message'];

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const emptyContact = (): ContactDraft => ({ name: '', phone: '', email: '', message: '' });

/** Rebuilds a draft from untrusted input: strings only, lengths capped. */
export function coerceContact(input: unknown): ContactDraft {
  const o = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');
  return {
    name: str(o.name, 120),
    phone: str(o.phone, 30),
    email: str(o.email, 200),
    message: str(o.message, MESSAGE_MAX + 1),
  };
}

/** A phone or an email is needed so we can reply; both are checked when given. */
export function validateContact(draft: ContactDraft): ContactErrors {
  const errors: ContactErrors = {};
  if (draft.name.trim().length < 2) errors.name = 'Tell us your name.';
  const phone = draft.phone.trim();
  const email = draft.email.trim();
  if (!phone && !email) errors.phone = 'Add a phone number or an email so we can reply.';
  if (phone && !normaliseKenyanPhone(phone)) errors.phone = 'Enter a Kenyan phone number, like 0722 530 301.';
  if (email && !EMAIL.test(email)) errors.email = 'Check your email address.';
  const message = draft.message.trim();
  if (message.length < 5) errors.message = 'Write a short message.';
  else if (draft.message.length > MESSAGE_MAX) errors.message = `Keep it under ${MESSAGE_MAX} characters.`;
  return errors;
}

/** The message to send. Call only when validateContact returns no errors. */
export function toContactMessage(draft: ContactDraft): ContactMessage {
  return {
    name: draft.name.trim(),
    phone: draft.phone.trim() ? (normaliseKenyanPhone(draft.phone) ?? '') : '',
    email: draft.email.trim(),
    message: draft.message.trim(),
  };
}
