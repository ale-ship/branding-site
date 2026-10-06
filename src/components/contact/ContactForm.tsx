'use client';

import { Check } from 'lucide-react';
import { useEffect, useRef, useState, useTransition, type FormEvent } from 'react';
import { sendMessageAction } from '@/app/contact/actions';
import { CONTACT_FIELDS, emptyContact, MESSAGE_MAX, validateContact, type ContactDraft, type ContactErrors, type ContactField } from '@/lib/contact';
import { TextArea, TextField } from '../quote/fields';

/** A short message form. For prices, the quote form is better; the page says so. */
export function ContactForm() {
  const [draft, setDraft] = useState<ContactDraft>(emptyContact);
  const [errors, setErrors] = useState<ContactErrors>({});
  const [announcement, setAnnouncement] = useState('');
  const [failure, setFailure] = useState('');
  const [reference, setReference] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const doneRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (reference) doneRef.current?.focus();
  }, [reference]);

  const update = (field: ContactField, value: string) => {
    setDraft((d) => ({ ...d, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const showErrors = (found: ContactErrors) => {
    setErrors(found);
    const count = Object.keys(found).length;
    setAnnouncement(count === 1 ? 'One field needs attention.' : `${count} fields need attention.`);
    const first = CONTACT_FIELDS.find((f) => found[f]);
    if (first) requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>(`#contact-${first}`)?.focus());
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setFailure('');
    const found = validateContact(draft);
    if (Object.keys(found).length) return showErrors(found);
    startTransition(async () => {
      const result = await sendMessageAction(draft);
      if (result.ok) setReference(result.reference);
      else if (Object.keys(result.errors).length) showErrors(result.errors);
      else {
        setFailure(result.message);
        setAnnouncement(result.message);
      }
    });
  };

  if (reference) {
    return (
      <div className="bg-paper p-6 sm:p-10">
        <span aria-hidden className="grid size-12 place-items-center rounded-pill bg-accent text-on-accent">
          <Check className="size-6" />
        </span>
        <h2 ref={doneRef} tabIndex={-1} className="mt-6 text-[clamp(1.75rem,3vw,2.5rem)] leading-tight font-bold outline-none">
          Message sent
        </h2>
        <p className="mt-3 text-lg text-body">
          Thank you, {draft.name.trim().split(/\s+/)[0]}. Your reference is <strong className="text-heading">{reference}</strong>; we’ll reply
          within one working day.
        </p>
      </div>
    );
  }

  // Field ids are prefixed so they can't clash with anything else on the page.
  const field = (name: ContactField) => `contact-${name}`;
  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate aria-labelledby="contact-form-title" className="flex flex-col gap-7">
      <h2 id="contact-form-title" className="text-[clamp(1.75rem,3vw,2.5rem)] leading-tight font-bold">
        Send us a message
      </h2>
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
      <TextField name={field('name')} label="Your name" autoComplete="name" value={draft.name} onChange={(v) => update('name', v)} error={errors.name} />
      <div className="grid grid-cols-1 gap-7 sm:grid-cols-2">
        <TextField
          name={field('phone')}
          type="tel"
          inputMode="tel"
          label="Phone"
          autoComplete="tel"
          placeholder="0722 530 301"
          value={draft.phone}
          onChange={(v) => update('phone', v)}
          error={errors.phone}
        />
        <TextField
          name={field('email')}
          type="email"
          inputMode="email"
          label="Email"
          optional
          autoComplete="email"
          value={draft.email}
          onChange={(v) => update('email', v)}
          error={errors.email}
        />
      </div>
      <TextArea
        name={field('message')}
        label="Message"
        maxLength={MESSAGE_MAX}
        value={draft.message}
        onChange={(v) => update('message', v)}
        error={errors.message}
      />
      {failure && (
        <p role="alert" className="border-l-4 border-accent bg-paper px-4 py-3 text-heading">
          {failure}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-12 items-center justify-center self-start bg-ink px-7 font-semibold text-bg transition-colors hover:bg-ink-hover disabled:opacity-60"
      >
        {pending ? 'Sending…' : 'Send message'}
      </button>
    </form>
  );
}
