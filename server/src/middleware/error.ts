import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { ZodError } from 'zod';
import { AppError, isUniqueViolation } from '../utils/errors';
import { logger } from '../utils/logger';
import { LIMITS } from '@borrowbox/shared';

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Endpoint not found.' } });
}

// Express requires the 4-arg signature to treat this as an error handler.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.status).json({
      success: false,
      error: { code: err.code, message: err.message, ...(err.fields ? { fields: err.fields } : {}) },
    });
  }
  if (err instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const i of err.issues) fields[i.path.join('.') || '_'] ??= i.message;
    return res.status(422).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Please check the submitted information.', fields },
    });
  }
  if (err instanceof multer.MulterError) {
    const tooBig = err.code === 'LIMIT_FILE_SIZE';
    return res.status(tooBig ? 413 : 400).json({
      success: false,
      error: {
        code: tooBig ? 'PAYLOAD_TOO_LARGE' : 'BAD_REQUEST',
        message: tooBig
          ? `Each image must be smaller than ${LIMITS.MAX_IMAGE_BYTES / 1024 / 1024} MB.`
          : err.code === 'LIMIT_FILE_COUNT'
            ? `You can upload at most ${LIMITS.MAX_IMAGES} images.`
            : 'The upload could not be processed.',
      },
    });
  }
  const e = err as { type?: string; status?: number };
  if (e?.type === 'entity.too.large') {
    return res.status(413).json({ success: false, error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large.' } });
  }
  if (e?.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Malformed JSON body.' } });
  }
  if (isUniqueViolation(err)) {
    return res.status(409).json({ success: false, error: { code: 'CONFLICT', message: 'That already exists.' } });
  }

  logger.error({ err, method: req.method, url: req.originalUrl }, 'Unhandled error');
  res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'Something went wrong on our side. Please try again.' },
  });
}
