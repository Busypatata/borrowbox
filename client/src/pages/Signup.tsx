import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { MailCheck } from 'lucide-react';
import { registerSchema, type RegisterInput } from '@borrowbox/shared';
import { authApi } from '@/api/auth.api';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/Field';
import { InlineError, InlineNotice } from '@/components/ui/Feedback';
import { AuthShell } from '@/features/auth/AuthShell';
import { PasswordInput } from '@/features/auth/PasswordInput';
import { applyServerErrors } from '@/lib/forms';
import { errorMessage } from '@/lib/utils';
import { toast } from 'sonner';

export default function Signup() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const reg = useMutation({ mutationFn: (v: RegisterInput) => authApi.register(v) });
  const resend = useMutation({
    mutationFn: (email: string) => authApi.resendVerification(email),
    onSuccess: () => toast.success('If that address needs verifying, a new link is on its way.'),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const { register, handleSubmit, setError, formState: { errors } } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '', acceptTerms: undefined as unknown as true },
  });

  const onSubmit = handleSubmit((v) =>
    reg.mutate(v, {
      onSuccess: () => setSentTo(v.email),
      onError: (e) => { applyServerErrors(e, setError, ['name', 'email', 'password', 'confirmPassword', 'acceptTerms']); },
    }),
  );

  if (sentTo) {
    return (
      <AuthShell title="Check your inbox" docTitle="Verify your email" footer={<Link className="link" to="/login">Back to sign in</Link>}>
        <div className="card space-y-4 p-6 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-pale text-mist-700"><MailCheck className="h-7 w-7" aria-hidden /></div>
          <p className="text-sm">We've sent a verification link to <strong>{sentTo}</strong>. Open it to activate borrowing and lending. The link expires in 24 hours.</p>
          <InlineNotice>If you don't see it, check your spam folder. If this email already has an account, we've let the owner know instead.</InlineNotice>
          <Button variant="outline" loading={resend.isPending} onClick={() => resend.mutate(sentTo)}>Resend verification email</Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Join BorrowBox" subtitle="Borrow more. Buy less. It takes a minute." docTitle="Create account" footer={<>Already have an account? <Link className="link" to="/login">Sign in</Link></>}>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {reg.isError && !Object.prototype.hasOwnProperty.call(reg.error ?? {}, 'fields') && <InlineError>{errorMessage(reg.error)}</InlineError>}
        <TextField label="Full name" autoComplete="name" required error={errors.name?.message} {...register('name')} />
        <TextField label="Email" type="email" autoComplete="email" required error={errors.email?.message} {...register('email')} />
        <PasswordInput label="Password" autoComplete="new-password" required hint="At least 10 characters, with a letter and a number." error={errors.password?.message} {...register('password')} />
        <PasswordInput label="Confirm password" autoComplete="new-password" required error={errors.confirmPassword?.message} {...register('confirmPassword')} />
        <div>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-blush accent-burgundy" aria-invalid={!!errors.acceptTerms} {...register('acceptTerms')} />
            <span>I agree to the <Link to="/terms" target="_blank" className="link">Terms</Link> and <Link to="/privacy" target="_blank" className="link">Privacy Policy</Link>.</span>
          </label>
          {errors.acceptTerms && <p role="alert" className="mt-1 text-sm font-medium text-danger">{errors.acceptTerms.message}</p>}
        </div>
        <Button type="submit" size="lg" className="w-full" loading={reg.isPending}>Create account</Button>
      </form>
    </AuthShell>
  );
}
