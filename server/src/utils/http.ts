import type { Request, Response } from 'express';
import type { ZodTypeAny, z } from 'zod';
import type { ApiMeta } from '@borrowbox/shared';
import { Errors } from './errors';

export function ok<T>(res: Response, data: T, meta?: ApiMeta, status = 200) {
  res.status(status).json(meta ? { success: true, data, meta } : { success: true, data });
}
export const created = <T>(res: Response, data: T) => ok(res, data, undefined, 201);
export const noContent = (res: Response) => res.status(204).end();

/** Validate with Zod; throws a 422 with a per-field error map. */
export function parse<S extends ZodTypeAny>(schema: S, input: unknown): z.infer<S> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  const fields: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join('.') || '_';
    if (!fields[key]) fields[key] = issue.message;
  }
  throw Errors.validation(fields);
}

export function uuidParam(req: Request, name: string): string {
  const value = req.params[name];
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    throw Errors.notFound();
  }
  return value;
}

export function pageMeta(page: number, pageSize: number, total: number): ApiMeta {
  return { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}
