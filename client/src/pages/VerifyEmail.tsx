import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, MailQuestion, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { authApi } from '@/api/auth.api';
import { useAuth, useRefreshMe } from '@/hooks/useAuth';
import { Button, LinkButton } from '@/components/ui/Button';
import { TextField } from '@/components/ui/Field';
import { Spinner } from '@/components/ui/Feedback';
import { AuthShell } from '@/features/auth/AuthShell';
import { errorMessage } from '@/lib/utils';

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const { user } = useAuth();
  const refreshMe = useRefreshMe();
  const started = useRef(false);
  const [email, setEmail] = useState('');

  const verify = useMutation({ mutationFn: (t: string) => authApi.verifyEmail(t), onSuccess: () => void refreshMe() });
  const resend = useMutation({
    mutationFn: () => authApi.resendVerification(user ? undefined : email),
    onSuccess: () => toast.success('If that address needs verifying, a new link is on its way.'),
    onError: (e) => toast.error(errorMessage(e)),
  });

  // Tokens are single-use, so guard against React StrictMode's double effect.
  useEffect(() => {
    if (token && !started.current) {
      started.current = true;
      verify.mutate(token);
    }
  }, [token, verify]);

  const resendBox = (
    <div className="mt-6 space-y-3 text-left">
      {!user && <TextField label="Your email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />}
      <Button variant="outline" className="w-full" loading={resend.isPending} disabled={!user && !email} onClick={() => resend.mutate()}>Send a new verification link</Button>
    </div>
  );

  let body;
  if (!token) {
    body = (<div className="card p-6 text-center"><MailQuestion className="mx-auto h-10 w-10 text-mist-700" aria-hidden /><p className="mt-3 text-sm">Open the link in your verification email, or request a new one below.</p>{resendBox}</div>);
  } else if (verify.isPending || verify.isIdle) {
    body = <div className="card p-10 text-center"><Spinner label="Verifying your email" /><p className="mt-4 text-sm">Verifying your email…</p></div>;
  } else if (verify.isSuccess) {
    body = (<div className="card p-6 text-center"><CheckCircle2 className="mx-auto h-12 w-12 text-success" aria-hidden /><h2 className="mt-3 font-display text-xl">Email verified</h2><p className="mt-1 text-sm text-charcoal-70">You can now list items and send borrowing requests.</p><LinkButton to={user ? '/dashboard' : '/login'} className="mt-5 w-full">{user ? 'Go to dashboard' : 'Sign in'}</LinkButton></div>);
  } else {
    body = (<div role="alert" className="card p-6 text-center"><XCircle className="mx-auto h-12 w-12 text-danger" aria-hidden /><h2 className="mt-3 font-display text-xl">Link invalid or expired</h2><p className="mt-1 text-sm text-charcoal-70">{errorMessage(verify.error)}</p>{resendBox}</div>);
  }
  return <AuthShell title="Verify your email" footer={<Link className="link" to={user ? '/dashboard' : '/login'}>{user ? 'Back to dashboard' : 'Back to sign in'}</Link>}>{body}</AuthShell>;
}
