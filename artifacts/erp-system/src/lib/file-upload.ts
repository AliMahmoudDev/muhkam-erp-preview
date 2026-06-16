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
    const text = await res.text().catch(() => '');

    if (text) {
      try {
        const body = JSON.parse(text) as { error?: unknown; message?: unknown };
        if (typeof body.error === 'string') message = body.error;
        else if (typeof body.message === 'string') message = body.message;
        else message = text;
      } catch {
        message = text;
      }
    }

    throw new Error(message);
  }

  return res.json();
}
