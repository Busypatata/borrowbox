import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Heart, ImageOff, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import type { ItemSummary } from '@borrowbox/shared';
import { itemsApi } from '@/api/items.api';
import { useAuth } from '@/hooks/useAuth';
import { qk } from '@/lib/queryKeys';
import { categoryLabel, cn, conditionLabel, errorMessage } from '@/lib/utils';
import { Badge } from '@/components/ui/Misc';

export function FavoriteButton({ item, className }: { item: Pick<ItemSummary, 'id' | 'favorited' | 'title'>; className?: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: () => (item.favorited ? itemsApi.unfavorite(item.id) : itemsApi.favorite(item.id)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.itemsAll });
      void qc.invalidateQueries({ queryKey: qk.favorites });
      toast.success(item.favorited ? 'Removed from wish list' : 'Saved to wish list');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <button
      type="button"
      disabled={m.isPending}
      aria-pressed={item.favorited}
      aria-label={item.favorited ? `Remove ${item.title} from wish list` : `Save ${item.title} to wish list`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!user) return navigate('/login', { state: { from: location.pathname + location.search } });
        m.mutate();
      }}
      className={cn('grid h-9 w-9 place-items-center rounded-full bg-white/90 shadow-card transition hover:bg-white disabled:opacity-60', className)}
    >
      <Heart className={cn('h-[18px] w-[18px]', item.favorited ? 'fill-burgundy text-burgundy' : 'text-charcoal')} aria-hidden />
    </button>
  );
}

export function ItemCard({ item }: { item: ItemSummary }) {
  const unavailable = item.status !== 'AVAILABLE';
  return (
    <article className="card group relative overflow-hidden transition-shadow hover:shadow-pop">
      <div className="relative aspect-[4/3] bg-pale/60">
        {item.image ? (
          <img src={item.image.url} alt={item.image.altText} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
        ) : (
          <div className="grid h-full place-items-center text-charcoal-70"><ImageOff className="h-8 w-8" aria-label="No photo" /></div>
        )}
        <FavoriteButton item={item} className="absolute right-2.5 top-2.5 z-10" />
      </div>
      <div className="space-y-2 p-4">
        <h3 className="font-sans text-base font-semibold leading-snug">
          <Link to={`/items/${item.id}`} className="after:absolute after:inset-0 hover:text-burgundy">{item.title}</Link>
        </h3>
        <p className="text-sm text-charcoal-70">{categoryLabel(item.category)} · {conditionLabel(item.condition)}</p>
        <div className="flex items-center justify-between gap-2 pt-1">
          <span className="inline-flex items-center gap-1 text-xs text-charcoal-70">
            <MapPin className="h-3.5 w-3.5" aria-hidden />
            {item.distanceKm !== null ? `${item.distanceKm} km` : item.community}
          </span>
          <Badge tone={unavailable ? 'neutral' : 'success'}>{unavailable ? 'Unavailable' : 'Available'}</Badge>
        </div>
      </div>
    </article>
  );
}

export function ItemGrid({ items }: { items: ItemSummary[] }) {
  return (
    <ul className="grid grid-cols-1 gap-5 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((i) => <li key={i.id}><ItemCard item={i} /></li>)}
    </ul>
  );
}

export function ItemGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <ul aria-busy="true" aria-label="Loading items" className="grid grid-cols-1 gap-5 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="card overflow-hidden"><div className="skeleton aspect-[4/3] rounded-none" /><div className="space-y-2 p-4"><div className="skeleton h-4 w-3/4" /><div className="skeleton h-3 w-1/2" /></div></li>
      ))}
    </ul>
  );
}
