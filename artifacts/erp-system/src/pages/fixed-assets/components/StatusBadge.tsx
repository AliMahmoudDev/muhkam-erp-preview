import { CheckCircle, X } from 'lucide-react';

export function StatusBadge({ status }: { status: string }) {
  if (status === 'active')
    return (
      <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
        <CheckCircle className="w-3 h-3" /> نشط
      </span>
    );
  return (
    <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/30 flex items-center gap-1">
      <X className="w-3 h-3" /> مستبعد
    </span>
  );
}
