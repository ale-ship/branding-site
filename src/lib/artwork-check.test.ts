import { describe, expect, it } from 'vitest';
import { checkArtwork, dpiAt, jpegInfo, pdfInfo, pngInfo } from './artwork-check';

/** A PNG's first 26 bytes: signature, IHDR length and type, width, height, bit depth, colour type. */
function png(width: number, height: number, colourType = 2): Uint8Array {
  const b = new Uint8Array(33);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  new DataView(b.buffer).setUint32(16, width);
  new DataView(b.buffer).setUint32(20, height);
  b[24] = 8;
  b[25] = colourType;
  return b;
}

/** A JPEG: SOI, an APP0 segment, then SOF0 with the size and channel count. */
function jpeg(width: number, height: number, channels: number): Uint8Array {
  const app0 = [0xff, 0xe0, 0, 16, ...new Array(14).fill(0)];
  const sof = [0xff, 0xc0, 0, 17, 8, height >> 8, height & 255, width >> 8, width & 255, channels, ...new Array(9).fill(0)];
  return new Uint8Array([0xff, 0xd8, ...app0, ...sof]);
}

const pdf = (body: string) => new TextEncoder().encode(`%PDF-1.7\n${body}\n%%EOF`);
const cards = { slug: 'business-cards' };

describe('the artwork file check', () => {
  it('reads sizes and colour from image headers', () => {
    expect(pngInfo(png(1000, 600))).toEqual({ width: 1000, height: 600, colour: 'rgb' });
    expect(pngInfo(png(10, 10, 0))?.colour).toBe('grey');
    expect(jpegInfo(jpeg(1063, 685, 4))).toEqual({ width: 1063, height: 685, colour: 'cmyk' });
    expect(jpegInfo(jpeg(10, 10, 3))?.colour).toBe('rgb');
    expect(pngInfo(new Uint8Array([1, 2, 3]))).toBeNull();
    expect(jpegInfo(png(1, 1))).toBeNull();
  });

  it('works out dpi either way round', () => {
    // 85 mm = 3.35 in: 1004 px is 300 dpi.
    expect(dpiAt(1004, 650, 85, 55)).toBe(300);
    expect(dpiAt(650, 1004, 85, 55)).toBe(300);
  });

  it('warns about a low-resolution RGB card with no bleed', () => {
    const warnings = checkArtwork({ name: 'card.png', bytes: png(340, 220) }, cards);
    expect(warnings.map((w) => w.kind)).toEqual(['resolution', 'bleed', 'rgb']);
    expect(warnings[0]!.text).toMatch(/About 102 dpi/);
  });

  it('passes a 300 dpi CMYK card with bleed', () => {
    // 91 × 61 mm (85 × 55 plus 3 mm each side) at 300 dpi.
    expect(checkArtwork({ name: 'card.jpg', bytes: jpeg(1075, 720, 4) }, cards)).toEqual([]);
  });

  it('checks PDFs for colour space and a bleed box', () => {
    expect(pdfInfo(pdf('/ColorSpace /DeviceRGB /TrimBox [0 0 241 156] /BleedBox [0 0 241 156]'))).toEqual({ rgb: true, cmyk: false, bleed: false });
    expect(checkArtwork({ name: 'a.pdf', bytes: pdf('/DeviceRGB /TrimBox [8.5 8.5 249.5 164.5] /BleedBox [0 0 258 173]') }, cards).map((w) => w.kind)).toEqual(['rgb']);
    expect(checkArtwork({ name: 'b.pdf', bytes: pdf('/DeviceCMYK') }, cards).map((w) => w.kind)).toEqual(['bleed']);
  });

  it('leaves vector and unknown files alone, and skips bleed where there is no trim', () => {
    expect(checkArtwork({ name: 'logo.svg', bytes: new TextEncoder().encode('<svg/>') }, cards)).toEqual([]);
    expect(checkArtwork({ name: 'tee.png', bytes: png(3307, 4134) }, { slug: 't-shirt-printing' }).map((w) => w.kind)).toEqual(['rgb']);
  });
});
