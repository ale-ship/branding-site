// @ts-check

/**
 * Just enough of PNG and JPEG to know an upload is one and how big it is, without a native image
 * library: the proof is watermarked as an SVG around the image (watermarkSvg), which needs its size.
 */

/** @typedef {{ type: 'image/png' | 'image/jpeg'; width: number; height: number }} ImageInfo */

/**
 * @param {Buffer} b
 * @returns {ImageInfo | null}
 */
export function imageInfo(b) {
  // PNG: the signature, then IHDR with width and height.
  if (b.length > 24 && b.readUInt32BE(0) === 0x89504e47 && b.toString('ascii', 12, 16) === 'IHDR') {
    return { type: 'image/png', width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
  }
  // JPEG: walk the segments to the first start-of-frame.
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) return null;
      const marker = b.readUInt8(i + 1);
      const length = b.readUInt16BE(i + 2);
      const sof = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
      if (sof) return { type: 'image/jpeg', height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7) };
      i += 2 + length;
    }
  }
  return null;
}

/**
 * The proof the customer sees: the artwork with PROOF across it, as one SVG with the image inside,
 * so it can't be used without paying (docs/ORDER_WORKFLOW_SPEC.md, "Proofs and approval").
 * @param {Buffer} image
 * @param {ImageInfo} info
 * @returns {string}
 */
export function watermarkSvg(image, info) {
  const { width: w, height: h } = info;
  const size = Math.round(Math.min(w, h) / 5);
  const marks = [];
  // Three diagonal rows, so cropping can't remove them all.
  for (const y of [0.25, 0.55, 0.85]) {
    marks.push(
      `<text x="${w / 2}" y="${Math.round(h * y)}" transform="rotate(-24 ${w / 2} ${Math.round(h * y)})" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="${size}" fill="#ffffff" fill-opacity="0.45" stroke="#d7000f" stroke-opacity="0.55" stroke-width="${Math.max(1, Math.round(size / 40))}" letter-spacing="${Math.round(size / 8)}">PROOF</text>`,
    );
  }
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">`,
    `<image width="${w}" height="${h}" xlink:href="data:${info.type};base64,${image.toString('base64')}"/>`,
    ...marks,
    '</svg>',
  ].join('');
}
