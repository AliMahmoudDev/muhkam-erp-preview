import type { AuditProduct } from '../_shared';
import type { VarianceData } from './types';

export function computeVariance(
  allProducts: AuditProduct[],
  physicalQtys: Record<number, string>,
  itemNotes: Record<number, string>,
  selectedWarehouse: number,
  countDate: string,
  countTime: string,
): VarianceData {
  const enteredProducts = allProducts.filter(
    (p) => physicalQtys[p.id] !== undefined && physicalQtys[p.id] !== ''
  );
  const itemsWithPosDiff = enteredProducts.filter((p) => {
    const diff = parseFloat(physicalQtys[p.id] || '0') - p.calculated_qty;
    return diff > 0.001;
  });
  const itemsWithNegDiff = enteredProducts.filter((p) => {
    const diff = parseFloat(physicalQtys[p.id] || '0') - p.calculated_qty;
    return diff < -0.001;
  });
  const itemsWithDiff = enteredProducts.filter((p) => {
    const diff = parseFloat(physicalQtys[p.id] || '0') - p.calculated_qty;
    return Math.abs(diff) > 0.001;
  });
  const totalPosDiff = itemsWithPosDiff.reduce(
    (acc, p) => acc + (parseFloat(physicalQtys[p.id] || '0') - p.calculated_qty),
    0
  );
  const totalNegDiff = itemsWithNegDiff.reduce(
    (acc, p) => acc + (parseFloat(physicalQtys[p.id] || '0') - p.calculated_qty),
    0
  );

  const missingNotes = itemsWithDiff.some((p) => !itemNotes[p.id]?.trim());
  const canApply =
    enteredProducts.length > 0 &&
    selectedWarehouse > 0 &&
    !!countDate &&
    !!countTime &&
    !missingNotes;

  return {
    enteredProducts,
    itemsWithDiff,
    itemsWithPosDiff,
    itemsWithNegDiff,
    totalPosDiff,
    totalNegDiff,
    missingNotes,
    canApply,
  };
}
