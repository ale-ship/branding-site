'use client';

import { FileText, Paperclip, X } from 'lucide-react';
import { useState, type DragEvent, type ReactNode } from 'react';
import type { ArtworkFile } from '@/lib/api/types';
import { ARTWORK_EXTENSIONS, ARTWORK_MAX_FILES, formatBytes } from '@/lib/quote';
import { FieldError, Hint } from '../quote/fields';

/** Small building blocks for the order form, on top of the quote form's fields. */

/** Error keys like `brief.sizes` as element ids: `brief-sizes`. */
export const fieldId = (key: string) => key.replace(/\./g, '-');

const chip =
  'inline-flex min-h-11 cursor-pointer items-center gap-2 border border-border-strong px-4 text-sm font-medium text-heading transition-colors hover:border-ink has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-bg has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus';

type ChipOption = { value: string; label: string; note?: string };

/** One choice (radios) or several (checkboxes), drawn as chips. */
export function Chips({
  id,
  legend,
  options,
  value,
  onChange,
  multiple = false,
  error,
  hint,
}: {
  id: string;
  legend: ReactNode;
  options: ChipOption[];
  value: string | string[];
  onChange: (value: string | string[]) => void;
  multiple?: boolean;
  error?: string;
  hint?: ReactNode;
}) {
  const chosen = Array.isArray(value) ? value : [value];
  const describedBy = [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined;
  return (
    <fieldset aria-describedby={describedBy} aria-invalid={error ? true : undefined}>
      <legend className="font-semibold text-heading">{legend}</legend>
      <Hint name={id}>{hint}</Hint>
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((o, i) => {
          const inputId = `${id}-${o.value}`.replace(/[^a-zA-Z0-9-]/g, '-');
          return (
            <label key={o.value} htmlFor={inputId} className={chip}>
              <input
                id={inputId}
                {...(i === 0 ? { 'data-field': id } : {})}
                type={multiple ? 'checkbox' : 'radio'}
                name={id}
                value={o.value}
                checked={chosen.includes(o.value)}
                onChange={(e) => {
                  if (!multiple) onChange(o.value);
                  else onChange(e.target.checked ? [...chosen, o.value] : chosen.filter((v) => v !== o.value));
                }}
                className="sr-only"
              />
              {o.label}
              {o.note && <span className="text-xs opacity-75">{o.note}</span>}
            </label>
          );
        })}
      </div>
      <FieldError name={id} error={error} />
    </fieldset>
  );
}

/** Choose or drop files; only names and sizes are kept until the backend takes uploads. */
export function FilePicker({
  id,
  label,
  hint,
  files,
  onChange,
  error,
}: {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  files: ArtworkFile[];
  onChange: (files: ArtworkFile[]) => void;
  error?: string;
}) {
  const [dragging, setDragging] = useState(false);
  const add = (list: FileList | null) => {
    const picked = Array.from(list ?? []).map((f) => ({ name: f.name, size: f.size, type: f.type }));
    if (picked.length) onChange([...files, ...picked.filter((p) => !files.some((f) => f.name === p.name && f.size === p.size))]);
  };
  return (
    <div>
      <p id={`${id}-label`} className="font-semibold text-heading">
        {label}
      </p>
      <Hint name={id}>{hint}</Hint>
      <label
        htmlFor={id}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e: DragEvent<HTMLLabelElement>) => {
          e.preventDefault();
          setDragging(false);
          add(e.dataTransfer.files);
        }}
        className={`mt-3 flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1.5 border border-dashed bg-paper px-4 py-5 text-center transition-colors hover:border-ink has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus ${dragging ? 'border-ink bg-panel' : 'border-border-strong'}`}
      >
        <Paperclip aria-hidden className="size-5 text-heading" />
        <span className="font-semibold text-heading">Choose files</span>
        <span className="text-sm text-muted">or drop them here</span>
        <input
          id={id}
          type="file"
          multiple
          accept={ARTWORK_EXTENSIONS.map((x) => `.${x}`).join(',')}
          onChange={(e) => {
            add(e.target.files);
            e.target.value = '';
          }}
          aria-labelledby={`${id}-label`}
          aria-describedby={[hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined}
          aria-invalid={error ? true : undefined}
          className="sr-only"
        />
      </label>
      {files.length > 0 && (
        <ul className="mt-3 border-t border-border">
          {files.map((file, i) => (
            <li key={`${file.name}-${file.size}`} className="flex items-center gap-3 border-b border-border py-1.5">
              <FileText aria-hidden className="size-4 shrink-0 text-muted" />
              <span className="min-w-0 flex-1 truncate text-heading">{file.name}</span>
              <span className="text-sm text-muted tabular-nums">{formatBytes(file.size)}</span>
              <button
                type="button"
                onClick={() => onChange(files.filter((_, j) => j !== i))}
                aria-label={`Remove ${file.name}`}
                className="grid size-11 place-items-center text-muted transition-colors hover:text-heading"
              >
                <X aria-hidden className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <FieldError name={id} error={error} />
      <p className="mt-1 text-xs text-muted">Up to {ARTWORK_MAX_FILES} files of 25 MB.</p>
    </div>
  );
}
