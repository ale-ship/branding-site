'use client';

import { ArrowLeft, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useRef, useState, useTransition, type FormEvent } from 'react';
import { createOrderAction } from '@/app/order/actions';
import type { OrderProduct } from '@/lib/api/order-types';
import { formatDay } from '@/lib/calendar';
import { formatKes, pad2 } from '@/lib/format';
import { emptyOrderDraft, ORDER_STEPS, stepOfField, toPriceRequest, validateOrderDraft, type DraftBriefValue, type OrderDraft, type OrderErrors } from '@/lib/order';
import { DELIVERY_ZONES, estimatePrice } from '@/lib/pricing';
import { nairobiToday } from '@/lib/quote';
import { ChoiceGroup, FieldError, TextField } from '../quote/fields';
import { BriefFields } from './BriefFields';
import { CommonBriefFields } from './CommonBriefFields';
import { fieldId } from './controls';
import { PriceSummary } from './PriceSummary';

type Props = { product: OrderProduct; prefill?: { quantity?: string; brief?: Record<string, string> } };

const MECHANISM_NOTE: Record<OrderProduct['mechanism'], string> = {
  A: 'Priced now. Pay a deposit (or in full under KES 5,000), approve a proof, pay the balance, and we print.',
  B: 'Pay the survey fee now. We visit, measure and send a firm price; the fee comes off your final bill.',
  C: 'Pay now. We send proofs; your files unlock when you approve the final design.',
};

/**
 * The order: four steps, each checked before moving on, with the price live beside it. Placing
 * the order sends everything to the server, which checks and prices it again, then the order page
 * takes the payment (docs/ORDER_WORKFLOW_SPEC.md).
 */
export function OrderForm({ product, prefill }: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState<OrderDraft>(() => {
    const d = emptyOrderDraft(product);
    if (prefill?.quantity && product.mechanism === 'A') d.quantity = prefill.quantity;
    if (prefill?.brief) Object.assign(d.brief, prefill.brief);
    return d;
  });
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<OrderErrors>({});
  const [announcement, setAnnouncement] = useState('');
  const [failure, setFailure] = useState('');
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const current = ORDER_STEPS[step]!;
  const isLast = step === ORDER_STEPS.length - 1;
  const estimate = useMemo(() => estimatePrice(product, toPriceRequest(draft, product), nairobiToday()), [draft, product]);
  const quantity = Number(toPriceRequest(draft, product).quantity);

  const clear = (key: string) => errors[key] && setErrors((e) => ({ ...e, [key]: undefined }));
  const update = <K extends keyof OrderDraft>(key: K, value: OrderDraft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    clear(key);
  };
  const updateBrief = (id: string, value: DraftBriefValue) => {
    setDraft((d) => ({ ...d, brief: { ...d.brief, [id]: value } }));
    clear(`brief.${id}`);
  };

  const showErrors = (found: OrderErrors) => {
    const keys = Object.keys(found).filter((k) => found[k]);
    setErrors(found);
    setAnnouncement(keys.length === 1 ? 'One field needs attention.' : `${keys.length} fields need attention.`);
    const first = keys[0];
    if (!first) return;
    const target = ORDER_STEPS.findIndex((s) => s.id === stepOfField(first));
    if (target !== -1 && target !== step) setStep(target);
    requestAnimationFrame(() => {
      const id = fieldId(first);
      (formRef.current?.querySelector<HTMLElement>(`[data-field="${id}"]`) ?? document.getElementById(id))?.focus();
    });
  };

  const goTo = (next: number) => {
    setStep(next);
    setAnnouncement(`Step ${next + 1} of ${ORDER_STEPS.length}: ${ORDER_STEPS[next]!.label}`);
    requestAnimationFrame(() => {
      headingRef.current?.focus();
      headingRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setFailure('');
    const found = validateOrderDraft(draft, product, isLast ? undefined : current.id);
    if (Object.keys(found).length) return showErrors(found);
    if (!isLast) {
      setErrors({});
      return goTo(step + 1);
    }
    startTransition(async () => {
      const result = await createOrderAction(product.slug, draft);
      if (result.ok) {
        router.push(`/order/${result.ref}?t=${result.token}`);
      } else if (result.errors && Object.keys(result.errors).length) {
        showErrors(result.errors);
      } else {
        setFailure(result.message);
        setAnnouncement(result.message);
      }
    });
  };

  const designFee = product.mechanism === 'A' ? product.designFee : 0;

  return (
    <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] lg:gap-16">
      <form ref={formRef} onSubmit={onSubmit} noValidate aria-labelledby="order-step-title">
        <ol className="mb-8 grid grid-cols-4 gap-2">
          {ORDER_STEPS.map((s, i) => (
            <li key={s.id} aria-current={i === step ? 'step' : undefined} className="flex flex-col gap-2">
              <span className={`h-1 ${i <= step ? 'bg-accent' : 'bg-border'}`} />
              <span className={`text-xs font-semibold tracking-[0.12em] uppercase ${i === step ? 'text-heading' : 'text-muted'}`}>
                <span className="tabular-nums">{pad2(i + 1)}</span>
                <span className="hidden md:inline"> {s.label}</span>
              </span>
            </li>
          ))}
        </ol>

        <h2 id="order-step-title" ref={headingRef} tabIndex={-1} className="scroll-mt-28 text-[clamp(1.75rem,3vw,2.5rem)] leading-tight font-bold outline-none">
          {current.label}
        </h2>
        <p aria-live="polite" className="sr-only">
          {announcement}
        </p>

        {/* Phones: the price sits at the top of each step, folded. */}
        <details className="mt-6 border border-border bg-bg lg:hidden">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 px-4 [&::-webkit-details-marker]:hidden">
            <span className="text-sm font-semibold text-heading">Price</span>
            <span className="text-sm text-heading tabular-nums">
              {estimate.total !== null ? formatKes(estimate.total) : 'After survey'} · pay now <strong>{formatKes(estimate.dueNow.amount)}</strong>
            </span>
          </summary>
          <div className="border-t border-border p-4">
            <PriceSummary estimate={estimate} />
          </div>
        </details>

        <div className="mt-8 flex flex-col gap-8">
          {current.id === 'what' && (
            <>
              <p className="bg-paper px-4 py-3 text-sm text-body">{MECHANISM_NOTE[product.mechanism]}</p>
              {product.mechanism === 'A' && (
                <TextField
                  name="quantity"
                  label="How many?"
                  hint={`Minimum ${product.minQuantity}. ${[...product.priceTiers]
                    .sort((a, b) => a.minQty - b.minQty)
                    .map((t) => `${t.minQty}+: ${formatKes(t.unitPrice)}`)
                    .join(' · ')} each.`}
                  inputMode="numeric"
                  value={draft.quantity}
                  onChange={(v) => update('quantity', v)}
                  error={errors.quantity}
                />
              )}
              <BriefFields fields={product.brief} values={draft.brief} onChange={updateBrief} errors={errors} quantity={quantity} />
            </>
          )}

          {current.id === 'brief' && (
            <CommonBriefFields
              value={draft.common}
              onChange={(common) => {
                setDraft((d) => ({ ...d, common }));
                setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !k.startsWith('common.'))));
              }}
              errors={errors}
              mechanism={product.mechanism}
              designFee={designFee}
            />
          )}

          {current.id === 'when' && (
            <>
              {product.mechanism === 'B' ? (
                <div className="bg-paper p-5 text-body">
                  <p className="font-semibold text-heading">We’ll survey on one of your dates</p>
                  <p className="mt-1">
                    {(Array.isArray(draft.brief.surveyDates) ? draft.brief.surveyDates.filter(Boolean) : []).map((d) => formatDay(d)).join(' or ')}. Installation is
                    scheduled with you once you accept the firm price.
                  </p>
                </div>
              ) : (
                <fieldset>
                  <legend className="font-semibold text-heading">When do you need it?</legend>
                  <p className="mt-1.5 text-sm text-muted">Dates count from when you approve the proof.</p>
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {estimate.tiers.map((t, i) => (
                      <label
                        key={t.code}
                        htmlFor={`urgency-${t.code}`}
                        className={`flex min-h-14 items-start gap-3 border px-4 py-3.5 transition-colors has-[:checked]:border-ink has-[:checked]:bg-paper has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus ${
                          t.available ? 'cursor-pointer border-border-strong hover:border-ink' : 'cursor-not-allowed border-border text-muted'
                        }`}
                      >
                        <input
                          id={`urgency-${t.code}`}
                          {...(i === 0 ? { 'data-field': 'urgency' } : {})}
                          type="radio"
                          name="urgency"
                          value={t.code}
                          disabled={!t.available}
                          checked={estimate.urgency.code === t.code}
                          onChange={() => update('urgency', t.code)}
                          className="mt-1 size-4 shrink-0 accent-ink"
                        />
                        <span className="min-w-0">
                          <span className="block font-semibold text-heading">
                            {t.label}
                            {t.multiplier !== 1 && (
                              <span className="ml-2 text-sm font-normal text-muted">
                                {t.multiplier > 1 ? '+' : '−'}
                                {Math.round(Math.abs(t.multiplier - 1) * 100)}%
                              </span>
                            )}
                          </span>
                          {t.available ? (
                            <span className="block text-sm text-body">
                              Ready {t.readyBy ? formatDay(t.readyBy) : ''} · {formatKes(t.total ?? 0)}
                            </span>
                          ) : (
                            <span className="block text-sm">{t.reason}</span>
                          )}
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}

              {product.mechanism === 'A' && (
                <>
                  <ChoiceGroup
                    name="handover"
                    legend="How should it reach you?"
                    value={draft.handover}
                    onChange={(v) => update('handover', v as OrderDraft['handover'])}
                    options={[
                      { value: 'pickup', label: 'I’ll collect', description: 'Free, from Chuka Elimu Plaza, Loita Street' },
                      { value: 'delivery', label: 'Deliver it', description: 'In Nairobi or by courier countrywide' },
                    ]}
                  />
                  {draft.handover === 'delivery' && (
                    <>
                      <ChoiceGroup
                        name="zone"
                        legend="Where to?"
                        value={draft.zone}
                        onChange={(v) => update('zone', v as OrderDraft['zone'])}
                        options={DELIVERY_ZONES.map((z) => ({ value: z.zone, label: `${z.label}: ${formatKes(z.fee)}`, description: z.note }))}
                      />
                      <TextField name="address" label="Delivery address" hint="Building, street, area and town." autoComplete="street-address" value={draft.address} onChange={(v) => update('address', v)} error={errors.address} />
                    </>
                  )}
                </>
              )}
              {product.mechanism === 'C' && <p className="text-body">Your final files unlock on your order page, and we email the link.</p>}
            </>
          )}

          {current.id === 'you' && (
            <>
              <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
                <TextField name="name" label="Your name" autoComplete="name" value={draft.name} onChange={(v) => update('name', v)} error={errors.name} />
                <TextField name="company" label="Company" optional autoComplete="organization" value={draft.company} onChange={(v) => update('company', v)} />
                <TextField
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  label="Phone"
                  hint="For M-Pesa and WhatsApp updates."
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
                  hint="For your receipt, invoice and proofs."
                  autoComplete="email"
                  value={draft.email}
                  onChange={(v) => update('email', v)}
                  error={errors.email}
                />
              </div>

              <div className="border border-border p-5">
                <p className="font-semibold text-heading">{product.name}</p>
                <p className="mt-1 text-sm text-body">
                  {product.mechanism === 'A' && `${quantity.toLocaleString('en-KE')} pieces · `}
                  {estimate.urgency.label} deadline
                  {estimate.readyBy && `, ready about ${formatDay(estimate.readyBy)}`}
                  {product.mechanism === 'A' && (draft.handover === 'delivery' ? ' · delivery' : ' · collect on Loita Street')}
                </p>
                <p className="mt-3 text-sm text-muted">
                  Next: pay <strong className="text-heading">{formatKes(estimate.dueNow.amount)}</strong> by M-Pesa on your order page. Nothing is charged until you confirm on your phone.
                </p>
              </div>

              <div>
                <label htmlFor="agree" className="flex min-h-11 cursor-pointer items-start gap-3">
                  <input
                    id="agree"
                    type="checkbox"
                    checked={draft.agree}
                    onChange={(e) => update('agree', e.target.checked)}
                    aria-invalid={errors.agree ? true : undefined}
                    aria-describedby={errors.agree ? 'agree-error' : undefined}
                    className="mt-1 size-5 shrink-0 accent-ink"
                  />
                  <span className="text-body">
                    I agree to the{' '}
                    <Link href="/terms" target="_blank" className="font-semibold text-link underline">
                      Terms
                    </Link>{' '}
                    and understand printing starts only after I approve a proof.
                  </span>
                </label>
                <FieldError name="agree" error={errors.agree} />
              </div>
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
            <button type="button" onClick={() => goTo(step - 1)} className="inline-flex min-h-12 items-center gap-2 px-2 font-semibold text-heading">
              <ArrowLeft aria-hidden className="size-4" />
              Back
            </button>
          ) : (
            <Link href="/order" className="inline-flex min-h-12 items-center gap-2 px-2 font-semibold text-heading">
              <ArrowLeft aria-hidden className="size-4" />
              Change item
            </Link>
          )}
          <button
            type="submit"
            disabled={pending}
            className="group inline-flex min-h-12 items-center gap-2 bg-ink px-7 font-semibold text-bg transition-colors hover:bg-ink-hover disabled:opacity-60"
          >
            {isLast ? (pending ? 'Placing your order…' : `Place order · pay ${formatKes(estimate.dueNow.amount)}`) : 'Next'}
            {!pending && <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5" />}
          </button>
        </div>
      </form>

      <aside aria-label="Price" className="hidden lg:sticky lg:top-28 lg:block lg:self-start">
        <div className="border border-border p-6">
          <PriceSummary estimate={estimate} />
        </div>
      </aside>
    </div>
  );
}
