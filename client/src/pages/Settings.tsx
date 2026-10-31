import { useEffect, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Camera, Crosshair, ShieldCheck, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { changePasswordSchema, deleteAccountSchema, LIMITS, updateProfileSchema, type UpdateProfileInput } from '@borrowbox/shared';
import { z } from 'zod';
import { authApi } from '@/api/auth.api';
import { avatarApi, usersApi, type Prefs } from '@/api/users.api';
import { useAuth, useLogout } from '@/hooks/useAuth';
import { useDocumentTitle } from '@/hooks/misc';
import { qk } from '@/lib/queryKeys';
import { applyServerErrors } from '@/lib/forms';
import { cn, errorMessage } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { TextArea, TextField } from '@/components/ui/Field';
import { ConfirmDialog } from '@/components/ui/Modal';
import { InlineError, InlineNotice, Skeleton } from '@/components/ui/Feedback';
import { Avatar, PageHeader } from '@/components/ui/Misc';
import { PasswordInput } from '@/features/auth/PasswordInput';

export function SettingsLayout() {
  const tab = ({ isActive }: { isActive: boolean }) => cn('whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-semibold', isActive ? 'bg-burgundy text-white' : 'bg-white hover:bg-blush/50');
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Settings" />
      <nav aria-label="Settings sections" className="-mx-1 mb-6 flex gap-2 overflow-x-auto px-1 pb-1">
        <NavLink end to="/settings" className={tab}>Profile</NavLink>
        <NavLink to="/settings/security" className={tab}>Security</NavLink>
        <NavLink to="/settings/notifications" className={tab}>Notifications</NavLink>
      </nav>
      <Outlet />
    </div>
  );
}

type ProfileValues = Pick<UpdateProfileInput, 'name' | 'bio' | 'city' | 'community'>;

export function ProfileSettings() {
  useDocumentTitle('Profile settings');
  const { user } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [geoMsg, setGeoMsg] = useState<string | null>(null);
  const resend = useMutation({ mutationFn: () => authApi.resendVerification(), onSuccess: () => toast.success('If your address needs verifying, a new link is on its way.'), onError: (e) => toast.error(errorMessage(e)) });

  const { register, handleSubmit, reset, setError, formState: { errors, isDirty } } = useForm<ProfileValues>({
    resolver: zodResolver(updateProfileSchema.pick({ name: true, bio: true, city: true, community: true })),
    defaultValues: { name: user?.name ?? '', bio: user?.bio ?? '', city: user?.city ?? '', community: user?.community ?? '' },
  });
  const setMe = (me: unknown) => qc.setQueryData(qk.me, (old: { csrfToken: string | null } | undefined) => ({ ...(old ?? { csrfToken: null }), user: me }));

  const save = useMutation({
    mutationFn: (v: ProfileValues) => usersApi.updateMe({ ...v, ...(coords ?? {}) }),
    onSuccess: (me) => { setMe(me); reset({ name: me.name, bio: me.bio ?? '', city: me.city ?? '', community: me.community ?? '' }); setCoords(null); toast.success('Profile saved'); void qc.invalidateQueries({ queryKey: qk.user(me.id) }); },
    onError: (e) => { applyServerErrors(e, setError, ['name', 'bio', 'city', 'community']); },
  });
  const upload = useMutation({
    mutationFn: (f: File) => avatarApi.upload(f),
    onSuccess: (me) => { setMe(me); toast.success('Profile photo updated'); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const removePhoto = useMutation({ mutationFn: avatarApi.remove, onSuccess: (me) => { setMe(me); toast.success('Profile photo removed'); }, onError: (e) => toast.error(errorMessage(e)) });

  const locate = () => {
    setGeoMsg(null);
    if (!navigator.geolocation) return setGeoMsg('Your browser does not support location.');
    navigator.geolocation.getCurrentPosition(
      (p) => { setCoords({ latitude: p.coords.latitude, longitude: p.coords.longitude }); setGeoMsg('Location captured — save to apply. It is only used to calculate approximate distances.'); },
      () => setGeoMsg('Could not get your location.'), { timeout: 8000 });
  };
  if (!user) return <Skeleton className="h-96" />;

  return (
    <div className="space-y-6">
      <section className="card p-6">
        <div className="flex flex-wrap items-center gap-5">
          <Avatar name={user.name} src={user.profileImageUrl} size={80} />
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" icon={<Camera className="h-4 w-4" aria-hidden />} loading={upload.isPending} onClick={() => fileRef.current?.click()}>Change photo</Button>
              {user.profileImageUrl && <Button size="sm" variant="ghost" loading={removePhoto.isPending} onClick={() => removePhoto.mutate()}>Remove</Button>}
            </div>
            <p className="text-xs text-charcoal-70">JPEG, PNG or WebP, up to {LIMITS.MAX_IMAGE_BYTES / 1024 / 1024} MB.</p>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Choose a profile photo" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload.mutate(f); e.target.value = ''; }} />
          </div>
        </div>
      </section>

      <form noValidate onSubmit={handleSubmit((v) => save.mutate(v))} className="card space-y-5 p-6">
        {save.isError && !applyServerErrorsHas(save.error) && <InlineError>{errorMessage(save.error)}</InlineError>}
        <TextField label="Display name" required error={errors.name?.message} {...register('name')} />
        <TextArea label="Bio" maxLength={LIMITS.BIO_MAX} className="min-h-24" hint="Tell the community a little about yourself." error={errors.bio?.message} {...register('bio')} />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Community / neighbourhood" error={errors.community?.message} {...register('community')} />
          <TextField label="City" error={errors.city?.message} {...register('city')} />
        </div>
        <div>
          <Button type="button" size="sm" variant="soft" icon={<Crosshair className="h-4 w-4" aria-hidden />} onClick={locate}>{user.latitude != null ? 'Update my saved location' : 'Save my location for distance search'}</Button>
          {geoMsg && <p role="status" className="mt-2 text-xs text-charcoal-70">{geoMsg}</p>}
          {user.latitude != null && !geoMsg && <p className="mt-2 text-xs text-charcoal-70">A location is saved. It is never shown to other members — only approximate distances.</p>}
        </div>
        <div className="flex justify-end"><Button type="submit" loading={save.isPending} disabled={!isDirty && !coords}>Save changes</Button></div>
      </form>

      <section className="card space-y-3 p-6" aria-labelledby="ev">
        <h2 id="ev" className="text-xl">Email</h2>
        <p className="text-sm">{user.email}</p>
        {user.emailVerified ? <p className="inline-flex items-center gap-1.5 text-sm font-medium text-success"><ShieldCheck className="h-4 w-4" aria-hidden />Verified</p> : (
          <><InlineNotice tone="warn">Not verified yet. You need a verified email to list items and send requests.</InlineNotice><Button variant="outline" size="sm" loading={resend.isPending} onClick={() => resend.mutate()}>Resend verification email</Button></>
        )}
      </section>
    </div>
  );
}
const applyServerErrorsHas = (e: unknown) => Boolean((e as { fields?: unknown })?.fields);

type PwValues = z.infer<typeof changePasswordSchema>;
export function SecuritySettings() {
  useDocumentTitle('Security');
  const navigate = useNavigate();
  const logoutAll = useLogout(true);
  const logout = useLogout();
  const { user } = useAuth();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const del = useForm<z.infer<typeof deleteAccountSchema>>({ resolver: zodResolver(deleteAccountSchema), defaultValues: { password: '', confirm: '' as 'DELETE' } });
  const { register, handleSubmit, reset, setError, formState: { errors } } = useForm<PwValues>({ resolver: zodResolver(changePasswordSchema), defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' } });
  const change = useMutation({
    mutationFn: authApi.changePassword,
    onSuccess: () => { toast.success('Password changed. Other devices were signed out.'); reset(); },
    onError: (e) => { applyServerErrors(e, setError, ['currentPassword', 'newPassword', 'confirmPassword']); },
  });
  const delMut = useMutation({
    mutationFn: usersApi.deleteMe,
    onSuccess: () => { toast.success('Your account has been deleted.'); logout.mutate(undefined, { onSettled: () => navigate('/', { replace: true }) }); },
  });
  useEffect(() => { if (!confirmDelete) { delMut.reset(); del.reset(); } /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [confirmDelete]);

  return (
    <div className="space-y-6">
      <form noValidate onSubmit={handleSubmit((v) => change.mutate(v))} className="card space-y-4 p-6">
        <h2 className="text-xl">Change password</h2>
        {change.isError && !applyServerErrorsHas(change.error) && <InlineError>{errorMessage(change.error)}</InlineError>}
        <PasswordInput label="Current password" autoComplete="current-password" required error={errors.currentPassword?.message} {...register('currentPassword')} />
        <PasswordInput label="New password" autoComplete="new-password" required hint="At least 10 characters, with a letter and a number." error={errors.newPassword?.message} {...register('newPassword')} />
        <PasswordInput label="Confirm new password" autoComplete="new-password" required error={errors.confirmPassword?.message} {...register('confirmPassword')} />
        <div className="flex justify-end"><Button type="submit" loading={change.isPending}>Update password</Button></div>
      </form>

      <section className="card space-y-3 p-6" aria-labelledby="sess">
        <h2 id="sess" className="text-xl">Sessions</h2>
        <p className="text-sm text-charcoal-70">Sign out of every device, including this one.</p>
        <Button variant="outline" loading={logoutAll.isPending} onClick={() => logoutAll.mutate(undefined, { onSuccess: () => { toast.success('Signed out everywhere'); navigate('/login'); } })}>Sign out of all devices</Button>
      </section>

      <section className="card space-y-3 border-danger/30 p-6" aria-labelledby="danger">
        <h2 id="danger" className="text-xl text-danger">Delete account</h2>
        <p className="text-sm text-charcoal-70">This closes your account, archives your listings and removes your personal details. Reviews and loan history are kept anonymised for the other members involved. This can't be undone.</p>
        <Button variant="danger" icon={<Trash2 className="h-4 w-4" aria-hidden />} onClick={() => setConfirmDelete(true)}>Delete my account…</Button>
      </section>

      <ConfirmDialog open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete your account?" description={`This will permanently close the account for ${user?.email ?? ''}.`} confirmLabel="Delete account" danger loading={delMut.isPending}
        error={delMut.isError ? errorMessage(delMut.error) : undefined}
        onConfirm={del.handleSubmit((v) => delMut.mutate({ password: v.password, confirm: 'DELETE' }))}>
        <div className="space-y-3">
          <PasswordInput label="Your password" autoComplete="current-password" error={del.formState.errors.password?.message} {...del.register('password')} />
          <TextField label='Type "DELETE" to confirm' autoComplete="off" error={del.formState.errors.confirm?.message} {...del.register('confirm')} />
        </div>
      </ConfirmDialog>
    </div>
  );
}

const PREF_ROWS: { key: keyof Prefs; title: string; body: string }[] = [
  { key: 'requestUpdates', title: 'Requests & loans', body: 'New requests, approvals, handovers and returns.' },
  { key: 'messages', title: 'Messages', body: 'When someone sends you a message.' },
  { key: 'reviews', title: 'Reviews', body: 'When you receive a new review.' },
  { key: 'emailEnabled', title: 'Email copies', body: 'Also email me about the above (security alerts are always sent).' },
];

export function NotificationSettings() {
  useDocumentTitle('Notification settings');
  const qc = useQueryClient();
  const q = useQuery({ queryKey: qk.prefs, queryFn: usersApi.prefs });
  const m = useMutation({
    mutationFn: (p: Partial<Prefs>) => usersApi.updatePrefs(p),
    onSuccess: (data) => { qc.setQueryData(qk.prefs, data); toast.success('Preferences saved'); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  if (q.isLoading) return <Skeleton className="h-64" />;
  if (q.isError || !q.data) return <InlineError>{errorMessage(q.error)}</InlineError>;
  return (
    <section className="card divide-y divide-blush/60" aria-label="Notification preferences">
      {PREF_ROWS.map((r) => (
        <label key={r.key} className="flex cursor-pointer items-center justify-between gap-4 p-5">
          <span><span className="block text-sm font-semibold">{r.title}</span><span className="block text-sm text-charcoal-70">{r.body}</span></span>
          <input type="checkbox" role="switch" className="h-5 w-5 accent-burgundy" checked={q.data[r.key]} disabled={m.isPending} onChange={(e) => m.mutate({ [r.key]: e.target.checked })} />
        </label>
      ))}
      <p className="flex items-center gap-2 p-5 text-sm text-charcoal-70"><ShieldCheck className="h-4 w-4 shrink-0" aria-hidden />Security notifications about your account can't be turned off.</p>
    </section>
  );
}
