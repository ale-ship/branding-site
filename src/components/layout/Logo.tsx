import Link from 'next/link';

/**
 * Stand-in wordmark until Noorcom's refreshed logo arrives (RUNBOOK.md decisions,
 * 3 Oct 2026). Swap the logo in here only; everything else uses this component.
 */
export function Logo({ tone = 'ink', className = '' }: { tone?: 'ink' | 'on-navy'; className?: string }) {
  const text = tone === 'ink' ? 'text-heading' : 'text-on-navy';
  return (
    <Link href="/" aria-label="Noorcom Branding, home" className={`inline-flex min-h-11 items-center gap-2.5 ${className}`}>
      <span aria-hidden className="grid size-9 place-items-center bg-accent font-display text-lg font-extrabold text-ink">
        N
      </span>
      <span aria-hidden className={`flex flex-col leading-none ${text}`}>
        <span className="font-display text-[1.15rem] font-extrabold tracking-[-0.01em]">NOORCOM</span>
        <span className="mt-0.5 text-[0.62rem] font-semibold tracking-[0.42em]">BRANDING</span>
      </span>
    </Link>
  );
}
