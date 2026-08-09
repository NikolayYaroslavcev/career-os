import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'CareerOS - Your career workspace';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage(): ImageResponse {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 24,
          background: '#4F46E5',
          color: '#FFFFFF',
        }}
      >
        <div style={{ fontSize: 96, fontWeight: 700 }}>CareerOS</div>
        <div style={{ fontSize: 36, opacity: 0.85 }}>Your career workspace</div>
      </div>
    ),
    { ...size }
  );
}
