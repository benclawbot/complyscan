import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get('title') || 'GDPR Compliance Scanner';
  const description =
    searchParams.get('description') ||
    'Scan any website for GDPR compliance. Get a detailed PDF report with AI-powered analysis and actionable fix recommendations — free.';
  const score = searchParams.get('score');

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          backgroundColor: '#0f172a',
          padding: '60px 70px',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* Background gradient accent */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: '55%',
            height: '100%',
            background: 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)',
            opacity: 0.35,
          }}
        />

        {/* Logo mark */}
        <div
          style={{
            position: 'absolute',
            top: '50px',
            left: '70px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
              fontWeight: 700,
              color: 'white',
            }}
          >
            CS
          </div>
          <span style={{ fontSize: '22px', fontWeight: 700, color: 'white' }}>
            ComplyScan
          </span>
        </div>

        {/* Score badge */}
        {score && (
          <div
            style={{
              position: 'absolute',
              top: '50px',
              right: '70px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              gap: '4px',
            }}
          >
            <div
              style={{
                fontSize: '64px',
                fontWeight: 800,
                color:
                  Number(score) >= 75
                    ? '#22c55e'
                    : Number(score) >= 50
                    ? '#f59e0b'
                    : '#ef4444',
                lineHeight: 1,
              }}
            >
              {score}
            </div>
            <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)' }}>
              compliance score
            </div>
          </div>
        )}

        {/* Main content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', zIndex: 1 }}>
          <div
            style={{
              fontSize: '42px',
              fontWeight: 800,
              color: 'white',
              lineHeight: 1.1,
              maxWidth: '700px',
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontSize: '18px',
              color: 'rgba(255,255,255,0.65)',
              lineHeight: 1.5,
              maxWidth: '620px',
            }}
          >
            {description}
          </div>
        </div>

        {/* Bottom CTA */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            marginTop: '30px',
            zIndex: 1,
          }}
        >
          <div
            style={{
              backgroundColor: '#2563eb',
              color: 'white',
              padding: '10px 24px',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: 600,
            }}
          >
            Scan a website free →
          </div>
          <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)' }}>
            complyscan.pages.dev
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
