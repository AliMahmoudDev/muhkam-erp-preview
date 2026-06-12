/* eslint-disable erp/no-hardcoded-colors */
import { useState, useEffect, useRef } from 'react';
import { C, FONT } from './types';

/* ── Animated counter ───────────────────────────── */
export function AnimatedNumber({ target }: { target: number | string }) {
  const [display, setDisplay] = useState<number | string>(0);
  const raf = useRef<number | null>(null);
  useEffect(() => {
    if (typeof target !== 'number') {
      setDisplay(target);
      return;
    }
    const duration = 700;
    const startTime = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - startTime) / duration, 1);
      const e = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(target * e));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [target]);
  return <>{display}</>;
}

/* ── Toast ──────────────────────────────────────── */
export function Toast({ msg, type = 'success' }: { msg: string; type?: 'success' | 'error' }) {
  const isErr = type === 'error';
  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: isErr ? '#2e1a1a' : '#1a2e1a',
        border: `1px solid ${isErr ? 'rgba(239,68,68,0.4)' : 'rgba(34,197,94,0.4)'}`,
        borderRadius: '12px',
        padding: '12px 24px',
        fontSize: '14px',
        fontWeight: 700,
        color: isErr ? C.danger : C.success,
        zIndex: 3000,
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        animation: 'sa-fade-in 0.3s ease',
        fontFamily: FONT,
      }}
    >
      {isErr ? '⚠️' : '✅'} {msg}
    </div>
  );
}

/* ── Generic dark input ─────────────────────────── */
export function DarkInput({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  required = false,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  hint?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom: '14px' }}>
      <label
        style={{
          fontSize: '12px',
          fontWeight: 700,
          color: C.muted,
          display: 'block',
          marginBottom: '5px',
        }}
      >
        {label}
        {required && <span style={{ color: C.danger }}> *</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          padding: '10px 14px',
          borderRadius: '10px',
          border: `1.5px solid ${focused ? C.orange : C.border}`,
          background: C.bg,
          color: C.text,
          fontSize: '14px',
          fontFamily: FONT,
          outline: 'none',
          transition: 'border-color 0.2s',
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      {hint && <div style={{ fontSize: '11px', color: C.muted, marginTop: '4px' }}>{hint}</div>}
    </div>
  );
}

/* ── Modal shell ────────────────────────────────── */
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        dir="rtl"
        style={{
          background: C.card,
          borderRadius: '20px',
          border: `1px solid ${C.border}`,
          padding: '28px',
          maxWidth: '460px',
          width: '100%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          fontFamily: FONT,
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '22px',
          }}
        >
          <h3 style={{ fontSize: '17px', fontWeight: 900, color: C.orange, margin: 0 }}>{title}</h3>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: C.muted,
              fontSize: '20px',
              cursor: 'pointer',
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ── Confirm Delete Modal ───────────────────────── */
export function ConfirmDeleteModal({
  title,
  body,
  onConfirm,
  onCancel,
  loading,
  error,
}: {
  title: string;
  body: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
  error: string;
}) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1100,
        background: 'rgba(0,0,0,0.8)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div
        dir="rtl"
        style={{
          background: C.card,
          borderRadius: '20px',
          border: `1px solid ${C.border}`,
          padding: '32px',
          maxWidth: '420px',
          width: '100%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          fontFamily: FONT,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: 'rgba(239,68,68,0.15)',
              border: '1px solid rgba(239,68,68,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '22px',
              flexShrink: 0,
            }}
          >
            🗑️
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: 900, color: C.text, margin: 0 }}>{title}</h3>
        </div>
        <div style={{ fontSize: '14px', color: C.muted, lineHeight: 1.8, marginBottom: '20px' }}>
          {body}
        </div>
        {error && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: '10px',
              marginBottom: '16px',
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              fontSize: '13px',
              color: C.danger,
            }}
          >
            ⚠️ {error}
          </div>
        )}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={onConfirm}
            disabled={loading}
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: '10px',
              border: 'none',
              background: loading ? '#6b2020' : C.danger,
              color: 'var(--text-1)',
              fontSize: '14px',
              fontWeight: 800,
              cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: FONT,
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'جاري الحذف...' : 'نعم، احذف'}
          </button>
          <button
            onClick={onCancel}
            disabled={loading}
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: '10px',
              border: `1px solid ${C.border}`,
              background: 'transparent',
              color: C.muted,
              fontSize: '14px',
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: FONT,
            }}
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── ActionBtn ──────────────────────────────────── */
export function ActionBtn({
  label,
  icon,
  color,
  onClick,
}: {
  label: string;
  icon: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '5px',
        padding: '8px 14px',
        borderRadius: '10px',
        border: `1.5px solid ${color}44`,
        background: `${color}18`,
        color,
        fontSize: '13px',
        fontWeight: 700,
        cursor: 'pointer',
        transition: 'all 0.15s',
        fontFamily: FONT,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = `${color}30`;
        e.currentTarget.style.borderColor = `${color}88`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = `${color}18`;
        e.currentTarget.style.borderColor = `${color}44`;
      }}
    >
      {icon && <span>{icon}</span>}
      <span>{label}</span>
    </button>
  );
}

/* ── PageBtn ────────────────────────────────────── */
export function PageBtn({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '6px 14px',
        borderRadius: '8px',
        fontSize: '12px',
        fontWeight: 700,
        cursor: disabled ? 'default' : 'pointer',
        fontFamily: FONT,
        border: `1px solid ${disabled ? 'rgba(51,65,85,0.4)' : C.border}`,
        background: 'transparent',
        color: disabled ? 'rgba(148,163,184,0.3)' : C.muted,
        transition: 'all 0.15s',
      }}
    >
      {label}
    </button>
  );
}
