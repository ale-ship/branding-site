import { ImageResponse } from 'next/og';

/** The home-screen icon on iPhones and iPads: the stand-in "N" mark until the real logo arrives. */
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#f07f22',
          color: '#0f1a2e',
          fontSize: 120,
          fontWeight: 800,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        N
      </div>
    ),
    size,
  );
}
