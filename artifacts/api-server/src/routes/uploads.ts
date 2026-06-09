import { Router, type IRouter, type Request, type Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { wrap } from '../lib/async-handler';
import { getTenantObject, putTenantObject, type UploadCategory } from '../lib/r2-storage';

const router: IRouter = Router();

const MAX_FILE_MB = Number(process.env.R2_UPLOAD_MAX_MB || 8);
const MAX_FILE_SIZE = Math.max(1, Math.min(MAX_FILE_MB, 25)) * 1024 * 1024;

const allowedMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
]);

const categorySchema = z
  .enum(['repairs', 'employees', 'company', 'invoices', 'attachments'])
  .default('attachments');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      cb(new Error('نوع الملف غير مسموح. المسموح: JPG, PNG, WEBP, GIF, PDF'));
      return;
    }
    cb(null, true);
  },
});

function runUpload(req: Request, res: Response): Promise<void> {
  return new Promise((resolve, reject) => {
    upload.single('file')(req, res, (err) => {
      if (err) reject(err instanceof Error ? err : new Error('فشل رفع الملف'));
      else resolve();
    });
  });
}

function detectFileType(buffer: Buffer): string | null {
  if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff)
    return 'image/jpeg';
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  )
    return 'image/png';
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  )
    return 'image/webp';
  if (buffer.length >= 6) {
    const signature = buffer.subarray(0, 6).toString('ascii');
    if (signature === 'GIF87a' || signature === 'GIF89a') return 'image/gif';
  }
  if (buffer.length >= 5 && buffer.subarray(0, 5).toString('ascii') === '%PDF-')
    return 'application/pdf';
  return null;
}

function validateFileSignature(file: Express.Multer.File): void {
  const detected = detectFileType(file.buffer);
  if (!detected || detected !== file.mimetype) {
    throw new Error('محتوى الملف لا يطابق نوعه أو غير مسموح');
  }
}

/* POST /api/uploads — upload a tenant-scoped file to R2 */
router.post(
  '/uploads',
  wrap(async (req, res) => {
    try {
      await runUpload(req, res);
    } catch (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: `حجم الملف أكبر من الحد المسموح (${MAX_FILE_MB}MB)` });
      }
      return res.status(400).json({ error: err instanceof Error ? err.message : 'فشل رفع الملف' });
    }

    const companyId = req.user?.company_id;
    if (!companyId) return res.status(403).json({ error: 'لا يوجد company_id لهذا المستخدم' });

    const file = req.file;
    if (!file) return res.status(400).json({ error: 'لم يتم إرسال ملف. استخدم الحقل file' });

    const parsedCategory = categorySchema.safeParse(req.body?.category);
    if (!parsedCategory.success) {
      return res.status(400).json({ error: 'تصنيف الملف غير صالح' });
    }

    try {
      validateFileSignature(file);
    } catch (err) {
      return res
        .status(400)
        .json({ error: err instanceof Error ? err.message : 'نوع الملف غير مسموح' });
    }

    const stored = await putTenantObject({
      companyId,
      category: parsedCategory.data as UploadCategory,
      filename: file.originalname || 'upload',
      contentType: file.mimetype,
      body: file.buffer,
    });

    return res.status(201).json(stored);
  })
);

/* GET /api/uploads/file?key=... — authenticated tenant-scoped file reader */
router.get(
  '/uploads/file',
  wrap(async (req, res) => {
    const companyId = req.user?.company_id;
    if (!companyId) return res.status(403).json({ error: 'لا يوجد company_id لهذا المستخدم' });

    const key = String(req.query.key || '');
    const object = await getTenantObject(companyId, key);

    res.setHeader('Content-Type', object.contentType);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    if (object.contentLength !== undefined) {
      res.setHeader('Content-Length', String(object.contentLength));
    }

    return object.body.pipe(res);
  })
);

export default router;
