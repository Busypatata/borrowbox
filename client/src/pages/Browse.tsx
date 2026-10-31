import { useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Crosshair, Filter, Search, X } from 'lucide-react';
import { CATEGORIES, CONDITIONS, CONDITION_LABELS } from '@borrowbox/shared';
import { itemsApi, type ItemFilters } from '@/api/items.api';
import { useAuth } from '@/hooks/useAuth';
import { useDebounced, useDocumentTitle } from '@/hooks/misc';
import { qk } from '@/lib/queryKeys';
import { categoryLabel, cn, formatDate, pluralize } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { SelectField, TextField } from '@/components/ui/Field';
import { EmptyState, ErrorState, InlineNotice } from '@/components/ui/Feedback';
import { Pagination } from '@/components/ui/Misc';
import { ItemGrid, ItemGridSkeleton } from '@/components/items/ItemCard';
import { AdaptiveLayout } from '@/components/layout/AppLayout';
import { todayUtc } from '@borrowbox/shared';

const RADII = [2, 5, 10, 25, 50];
const PAGE_SIZE = 12;

function Radio({ name, value, checked, onChange, children }: { name: string; value: string; checked: boolean; onChange: () => void; children: string }) {
  return (
    <label className={cn('flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-blush/40', checked && 'bg-pale font-semibold')}>
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} className="h-4 w-4 accent-burgundy" />
      {children}
    </label>
  );
}

function BrowseBody() {
  const [params, setParams] = useSearchParams();
  const { user } = useAuth();
  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [panel, setPanel] = useState(false);
  useDocumentTitle('Browse items');

  const get = (k: string) => params.get(k) ?? '';
  const [qInput, setQInput] = useState(get('q'));
  const debouncedQ = useDebounced(qInput);
  const [communityInput, setCommunityInput] = useState(get('community'));
  const debouncedCommunity = useDebounced(communityInput);

  const set = (patch: Record<string, string | null>, resetPage = true) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) { if (v) next.set(k, v); else next.delete(k); }
    if (resetPage) next.delete('page');
    setParams(next, { replace: true });
  };
  useEffect(() => { if (debouncedQ !== get('q')) set({ q: debouncedQ.trim() || null }); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [debouncedQ]);
  useEffect(() => { if (debouncedCommunity !== get('community')) set({ community: debouncedCommunity.trim() || null }); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [debouncedCommunity]);
  // Keep inputs in sync with back/forward navigation.
  useEffect(() => { setQInput(get('q')); setCommunityInput(get('community')); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [params.get('q'), params.get('community')]);

  const coords = geo ?? (user?.latitude != null && user.longitude != null ? { lat: user.latitude, lng: user.longitude } : null);
  const radius = Number(get('radius')) || undefined;
  const from = get('from');
  const to = get('to');
  const datesIncomplete = Boolean(from) !== Boolean(to);
  const sort = get('sort') || 'newest';
  const page = Math.max(1, Number(get('page')) || 1);

  const filters: ItemFilters = useMemo(() => ({
    q: get('q') || undefined,
    category: get('category') || undefined,
    condition: get('condition') || undefined,
    community: get('community') || undefined,
    from: from && to ? from : undefined,
    to: from && to ? to : undefined,
    lat: coords && (radius || sort === 'distance') ? coords.lat : undefined,
    lng: coords && (radius || sort === 'distance') ? coords.lng : undefined,
    radiusKm: coords ? radius : undefined,
    sort: sort === 'distance' && !coords ? 'newest' : sort === 'relevance' && !get('q') ? 'newest' : sort,
    page,
    pageSize: PAGE_SIZE,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [params, coords?.lat, coords?.lng]);

  const q = useQuery({ queryKey: qk.items(filters), queryFn: ({ signal }) => itemsApi.list(filters, signal), placeholderData: keepPreviousData });
  const items = q.data?.data ?? [];
  const total = q.data?.meta.total ?? 0;
  const totalPages = q.data?.meta.totalPages ?? 1;

  const chips: { key: string; label: string }[] = [];
  if (get('q')) chips.push({ key: 'q', label: `“${get('q')}”` });
  if (get('category')) chips.push({ key: 'category', label: categoryLabel(get('category')) });
  if (get('condition')) chips.push({ key: 'condition', label: CONDITION_LABELS[get('condition') as keyof typeof CONDITION_LABELS] ?? get('condition') });
  if (get('community')) chips.push({ key: 'community', label: get('community') });
  if (from && to) chips.push({ key: 'dates', label: `${formatDate(from, { day: 'numeric', month: 'short' })} – ${formatDate(to, { day: 'numeric', month: 'short' })}` });
  if (radius) chips.push({ key: 'radius', label: `Within ${radius} km` });
  const clearAll = () => { setParams(new URLSearchParams(), { replace: true }); setQInput(''); setCommunityInput(''); };
  const removeChip = (k: string) => (k === 'dates' ? set({ from: null, to: null }) : set({ [k]: null }));

  const useMyLocation = () => {
    setGeoError(null);
    if (!navigator.geolocation) return setGeoError('Your browser does not support location.');
    navigator.geolocation.getCurrentPosition(
      (p) => { setGeo({ lat: p.coords.latitude, lng: p.coords.longitude }); if (!radius) set({ radius: '10' }); },
      () => setGeoError('We could not get your location. You can save a location in your profile instead.'),
      { enableHighAccuracy: false, timeout: 8000 },
    );
  };

  const Filters = (
    <div className="space-y-6">
      <fieldset><legend className="mb-1.5 text-sm font-semibold">Categories</legend>
        <div className="max-h-72 space-y-0.5 overflow-y-auto">
          <Radio name="category" value="" checked={!get('category')} onChange={() => set({ category: null })}>All Categories</Radio>
          {CATEGORIES.map((c) => <Radio key={c.slug} name="category" value={c.slug} checked={get('category') === c.slug} onChange={() => set({ category: c.slug })}>{c.label}</Radio>)}
        </div>
      </fieldset>
      <fieldset><legend className="mb-1.5 text-sm font-semibold">Condition</legend>
        <Radio name="condition" value="" checked={!get('condition')} onChange={() => set({ condition: null })}>Any</Radio>
        {CONDITIONS.map((c) => <Radio key={c} name="condition" value={c} checked={get('condition') === c} onChange={() => set({ condition: c })}>{CONDITION_LABELS[c]}</Radio>)}
      </fieldset>
      <TextField label="Community / location" placeholder="e.g. Imphal West" value={communityInput} onChange={(e) => setCommunityInput(e.target.value)} />
      <fieldset className="space-y-2"><legend className="mb-1.5 text-sm font-semibold">Available between</legend>
        <TextField label="From" type="date" min={todayUtc()} value={from} onChange={(e) => set({ from: e.target.value || null })} />
        <TextField label="To" type="date" min={from || todayUtc()} value={to} onChange={(e) => set({ to: e.target.value || null })} />
        {datesIncomplete && <p className="text-xs text-charcoal-70">Choose both dates to filter by availability.</p>}
      </fieldset>
      <fieldset className="space-y-2"><legend className="mb-1.5 text-sm font-semibold">Distance</legend>
        <SelectField label="Within" value={radius ? String(radius) : ''} disabled={!coords} onChange={(e) => set({ radius: e.target.value || null })}>
          <option value="">Any distance</option>
          {RADII.map((r) => <option key={r} value={r}>{r} km</option>)}
        </SelectField>
        {!coords && <p className="text-xs text-charcoal-70">Share your location to filter by distance.</p>}
        <Button size="sm" variant="soft" icon={<Crosshair className="h-4 w-4" aria-hidden />} onClick={useMyLocation}>Use my location</Button>
        {geoError && <p role="alert" className="text-xs text-danger">{geoError}</p>}
      </fieldset>
    </div>
  );

  return (
    <div>
      <h1 className="text-3xl">Browse Items</h1>
      <p className="mt-1 text-sm text-charcoal-70">Find what you need, when you need it.</p>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <form role="search" className="relative flex-1" onSubmit={(e) => { e.preventDefault(); set({ q: qInput.trim() || null }); }}>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal-70" aria-hidden />
          <input aria-label="Search items" value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder="Search titles, descriptions and categories" className="w-full rounded-xl border border-blush bg-white py-2.5 pl-10 pr-3 text-sm" />
        </form>
        <div className="flex gap-2">
          <Button variant="outline" className="lg:hidden" icon={<Filter className="h-4 w-4" aria-hidden />} aria-expanded={panel} onClick={() => setPanel((p) => !p)}>Filters{chips.length ? ` (${chips.length})` : ''}</Button>
          <label className="sr-only" htmlFor="sort">Sort by</label>
          <select id="sort" value={sort} onChange={(e) => set({ sort: e.target.value === 'newest' ? null : e.target.value })} className="rounded-xl border border-blush bg-white px-3 py-2.5 text-sm">
            <option value="newest">Newest</option>
            <option value="relevance" disabled={!get('q')}>Relevance{get('q') ? '' : ' (search first)'}</option>
            <option value="distance" disabled={!coords}>Distance{coords ? '' : ' (needs location)'}</option>
          </select>
        </div>
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[16rem_1fr]">
        <aside className={cn('card p-5 lg:block', panel ? 'block' : 'hidden')} aria-label="Filters">
          <div className="mb-4 flex items-center justify-between lg:hidden"><h2 className="font-sans text-base font-semibold">Filters</h2><button type="button" aria-label="Close filters" onClick={() => setPanel(false)}><X className="h-5 w-5" aria-hidden /></button></div>
          {Filters}
          {chips.length > 0 && <Button variant="ghost" size="sm" className="mt-5 w-full" onClick={clearAll}>Clear all filters</Button>}
        </aside>

        <section aria-label="Results" aria-busy={q.isFetching}>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <p aria-live="polite" className="text-sm text-charcoal-70">{q.isLoading ? 'Loading…' : `Showing ${items.length} of ${pluralize(total, 'item')}`}</p>
            {chips.map((c) => (
              <button key={c.key} type="button" onClick={() => removeChip(c.key)} aria-label={`Remove filter ${c.label}`} className="inline-flex items-center gap-1 rounded-full bg-pale px-3 py-1 text-xs font-semibold hover:bg-blush">{c.label}<X className="h-3 w-3" aria-hidden /></button>
            ))}
            {chips.length > 0 && <button type="button" onClick={clearAll} className="link text-xs">Clear all</button>}
          </div>
          {datesIncomplete && <div className="mb-4"><InlineNotice tone="warn">Pick both a start and end date to filter by availability.</InlineNotice></div>}
          {q.isLoading ? <ItemGridSkeleton count={8} /> : q.isError ? <ErrorState error={q.error} onRetry={() => void q.refetch()} /> : items.length === 0 ? (
            <EmptyState title="No items match your search" body={chips.length ? 'Try removing a filter or searching for something broader.' : 'Nothing has been shared yet. Be the first!'} action={chips.length ? <Button variant="outline" onClick={clearAll}>Clear all filters</Button> : undefined} />
          ) : (
            <div className={cn(q.isPlaceholderData && 'opacity-60 transition-opacity')}><ItemGrid items={items} /></div>
          )}
          <Pagination page={page} totalPages={totalPages} onChange={(p) => { set({ page: p === 1 ? null : String(p) }, false); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
        </section>
      </div>
    </div>
  );
}

export default function Browse() {
  return <AdaptiveLayout><BrowseBody /></AdaptiveLayout>;
}
