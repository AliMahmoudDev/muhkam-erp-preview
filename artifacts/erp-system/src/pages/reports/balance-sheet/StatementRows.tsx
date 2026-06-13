/**
 * Balance Sheet table row helper components.
 * Extracted from BalanceSheetReport.tsx for maintainability.
 * Purely presentational — no state, no API calls.
 */
import React from 'react';
import { formatCurrency } from '../shared';
import { useTheme } from './types';

export function SectionHd({
  label,
  hint,
  accent,
}: {
  label: string;
  hint?: string;
  accent?: string;
}) {
  const { hdrBg } = useTheme();
  return (
    <tr>
      <td
        colSpan={2}
        style={{
          background: accent ?? hdrBg,
          color: 'var(--text-1)',
          fontWeight: 700,
          fontSize: 11,
          letterSpacing: '0.06em',
          padding: '8px 16px',
          borderBottom: 'none',
          borderRight: accent ? `3px solid rgba(255,255,255,0.3)` : 'none',
        }}
      >
        {label}
        {hint && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 400,
              marginRight: 8,
              color: 'rgba(255,255,255,0.50)',
            }}
          >
            {hint}
          </span>
        )}
      </td>
    </tr>
  );
}

export function SubSectionHd({ label }: { label: string }) {
  const { isLight, panelBdr } = useTheme();
  return (
    <tr>
      <td
        colSpan={2}
        style={{
          background: isLight ? 'var(--text-1)' : 'rgba(255,255,255,0.04)',
          color: isLight ? 'var(--text-2)' : 'rgba(255,255,255,0.60)',
          fontWeight: 700,
          fontSize: 10.5,
          letterSpacing: '0.05em',
          padding: '6px 20px',
          borderBottom: `1px solid ${panelBdr}`,
        }}
      >
        {label}
      </td>
    </tr>
  );
}

export function ChildRow({
  label,
  value,
  dim,
  clickable,
  expanded,
  onToggle,
  Icon,
}: {
  label: string;
  value: number;
  dim?: boolean;
  clickable?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
  Icon?: React.ElementType;
}) {
  const { txtBody, txtDim, bdColor, isLight } = useTheme();
  const txtColor = dim ? txtDim : txtBody;
  const hoverBg = isLight ? 'rgba(245,158,11,0.04)' : 'rgba(255,255,255,0.03)';
  return (
    <tr
      onClick={clickable ? onToggle : undefined}
      style={{ cursor: clickable ? 'pointer' : 'default' }}
      className={clickable ? 'transition-colors' : ''}
      onMouseEnter={(e) => {
        if (clickable) (e.currentTarget as HTMLElement).style.background = hoverBg;
      }}
      onMouseLeave={(e) => {
        if (clickable) (e.currentTarget as HTMLElement).style.background = '';
      }}
    >
      <td
        style={{
          paddingRight: 36,
          paddingLeft: 16,
          paddingTop: 9,
          paddingBottom: 9,
          fontSize: 12.5,
          color: txtColor,
          borderBottom: `1px solid ${bdColor}`,
        }}
      >
        <span className="flex items-center gap-2">
          {Icon && <Icon className="w-3.5 h-3.5 opacity-50" />}
          {label}
          {clickable && (
            <span
              style={{
                fontSize: 10,
                color: 'var(--status-warning)',
                fontWeight: 700,
                marginRight: 4,
              }}
            >
              {expanded ? '▲ إخفاء' : '▼ تفاصيل'}
            </span>
          )}
        </span>
      </td>
      <td
        style={{
          textAlign: 'left',
          fontVariantNumeric: 'tabular-nums',
          fontWeight: 600,
          fontSize: 13,
          color: dim ? txtDim : txtBody,
          paddingLeft: 20,
          paddingRight: 16,
          borderBottom: `1px solid ${bdColor}`,
        }}
      >
        {formatCurrency(value)}
      </td>
    </tr>
  );
}

export function TotalRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: string;
}) {
  const clr = accent ?? 'var(--status-warning)';
  return (
    <tr>
      <td
        style={{
          fontWeight: 800,
          fontSize: 13.5,
          background: `${clr}18`,
          color: clr,
          borderTop: `2px solid ${clr}40`,
          borderBottom: `2px solid ${clr}40`,
          padding: '10px 16px',
        }}
      >
        {label}
      </td>
      <td
        style={{
          textAlign: 'left',
          fontWeight: 800,
          fontSize: 13.5,
          background: `${clr}18`,
          color: clr,
          borderTop: `2px solid ${clr}40`,
          borderBottom: `2px solid ${clr}40`,
          padding: '10px 16px',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {formatCurrency(value)}
      </td>
    </tr>
  );
}

export function NetRow({
  label,
  value,
  balanced,
}: {
  label: string;
  value: number;
  balanced: boolean;
}) {
  const clr = balanced ? 'var(--status-success)' : 'var(--status-danger)';
  const bg = balanced ? 'rgba(5,150,105,0.10)' : 'rgba(220,38,38,0.10)';
  return (
    <tr>
      <td
        style={{
          fontWeight: 900,
          fontSize: 16,
          background: bg,
          color: clr,
          borderTop: `2px solid ${clr}`,
          padding: '13px 16px',
        }}
      >
        {label}
      </td>
      <td
        style={{
          textAlign: 'left',
          fontWeight: 900,
          fontSize: 16,
          background: bg,
          color: clr,
          borderTop: `2px solid ${clr}`,
          padding: '13px 16px',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {formatCurrency(value)}
      </td>
    </tr>
  );
}

export function Spacer() {
  return (
    <tr>
      <td colSpan={2} style={{ height: 1, background: 'var(--edge-row)', padding: 0 }} />
    </tr>
  );
}

export function DrillRow({ children }: { children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={2} style={{ padding: '0 12px 12px', background: 'var(--bg-row-alt)' }}>
        {children}
      </td>
    </tr>
  );
}
