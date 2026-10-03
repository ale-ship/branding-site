/**
 * The site's signature: details from print production. All decorative (aria-hidden).
 */

/** Crop marks at the four corners of the nearest `relative` parent, just outside its edge. */
export function CropMarks({ className = 'text-border-strong' }: { className?: string }) {
  const corner = 'absolute size-5 sm:size-7';
  const h = 'absolute h-px w-full bg-current';
  const v = 'absolute h-full w-px bg-current';
  return (
    <span aria-hidden className={`pointer-events-none ${className}`}>
      <span className={`${corner} -top-3 -left-3 sm:-top-4 sm:-left-4`}>
        <span className={`${h} top-0 left-0`} style={{ width: '60%' }} />
        <span className={`${v} top-0 left-0`} style={{ height: '60%' }} />
      </span>
      <span className={`${corner} -top-3 -right-3 sm:-top-4 sm:-right-4`}>
        <span className={`${h} top-0 right-0`} style={{ width: '60%' }} />
        <span className={`${v} top-0 right-0`} style={{ height: '60%' }} />
      </span>
      <span className={`${corner} -bottom-3 -left-3 sm:-bottom-4 sm:-left-4`}>
        <span className={`${h} bottom-0 left-0`} style={{ width: '60%' }} />
        <span className={`${v} bottom-0 left-0`} style={{ height: '60%' }} />
      </span>
      <span className={`${corner} -right-3 -bottom-3 sm:-right-4 sm:-bottom-4`}>
        <span className={`${h} right-0 bottom-0`} style={{ width: '60%' }} />
        <span className={`${v} right-0 bottom-0`} style={{ height: '60%' }} />
      </span>
    </span>
  );
}

/** Four process-colour dots: C, M, Y, K. */
export function CmykDots({ className = '' }: { className?: string }) {
  return (
    <span aria-hidden className={`inline-flex gap-1 ${className}`}>
      <span className="size-2 rounded-pill bg-cmyk-c" />
      <span className="size-2 rounded-pill bg-cmyk-m" />
      <span className="size-2 rounded-pill bg-cmyk-y" />
      <span className="size-2 rounded-pill bg-cmyk-k" />
    </span>
  );
}

/** A job's palette as small swatch chips, like a printer's colour bar. */
export function Swatches({ colours, label }: { colours: string[]; label: string }) {
  return (
    <span className="inline-flex" role="img" aria-label={label}>
      {colours.map((colour) => (
        <span
          key={colour}
          className="-ml-px size-4 border border-border-strong first:ml-0"
          style={{ backgroundColor: colour }}
        />
      ))}
    </span>
  );
}

/** A small uppercase label above section headings. */
export function Eyebrow({ children, className = 'text-muted' }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={`text-xs font-semibold tracking-[0.18em] uppercase ${className}`}>
      {children}
    </p>
  );
}
