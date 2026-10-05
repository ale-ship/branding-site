import Image from 'next/image';
import Link from 'next/link';

/**
 * The Noorcom Branding logo (supplied 5 Oct 2026, files in public/brand). In the header the round
 * N mark sits beside the name set as live text, because the full lockup's tagline is unreadable
 * at header size; `variant="full"` shows the whole lockup (footer). Use the logo only through here.
 */
export function Logo({ variant = 'compact', className = '' }: { variant?: 'compact' | 'full'; className?: string }) {
  if (variant === 'full') {
    return (
      <Link href="/" aria-label="Noorcom Branding, home" className={`inline-flex min-h-11 items-center ${className}`}>
        <Image src="/brand/nb-logo.png" alt="" width={578} height={440} className="h-24 w-auto" />
      </Link>
    );
  }
  return (
    <Link href="/" aria-label="Noorcom Branding, home" className={`inline-flex min-h-11 items-center gap-2.5 ${className}`}>
      <Image src="/brand/nb-mark.png" alt="" width={308} height={308} priority className="size-10" />
      <span aria-hidden className="flex flex-col leading-none">
        <span className="text-[1.15rem] font-semibold tracking-[-0.01em] text-ink">
          Noorcom <span className="font-extrabold text-brand-red-ink">Branding</span>
        </span>
        <span className="mt-1 text-[0.6rem] font-bold tracking-[0.2em] text-ink">DESIGN | PRINT | BRAND</span>
      </span>
    </Link>
  );
}
