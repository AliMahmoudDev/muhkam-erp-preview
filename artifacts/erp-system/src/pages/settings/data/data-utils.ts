import { useState, useEffect } from 'react';
import ExcelJS from 'exceljs';

export const ACTIVITY_KEY = 'halal_erp_activity_log';

export interface ActivityEntry {
  id: string;
  date: string;
  type: 'import-products' | 'import-purchases' | 'delete' | 'reset';
  file: string;
  status: string;
}

export interface PurchaseRow {
  idx: number;
  sku: string;
  name: string;
  quantity: string;
  unitPrice: string;
  supplier: string;
  invoiceNo: string;
  date: string;
  tax: string;
  discount: string;
  productId: number | null;
  errors: string[];
}

export const ACTIVITY_STYLE: Record<ActivityEntry['type'], { label: string; cls: string }> = {
  'import-products': { label: 'استيراد أصناف', cls: 'bg-amber-500/15 text-amber-400' },
  'import-purchases': { label: 'استيراد مشتريات', cls: 'bg-violet-500/15 text-violet-400' },
  delete: { label: 'حذف انتقائي', cls: 'bg-red-500/15 text-red-400' },
  reset: { label: 'إعادة تعيين', cls: 'bg-red-900/30 text-red-300' },
};

export function loadActivityLog(): ActivityEntry[] {
  try {
    return JSON.parse(localStorage.getItem(ACTIVITY_KEY) || '[]');
  } catch {
    return [];
  }
}

export function pushActivity(e: Omit<ActivityEntry, 'id'>) {
  const log = loadActivityLog();
  log.unshift({ ...e, id: `${Date.now()}` });
  try {
    localStorage.setItem(ACTIVITY_KEY, JSON.stringify(log.slice(0, 50)));
  } catch {}
}

export function useCountdown(trigger: boolean, seconds: number) {
  const [count, setCount] = useState(seconds);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!trigger) {
      setCount(seconds);
      setReady(false);
      return;
    }
    setCount(seconds);
    setReady(false);
    const iv = setInterval(() => {
      setCount((c) => {
        if (c <= 1) {
          clearInterval(iv);
          setReady(true);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [trigger, seconds]);
  return { count, ready };
}

export async function readSheetRows(buffer: ArrayBuffer): Promise<Record<string, unknown>[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  if (!ws) return [];
  const headers: Record<number, string> = {};
  const rows: Record<string, unknown>[] = [];
  ws.eachRow((row, rowNum) => {
    if (rowNum === 1) {
      row.eachCell((cell, col) => {
        headers[col] = String(cell.value ?? '');
      });
    } else {
      const obj: Record<string, unknown> = {};
      row.eachCell((cell, col) => {
        if (headers[col]) obj[headers[col]] = cell.value;
      });
      if (Object.keys(obj).length > 0) rows.push(obj);
    }
  });
  return rows;
}

export async function writeXlsxBlob(
  columns: { header: string; key: string; width?: number }[],
  data: Record<string, unknown>[],
  sheetName: string
): Promise<Blob> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName);
  ws.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 20 }));
  ws.getRow(1).font = { bold: true };
  for (const row of data) ws.addRow(row);
  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
