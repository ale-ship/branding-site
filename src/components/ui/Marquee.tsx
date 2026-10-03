import type { ReactNode } from 'react';

/**
 * An endless horizontal ticker. The items render twice so the loop is seamless; the copy is
 * hidden from screen readers. Pauses on hover; stands still under reduced motion.
 */
export function Marquee({ items, className = '' }: { items: ReactNode[]; className?: string }) {
  const row = (hidden: boolean) => (
    <ul aria-hidden={hidden || undefined} className="flex shrink-0 items-center">
      {items.map((item, i) => (
        <li key={i} className="flex shrink-0 items-center">
          {item}
        </li>
      ))}
    </ul>
  );
  return (
    <div className={`group overflow-hidden ${className}`}>
      <div className="flex w-max animate-marquee group-hover:[animation-play-state:paused]">
        {row(false)}
        {row(true)}
      </div>
    </div>
  );
}
