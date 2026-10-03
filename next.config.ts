import path from 'node:path';
import type { NextConfig } from 'next';

/** Security headers on every response. A full Content-Security-Policy comes at launch (Phase 6). */
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
  images: {
    formats: ['image/avif', 'image/webp'],
    localPatterns: [{ pathname: '/images/**' }, { pathname: '/brand/**' }],
  },
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
