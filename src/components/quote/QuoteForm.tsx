'use client';

import { ArrowLeft, ArrowRight, Check, FileText, Paperclip, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState, useTransition, type ChangeEvent, type DragEvent, type FormEvent } from 'react';
import { submitQuoteAction } from '@/app/quote/actions';
import type { ContactChannel, FulfilmentMethod } from '@/lib/api/types';
import { pad2 } from '@/lib/format';
import {
  ARTWORK_EXTENSIONS,
  ARTWORK_MAX_FILES,
  DETAILS_MAX,
  emptyDraft,
  formatBytes,
  nairobiToday,
  QUOTE_STEPS,
  validateQuote,
  whatsappFollowUp,
  type QuoteDraft,
  type QuoteErrors,
  type QuoteField,
} from '@/lib/quote';
import { ChoiceGroup, FieldError, Hint, TextArea, TextField } from './fields';

type Props = {
  services: { slug: string; name: string; summary: string }[];
  initialService: string;
  whatsappHref: string;
  email: string;
};

const FULFILMENT_OPTIONS: { value: FulfilmentMethod; label: string; description: string }[] = [
  { value: 'collect', label: 'I’ll collect', description: 'From our shop on Loita Street' },
  { value: 'deliver', label: 'Deliver it', description: 'Anywhere in Kenya' },
  { value: 'install', label: 'Install it', description: 'Signs, wraps and murals' },
];

const CONTACT_OPTIONS: { value: ContactChannel; label: string }[] = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'phone', label: 'Phone call' },
  { value: 'email', label: 'Email' },
];

/**
 * The quote request, in three steps. Each step is checked before moving on; the server checks
 * everything again. On success the form is replaced by a confirmation with the reference.
 */
export function QuoteForm({ services, initialService, whatsappHref, email }: Props) {
  const [draft, setDraft] = useState<QuoteDraft>(() => emptyDraft(initialService));
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<QuoteErrors>({});
  const [announcement, setAnnouncement] = useState('');
  const [failure, setFailure] = useState('');
  const [reference, setReference] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // Once the confirmation is on screen, move focus to it so screen readers announce it.
  useEffect(() => {
    if (!reference) return;
    headingRef.current?.focus();
    headingRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [reference]);

  const serviceSlugs = services.map((s) => s.slug);
  const isLast = step === QUOTE_STEPS.length - 1;
  const current = QUOTE_STEPS[step]!;

  const update = <K extends QuoteField>(field: K, value: QuoteDraft[K]) => {
    setDraft((d) => ({ ...d, [field]: value }));
    // Clear a field's error as soon as it's edited; it's checked again on Next.
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const showErrors = (found: QuoteErrors) => {
    setErrors(found);
    const fields = Object.keys(found) as QuoteField[];
    const count = fields.length;
    setAnnouncement(count === 1 ? 'One field needs attention.' : `${count} fields need attention.`);
    // Focus the first problem in page order.
    const order = QUOTE_STEPS.flatMap((s) => s.fields) as readonly QuoteField[];
    const first = order.find((f) => found[f]);
    if (first) {
      requestAnimationFrame(() => {
        const el =
          formRef.current?.querySelector<HTMLElement>(`[data-field="${first}"]`) ??
          formRef.current?.querySelector<HTMLElement>(`#${first}`);
        el?.focus();
      });
    }
  };

  const goTo = (next: number) => {
    setStep(next);
    setAnnouncement(`Step ${next + 1} of ${QUOTE_STEPS.length}: ${QUOTE_STEPS[next]!.label}`);
    requestAnimationFrame(() => {
      headingRef.current?.focus();
      headingRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setFailure('');
    const found = validateQuote(draft, serviceSlugs, isLast ? undefined : current.fields);
    if (Object.keys(found).length) {
      // On the last step a problem may sit on an earlier step: go back to it.
      const stepWithError = QUOTE_STEPS.findIndex((s) => s.fields.some((f) => found[f as QuoteField]));
      if (stepWithError !== -1 && stepWithError !== step) setStep(stepWithError);
      showErrors(found);
      return;
    }
    if (!isLast) {
      setErrors({});
      goTo(step + 1);
      return;
    }
    startTransition(async () => {
      const result = await submitQuoteAction(draft);
      if (result.ok) {
        setReference(result.reference);
      } else if (Object.keys(result.errors).length) {
        const stepWithError = QUOTE_STEPS.findIndex((s) => s.fields.some((f) => result.errors[f as QuoteField]));
        if (stepWithError !== -1) setStep(stepWithError);
        showErrors(result.errors);
      } else {
        setFailure(result.message);
        setAnnouncement(result.message);
      }
    });
  };

  const [dragging, setDragging] = useState(false);

  const addFiles = (files: FileList | null) => {
    const picked = Array.from(files ?? []).map((f) => ({ name: f.name, size: f.size, type: f.type }));
    if (!picked.length) return;
    const merged = [...draft.artwork, ...picked.filter((p) => !draft.artwork.some((a) => a.name === p.name && a.size === p.size))];
    update('artwork', merged);
    const problem = validateQuote({ ...draft, artwork: merged }, serviceSlugs, ['artwork']).artwork;
    if (problem) setErrors((er) => ({ ...er, artwork: problem }));
  };

  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    addFiles(e.target.files);
    e.target.value = '';
  };

  const onDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const removeFile = (index: number) => {
    const next = draft.artwork.filter((_, i) => i !== index);
    update('artwork', next);
    const problem = validateQuote({ ...draft, artwork: next }, serviceSlugs, ['artwork']).artwork;
    setErrors((er) => ({ ...er, artwork: problem }));
  };

  if (reference) {
    const reply =
      draft.preferredContact === 'email' ? 'by email' : draft.preferredContact === 'phone' ? 'with a call' : 'on WhatsApp';
    return (
      <div className="bg-paper p-6 sm:p-10">
        <span aria-hidden className="grid size-12 place-items-center rounded-pill bg-accent text-ink">
          <Check className="size-6" />
        </span>
        <h2 ref={headingRef} tabIndex={-1} className="mt-6 scroll-mt-28 text-[clamp(2rem,4vw,3rem)] leading-tight font-bold outline-none">
          Request sent. Thank you, {draft.name.trim().split(/\s+/)[0]}.
        </h2>
        <p className="mt-4 text-lg text-body">
          Your reference is <strong className="font-display text-2xl text-heading">{reference}</strong>. We’ll reply {reply}{' '}
          within one working day with a price and, where it helps, a proof.
        </p>
        {draft.artwork.length > 0 && (
          // TODO(backend): upload the files with the request; until then they're sent separately.
          <p className="mt-4 text-body">
            Please send your artwork files on WhatsApp or to <a href={`mailto:${email}?subject=${reference}`} className="font-semibold text-link underline">{email}</a>, quoting {reference}.
          </p>
        )}
        <div className="mt-8 flex flex-wrap gap-3">
          <a
            href={whatsappFollowUp(reference, whatsappHref)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-12 items-center gap-2 bg-whatsapp px-6 font-semibold text-bg transition-colors hover:bg-whatsapp-hover"
          >
            Continue on WhatsApp
          </a>
          <Link href="/work" className="inline-flex min-h-12 items-center border border-ink px-6 font-semibold text-ink transition-colors hover:bg-ink hover:text-bg">
            Look at our work
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate aria-labelledby="quote-step-title">
      <ol className="mb-8 grid grid-cols-3 gap-2">
        {QUOTE_STEPS.map((s, i) => (
          <li key={s.id} aria-current={i === step ? 'step' : undefined} className="flex flex-col gap-2">
            <span className={`h-1 ${i <= step ? 'bg-accent' : 'bg-border'}`} />
            <span className={`text-xs font-semibold tracking-[0.12em] uppercase ${i === step ? 'text-heading' : 'text-muted'}`}>
              <span className="tabular-nums">{pad2(i + 1)}</span>
              <span className="hidden sm:inline"> {s.label}</span>
            </span>
          </li>
        ))}
      </ol>

      <h2 id="quote-step-title" ref={headingRef} tabIndex={-1} className="scroll-mt-28 text-[clamp(1.75rem,3vw,2.5rem)] leading-tight font-bold outline-none">
        {current.label}
      </h2>

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <div className="mt-8 flex flex-col gap-8">
        {step === 0 && (
          <>
            <ChoiceGroup
              name="service"
              legend="What do you need?"
              options={services.map((s) => ({ value: s.slug, label: s.name, description: s.summary }))}
              value={draft.service}
              onChange={(v) => update('service', v)}
              error={errors.service}
            />
            <TextField
              name="quantity"
              label="How many?"
              hint="Pieces, signs or vehicles. A rough number is fine."
              inputMode="numeric"
              placeholder="e.g. 100"
              value={draft.quantity}
              onChange={(v) => update('quantity', v)}
              error={errors.quantity}
            />
            <TextArea
              name="details"
              label="Tell us about the job"
              hint="Sizes, colours, where it will be used, anything you have in mind."
              placeholder="e.g. 100 white t-shirts with our logo on the chest, sizes S to XXL, for a staff day."
              maxLength={DETAILS_MAX}
              value={draft.details}
              onChange={(v) => update('details', v)}
              error={errors.details}
            />
          </>
        )}

        {step === 1 && (
          <>
            <div>
              <p id="artwork-label" className="font-semibold text-heading">
                Artwork <span className="font-normal text-muted">(optional)</span>
              </p>
              <Hint name="artwork">
                Logos or designs: PDF, AI, EPS, SVG, PSD, CDR, PNG, JPG, TIFF or ZIP, up to {ARTWORK_MAX_FILES} files of 25 MB.
              </Hint>
              <label
                htmlFor="artwork"
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                className={`mt-3 flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 border border-dashed bg-paper px-4 py-6 text-center transition-colors hover:border-ink ${dragging ? 'border-ink bg-panel' : 'border-border-strong'} has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus`}
              >
                <Paperclip aria-hidden className="size-5 text-heading" />
                <span className="font-semibold text-heading">Choose files</span>
                <span className="text-sm text-muted">or drop them here</span>
                <input
                  ref={fileInput}
                  id="artwork"
                  type="file"
                  multiple
                  accept={ARTWORK_EXTENSIONS.map((x) => `.${x}`).join(',')}
                  onChange={onPick}
                  aria-labelledby="artwork-label"
                  aria-describedby={`artwork-hint${errors.artwork ? ' artwork-error' : ''}`}
                  aria-invalid={errors.artwork ? true : undefined}
                  className="sr-only"
                />
              </label>
              {draft.artwork.length > 0 && (
                <ul className="mt-3 border-t border-border">
                  {draft.artwork.map((file, i) => (
                    <li key={`${file.name}-${file.size}`} className="flex items-center gap-3 border-b border-border py-2">
                      <FileText aria-hidden className="size-4 shrink-0 text-muted" />
                      <span className="min-w-0 flex-1 truncate text-heading">{file.name}</span>
                      <span className="text-sm text-muted tabular-nums">{formatBytes(file.size)}</span>
                      <button
                        type="button"
                        onClick={() => removeFile(i)}
                        aria-label={`Remove ${file.name}`}
                        className="grid size-11 place-items-center text-muted transition-colors hover:text-heading"
                      >
                        <X aria-hidden className="size-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <FieldError name="artwork" error={errors.artwork} />
            </div>

            <label className="flex min-h-12 cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={draft.needsDesign}
                onChange={(e) => update('needsDesign', e.target.checked)}
                className="mt-1 size-5 shrink-0 accent-ink"
              />
              <span>
                <span className="block font-semibold text-heading">I need you to design it</span>
                <span className="block text-sm text-muted">Our studio will design it and send you a proof first.</span>
              </span>
            </label>

            <TextField
              name="deadline"
              type="date"
              label="When do you need it?"
              optional
              hint="Leave empty if there’s no fixed date."
              min={nairobiToday()}
              value={draft.deadline}
              onChange={(v) => update('deadline', v)}
              error={errors.deadline}
            />

            <ChoiceGroup
              name="fulfilment"
              legend="How should it reach you?"
              options={FULFILMENT_OPTIONS}
              value={draft.fulfilment}
              onChange={(v) => update('fulfilment', v)}
              columns={3}
            />

            {draft.fulfilment !== 'collect' && (
              <TextField
                name="location"
                label={draft.fulfilment === 'install' ? 'Where should we install it?' : 'Where should we deliver it?'}
                hint="Town and area, or the building name."
                autoComplete="street-address"
                value={draft.location}
                onChange={(v) => update('location', v)}
                error={errors.location}
              />
            )}
          </>
        )}

        {step === 2 && (
          <>
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
              <TextField name="name" label="Your name" autoComplete="name" value={draft.name} onChange={(v) => update('name', v)} error={errors.name} />
              <TextField
                name="company"
                label="Company"
                optional
                autoComplete="organization"
                value={draft.company}
                onChange={(v) => update('company', v)}
              />
              <TextField
                name="phone"
                type="tel"
                inputMode="tel"
                label="Phone"
                hint="We’ll WhatsApp or call this number."
                autoComplete="tel"
                placeholder="0722 530 301"
                value={draft.phone}
                onChange={(v) => update('phone', v)}
                error={errors.phone}
              />
              <TextField
                name="email"
                type="email"
                inputMode="email"
                label="Email"
                optional={draft.preferredContact !== 'email'}
                autoComplete="email"
                value={draft.email}
                onChange={(v) => update('email', v)}
                error={errors.email}
              />
            </div>
            <ChoiceGroup
              name="preferredContact"
              legend="How should we reply?"
              options={CONTACT_OPTIONS}
              value={draft.preferredContact}
              onChange={(v) => update('preferredContact', v)}
              columns={3}
            />
            <p className="text-sm text-muted">
              We only use your details to reply to this request. See how we handle them in our{' '}
              <Link href="/privacy" className="text-link underline">
                privacy notice
              </Link>
              .
            </p>
          </>
        )}
      </div>

      {failure && (
        <p role="alert" className="mt-8 border-l-4 border-accent bg-paper px-4 py-3 text-heading">
          {failure}
        </p>
      )}

      <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6">
        {step > 0 ? (
          <button
            type="button"
            onClick={() => goTo(step - 1)}
            className="inline-flex min-h-12 items-center gap-2 px-2 font-semibold text-heading"
          >
            <ArrowLeft aria-hidden className="size-4" />
            Back
          </button>
        ) : (
          <span />
        )}
        <button
          type="submit"
          disabled={pending}
          className="group inline-flex min-h-12 items-center gap-2 bg-ink px-7 font-semibold text-bg transition-colors hover:bg-ink-hover disabled:opacity-60"
        >
          {isLast ? (pending ? 'Sending…' : 'Send request') : 'Next'}
          {!pending && <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5" />}
        </button>
      </div>
    </form>
  );
}
