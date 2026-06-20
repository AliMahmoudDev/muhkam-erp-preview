/**
 * LoadingPage — صفحة التحميل الاحترافية لنظام مُحكم
 * تُعرض أثناء تحميل الصفحات (Suspense fallback) وأثناء التحقق من الجلسة.
 */

export function LoadingPage() {
  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
      style={{ background: 'var(--erp-bg-app, #0a0e1a)' }}
    >
      {/* Logo + Text */}
      <div className="relative flex flex-col items-center gap-6">
        {/* Logo icon */}
        <div className="relative">
          <div
            className="w-20 h-20 rounded-2xl border border-line flex items-center justify-center animate-[logo-breathe_2.5s_ease-in-out_infinite]"
            style={{ background: 'var(--bg-surface)' }}
          >
            <svg
              width="48"
              height="48"
              viewBox="0 0 180 180"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect x="20" y="16" width="140" height="4" rx="2" fill="var(--status-warning)" />
              <text
                x="90"
                y="115"
                fontFamily="Arial, sans-serif"
                fontSize="88"
                fontWeight="bold"
                textAnchor="middle"
                fill="var(--status-warning)"
              >
                م
              </text>
              <circle cx="90" cy="148" r="6" fill="var(--status-warning)" opacity="0.7" />
            </svg>
          </div>
        </div>

        {/* Brand name */}
        <div className="flex flex-col items-center gap-1">
          <h1
            className="text-2xl font-bold text-ink/90 tracking-wide"
            style={{ fontFamily: 'Tajawal, sans-serif' }}
          >
            مُحكم
          </h1>
          <p className="text-xs text-ink/40 tracking-widest uppercase">MUHKAM ERP</p>
        </div>

        {/* Progress bar */}
        <div className="w-48 h-1 rounded-full bg-surface overflow-hidden mt-2">
          <div className="h-full rounded-full bg-[var(--brand)] animate-[progress-slide_1.8s_ease-in-out_infinite]" />
        </div>

        {/* Loading text */}
        <p className="text-sm text-ink/30 mt-1" style={{ fontFamily: 'Tajawal, sans-serif' }}>
          جارِ التحميل...
        </p>
      </div>

      {/* Inline keyframes */}
      <style>{`
        @keyframes logo-breathe {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.04); opacity: 0.92; }
        }
        @keyframes progress-slide {
          0% { width: 0%; margin-left: 0%; }
          50% { width: 60%; margin-left: 20%; }
          100% { width: 0%; margin-left: 100%; }
        }
      `}</style>
    </div>
  );
}
