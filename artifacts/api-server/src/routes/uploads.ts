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
      if (err) reject(err);
      else resolve();
    });
  });
}

/* POST /api/uploads — upload a tenant-scoped file to R2 */
router.post(
  '/uploads',
  wrap(async (req, res) => {
    await runUpload(req, res);

    const companyId = req.user?.company_id;
    if (!companyId) return res.status(403).json({ error: 'لا يوجد company_id لهذا المستخدم' });

    const file = req.file;
    if (!file) return res.status(400).json({ error: 'لم يتم إرسال ملف. استخدم الحقل file' });

    const parsedCategory = categorySchema.safeParse(req.body?.category);
    if (!parsedCategory.success) {
      return res.status(400).json({ error: 'تصنيف الملف غير صالح' });
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
