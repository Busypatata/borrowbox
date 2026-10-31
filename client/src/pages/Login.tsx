import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { loginSchema, type LoginInput } from '@borrowbox/shared';
import { useLogin } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/Field';
import { InlineError } from '@/components/ui/Feedback';
import { AuthShell } from '@/features/auth/AuthShell';
import { PasswordInput } from '@/features/auth/PasswordInput';
import { applyServerErrors } from '@/lib/forms';
import { errorMessage } from '@/lib/utils';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  const login = useLogin();
  const { register, handleSubmit, setError, formState: { errors } } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', rememberMe: false },
  });

  const onSubmit = handleSubmit((values) =>
    login.mutate(values, {
      onSuccess: (s) => {
        toast.success(`Welcome back, ${s.user?.name.split(' ')[0] ?? ''}!`);
        navigate(from && from.startsWith('/') && !from.startsWith('//') ? from : '/dashboard', { replace: true });
      },
      onError: (e) => { applyServerErrors(e, setError, ['email', 'password']); },
    }),
  );

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to borrow, lend and keep track of your loans."
      docTitle="Sign in"
      footer={<>New to BorrowBox? <Link className="link" to="/signup" state={location.state}>Create an account</Link></>}
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {login.isError && <InlineError>{errorMessage(login.error)}</InlineError>}
        <TextField label="Email" type="email" autoComplete="email" required error={errors.email?.message} {...register('email')} />
        <PasswordInput label="Password" autoComplete="current-password" required error={errors.password?.message} {...register('password')} />
        <div className="flex items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4 rounded border-blush accent-burgundy" {...register('rememberMe')} />
            Keep me signed in for 30 days
          </label>
          <Link to="/forgot-password" className="link text-sm">Forgot password?</Link>
        </div>
        <Button type="submit" size="lg" className="w-full" loading={login.isPending}>Sign in</Button>
      </form>
    </AuthShell>
  );
}
