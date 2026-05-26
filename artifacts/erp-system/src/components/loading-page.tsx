/**
 * LoadingPage — صفحة التحميل الاحترافية لنظام مُحكم
 * تُعرض أثناء تحميل الصفحات (Suspense fallback) وأثناء التحقق من الجلسة.
 */

export function LoadingPage() {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center" style={{ background: 'var(--erp-bg-app, #0a0e1a)' }}>
      {/* Ambient glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-amber-500/5 blur-[120px] animate-pulse" />
      </div>

      {/* Logo + Text */}
      <div className="relative flex flex-col items-center gap-6">
        {/* Logo icon */}
        <div className="relative">
          <div className="w-20 h-20 rounded-2xl border border-amber-500/20 flex items-center justify-center shadow-2xl shadow-amber-500/10 animate-[logo-breathe_2.5s_ease-in-out_infinite]" style={{ background: 'var(--erp-bg-card, linear-gradient(135deg, #0F172A, #1e293b))' }}>
            <svg width="48" height="48" viewBox="0 0 180 180" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="20" y="16" width="140" height="4" rx="2" fill="#F59E0B"/>
              <text x="90" y="115" fontFamily="Arial, sans-serif" fontSize="88" fontWeight="bold" textAnchor="middle" fill="#F59E0B">م</text>
              <circle cx="90" cy="148" r="6" fill="#F59E0B" opacity="0.7"/>
            </svg>
          </div>
          {/* Ring animation */}
          <div className="absolute -inset-2 rounded-3xl border border-amber-500/20 animate-[ring-pulse_2.5s_ease-in-out_infinite]" />
        </div>

        {/* Brand name */}
        <div className="flex flex-col items-center gap-1">
          <h1 className="text-2xl font-bold text-white/90 tracking-wide" style={{ fontFamily: 'Tajawal, sans-serif' }}>
            مُحكم
          </h1>
          <p className="text-xs text-white/40 tracking-widest uppercase">
            MUHKAM ERP
          </p>
        </div>

        {/* Progress bar */}
        <div className="w-48 h-1 rounded-full bg-white/5 overflow-hidden mt-2">
          <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-400 animate-[progress-slide_1.8s_ease-in-out_infinite]" />
        </div>

        {/* Loading text */}
        <p className="text-sm text-white/30 mt-1" style={{ fontFamily: 'Tajawal, sans-serif' }}>
          جارِ التحميل...
        </p>
      </div>

      {/* Inline keyframes */}
      <style>{`
        @keyframes logo-breathe {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.04); opacity: 0.92; }
        }
        @keyframes ring-pulse {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.06); }
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
