import { Link } from 'wouter';
import { Home, SearchX } from 'lucide-react';

export default function NotFound() {
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      dir="rtl"
      style={{ background: 'var(--bg-app)' }}
    >
      <div
        className="text-center px-8 py-12 rounded-3xl max-w-md w-full mx-4"
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid rgba(99,102,241,0.18)',
        }}
      >
        <div
          className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-4"
          style={{
            background: 'rgba(99,102,241,0.08)',
            border: '1.5px solid rgba(99,102,241,0.25)',
          }}
        >
          <SearchX className="w-9 h-9 text-indigo-400" />
        </div>

        <p className="text-6xl font-black mb-3 tabular-nums" style={{ color: 'var(--edge)' }}>
          404
        </p>

        <h1 className="text-2xl font-black text-ink mb-2">الصفحة غير موجودة</h1>
        <p className="text-sm mb-8" style={{ color: 'var(--text-2)', lineHeight: 1.7 }}>
          الرابط الذي أدخلته غير موجود أو تم نقل الصفحة إلى مكان آخر.
        </p>

        <Link href="/">
          <button className="erp-btn erp-btn-primary erp-btn-md mx-auto flex items-center gap-2">
            <Home className="w-4 h-4" />
            العودة للرئيسية
          </button>
        </Link>
      </div>
    </div>
  );
}
