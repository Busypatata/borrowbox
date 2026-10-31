import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { forgotPasswordSchema } from '@borrowbox/shared';
import { z } from 'zod';
import { authApi } from '@/api/auth.api';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/Field';
import { InlineError, InlineNotice } from '@/components/ui/Feedback';
import { AuthShell } from '@/features/auth/AuthShell';
import { errorMessage } from '@/lib/utils';

type Values = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPassword() {
  const [sent, setSent] = useState(false);
  const m = useMutation({ mutationFn: (v: Values) => authApi.forgotPassword(v.email), onSuccess: () => setSent(true) });
  const { register, handleSubmit, formState: { errors } } = useForm<Values>({ resolver: zodResolver(forgotPasswordSchema), defaultValues: { email: '' } });

  return (
    <AuthShell title="Forgot your password?" subtitle="Enter your email and we'll send you a link to choose a new one." footer={<Link className="link" to="/login">Back to sign in</Link>}>
      {sent ? (
        <InlineNotice tone="success">If an account exists for that address, a reset link is on its way. It expires in 30 minutes.</InlineNotice>
      ) : (
        <form onSubmit={handleSubmit((v) => m.mutate(v))} noValidate className="space-y-4">
          {m.isError && <InlineError>{errorMessage(m.error)}</InlineError>}
          <TextField label="Email" type="email" autoComplete="email" required error={errors.email?.message} {...register('email')} />
          <Button type="submit" size="lg" className="w-full" loading={m.isPending}>Send reset link</Button>
        </form>
      )}
    </AuthShell>
  );
}
