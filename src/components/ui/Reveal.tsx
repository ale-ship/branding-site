'use client';

import { useEffect, useRef, type ElementType, type ReactNode } from 'react';

type Props = {
  children: ReactNode;
  as?: ElementType;
  /** Delay in ms, for staggering siblings. */
  delay?: number;
  className?: string;
};

/**
 * Fades and lifts its content in when it scrolls into view. Without JavaScript, or with
 * reduced motion, content is simply shown (styles in globals.css under [data-reveal]).
 */
export function Reveal({ children, as: Tag = 'div', delay = 0, className }: Props) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          el.dataset.visible = 'true';
          observer.disconnect();
        }
      },
      { rootMargin: '0px 0px -8% 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      data-reveal=""
      className={className}
      style={delay ? ({ '--reveal-delay': `${delay}ms` } as React.CSSProperties) : undefined}
    >
      {children}
    </Tag>
  );
}
