import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { ApiError } from '@/api/client';

/** Maps a server 422 field-error map back onto the form. Returns true if any field was set. */
export function applyServerErrors<T extends FieldValues>(err: unknown, setError: UseFormSetError<T>, known: string[]): boolean {
  if (!(err instanceof ApiError) || !err.fields) return false;
  let any = false;
  for (const [k, msg] of Object.entries(err.fields)) {
    if (known.includes(k)) {
      setError(k as Path<T>, { type: 'server', message: msg });
      any = true;
    }
  }
  return any;
}
