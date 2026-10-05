'use client';

import { Plus, X } from 'lucide-react';
import type { CommonBrief, Mechanism } from '@/lib/api/order-types';
import { formatKes } from '@/lib/format';
import { MAX_COLOURS, STYLE_TAGS } from '@/lib/order';
import { ChoiceGroup, FieldError, Hint, inputClass, TextArea, TextField } from '../quote/fields';
import { Chips, FilePicker } from './controls';

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
/** `#abc` -> `#aabbcc`, for the colour picker, which only takes six digits. */
const sixDigit = (hex: string) => (hex.length === 4 ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}` : hex);

type Props = {
  value: CommonBrief;
  onChange: (next: CommonBrief) => void;
  errors: Record<string, string | undefined>;
  mechanism: Mechanism;
  designFee: number;
};

/** The brief every order shares (spec, "Common brief block"). Error keys are `common.<key>`. */
export function CommonBriefFields({ value, onChange, errors, mechanism, designFee }: Props) {
  const set = <K extends keyof CommonBrief>(key: K, v: CommonBrief[K]) => onChange({ ...value, [key]: v });

  return (
    <>
      {mechanism !== 'C' && (
        <ChoiceGroup
          name="common-artwork"
          legend="Artwork"
          value={value.artwork}
          onChange={(v) => set('artwork', v)}
          options={[
            { value: 'need-design', label: 'I need it designed', description: designFee ? `Our studio designs it: ${formatKes(designFee)}, two revision rounds` : 'Our studio designs it' },
            { value: 'print-ready', label: 'I have print-ready artwork', description: 'No design fee; we check your files before printing' },
          ]}
        />
      )}

      <FilePicker
        id="common-assets"
        label={value.artwork === 'print-ready' && mechanism === 'A' ? 'Your print-ready artwork' : 'Your logo and assets (optional)'}
        hint="PDF, AI, EPS, SVG, PSD, CDR, PNG, JPG, TIFF or ZIP."
        files={value.assets}
        onChange={(files) => set('assets', files)}
        error={errors['common.assets']}
      />

      <fieldset aria-describedby={`common-colours-hint${errors['common.colours'] ? ' common-colours-error' : ''}`}>
        <legend className="font-semibold text-heading">Brand colours (optional)</legend>
        <Hint name="common-colours">Up to {MAX_COLOURS}: pick a colour, or type a HEX code (#FF0000) or a Pantone (485 C).</Hint>
        <ul className="mt-3 flex flex-col gap-2">
          {value.colours.map((c, i) => (
            <li key={i} className="flex items-center gap-2">
              <input
                type="color"
                aria-label={`Colour ${i + 1}`}
                value={HEX.test(c.trim()) ? sixDigit(c.trim()) : '#000000'}
                onChange={(e) => set('colours', value.colours.map((x, j) => (j === i ? e.target.value.toUpperCase() : x)))}
                className="size-12 shrink-0 cursor-pointer border border-border-strong bg-bg p-1"
              />
              <input
                {...(i === 0 ? { 'data-field': 'common-colours' } : {})}
                aria-label={`Colour ${i + 1} code`}
                value={c}
                onChange={(e) => set('colours', value.colours.map((x, j) => (j === i ? e.target.value : x)))}
                aria-invalid={errors['common.colours'] ? true : undefined}
                className={`${inputClass} max-w-48`}
              />
              <button
                type="button"
                onClick={() => set('colours', value.colours.filter((_, j) => j !== i))}
                aria-label={`Remove colour ${i + 1}`}
                className="grid size-11 place-items-center text-muted hover:text-heading"
              >
                <X aria-hidden className="size-4" />
              </button>
            </li>
          ))}
        </ul>
        {value.colours.length < MAX_COLOURS && (
          <button
            type="button"
            onClick={() => set('colours', [...value.colours, '#FF0000'])}
            className="mt-2 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-heading underline decoration-accent decoration-2 underline-offset-4"
          >
            <Plus aria-hidden className="size-4" />
            Add a colour
          </button>
        )}
        <FieldError name="common-colours" error={errors['common.colours']} />
      </fieldset>

      <ChoiceGroup
        name="common-typography"
        legend="Fonts"
        value={value.typography}
        onChange={(v) => set('typography', v)}
        columns={3}
        options={[
          { value: 'from-logo', label: 'Use what’s in my logo' },
          { value: 'designer', label: 'Let the designer choose' },
          { value: 'named', label: 'I’ll name them' },
        ]}
      />
      {value.typography === 'named' && (
        <TextField name="common-fonts" label="Font names" placeholder="e.g. Montserrat, Lato" value={value.fonts} onChange={(v) => set('fonts', v)} error={errors['common.fonts']} />
      )}

      <TextArea
        name="common-text"
        label="The exact words to appear (optional)"
        hint="Names, slogans, phone numbers: we use them exactly as you type them."
        maxLength={2000}
        value={value.text}
        onChange={(v) => set('text', v)}
        error={errors['common.text']}
      />

      <Chips
        id="common-styles"
        legend="Style (optional)"
        multiple
        options={STYLE_TAGS.map((s) => ({ value: s, label: s }))}
        value={value.styles}
        onChange={(v) => set('styles', v as string[])}
        error={errors['common.styles']}
      />

      <FilePicker
        id="common-inspiration"
        label="Inspiration images (optional)"
        hint="Designs you like, photos of a space, anything that helps."
        files={value.inspiration}
        onChange={(files) => set('inspiration', files)}
        error={errors['common.inspiration']}
      />

      <TextArea
        name="common-inspirationLinks"
        label="Inspiration links (optional)"
        hint="Pinterest, Instagram or websites: one link per line, up to 5."
        maxLength={1500}
        value={value.inspirationLinks.join('\n')}
        onChange={(v) => set('inspirationLinks', v.split('\n'))}
        error={errors['common.inspirationLinks']}
      />

      <TextArea
        name="common-notes"
        label="Anything else (optional)"
        maxLength={2000}
        value={value.notes}
        onChange={(v) => set('notes', v)}
        error={errors['common.notes']}
      />
    </>
  );
}
