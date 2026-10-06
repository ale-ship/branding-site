import { ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

type Variant = 'primary' | 'accent' | 'outline' | 'on-dark';

const variants: Record<Variant, string> = {
  primary: 'bg-ink text-bg hover:bg-ink-hover',
  accent: 'bg-accent text-on-accent hover:bg-accent-hover',
  outline: 'border border-ink text-ink hover:bg-ink hover:text-bg',
  /** Light outline, for dark or red backgrounds. */
  'on-dark': 'border border-on-dark text-on-dark hover:bg-on-dark hover:text-dark',
};

type Props = {
  href: string;
  children: ReactNode;
  variant?: Variant;
  /** Show the diagonal arrow that slides on hover. */
  arrow?: boolean;
  external?: boolean;
  className?: string;
};

/** A link styled as a square button. 48 px tall, so it clears the 44 px touch target. */
export function ButtonLink({ href, children, variant = 'primary', arrow = true, external, className = '' }: Props) {
  const classes = `group inline-flex min-h-12 items-center justify-center gap-2 px-6 text-[0.95rem] font-semibold transition-colors duration-300 ${variants[variant]} ${className}`;
  const content = (
    <>
      <span>{children}</span>
      {arrow && (
        <ArrowUpRight
          aria-hidden
          className="size-4 transition-transform duration-300 ease-out group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
        />
      )}
    </>
  );
  if (external) {
    return (
      <a href={href} className={classes} target="_blank" rel="noopener noreferrer">
        {content}
      </a>
    );
  }
  return (
    <Link href={href} className={classes}>
      {content}
    </Link>
  );
}
