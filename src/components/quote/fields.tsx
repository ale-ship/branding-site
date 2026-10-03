import type { ReactNode } from 'react';

/** Form building blocks for the quote form. Every input is labelled and wired to its error. */

export const inputClass =
  'block w-full min-h-12 border border-border-strong bg-bg px-4 py-3 text-base text-heading placeholder:text-muted transition-colors hover:border-ink focus:border-ink focus:outline-2 focus:outline-offset-0 focus:outline-focus aria-[invalid=true]:border-accent-ink';

export function describedBy(name: string, error?: string, hint?: string): string | undefined {
  const ids = [hint ? `${name}-hint` : '', error ? `${name}-error` : ''].filter(Boolean);
  return ids.length ? ids.join(' ') : undefined;
}

export function FieldError({ name, error }: { name: string; error?: string }) {
  if (!error) return null;
  return (
    <p id={`${name}-error`} className="mt-2 text-sm font-medium text-accent-ink">
      {error}
    </p>
  );
}

export function Hint({ name, children }: { name: string; children?: ReactNode }) {
  if (!children) return null;
  return (
    <p id={`${name}-hint`} className="mt-1.5 text-sm text-muted">
      {children}
    </p>
  );
}

type TextFieldProps = {
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: ReactNode;
  optional?: boolean;
  type?: 'text' | 'tel' | 'email' | 'date';
  inputMode?: 'text' | 'tel' | 'email' | 'numeric';
  autoComplete?: string;
  placeholder?: string;
  min?: string;
};

export function TextField({ name, label, value, onChange, error, hint, optional, type = 'text', ...rest }: TextFieldProps) {
  return (
    <div>
      <label htmlFor={name} className="block font-semibold text-heading">
        {label} {optional && <span className="font-normal text-muted">(optional)</span>}
      </label>
      <Hint name={name}>{hint}</Hint>
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(name, error, hint ? 'hint' : undefined)}
        className={`mt-2 ${inputClass}`}
        {...rest}
      />
      <FieldError name={name} error={error} />
    </div>
  );
}

type TextAreaProps = {
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: ReactNode;
  maxLength: number;
  placeholder?: string;
};

export function TextArea({ name, label, value, onChange, error, hint, maxLength, placeholder }: TextAreaProps) {
  return (
    <div>
      <label htmlFor={name} className="block font-semibold text-heading">
        {label}
      </label>
      <Hint name={name}>{hint}</Hint>
      <textarea
        id={name}
        name={name}
        rows={5}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(name, error, hint ? 'hint' : undefined)}
        className={`mt-2 resize-y ${inputClass}`}
      />
      <div className="flex justify-between gap-4">
        <FieldError name={name} error={error} />
        <p className="mt-2 ml-auto text-xs text-muted tabular-nums">
          {value.length} / {maxLength}
        </p>
      </div>
    </div>
  );
}

type Option<T extends string> = { value: T; label: string; description?: string };

type ChoiceGroupProps<T extends string> = {
  name: string;
  legend: string;
  options: Option<T>[];
  value: string;
  onChange: (value: T) => void;
  error?: string;
  hint?: ReactNode;
  /** Grid columns from 640 px. */
  columns?: 2 | 3;
};

/** Radio buttons drawn as square cards. Arrow keys move between them (native radio behaviour). */
export function ChoiceGroup<T extends string>({ name, legend, options, value, onChange, error, hint, columns = 2 }: ChoiceGroupProps<T>) {
  return (
    <fieldset aria-describedby={describedBy(name, error, hint ? 'hint' : undefined)} aria-invalid={error ? true : undefined}>
      <legend className="font-semibold text-heading">{legend}</legend>
      <Hint name={name}>{hint}</Hint>
      <div className={`mt-3 grid grid-cols-1 gap-2 ${columns === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
        {options.map((option, i) => {
          const id = `${name}-${option.value}`;
          return (
            <label
              key={option.value}
              htmlFor={id}
              className="group relative flex min-h-14 cursor-pointer items-start gap-3 border border-border-strong bg-bg px-4 py-3.5 transition-colors hover:border-ink has-[:checked]:border-ink has-[:checked]:bg-paper has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus"
            >
              <input
                id={id}
                // The first radio carries the group's id, so "focus the first invalid field" can find it.
                {...(i === 0 ? { 'data-field': name } : {})}
                type="radio"
                name={name}
                value={option.value}
                checked={value === option.value}
                onChange={() => onChange(option.value)}
                className="peer sr-only"
              />
              <span
                aria-hidden
                className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-pill border border-border-strong bg-bg peer-checked:border-ink"
              >
                <span className="size-2.5 scale-0 rounded-pill bg-ink transition-transform peer-checked:scale-100 group-has-[:checked]:scale-100" />
              </span>
              <span>
                <span className="block font-semibold text-heading">{option.label}</span>
                {option.description && <span className="mt-0.5 block text-sm text-muted">{option.description}</span>}
              </span>
            </label>
          );
        })}
      </div>
      <FieldError name={name} error={error} />
    </fieldset>
  );
}
