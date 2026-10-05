'use client';

import type { BriefField, BriefOption } from '@/lib/api/order-types';
import { addWorkingDays } from '@/lib/calendar';
import { formatKes } from '@/lib/format';
import type { DraftBriefValue } from '@/lib/order';
import { nairobiToday } from '@/lib/quote';
import { FieldError, Hint, inputClass, TextArea, TextField } from '../quote/fields';
import { Chips, fieldId } from './controls';

/** "+KES 4 each" / "+KES 1,500 once" for a priced option. */
function priceNote(o: { unitDelta?: number; fixedDelta?: number }): string | undefined {
  const sign = (n: number) => (n > 0 ? '+' : '−');
  if (o.unitDelta) return `${sign(o.unitDelta)}${formatKes(Math.abs(o.unitDelta))} each`;
  if (o.fixedDelta) return `${sign(o.fixedDelta)}${formatKes(Math.abs(o.fixedDelta))} once`;
  return undefined;
}
const chipOptions = (options: BriefOption[]) => options.map((o) => ({ value: o.value, label: o.label, note: priceNote(o) }));

type Props = {
  fields: BriefField[];
  values: Record<string, DraftBriefValue>;
  onChange: (id: string, value: DraftBriefValue) => void;
  errors: Record<string, string | undefined>;
  /** The order quantity, for the sizes total. */
  quantity: number;
};

/**
 * Draws any product's brief from its schema (docs/ORDER_WORKFLOW_SPEC.md, "Brief forms by
 * category"): a new product needs data, not code. Error keys are `brief.<field id>`.
 */
export function BriefFields({ fields, values, onChange, errors, quantity }: Props) {
  return (
    <>
      {fields.map((f) => {
        const key = `brief.${f.id}`;
        const id = fieldId(key);
        const error = errors[key];
        const label = f.required ? f.label : `${f.label} (optional)`;
        const v = values[f.id];
        switch (f.kind) {
          case 'select':
            return <Chips key={f.id} id={id} legend={label} hint={f.help} options={chipOptions(f.options)} value={typeof v === 'string' ? v : ''} onChange={(x) => onChange(f.id, x as string)} error={error} />;
          case 'multiselect':
            return (
              <Chips
                key={f.id}
                id={id}
                legend={label}
                hint={f.help ?? 'Choose all that apply.'}
                multiple
                options={chipOptions(f.options)}
                value={Array.isArray(v) ? v : []}
                onChange={(x) => onChange(f.id, x as string[])}
                error={error}
              />
            );
          case 'number':
            return (
              <div key={f.id} className="max-w-xs">
                <TextField
                  name={id}
                  label={f.unit ? `${f.label} (${f.unit})` : f.label}
                  optional={!f.required}
                  hint={f.help}
                  inputMode="numeric"
                  value={typeof v === 'string' ? v : ''}
                  onChange={(x) => onChange(f.id, x)}
                  error={error}
                />
              </div>
            );
          case 'text':
            return (
              <TextField key={f.id} name={id} label={f.label} optional={!f.required} hint={f.help} placeholder={f.placeholder} value={typeof v === 'string' ? v : ''} onChange={(x) => onChange(f.id, x)} error={error} />
            );
          case 'textarea':
            return (
              <TextArea
                key={f.id}
                name={id}
                label={label}
                hint={f.help}
                placeholder={f.placeholder}
                maxLength={f.maxLength ?? 2000}
                value={typeof v === 'string' ? v : ''}
                onChange={(x) => onChange(f.id, x)}
                error={error}
              />
            );
          case 'sizes': {
            const map = v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, string>) : {};
            const sum = f.sizes.reduce((s, size) => s + (Number(map[size]) || 0), 0);
            return (
              <fieldset key={f.id} aria-describedby={`${id}-hint${error ? ` ${id}-error` : ''}`}>
                <legend className="font-semibold text-heading">{label}</legend>
                <Hint name={id}>{f.help}</Hint>
                <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-5">
                  {f.sizes.map((size, i) => (
                    <div key={size}>
                      <label htmlFor={`${id}-${size}`} className="block text-sm font-semibold text-heading">
                        {size}
                      </label>
                      <input
                        id={`${id}-${size}`}
                        {...(i === 0 ? { 'data-field': id } : {})}
                        inputMode="numeric"
                        value={map[size] ?? ''}
                        onChange={(e) => onChange(f.id, { ...map, [size]: e.target.value })}
                        aria-invalid={error ? true : undefined}
                        className={`mt-1 ${inputClass} tabular-nums`}
                      />
                    </div>
                  ))}
                </div>
                <p className={`mt-2 text-sm tabular-nums ${sum === quantity ? 'text-muted' : 'font-medium text-heading'}`} aria-live="polite">
                  {sum.toLocaleString('en-KE')} of {quantity.toLocaleString('en-KE')} pieces
                </p>
                <FieldError name={id} error={error} />
              </fieldset>
            );
          }
          case 'dimensions': {
            const d = v && typeof v === 'object' && 'widthCm' in v ? (v as { widthCm: string; heightCm: string }) : { widthCm: '', heightCm: '' };
            return (
              <fieldset key={f.id} aria-describedby={error ? `${id}-error` : undefined}>
                <legend className="font-semibold text-heading">{label}</legend>
                <Hint name={id}>{f.help}</Hint>
                <div className="mt-3 flex items-end gap-3">
                  {(['widthCm', 'heightCm'] as const).map((side, i) => (
                    <div key={side} className="w-32">
                      <label htmlFor={`${id}-${side}`} className="block text-sm font-semibold text-heading">
                        {side === 'widthCm' ? 'Width (cm)' : 'Height (cm)'}
                      </label>
                      <input
                        id={`${id}-${side}`}
                        {...(i === 0 ? { 'data-field': id } : {})}
                        inputMode="numeric"
                        value={d[side]}
                        onChange={(e) => onChange(f.id, { ...d, [side]: e.target.value })}
                        aria-invalid={error ? true : undefined}
                        className={`mt-1 ${inputClass} tabular-nums`}
                      />
                    </div>
                  ))}
                </div>
                <FieldError name={id} error={error} />
              </fieldset>
            );
          }
          case 'dates': {
            const list = Array.isArray(v) ? v : [];
            const min = addWorkingDays(nairobiToday(), 1);
            return (
              <fieldset key={f.id} aria-describedby={`${id}-hint${error ? ` ${id}-error` : ''}`}>
                <legend className="font-semibold text-heading">{label}</legend>
                <Hint name={id}>{f.help}</Hint>
                <div className="mt-3 flex flex-wrap gap-3">
                  {Array.from({ length: f.count }, (_, i) => (
                    <div key={i}>
                      <label htmlFor={`${id}-${i}`} className="block text-sm font-semibold text-heading">
                        {i === 0 ? 'First choice' : i === 1 ? 'Second choice' : `Choice ${i + 1}`}
                      </label>
                      <input
                        id={`${id}-${i}`}
                        {...(i === 0 ? { 'data-field': id } : {})}
                        type="date"
                        min={min}
                        value={list[i] ?? ''}
                        onChange={(e) => {
                          const next = Array.from({ length: f.count }, (_, j) => list[j] ?? '');
                          next[i] = e.target.value;
                          onChange(f.id, next);
                        }}
                        aria-invalid={error ? true : undefined}
                        className={`mt-1 ${inputClass}`}
                      />
                    </div>
                  ))}
                </div>
                <FieldError name={id} error={error} />
              </fieldset>
            );
          }
          case 'yesno': {
            const note = priceNote({ unitDelta: f.yesUnitDelta, fixedDelta: f.yesFixedDelta });
            return (
              <div key={f.id}>
                <label htmlFor={id} className="flex min-h-11 cursor-pointer items-start gap-3">
                  <input id={id} type="checkbox" checked={v === true} onChange={(e) => onChange(f.id, e.target.checked)} className="mt-1 size-5 shrink-0 accent-ink" />
                  <span>
                    <span className="block font-semibold text-heading">
                      {f.label}
                      {note && <span className="ml-2 text-sm font-normal text-muted">{note}</span>}
                    </span>
                    {f.help && <span className="block text-sm text-muted">{f.help}</span>}
                  </span>
                </label>
              </div>
            );
          }
        }
      })}
    </>
  );
}
