import { resolveUploadedFileUrl } from '@/lib/file-upload';
/**
 * EmployeeDocuments.tsx — documents & attachments display for the employee detail panel.
 */
import { IdCard } from 'lucide-react';
import type { Employee, EmpDocument } from './types';

interface EmployeeDocumentsProps {
  selected: Employee;
  documents: EmpDocument[];
}

export function EmployeeDocuments({ selected, documents }: EmployeeDocumentsProps) {
  return (
    <div className="space-y-2">
      {selected.national_id_image && (
        <div className="bg-white/5 rounded-lg p-2 space-y-2">
          <div className="flex items-center gap-1 text-xs font-semibold text-white">
            <IdCard size={12} className="text-amber-400" /> صورة البطاقة الشخصية
          </div>
          <a
            href={resolveUploadedFileUrl(selected.national_id_image)}
            target="_blank"
            rel="noopener noreferrer"
            className="block"
          >
            <img
              src={resolveUploadedFileUrl(selected.national_id_image)}
              alt="بطاقة شخصية"
              className="rounded max-h-48 w-auto border border-white/10"
            />
          </a>
        </div>
      )}
      {documents.length === 0 && !selected.national_id_image && (
        <p className="text-white/40 text-xs text-center py-4">لا توجد مستندات</p>
      )}
      {documents.map((doc) => (
        <div key={doc.id} className="bg-white/5 rounded-lg p-2">
          <div className="text-xs font-semibold text-white">{doc.file_name}</div>
          <div className="text-xs text-white/50">{doc.document_type}</div>
          {doc.expiry_date && (
            <div className="text-xs text-amber-300">ينتهي: {doc.expiry_date}</div>
          )}
        </div>
      ))}
    </div>
  );
}
