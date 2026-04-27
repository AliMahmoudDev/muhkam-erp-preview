import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * تصدير جدول بيانات إلى ملف PDF بتنسيق A4 أفقي.
 *
 * @param options.title       - عنوان التقرير بالعربية يُعرض في المنتصف
 * @param options.columns     - مصفوفة رؤوس الأعمدة بالعربية
 * @param options.rows        - مصفوفة ثنائية الأبعاد تحتوي على بيانات الجدول
 * @param options.filename    - اسم ملف الإخراج بدون الامتداد .pdf
 * @param options.companyName - اسم الشركة الاختياري يُعرض في أعلى يمين الصفحة
 */
export function exportTableToPDF(options: {
  title: string;
  columns: string[];
  rows: (string | number)[][];
  filename: string;
  companyName?: string;
}): void {
  const { title, columns, rows, filename, companyName } = options;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  const pageWidth = doc.internal.pageSize.getWidth();

  let cursorY = 14;

  if (companyName) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(companyName, pageWidth - 10, cursorY, { align: 'right' });
    cursorY += 10;
  }

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(title, pageWidth / 2, cursorY, { align: 'center' });
  cursorY += 8;

  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  const dateLabel = `${dd}/${mm}/${yyyy} :` + '\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u062A\u0635\u062F\u064A\u0631';

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(dateLabel, pageWidth / 2, cursorY, { align: 'center' });
  cursorY += 8;

  autoTable(doc, {
    head: [columns],
    body: rows,
    startY: cursorY,
    styles: {
      halign: 'right',
      font: 'helvetica',
      fontSize: 9,
    },
    headStyles: {
      halign: 'right',
      fillColor: [245, 158, 11],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [250, 250, 250],
    },
    margin: { right: 10, left: 10 },
  });

  doc.save(`${filename}.pdf`);
}
