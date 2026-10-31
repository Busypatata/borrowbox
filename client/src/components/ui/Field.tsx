import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface FieldShellProps {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  id: string;
  children: ReactNode;
  className?: string;
}
export function FieldShell({ label, error, hint, required, id, children, className }: FieldShellProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className="block text-sm font-medium text-charcoal">
        {label}
        {required && <span className="text-danger" aria-hidden> *</span>}
      </label>
      {children}
      {hint && !error && <p id={`${id}-hint`} className="text-xs text-charcoal-70">{hint}</p>}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

const control =
  'w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-charcoal placeholder:text-charcoal-70/70 transition-colors focus-visible:border-mist disabled:bg-blush/30 disabled:text-charcoal-70';
const ring = (error?: string) => (error ? 'border-danger' : 'border-blush hover:border-burgundy/40');

interface BaseProps { label: string; error?: string; hint?: string; wrapperClassName?: string }

export const TextField = forwardRef<HTMLInputElement, BaseProps & InputHTMLAttributes<HTMLInputElement>>(function TextField(
  { label, error, hint, wrapperClassName, className, required, ...rest }, ref,
) {
  const id = useId();
  return (
    <FieldShell label={label} error={error} hint={hint} required={required} id={id} className={wrapperClassName}>
      <input ref={ref} id={id} required={required} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined} className={cn(control, ring(error), className)} {...rest} />
    </FieldShell>
  );
});

export const TextArea = forwardRef<HTMLTextAreaElement, BaseProps & TextareaHTMLAttributes<HTMLTextAreaElement>>(function TextArea(
  { label, error, hint, wrapperClassName, className, required, ...rest }, ref,
) {
  const id = useId();
  return (
    <FieldShell label={label} error={error} hint={hint} required={required} id={id} className={wrapperClassName}>
      <textarea ref={ref} id={id} required={required} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined} className={cn(control, ring(error), 'min-h-28 resize-y', className)} {...rest} />
    </FieldShell>
  );
});

export const SelectField = forwardRef<HTMLSelectElement, BaseProps & SelectHTMLAttributes<HTMLSelectElement>>(function SelectField(
  { label, error, hint, wrapperClassName, className, required, children, ...rest }, ref,
) {
  const id = useId();
  return (
    <FieldShell label={label} error={error} hint={hint} required={required} id={id} className={wrapperClassName}>
      <select ref={ref} id={id} required={required} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined} className={cn(control, ring(error), className)} {...rest}>
        {children}
      </select>
    </FieldShell>
  );
});
