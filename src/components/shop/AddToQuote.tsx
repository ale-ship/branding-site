'use client';

import { ArrowRight, Check, Minus, Plus } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import type { ProductOption } from '@/lib/api/types';
import { formatKes } from '@/lib/format';
import { describeOptions, itemKey, QUANTITY_MAX } from '@/lib/quote-list';
import { clampQuantity } from '@/lib/shop';
import { useQuoteList } from './useQuoteList';

type Props = {
  slug: string;
  name: string;
  pricePerPiece: number;
  minQuantity: number;
  options: ProductOption[];
};

/**
 * Options, quantity and "Add to quote" on a product page. There is no payment: the item goes
 * into the quote list and is sent with /quote. The quantity starts at the minimum order.
 */
export function AddToQuote({ slug, name, pricePerPiece, minQuantity, options }: Props) {
  const quoteList = useQuoteList();
  const [chosen, setChosen] = useState<Record<string, string>>(() =>
    Object.fromEntries(options.map((o) => [o.name, o.values[0] ?? ''])),
  );
  const [qtyText, setQtyText] = useState(String(minQuantity));
  const [added, setAdded] = useState<string | null>(null);

  const typed = Number(qtyText);
  const quantity = Number.isInteger(typed) ? typed : NaN;
  const valid = quantity >= minQuantity && quantity <= QUANTITY_MAX;
  const step = minQuantity >= 50 ? 10 : 1;
  const inList = quoteList.items.find((i) => itemKey(i) === itemKey({ slug, options: chosen }));

  const setQuantity = (n: number) => {
    setQtyText(String(clampQuantity(n, minQuantity, QUANTITY_MAX)));
    setAdded(null);
  };

  const add = () => {
    if (!valid) return;
    quoteList.add({ slug, quantity, options: chosen });
    setAdded(`${quantity.toLocaleString('en-KE')} × ${name}${options.length ? ` (${describeOptions(chosen)})` : ''}`);
  };

  return (
    <div className="flex flex-col gap-7">
      {options.map((option) => (
        <fieldset key={option.name}>
          <legend className="text-sm font-semibold text-heading">
            {option.name}: <span className="font-normal text-body">{chosen[option.name]}</span>
          </legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {option.values.map((value) => {
              const id = `${slug}-${option.name}-${value}`.replace(/[^a-zA-Z0-9-]/g, '-');
              return (
                <label
                  key={value}
                  htmlFor={id}
                  className="inline-flex min-h-11 cursor-pointer items-center border border-border-strong px-4 text-sm font-medium text-heading transition-colors hover:border-ink has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-bg has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus"
                >
                  <input
                    id={id}
                    type="radio"
                    name={`${slug}-${option.name}`}
                    value={value}
                    checked={chosen[option.name] === value}
                    onChange={() => {
                      setChosen((c) => ({ ...c, [option.name]: value }));
                      setAdded(null);
                    }}
                    className="sr-only"
                  />
                  {value}
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}

      <div>
        <label htmlFor={`${slug}-qty`} className="text-sm font-semibold text-heading">
          Quantity <span className="font-normal text-muted">(minimum {minQuantity})</span>
        </label>
        <div className="mt-3 flex items-stretch">
          <button
            type="button"
            onClick={() => setQuantity((Number.isFinite(quantity) ? quantity : minQuantity) - step)}
            disabled={Number.isFinite(quantity) && quantity <= minQuantity}
            aria-label={`${step} fewer`}
            className="grid size-12 place-items-center border border-border-strong text-heading transition-colors hover:border-ink disabled:opacity-40"
          >
            <Minus aria-hidden className="size-4" />
          </button>
          <input
            id={`${slug}-qty`}
            type="number"
            inputMode="numeric"
            min={minQuantity}
            max={QUANTITY_MAX}
            step={1}
            value={qtyText}
            onChange={(e) => {
              setQtyText(e.target.value);
              setAdded(null);
            }}
            onBlur={() => {
              if (!valid) setQuantity(Number.isFinite(quantity) ? quantity : minQuantity);
            }}
            aria-invalid={!valid || undefined}
            aria-describedby={`${slug}-qty-note`}
            className="-mx-px min-h-12 w-28 border border-border-strong bg-bg text-center text-lg font-semibold text-heading tabular-nums focus:z-10"
          />
          <button
            type="button"
            onClick={() => setQuantity((Number.isFinite(quantity) ? quantity : minQuantity) + step)}
            aria-label={`${step} more`}
            className="grid size-12 place-items-center border border-border-strong text-heading transition-colors hover:border-ink"
          >
            <Plus aria-hidden className="size-4" />
          </button>
        </div>
        <p id={`${slug}-qty-note`} className={`mt-2 text-sm ${valid ? 'text-muted' : 'font-medium text-accent-ink'}`}>
          {valid
            ? `About ${formatKes(quantity * pricePerPiece)} before design and delivery. Bigger runs cost less: we confirm the price in your quote.`
            : `Enter at least ${minQuantity} pieces.`}
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={add}
          disabled={!valid}
          className="inline-flex min-h-12 items-center justify-center gap-2 bg-ink px-7 font-semibold text-bg transition-colors hover:bg-ink-hover disabled:opacity-50"
        >
          {inList && !added ? 'Update quote' : 'Add to quote'}
        </button>
        {inList && !added && (
          <p className="text-sm text-muted">
            Already in your quote: {inList.quantity.toLocaleString('en-KE')} pieces with these options.
          </p>
        )}
      </div>

      <div aria-live="polite">
        {added && (
          <div className="flex flex-col gap-3 border-l-4 border-accent bg-paper px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-start gap-2 text-heading">
              <Check aria-hidden className="mt-0.5 size-5 shrink-0 text-accent-ink" />
              <span>
                Added {added}. Your quote has {quoteList.items.length} {quoteList.items.length === 1 ? 'item' : 'items'}.
              </span>
            </p>
            <Link href="/quote" className="group inline-flex min-h-11 shrink-0 items-center gap-2 font-semibold text-heading underline decoration-accent decoration-2 underline-offset-4">
              Review and send
              <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
