import { ArrowUpRight } from 'lucide-react';
import Link from 'next/link';

/**
 * A round badge whose text circles slowly (Agrumea's rotating stamp). Stops under reduced
 * motion. The link's accessible name is the plain label, not the repeated circle text.
 * Position it by wrapping it; the badge itself is `relative` for its layers.
 */
export function RotatingBadge({
  href,
  label,
  id = 'badge',
  className = '',
}: {
  href: string;
  label: string;
  /** Unique per page: names the SVG path the text follows. */
  id?: string;
  className?: string;
}) {
  const ring = `${label} • ${label} • `.toUpperCase();
  return (
    <Link
      href={href}
      aria-label={label}
      className={`group relative grid size-28 place-items-center rounded-pill bg-accent text-on-accent shadow-[0_10px_30px_-10px_rgba(15,26,46,0.45)] transition-transform duration-500 ease-out hover:scale-105 sm:size-36 ${className}`}
    >
      <svg aria-hidden viewBox="0 0 100 100" className="absolute inset-0 size-full animate-spin-slow">
        <defs>
          <path id={`${id}-circle`} d="M50,50 m-37,0 a37,37 0 1,1 74,0 a37,37 0 1,1 -74,0" />
        </defs>
        <text className="fill-current text-[9.2px] font-semibold tracking-[0.2em]">
          <textPath href={`#${id}-circle`}>{ring}</textPath>
        </text>
      </svg>
      <ArrowUpRight
        aria-hidden
        className="size-7 transition-transform duration-500 ease-out group-hover:rotate-45 sm:size-8"
      />
    </Link>
  );
}
