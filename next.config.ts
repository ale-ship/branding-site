import path from 'node:path';
import type { NextConfig } from 'next';

/**
 * Security headers on every response.
 *
 * TODO(launch): add a strict Content-Security-Policy once the backend's domain is known. It will
 * need at least: default-src 'self'; img-src 'self' data: blob:; frame-src https://maps.google.com
 * https://www.google.com (the contact page map); script-src 'self' 'nonce-…' (Next.js inline
 * scripts need a nonce set in middleware); style-src 'self' 'unsafe-inline'; font-src 'self';
 * frame-ancestors 'self'. Until then only frame-ancestors is set, which is safe on its own.
 */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'self'" },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
];

const nextConfig: NextConfig = {
  // Pin the root so a stray lockfile in a parent folder can't confuse detection.
  turbopack: { root: path.join(__dirname) },
  // A self-contained server in .next/standalone: the VPS runs it with plain node
  // (deploy/scripts/deploy-branding.sh copies in .next/static and public).
  output: 'standalone',
  images: {
    formats: ['image/avif', 'image/webp'],
    localPatterns: [{ pathname: '/images/**' }, { pathname: '/brand/**' }],
  },
  poweredByHeader: false,
  /**
   * The old Lovable site's addresses (docs/RUNBOOK.md, Phase 6), so bookmarks and search results land
   * somewhere useful after the switch. Its shop checkout becomes the quote form; its admin and
   * sign-in pages are gone (our own back office comes later), so they go to the home page with a
   * temporary redirect. Our own back office lives at /admin/ on the VPS (docs/BACKEND_RUNBOOK.md, step B4),
   * served by nginx before a request reaches Next, so these redirects only answer where it isn't.
   */
  async redirects() {
    return [
      { source: '/checkout', destination: '/quote', permanent: true },
      // The old site's confirmation page: orders are now found and tracked under /order.
      { source: '/order-confirmation', destination: '/order', permanent: true },
      { source: '/auth', destination: '/', permanent: false },
      { source: '/admin', destination: '/', permanent: false },
      { source: '/admin/:path*', destination: '/', permanent: false },
    ];
  },
  /**
   * In live mode, links to stored files (proof images: /api/files/…, signed by the API) go to the API.
   * On the VPS nginx sends /api/ to the API first; this is for running the site and the API locally.
   */
  async rewrites() {
    if (process.env.NEXT_PUBLIC_API_MODE !== 'live') return [];
    const api = process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:4300';
    return [{ source: '/api/files/:path*', destination: `${api}/api/files/:path*` }];
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
