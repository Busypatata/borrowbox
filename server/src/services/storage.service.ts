import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { v2 as cloudinary } from 'cloudinary';
import { ALLOWED_IMAGE_TYPES, LIMITS } from '@borrowbox/shared';
import { env } from '../config/env';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';

export const LOCAL_UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');

export interface StoredImage {
  url: string;
  storageKey: string;
}

type Detected = { mime: (typeof ALLOWED_IMAGE_TYPES)[number]; ext: 'jpg' | 'png' | 'webp' };

/** Sniffs the real file type from magic bytes. Browser MIME type and filename are never trusted. */
export function detectImageType(buf: Buffer): Detected | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' };
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { mime: 'image/png', ext: 'png' };
  }
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') {
    return { mime: 'image/webp', ext: 'webp' };
  }
  return null;
}

export function validateImage(file: { buffer: Buffer; size: number }): Detected {
  if (file.size > LIMITS.MAX_IMAGE_BYTES) {
    throw new AppError(413, 'PAYLOAD_TOO_LARGE', `Each image must be smaller than ${LIMITS.MAX_IMAGE_BYTES / 1024 / 1024} MB.`);
  }
  const detected = detectImageType(file.buffer);
  if (!detected) {
    throw new AppError(415, 'UNSUPPORTED_MEDIA', 'Only JPEG, PNG or WebP images are allowed.');
  }
  return detected;
}

export function storageAvailable(): boolean {
  return env.STORAGE_PROVIDER === 'local' ? !env.isProd : env.cloudinaryConfigured;
}

let configured = false;
function configureCloudinary() {
  if (configured) return;
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  configured = true;
}

function unavailable(): never {
  throw new AppError(
    503,
    'STORAGE_UNAVAILABLE',
    'Image uploads are not available right now. Please try again later.',
  );
}

export async function storeImage(file: { buffer: Buffer; size: number }): Promise<StoredImage> {
  const detected = validateImage(file);
  if (!storageAvailable()) unavailable();

  if (env.STORAGE_PROVIDER === 'local') {
    await fs.mkdir(LOCAL_UPLOAD_DIR, { recursive: true });
    const name = `${crypto.randomUUID()}.${detected.ext}`;
    await fs.writeFile(path.join(LOCAL_UPLOAD_DIR, name), file.buffer);
    const origin = env.PUBLIC_API_URL ?? `http://localhost:${env.PORT}`;
    return { url: `${origin}/uploads/${name}`, storageKey: `local:${name}` };
  }

  configureCloudinary();
  try {
    const result = await new Promise<{ secure_url: string; public_id: string }>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: 'borrowbox/items',
          resource_type: 'image',
          allowed_formats: ['jpg', 'png', 'webp'],
          transformation: [{ width: 1600, height: 1600, crop: 'limit', quality: 'auto', fetch_format: 'auto' }],
        },
        (err, res) => (err || !res ? reject(err ?? new Error('Empty Cloudinary response')) : resolve(res)),
      );
      stream.end(file.buffer);
    });
    return { url: result.secure_url, storageKey: result.public_id };
  } catch (err) {
    logger.error({ err }, 'Cloudinary upload failed');
    unavailable();
  }
}

export async function deleteImage(storageKey: string): Promise<void> {
  try {
    if (storageKey.startsWith('local:')) {
      await fs.rm(path.join(LOCAL_UPLOAD_DIR, path.basename(storageKey.slice(6))), { force: true });
      return;
    }
    if (!env.cloudinaryConfigured) return;
    configureCloudinary();
    await cloudinary.uploader.destroy(storageKey, { resource_type: 'image' });
  } catch (err) {
    // Orphaned remote files are acceptable; the database remains consistent.
    logger.warn({ err }, 'Failed to delete stored image');
  }
}
