import ExcelJS from 'exceljs';

export interface ExportColumn<T> {
  header: string;
  key: keyof T | string;
  width?: number;
  format?: (row: T) => string | number | null;
}

export async function exportToExcel<T>(opts: {
  filename: string;
  sheetName: string;
  title: string;
  columns: ExportColumn<T>[];
  rows: T[];
}): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'MUHKAM ERP';
  wb.created = new Date();
  const ws = wb.addWorksheet(opts.sheetName, {
    views: [{ rightToLeft: true }],
  });
  ws.mergeCells(1, 1, 1, opts.columns.length);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = opts.title;
  titleCell.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6D28D9' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 28;

  ws.getRow(2).values = opts.columns.map(c => c.header);
  ws.getRow(2).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getRow(2).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4C1D95' },
  } as ExcelJS.Fill;
  ws.getRow(2).alignment = { horizontal: 'center', vertical: 'middle' };
  opts.columns.forEach((c, i) => {
    ws.getColumn(i + 1).width = c.width ?? 18;
  });

  for (const row of opts.rows) {
    const values = opts.columns.map(c =>
      c.format ? c.format(row) : ((row as Record<string, unknown>)[c.key as string] as string | number | null) ?? '',
    );
    ws.addRow(values);
  }

  for (let r = 3; r <= ws.rowCount; r++) {
    ws.getRow(r).alignment = { horizontal: 'center', vertical: 'middle' };
    if (r % 2 === 0) {
      ws.getRow(r).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF5F3FF' },
      } as ExcelJS.Fill;
    }
  }

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  triggerDownload(blob, opts.filename + '.xlsx');
}

export function exportToPDF<T>(opts: {
  filename: string;
  title: string;
  columns: ExportColumn<T>[];
  rows: T[];
}): void {
  const headers = opts.columns.map(c => c.header).join('</th><th>');
  const tableBody = opts.rows
    .map(row => {
      const cells = opts.columns
        .map(c => {
          const v = c.format ? c.format(row) : (row as Record<string, unknown>)[c.key as string];
          return `<td>${escapeHtml(String(v ?? ''))}</td>`;
        })
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');

  const html = `<!doctype html><html dir="rtl" lang="ar">
<head><meta charset="utf-8"><title>${escapeHtml(opts.title)}</title>
<style>
  @page { size: A4; margin: 12mm; }
  body { font-family: 'Cairo', Arial, sans-serif; direction: rtl; color: #1f2937; }
  h1 { color: #6d28d9; text-align: center; margin: 0 0 10px; font-size: 22px; }
  .meta { text-align: center; color: #6b7280; margin-bottom: 18px; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { background: #4c1d95; color: white; padding: 8px 6px; border: 1px solid #4c1d95; font-weight: 700; }
  td { padding: 6px; border: 1px solid #e5e7eb; text-align: center; }
  tr:nth-child(even) td { background: #f5f3ff; }
  .footer { margin-top: 16px; text-align: center; color: #9ca3af; font-size: 10px; }
</style></head>
<body>
  <h1>${escapeHtml(opts.title)}</h1>
  <div class="meta">${new Date().toLocaleString('ar-EG')} — MUHKAM ERP</div>
  <table>
    <thead><tr><th>${headers}</th></tr></thead>
    <tbody>${tableBody}</tbody>
  </table>
  <div class="footer">عدد السجلات: ${opts.rows.length}</div>
  <script>window.onload=()=>{window.print();}</script>
</body></html>`;

  const w = window.open('', '_blank', 'width=1024,height=768');
  if (!w) return;
  w.document.write(html);
  w.document.close();
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
