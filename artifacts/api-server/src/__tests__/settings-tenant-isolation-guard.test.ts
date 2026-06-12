import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const settingsDir = join(process.cwd(), 'src/routes/settings');

describe('settings tenant isolation guard', () => {
  it('keeps warehouse delete checks scoped by company_id', () => {
    const source = readFileSync(join(settingsDir, 'warehouses.ts'), 'utf8');

    expect(source).not.toContain('.where(eq(stockMovementsTable.warehouse_id, id)),');
    expect(source).not.toContain('.where(eq(stockCountSessionsTable.warehouse_id, id)),');
    expect(source).not.toContain(
      'await db.delete(warehousesTable).where(eq(warehousesTable.id, id));'
    );

    expect(source).toContain('eq(stockMovementsTable.company_id, tenant)');
    expect(source).toContain('eq(stockCountSessionsTable.company_id, tenant)');
    expect(source).toContain('eq(warehousesTable.company_id, tenant)');
  });

  it('keeps safe delete checks scoped by company_id', () => {
    const source = readFileSync(join(settingsDir, 'safes.ts'), 'utf8');

    const forbidden = [
      '.where(eq(expensesTable.safe_id, id))',
      '.where(eq(incomeTable.safe_id, id))',
      '.where(eq(receiptVouchersTable.safe_id, id))',
      '.where(eq(paymentVouchersTable.safe_id, id))',
      '.where(eq(depositVouchersTable.safe_id, id))',
      '.where(eq(salesTable.safe_id, id))',
      '.where(eq(transactionsTable.safe_id, id))',
    ];

    for (const pattern of forbidden) {
      expect(source).not.toContain(pattern);
    }

    expect(source).toContain('eq(expensesTable.company_id, tenant)');
    expect(source).toContain('eq(incomeTable.company_id, tenant)');
    expect(source).toContain('eq(receiptVouchersTable.company_id, tenant)');
    expect(source).toContain('eq(paymentVouchersTable.company_id, tenant)');
    expect(source).toContain('eq(depositVouchersTable.company_id, tenant)');
    expect(source).toContain('eq(safeTransfersTable.company_id, tenant)');
    expect(source).toContain('eq(salesTable.company_id, tenant)');
    expect(source).toContain('eq(transactionsTable.company_id, tenant)');
  });
});
