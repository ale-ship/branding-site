import type { CSSProperties, ElementType, ReactNode } from 'react';

type Props = {
  children: ReactNode;
  as?: ElementType;
  /** Delay in ms, for staggering siblings. */
  delay?: number;
  className?: string;
};

/**
 * Fades and lifts its content in when it scrolls into view. This is plain markup (a server
 * component): one shared observer, `RevealObserver` in the root layout, watches every
 * `[data-reveal]` on the page, so there's no per-section JavaScript to start up. Without
 * JavaScript, or with reduced motion, content is simply shown (styles in globals.css).
 */
export function Reveal({ children, as: Tag = 'div', delay = 0, className }: Props) {
  return (
    // The reveal script may set data-visible before React hydrates; that's expected.
    <Tag data-reveal="" suppressHydrationWarning className={className} style={delay ? ({ '--reveal-delay': `${delay}ms` } as CSSProperties) : undefined}>
      {children}
    </Tag>
  );
}
