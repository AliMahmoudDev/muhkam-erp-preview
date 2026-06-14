import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

/* ══════════════════════════════════════════════════
   SECTION CARD
══════════════════════════════════════════════════ */

export function SectionCard({
  icon,
  title,
  accent = 'var(--status-warning)',
  children,
  border,
  cardBg,
  actions,
  defaultOpen = true,
}: {
  icon: React.ReactNode;
  title: string;
  accent?: string;
  children: React.ReactNode;
  border: string;
  cardBg: string;
  actions?: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div
      style={{
        borderRadius: 16,
        border: `1px solid ${border}`,
        background: cardBg,
        overflow: 'hidden',
        marginBottom: 18,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px' }}>
        <button
          onClick={() => setOpen((o) => !o)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flex: 1,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            textAlign: 'right',
            padding: 0,
          }}
        >
          <span
            style={{
              width: 34,
              height: 34,
              borderRadius: 9,
              background: `${accent}22`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              color: accent,
            }}
          >
            {icon}
          </span>
          <span
            style={{
              fontSize: 14,
              fontWeight: 800,
              color: 'var(--text-1)',
              flex: 1,
            }}
          >
            {title}
          </span>
          <span
            style={{ color: 'var(--text-hint)', flexShrink: 0 }}
          >
            {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </span>
        </button>
        {actions && <div style={{ flexShrink: 0 }}>{actions}</div>}
      </div>
      {open && (
        <div style={{ borderTop: `1px solid ${border}`, padding: '14px 18px' }}>{children}</div>
      )}
    </div>
  );
}
