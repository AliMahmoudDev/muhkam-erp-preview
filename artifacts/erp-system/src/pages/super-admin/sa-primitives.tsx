/**
 * Shared SA UI primitives — SASkeleton, SAEmptyState, SAErrorState,
 * SASection, SATableHeader, StatusChip.
 *
 * Keep this file small and local to the super-admin module.
 * Import from './sa-primitives' inside the super-admin directory.
 */
import { AlertCircle, RefreshCw } from 'lucide-react';
import { C, FONT } from './types';

/* ── SASkeleton — shimmer placeholder rows ──────────────────────────── */
export function SASkeleton({ rows = 5, rowHeight = 44 }: { rows?: number; rowHeight?: number }) {
  return (
    <div style={{ padding: '16px 24px' }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          style={{
            height: rowHeight,
            borderRadius: '10px',
            marginBottom: '10px',
            background: `linear-gradient(90deg, ${C.bg} 25%, rgba(255,255,255,0.05) 37%, ${C.bg} 63%)`,
            backgroundSize: '400% 100%',
            animation: 'sa-shimmer 1.4s ease infinite',
          }}
        />
      ))}
    </div>
  );
}

/* ── SAEmptyState — no data placeholder ─────────────────────────────── */
export function SAEmptyState({
  icon,
  title,
  description,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
}) {
  return (
    <div style={{ padding: '64px 24px', textAlign: 'center' }}>
      {icon && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            marginBottom: '16px',
            color: C.muted,
            opacity: 0.4,
          }}
        >
          {icon}
        </div>
      )}
      <div style={{ fontSize: '15px', fontWeight: 700, color: C.text, marginBottom: '6px' }}>
        {title}
      </div>
      {description && (
        <div style={{ fontSize: '13px', color: C.muted, lineHeight: 1.6 }}>{description}</div>
      )}
    </div>
  );
}

/* ── SAErrorState — error with retry button ─────────────────────────── */
export function SAErrorState({
  title,
  description,
  onRetry,
}: {
  title: string;
  description?: string;
  onRetry: () => void;
}) {
  return (
    <div style={{ padding: '64px 24px', textAlign: 'center' }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
        <AlertCircle size={36} color={C.danger} strokeWidth={1.5} />
      </div>
      <div style={{ fontSize: '15px', fontWeight: 700, color: C.danger, marginBottom: '6px' }}>
        {title}
      </div>
      {description && (
        <div style={{ fontSize: '13px', color: C.muted, marginBottom: '20px', lineHeight: 1.6 }}>
          {description}
        </div>
      )}
      <button
        onClick={onRetry}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '9px 22px',
          borderRadius: '10px',
          background: C.orange,
          color: 'var(--text-1)',
          border: 'none',
          fontSize: '13px',
          fontWeight: 700,
          cursor: 'pointer',
          fontFamily: FONT,
        }}
      >
        <RefreshCw size={14} />
        إعادة المحاولة
      </button>
    </div>
  );
}

/* ── SASection — standard card wrapper ──────────────────────────────── */
export function SASection({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        background: C.card,
        borderRadius: '20px',
        border: `1px solid ${C.border}`,
        overflow: 'hidden',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* ── SATableHeader — card header with title + optional actions ───────── */
export function SATableHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div
      style={{
        padding: '18px 24px',
        borderBottom: `1px solid ${C.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
      }}
    >
      <div>
        <h2 style={{ fontSize: '16px', fontWeight: 800, color: C.text, margin: 0 }}>{title}</h2>
        {subtitle && (
          <p style={{ fontSize: '12px', color: C.muted, margin: '2px 0 0' }}>{subtitle}</p>
        )}
      </div>
      {actions && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          {actions}
        </div>
      )}
    </div>
  );
}

/* ── StatusChip — pill badge for company/user status ────────────────── */
export function StatusChip({
  bg,
  text,
  border,
  label,
}: {
  bg: string;
  text: string;
  border: string;
  label: string;
}) {
  return (
    <span
      style={{
        background: bg,
        color: text,
        border: `1px solid ${border}`,
        padding: '3px 10px',
        borderRadius: '20px',
        fontSize: '11px',
        fontWeight: 700,
        display: 'inline-block',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
}
