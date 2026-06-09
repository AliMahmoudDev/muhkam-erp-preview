import { api } from './api';
import { authFetch } from './auth-fetch';

export type UploadCategory = 'repairs' | 'employees' | 'company' | 'invoices' | 'attachments';

export interface UploadedFile {
  key: string;
  url: string;
  bucket: string;
  content_type: string;
  size: number;
}

export function resolveUploadedFileUrl(url: string | null | undefined): string {
  if (!url) return '';
  return url.startsWith('/api/') ? api(url) : url;
}

export async function uploadFileToR2(file: File, category: UploadCategory): Promise<UploadedFile> {
  const form = new FormData();
  form.append('file', file);
  form.append('category', category);

  const res = await authFetch(api('/api/uploads'), {
    method: 'POST',
    body: form,
  });

  if (!res.ok) {
    let message = 'فشل رفع الملف';
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {}
    throw new Error(message);
  }

  return res.json();
}
