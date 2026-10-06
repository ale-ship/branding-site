import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ImageResponse } from 'next/og';
import { site } from '@/lib/site';

/**
 * The default link preview (WhatsApp, Facebook, LinkedIn, X) for every page without its own
 * image. Drawn from the brand tokens: paper background, black type, one red block, crop marks,
 * and the logo's N mark (public/brand/nb-mark.png).
 */
export const alt = `${site.name}: printing and branding in Nairobi`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const ink = '#111111';
const red = '#d7000f';
const paper = '#f5f2ec';

export default async function OpengraphImage() {
  const markPng = await readFile(path.join(process.cwd(), 'public', 'brand', 'nb-mark.png'));
  const markSrc = `data:image/png;base64,${markPng.toString('base64')}`;
  const mark = (style: Record<string, number | string>) => (
    <div style={{ position: 'absolute', width: 36, height: 36, display: 'flex', ...style }} />
  );
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: paper, position: 'relative', padding: 72 }}>
        {mark({ top: 40, left: 40, borderTop: `2px solid ${ink}`, borderLeft: `2px solid ${ink}` })}
        {mark({ top: 40, right: 40, borderTop: `2px solid ${ink}`, borderRight: `2px solid ${ink}` })}
        {mark({ bottom: 40, left: 40, borderBottom: `2px solid ${ink}`, borderLeft: `2px solid ${ink}` })}
        {mark({ bottom: 40, right: 40, borderBottom: `2px solid ${ink}`, borderRight: `2px solid ${ink}` })}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain <img> */}
            <img src={markSrc} width={88} height={88} alt="" />
            <div style={{ display: 'flex', flexDirection: 'column', color: ink }}>
              <div style={{ display: 'flex', fontSize: 40, letterSpacing: -1 }}>
                <span>Noorcom&nbsp;</span>
                <span style={{ color: '#ff0001', fontWeight: 800 }}>Branding</span>
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: 4 }}>DESIGN | PRINT | BRAND</div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', color: ink }}>
            <div style={{ fontSize: 84, fontWeight: 800, lineHeight: 1, letterSpacing: -3 }}>We make brands</div>
            <div style={{ fontSize: 84, fontWeight: 800, lineHeight: 1.05, letterSpacing: -3, display: 'flex' }}>
              <span style={{ background: red, color: '#ffffff', padding: '0 14px', marginRight: 18 }}>impossible</span> to miss.
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: ink, fontSize: 24 }}>
            <div>Signage · Vehicle wraps · Apparel · Gifts · Print</div>
            <div>Nairobi, Kenya</div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
