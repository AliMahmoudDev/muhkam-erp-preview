import { CheckCircle, X } from 'lucide-react';

export function StatusBadge({ status }: { status: string }) {
  if (status === 'active')
    return (
      <span className="erp-status erp-status-active flex items-center gap-1">
        <CheckCircle className="w-3 h-3" /> نشط
      </span>
    );
  return (
    <span className="erp-status erp-status-inactive flex items-center gap-1">
      <X className="w-3 h-3" /> مستبعد
    </span>
  );
}
