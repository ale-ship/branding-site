'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

/**
 * The one observer behind every `Reveal`. Marks each `[data-reveal]` as visible when it scrolls
 * into view, or at once if it's already above the viewport (e.g. Back restoring a position
 * mid-page). Watches the DOM too, so sections added later (a form step, a client navigation)
 * are picked up.
 */
export function RevealObserver() {
  const pathname = usePathname();

  useEffect(() => {
    const show = (el: Element) => {
      (el as HTMLElement).dataset.visible = 'true';
      io.unobserve(el);
    };
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting || entry.boundingClientRect.bottom < 0) show(entry.target);
        }
      },
      { rootMargin: '0px 0px -8% 0px' },
    );
    const watch = (root: ParentNode) => {
      root.querySelectorAll('[data-reveal]:not([data-visible])').forEach((el) => io.observe(el));
    };
    watch(document);

    const mo = new MutationObserver((records) => {
      for (const record of records) {
        record.addedNodes.forEach((node) => {
          if (!(node instanceof Element)) return;
          if (node.matches('[data-reveal]:not([data-visible])')) io.observe(node);
          watch(node);
        });
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, [pathname]);

  return null;
}
