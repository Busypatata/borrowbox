import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useBlocker, useNavigate, useParams } from 'react-router-dom';
import { Crosshair } from 'lucide-react';
import { toast } from 'sonner';
import { CATEGORIES, CONDITIONS, CONDITION_LABELS, createItemSchema, LIMITS, type CreateItemInput } from '@borrowbox/shared';
import { itemsApi } from '@/api/items.api';
import { ApiError } from '@/api/client';
import { useAuth } from '@/hooks/useAuth';
import { useDocumentTitle, useUnsavedWarning } from '@/hooks/misc';
import { qk } from '@/lib/queryKeys';
import { applyServerErrors } from '@/lib/forms';
import { errorMessage } from '@/lib/utils';
import { Button, LinkButton } from '@/components/ui/Button';
import { SelectField, TextArea, TextField } from '@/components/ui/Field';
import { ConfirmDialog } from '@/components/ui/Modal';
import { EmptyState, ErrorState, InlineError, InlineNotice, Skeleton } from '@/components/ui/Feedback';
import { PageHeader } from '@/components/ui/Misc';
import { ImagePicker, type ExistingImage } from '@/features/item-management/ImagePicker';

type Values = CreateItemInput & { status?: 'AVAILABLE' | 'UNAVAILABLE' };
const FIELDS = ['title', 'description', 'category', 'condition', 'community', 'city', 'pickupInstructions', 'latitude', 'longitude', 'status'];

export default function ItemForm() {
  const { itemId } = useParams();
  const editing = Boolean(itemId);
  useDocumentTitle(editing ? 'Edit listing' : 'List an item');
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [files, setFiles] = useState<File[]>([]);
  const [imgError, setImgError] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<ExistingImage | null>(null);
  const [geoMsg, setGeoMsg] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const existing = useQuery({ queryKey: qk.item(itemId ?? ''), queryFn: () => itemsApi.get(itemId!), enabled: editing });
  const { register, handleSubmit, reset, setValue, setError, watch, formState: { errors, isDirty, isSubmitting, isSubmitSuccessful } } = useForm<Values>({
    resolver: zodResolver(createItemSchema),
    defaultValues: { title: '', description: '', category: undefined as never, condition: undefined as never, community: user?.community ?? '', city: user?.city ?? '', pickupInstructions: '', status: 'AVAILABLE' },
  });

  useEffect(() => {
    const it = existing.data;
    if (it) reset({ title: it.title, description: it.description, category: it.category as never, condition: it.condition, community: it.community, city: it.city, pickupInstructions: it.pickupInstructions ?? '', status: it.status === 'UNAVAILABLE' ? 'UNAVAILABLE' : 'AVAILABLE' });
  }, [existing.data, reset]);

  const lat = watch('latitude');
  const dirty = (isDirty || files.length > 0) && !isSubmitSuccessful;
  useUnsavedWarning(dirty);
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname);

  const removeImage = useMutation({
    mutationFn: (img: ExistingImage) => itemsApi.removeImage(itemId!, img.id),
    onSuccess: (item) => { qc.setQueryData(qk.item(itemId!), item); void qc.invalidateQueries({ queryKey: qk.itemsAll }); toast.success('Photo removed'); setRemoveTarget(null); },
    onError: (e) => { toast.error(errorMessage(e)); setRemoveTarget(null); },
  });

  const save = useMutation({
    mutationFn: async (v: Values) => {
      const { status, ...rest } = v;
      let item = editing ? await itemsApi.update(itemId!, { ...rest, status, latitude: rest.latitude ?? undefined, longitude: rest.longitude ?? undefined }) : await itemsApi.create(rest);
      if (files.length) {
        try { item = await itemsApi.uploadImages(item.id, files); }
        catch (err) { throw Object.assign(new Error(`Your listing was saved, but the photos could not be uploaded: ${errorMessage(err)}`), { savedId: item.id }); }
      }
      return item;
    },
    onSuccess: (item) => {
      void qc.invalidateQueries({ queryKey: qk.itemsAll });
      qc.setQueryData(qk.item(item.id), item);
      toast.success(editing ? 'Listing updated' : 'Your item is now listed!');
      setFiles([]);
      setTimeout(() => navigate(`/items/${item.id}`), 0);
    },
    onError: (e) => {
      const savedId = (e as { savedId?: string }).savedId;
      if (savedId) { // listing exists; photos failed — send the user to edit so they can retry
        void qc.invalidateQueries({ queryKey: qk.itemsAll });
        toast.error((e as Error).message);
        navigate(`/items/${savedId}/edit`, { replace: true });
        return;
      }
      if (!applyServerErrors(e, setError, FIELDS)) setSubmitError(errorMessage(e));
    },
  });

  const useLocation_ = () => {
    setGeoMsg(null);
    if (!navigator.geolocation) return setGeoMsg('Your browser does not support location.');
    navigator.geolocation.getCurrentPosition(
      (p) => { setValue('latitude', p.coords.latitude, { shouldDirty: true }); setValue('longitude', p.coords.longitude, { shouldDirty: true }); setGeoMsg('Location added. Only an approximate distance is ever shown to others.'); },
      () => setGeoMsg('Could not get your location. You can still publish without it.'),
      { timeout: 8000 },
    );
  };

  if (editing && existing.isLoading) return <div className="space-y-4"><Skeleton className="h-10 w-1/3" /><Skeleton className="h-96" /></div>;
  if (editing && existing.error instanceof ApiError && existing.error.status === 404) return <EmptyState title="Listing not found" body="It may have been removed, or it isn't yours to edit." action={<LinkButton to="/my-items">Back to my items</LinkButton>} />;
  if (editing && existing.isError) return <ErrorState error={existing.error} onRetry={() => void existing.refetch()} />;
  if (editing && existing.data && !existing.data.isOwner) return <EmptyState title="You can't edit this listing" action={<LinkButton to="/browse">Browse items</LinkButton>} />;
  const archived = existing.data && (existing.data.status === 'ARCHIVED' || existing.data.status === 'HIDDEN');

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={editing ? 'Edit listing' : 'List an item'} subtitle="Share something useful with your community." />
      {!user?.emailVerified && <div className="mb-4"><InlineNotice tone="warn">You need to verify your email before you can publish a listing.</InlineNotice></div>}
      {archived && <div className="mb-4"><InlineNotice tone="warn">This listing is {existing.data!.status === 'HIDDEN' ? 'hidden by moderators' : 'archived'}. Reactivate it from My Items to make it borrowable.</InlineNotice></div>}
      <form noValidate onSubmit={handleSubmit((v) => { setSubmitError(null); save.mutate(v); })} className="card space-y-6 p-6">
        {submitError && <InlineError>{submitError}</InlineError>}
        <TextField label="Title" required maxLength={LIMITS.TITLE_MAX} error={errors.title?.message} {...register('title')} />
        <TextArea label="Description" required maxLength={LIMITS.DESCRIPTION_MAX} hint={`${LIMITS.DESCRIPTION_MIN}–${LIMITS.DESCRIPTION_MAX} characters. Mention what's included and any care instructions.`} error={errors.description?.message} {...register('description')} />
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="Category" required error={errors.category?.message} defaultValue="" {...register('category')}>
            <option value="" disabled>Choose a category</option>
            {CATEGORIES.map((c) => <option key={c.slug} value={c.slug}>{c.label}</option>)}
          </SelectField>
          <SelectField label="Condition" required error={errors.condition?.message} defaultValue="" {...register('condition')}>
            <option value="" disabled>Choose a condition</option>
            {CONDITIONS.map((c) => <option key={c} value={c}>{CONDITION_LABELS[c]}</option>)}
          </SelectField>
        </div>
        <ImagePicker
          existing={existing.data?.images ?? []} files={files} onFiles={setFiles} error={imgError} onError={setImgError}
          removing={removeImage.isPending ? removeTarget?.id : null} onRemoveExisting={setRemoveTarget}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Community / neighbourhood" required error={errors.community?.message} {...register('community')} />
          <TextField label="City" required error={errors.city?.message} {...register('city')} />
        </div>
        <div>
          <Button type="button" variant="soft" size="sm" icon={<Crosshair className="h-4 w-4" aria-hidden />} onClick={useLocation_}>{lat != null ? 'Update my location' : 'Add my location for distance search'}</Button>
          {geoMsg && <p role="status" className="mt-2 text-xs text-charcoal-70">{geoMsg}</p>}
        </div>
        <TextArea label="Pickup instructions" className="min-h-24" maxLength={500} hint="Only shared with a borrower after you approve their request. Never put your exact home address in the description." error={errors.pickupInstructions?.message} {...register('pickupInstructions')} />
        {editing && !archived && (
          <SelectField label="Availability" hint="Temporarily unavailable items are hidden from search." {...register('status')}>
            <option value="AVAILABLE">Available to borrow</option>
            <option value="UNAVAILABLE">Temporarily unavailable</option>
          </SelectField>
        )}
        <div className="flex flex-wrap justify-end gap-3 border-t border-blush/70 pt-5">
          <Button variant="ghost" onClick={() => navigate(editing ? `/items/${itemId}` : '/my-items')} disabled={isSubmitting || save.isPending}>Cancel</Button>
          <Button type="submit" size="lg" loading={save.isPending} disabled={!user?.emailVerified}>{editing ? 'Save changes' : 'Publish listing'}</Button>
        </div>
      </form>

      <ConfirmDialog open={!!removeTarget} onClose={() => setRemoveTarget(null)} title="Remove this photo?" description="It will be deleted from your listing immediately." confirmLabel="Remove photo" danger loading={removeImage.isPending} onConfirm={() => removeTarget && removeImage.mutate(removeTarget)} />
      <ConfirmDialog open={blocker.state === 'blocked'} onClose={() => blocker.reset?.()} title="Discard your changes?" description="You have unsaved changes that will be lost if you leave this page." confirmLabel="Discard changes" danger onConfirm={() => blocker.proceed?.()} />
    </div>
  );
}
