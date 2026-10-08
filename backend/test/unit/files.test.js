import { describe, expect, it } from 'vitest';
import { imageInfo, watermarkSvg } from '../../src/lib/images.js';
import { signedPath, verifySignature } from '../../src/lib/signedUrl.js';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
// A JPEG's start: SOI, an APP0 segment, then a baseline frame 64 wide and 32 high.
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x4a, 0x46, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x20, 0x00, 0x40, 0x03, 0x01, 0x22, 0x00]);

describe('imageInfo', () => {
  it('reads a PNG’s and a JPEG’s size', () => {
    expect(imageInfo(PNG)).toEqual({ type: 'image/png', width: 1, height: 1 });
    expect(imageInfo(JPEG)).toEqual({ type: 'image/jpeg', width: 64, height: 32 });
  });

  it('refuses anything else', () => {
    expect(imageInfo(Buffer.from('%PDF-1.7 hello world, not an image'))).toBeNull();
    expect(imageInfo(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeNull();
    expect(imageInfo(Buffer.alloc(0))).toBeNull();
  });

  it('wraps the image in an SVG with PROOF across it', () => {
    const svg = watermarkSvg(PNG, { type: 'image/png', width: 800, height: 600 });
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain(`data:image/png;base64,${PNG.toString('base64')}`);
    expect(svg.match(/>PROOF<\/text>/g)).toHaveLength(3);
  });
});

describe('signed file links', () => {
  const now = new Date('2026-10-08T09:00:00Z');

  it('signs a key with an expiry, and checks both', () => {
    const path = signedPath('secret', 'proofs/NB-123456/abc.svg', { now });
    const url = new URL(path, 'http://x');
    expect(url.pathname).toBe('/api/files/proofs/NB-123456/abc.svg');
    const exp = url.searchParams.get('exp');
    const sig = url.searchParams.get('sig');
    expect(Number(exp) - now.getTime() / 1000).toBeGreaterThanOrEqual(3600);
    expect(verifySignature('secret', 'proofs/NB-123456/abc.svg', exp, sig, now)).toBe(true);
    expect(verifySignature('other', 'proofs/NB-123456/abc.svg', exp, sig, now)).toBe(false);
    expect(verifySignature('secret', 'proofs/NB-999999/abc.svg', exp, sig, now)).toBe(false);
    expect(verifySignature('secret', 'proofs/NB-123456/abc.svg', exp, sig, new Date(now.getTime() + 2 * 3600_000))).toBe(false);
    expect(verifySignature('secret', 'proofs/NB-123456/abc.svg', exp, 'zz', now)).toBe(false);
  });
});
