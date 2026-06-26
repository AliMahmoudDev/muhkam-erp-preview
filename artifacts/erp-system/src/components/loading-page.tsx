/* eslint-disable erp/no-hardcoded-colors -- loading page decorative colors: intentional fixed palette */
/**
 * LoadingPage — Light mode premium loader (amber/gold palette)
 */

export function LoadingPage() {
  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
      style={{ background: '#F5F5F5', overflow: 'hidden' }}
    >
      {/* Soft pastel orbs */}
      <div
        style={{
          position: 'absolute',
          width: 600,
          height: 600,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0,113,227,.15) 0%, transparent 70%)',
          filter: 'blur(60px)',
          top: '20%',
          left: '50%',
          transform: 'translateX(-50%)',
          animation: 'lp-ld-orb-1 8s ease-in-out infinite',
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: 500,
          height: 500,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(168,85,247,.12) 0%, transparent 70%)',
          filter: 'blur(60px)',
          bottom: '10%',
          left: '30%',
          animation: 'lp-ld-orb-2 10s ease-in-out infinite',
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: 400,
          height: 400,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(240,216,48,.18) 0%, transparent 70%)',
          filter: 'blur(60px)',
          top: '40%',
          left: '40%',
          animation: 'lp-ld-orb-3 16s ease-in-out infinite',
        }}
      />

      {/* Grid pattern */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(0,0,0,.025) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,.025) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          maskImage: 'radial-gradient(ellipse 60% 50% at 50% 50%, black 0%, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(ellipse 60% 50% at 50% 50%, black 0%, transparent 80%)',
        }}
      />

      {/* Main content */}
      <div className="relative flex flex-col items-center" style={{ gap: 32 }}>
        {/* Logo with rotating ring */}
        <div style={{ position: 'relative', width: 120, height: 120 }}>
          <svg
            width="120"
            height="120"
            viewBox="0 0 120 120"
            style={{ position: 'absolute', inset: 0, animation: 'lp-ld-spin 3s linear infinite' }}
          >
            <defs>
              <linearGradient id="lp-ld-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#0071E3" />
                <stop offset="50%" stopColor="#2997FF" />
                <stop offset="100%" stopColor="#A855F7" />
              </linearGradient>
            </defs>
            <circle
              cx="60"
              cy="60"
              r="56"
              fill="none"
              stroke="url(#lp-ld-grad)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray="60 280"
              opacity="0.9"
            />
            <circle cx="60" cy="60" r="48" fill="none" stroke="rgba(0,0,0,.06)" strokeWidth="1" />
          </svg>
          <div
            style={{
              position: 'absolute',
              inset: 20,
              borderRadius: 22,
              background: 'linear-gradient(135deg, #0071E3 0%, #A855F7 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 24px rgba(0,113,227,.25), inset 0 1px 0 rgba(255,255,255,.25)',
              animation: 'lp-ld-pulse 2s ease-in-out infinite',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: 22,
                background:
                  'radial-gradient(circle at 30% 20%, rgba(255,255,255,.3) 0%, transparent 50%)',
              }}
            />
            <span
              style={{
                position: 'relative',
                color: '#fff',
                fontFamily: "'Tajawal','SF Pro Display',sans-serif",
                fontSize: 44,
                fontWeight: 800,
                lineHeight: 1,
              }}
            >
              م
            </span>
          </div>
        </div>

        {/* Brand */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <h1
            style={{
              fontFamily: "'Tajawal','SF Pro Display',sans-serif",
              fontSize: 28,
              fontWeight: 800,
              color: '#1D1D1F',
              letterSpacing: '-0.02em',
              margin: 0,
              lineHeight: 1,
            }}
          >
            مُحكم
          </h1>
          <p
            style={{
              fontFamily: "'Inter','Tajawal',sans-serif",
              fontSize: 10,
              fontWeight: 600,
              color: '#86868B',
              letterSpacing: '0.3em',
              textTransform: 'uppercase',
              margin: 0,
            }}
          >
            MUHKAM ERP
          </p>
        </div>

        {/* Progress bar */}
        <div
          style={{
            width: 220,
            height: 3,
            borderRadius: 980,
            background: 'rgba(0,0,0,.06)',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'linear-gradient(90deg, transparent 0%, #0071E3 30%, #2997FF 50%, #0071E3 70%, transparent 100%)',
              backgroundSize: '200% 100%',
              animation: 'lp-ld-shimmer 1.6s ease-in-out infinite',
              borderRadius: 980,
            }}
          />
        </div>

        {/* Loading text */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontFamily: "'Tajawal','SF Pro Display',sans-serif",
            fontSize: 14,
            color: '#6E6E73',
          }}
        >
          <span>جارٍ التحميل</span>
          <span style={{ display: 'inline-flex', gap: 3 }}>
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: '50%',
                  background: '#0071E3',
                  animation: `lp-ld-dot 1.4s ease-in-out ${i * 0.2}s infinite`,
                  display: 'inline-block',
                }}
              />
            ))}
          </span>
        </div>
      </div>

      <style>{`
        @keyframes lp-ld-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes lp-ld-pulse {
          0%, 100% { transform: scale(1); box-shadow: 0 8px 24px rgba(0,113,227,.25), inset 0 1px 0 rgba(255,255,255,.25); }
          50% { transform: scale(1.05); box-shadow: 0 12px 32px rgba(0,113,227,.4), inset 0 1px 0 rgba(255,255,255,.25); }
        }
        @keyframes lp-ld-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        @keyframes lp-ld-dot { 0%, 60%, 100% { opacity: 0.3; transform: scale(0.8); } 30% { opacity: 1; transform: scale(1.2); } }
        @keyframes lp-ld-orb-1 { 0%, 100% { transform: translateX(-50%) scale(1); opacity: 0.6; } 50% { transform: translateX(-30%) scale(1.2); opacity: 0.9; } }
        @keyframes lp-ld-orb-2 { 0%, 100% { transform: scale(1); opacity: 0.4; } 50% { transform: scale(1.3); opacity: 0.7; } }
        @keyframes lp-ld-orb-3 { 0%, 100% { transform: scale(1); opacity: 0.5; } 50% { transform: scale(1.2); opacity: 0.8; } }
      `}</style>
    </div>
  );
}
