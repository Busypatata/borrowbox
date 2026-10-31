import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { resetPasswordSchema } from '@borrowbox/shared';
import { z } from 'zod';
import { authApi } from '@/api/auth.api';
import { Button, LinkButton } from '@/components/ui/Button';
import { InlineError, InlineNotice } from '@/components/ui/Feedback';
import { AuthShell } from '@/features/auth/AuthShell';
import { PasswordInput } from '@/features/auth/PasswordInput';
import { applyServerErrors } from '@/lib/forms';
import { ApiError } from '@/api/client';
import { errorMessage } from '@/lib/utils';

type Values = z.infer<typeof resetPasswordSchema>;

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [done, setDone] = useState(false);
  const m = useMutation({ mutationFn: (v: Values) => authApi.resetPassword(v), onSuccess: () => setDone(true) });
  const { register, handleSubmit, setError, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token, password: '', confirmPassword: '' },
  });

  if (!token) {
    return (
      <AuthShell title="Link not valid" footer={<Link className="link" to="/login">Back to sign in</Link>}>
        <InlineError>This reset link is missing its token. Please request a new one.</InlineError>
        <LinkButton to="/forgot-password" className="mt-4 w-full">Request a new link</LinkButton>
      </AuthShell>
    );
  }
  if (done) {
    return (
      <AuthShell title="Password updated">
        <InlineNotice tone="success">Your password has been changed and all devices were signed out. Please sign in with your new password.</InlineNotice>
        <LinkButton to="/login" className="mt-4 w-full">Go to sign in</LinkButton>
      </AuthShell>
    );
  }
  const invalidToken = m.error instanceof ApiError && m.error.code === 'INVALID_TOKEN';

  return (
    <AuthShell title="Choose a new password" docTitle="Reset password" footer={<Link className="link" to="/login">Back to sign in</Link>}>
      <form onSubmit={handleSubmit((v) => m.mutate({ ...v, token }, { onError: (e) => { applyServerErrors(e, setError, ['password', 'confirmPassword']); } }))} noValidate className="space-y-4">
        {m.isError && !(m.error instanceof ApiError && m.error.fields) && (
          <InlineError>{errorMessage(m.error)}{invalidToken && <> <Link className="underline" to="/forgot-password">Request a new link</Link>.</>}</InlineError>
        )}
        <PasswordInput label="New password" autoComplete="new-password" required hint="At least 10 characters, with a letter and a number." error={errors.password?.message} {...register('password')} />
        <PasswordInput label="Confirm new password" autoComplete="new-password" required error={errors.confirmPassword?.message} {...register('confirmPassword')} />
        <Button type="submit" size="lg" className="w-full" loading={m.isPending}>Update password</Button>
      </form>
    </AuthShell>
  );
}
