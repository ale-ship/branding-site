/**
 * The one observer behind every `Reveal`. Marks each `[data-reveal]` as visible when it scrolls
 * into view, or at once if it's already above the viewport (e.g. Back restoring a position
 * mid-page). Watches the DOM too, so sections added later (a form step, a client navigation,
 * streamed content) are picked up.
 *
 * A plain inline script at the end of <body>, not a React effect: it runs as soon as the HTML is
 * parsed instead of after React has loaded and hydrated, so the hero isn't held invisible for
 * seconds on a slow phone. It runs once; the layout (and <body>) persist across navigations.
 */
const script = `(function () {
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting || e.boundingClientRect.bottom < 0) {
        e.target.setAttribute('data-visible', 'true');
        io.unobserve(e.target);
      }
    });
  }, { rootMargin: '0px 0px -8% 0px' });
  var sel = '[data-reveal]:not([data-visible])';
  var watch = function (root) {
    if (root.matches && root.matches(sel)) io.observe(root);
    root.querySelectorAll(sel).forEach(function (el) { io.observe(el); });
  };
  // Anything already on screen shows now, without waiting a frame for the observer.
  document.querySelectorAll(sel).forEach(function (el) {
    if (el.getBoundingClientRect().top < innerHeight) el.setAttribute('data-visible', 'true');
  });
  watch(document);
  new MutationObserver(function (records) {
    records.forEach(function (r) {
      r.addedNodes.forEach(function (n) { if (n.nodeType === 1) watch(n); });
    });
  }).observe(document.body, { childList: true, subtree: true });
})();`;

export function RevealObserver() {
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
