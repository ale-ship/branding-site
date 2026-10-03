import { ImageResponse } from 'next/og';
import { site } from '@/lib/site';

/**
 * The default link preview (WhatsApp, Facebook, LinkedIn, X) for every page without its own
 * image. Drawn from the brand tokens: paper background, navy type, one orange block, crop marks.
 * Replace the stand-in "N" mark when the refreshed logo arrives.
 */
export const alt = `${site.name}: printing and branding in Nairobi`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const navy = '#0f1a2e';
const orange = '#f07f22';
const paper = '#f5f2ec';

export default function OpengraphImage() {
  const mark = (style: Record<string, number | string>) => (
    <div style={{ position: 'absolute', width: 36, height: 36, display: 'flex', ...style }} />
  );
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: paper, position: 'relative', padding: 72 }}>
        {mark({ top: 40, left: 40, borderTop: `2px solid ${navy}`, borderLeft: `2px solid ${navy}` })}
        {mark({ top: 40, right: 40, borderTop: `2px solid ${navy}`, borderRight: `2px solid ${navy}` })}
        {mark({ bottom: 40, left: 40, borderBottom: `2px solid ${navy}`, borderLeft: `2px solid ${navy}` })}
        {mark({ bottom: 40, right: 40, borderBottom: `2px solid ${navy}`, borderRight: `2px solid ${navy}` })}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ width: 72, height: 72, background: orange, color: navy, fontSize: 48, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              N
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', color: navy }}>
              <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: -1 }}>NOORCOM</div>
              <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: 10 }}>BRANDING</div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', color: navy }}>
            <div style={{ fontSize: 84, fontWeight: 800, lineHeight: 1, letterSpacing: -3 }}>We make brands</div>
            <div style={{ fontSize: 84, fontWeight: 800, lineHeight: 1.05, letterSpacing: -3, display: 'flex' }}>
              <span style={{ background: orange, padding: '0 14px', marginRight: 18 }}>impossible</span> to miss.
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: navy, fontSize: 24 }}>
            <div>Signage · Vehicle wraps · Apparel · Gifts · Print</div>
            <div>Nairobi, Kenya</div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
