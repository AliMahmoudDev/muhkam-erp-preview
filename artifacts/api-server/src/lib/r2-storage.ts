import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Readable } from 'stream';

export type UploadCategory = 'repairs' | 'employees' | 'company' | 'invoices' | 'attachments';

export interface StoredObject {
  key: string;
  url: string;
  bucket: string;
  content_type: string;
  size: number;
}

interface R2StorageConfig {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  prefix: string;
}

let cachedClient: S3Client | null = null;
let cachedConfig: R2StorageConfig | null = null;

function getConfig(): R2StorageConfig {
  const endpoint = process.env.R2_ENDPOINT?.trim();
  const bucket = process.env.R2_BUCKET?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const prefix = (process.env.R2_UPLOAD_PREFIX?.trim() || 'uploads').replace(/^\/+|\/+$/g, '');

  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error(
      'R2 file storage is not configured. Set R2_ENDPOINT, R2_BUCKET, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY.'
    );
  }

  return { endpoint, bucket, accessKeyId, secretAccessKey, prefix };
}

function getClient(): { client: S3Client; config: R2StorageConfig } {
  const config = getConfig();

  if (
    cachedClient &&
    cachedConfig &&
    cachedConfig.endpoint === config.endpoint &&
    cachedConfig.bucket === config.bucket &&
    cachedConfig.accessKeyId === config.accessKeyId &&
    cachedConfig.secretAccessKey === config.secretAccessKey
  ) {
    return { client: cachedClient, config };
  }

  cachedClient = new S3Client({
    region: 'auto',
    endpoint: config.endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
  cachedConfig = config;

  return { client: cachedClient, config };
}

function extensionFrom(filename: string, contentType: string): string {
  const clean = filename.toLowerCase().split('?')[0] ?? '';
  const match = clean.match(/\.([a-z0-9]{1,8})$/);
  if (match?.[1]) return match[1];

  if (contentType === 'image/jpeg') return 'jpg';
  if (contentType === 'image/png') return 'png';
  if (contentType === 'image/webp') return 'webp';
  if (contentType === 'image/gif') return 'gif';
  if (contentType === 'application/pdf') return 'pdf';

  return 'bin';
}

export function tenantPrefix(companyId: number): string {
  const { config } = getClient();
  return `${config.prefix}/companies/${companyId}/`;
}

export async function putTenantObject(params: {
  companyId: number;
  category: UploadCategory;
  filename: string;
  contentType: string;
  body: Buffer;
}): Promise<StoredObject> {
  const { client, config } = getClient();

  const now = new Date();
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const ext = extensionFrom(params.filename, params.contentType);
  const key = `${config.prefix}/companies/${params.companyId}/${params.category}/${yyyy}/${mm}/${crypto.randomUUID()}.${ext}`;

  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: params.body,
      ContentType: params.contentType,
      Metadata: {
        company_id: String(params.companyId),
        category: params.category,
        original_filename: params.filename.slice(0, 180),
      },
    })
  );

  return {
    key,
    url: `/api/uploads/file?key=${encodeURIComponent(key)}`,
    bucket: config.bucket,
    content_type: params.contentType,
    size: params.body.byteLength,
  };
}

export async function getTenantObject(
  companyId: number,
  key: string
): Promise<{
  body: Readable;
  contentType: string;
  contentLength?: number;
}> {
  const { client, config } = getClient();
  const expectedPrefix = `${config.prefix}/companies/${companyId}/`;

  if (
    !key ||
    key.length > 1024 ||
    key.includes('\0') ||
    key.includes('..') ||
    !key.startsWith(expectedPrefix)
  ) {
    throw new Error('Invalid object key');
  }

  const result = await client.send(
    new GetObjectCommand({
      Bucket: config.bucket,
      Key: key,
    })
  );

  if (!(result.Body instanceof Readable)) {
    throw new Error('Invalid R2 response body');
  }

  return {
    body: result.Body,
    contentType: result.ContentType || 'application/octet-stream',
    contentLength: result.ContentLength,
  };
}
