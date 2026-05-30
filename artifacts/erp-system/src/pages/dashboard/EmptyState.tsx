import { Wallet } from 'lucide-react';

export function EmptyState({ msg, height = 160 }: { msg: string; height?: number }) {
  return (
    <div className="erp-empty-state" style={{ height }}>
      <div className="erp-empty-icon">
        <Wallet style={{ width: 22, height: 22 }} />
      </div>
      <p className="erp-empty-label">{msg}</p>
    </div>
  );
}
