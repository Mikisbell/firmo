import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'FIRMO POS - Sistema POS para Pollerías Peruanas';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OGImage() {
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
          background: 'linear-gradient(135deg, #18181b 0%, #09090b 100%)',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        {/* Decorative gradient circles */}
        <div
          style={{
            position: 'absolute',
            top: -80,
            right: -80,
            width: 400,
            height: 400,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(16,185,129,0.15) 0%, transparent 70%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -60,
            left: -60,
            width: 300,
            height: 300,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(13,148,136,0.12) 0%, transparent 70%)',
          }}
        />

        {/* Logo mark */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 120,
            height: 120,
            borderRadius: 28,
            background: 'linear-gradient(135deg, #10b981, #0d9488)',
            marginBottom: 32,
            boxShadow: '0 20px 60px rgba(16,185,129,0.3)',
          }}
        >
          <span style={{ fontSize: 64, fontWeight: 900, color: 'white', lineHeight: 1 }}>P</span>
        </div>

        {/* Title */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 16 }}>
          <span style={{ fontSize: 72, fontWeight: 900, color: '#10b981', letterSpacing: '-2px' }}>
            PARK
          </span>
          <span style={{ fontSize: 72, fontWeight: 900, color: 'white', letterSpacing: '-2px' }}>
            POS
          </span>
        </div>

        {/* Tagline */}
        <span style={{ fontSize: 28, color: '#a1a1aa', fontWeight: 500 }}>
          Sistema POS para Pollerías y Parrilleras Peruanas
        </span>

        {/* Feature pills */}
        <div style={{ display: 'flex', gap: 16, marginTop: 40 }}>
          {['Offline-First', 'Facturación SUNAT', 'Multi-Terminal', 'Hecho en Perú'].map((label) => (
            <div
              key={label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: 'rgba(16,185,129,0.1)',
                border: '1px solid rgba(16,185,129,0.2)',
                borderRadius: 100,
                padding: '8px 20px',
                fontSize: 18,
                color: '#6ee7b7',
                fontWeight: 600,
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  );
}
