import type { useQueryClient } from '@tanstack/react-query';
import type { useToast } from '@/hooks/use-toast';
import type { AuditProduct } from '../_shared';

export interface CountTabProps {
  warehouses: { id: number; name: string }[];
  currentWarehouseId: number | null;
  qc: ReturnType<typeof useQueryClient>;
  toast: ReturnType<typeof useToast>['toast'];
}

export type CountMode = 'full' | 'partial' | 'positive';

export interface VarianceData {
  enteredProducts: AuditProduct[];
  itemsWithDiff: AuditProduct[];
  itemsWithPosDiff: AuditProduct[];
  itemsWithNegDiff: AuditProduct[];
  totalPosDiff: number;
  totalNegDiff: number;
  missingNotes: boolean;
  canApply: boolean;
}
