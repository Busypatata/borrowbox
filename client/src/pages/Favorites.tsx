import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Heart } from 'lucide-react';
import { itemsApi } from '@/api/items.api';
import { useDocumentTitle } from '@/hooks/misc';
import { qk } from '@/lib/queryKeys';
import { LinkButton } from '@/components/ui/Button';
import { EmptyState, ErrorState } from '@/components/ui/Feedback';
import { PageHeader, Pagination } from '@/components/ui/Misc';
import { ItemGrid, ItemGridSkeleton } from '@/components/items/ItemCard';

export default function Favorites() {
  useDocumentTitle('Wish list');
  const [page, setPage] = useState(1);
  const q = useQuery({ queryKey: [...qk.favorites, page], queryFn: () => itemsApi.favorites(page) });
  const items = q.data?.data ?? [];
  return (
    <div>
      <PageHeader title="Wish List" subtitle="Items you've saved for later." />
      {q.isLoading ? <ItemGridSkeleton count={4} /> : q.isError ? <ErrorState error={q.error} onRetry={() => void q.refetch()} /> : items.length === 0 ? (
        <EmptyState icon={<Heart className="h-6 w-6" aria-hidden />} title="Your wish list is empty." body="Tap the heart on any item to save it here." action={<LinkButton to="/browse">Browse items</LinkButton>} />
      ) : <ItemGrid items={items} />}
      <Pagination page={page} totalPages={q.data?.meta.totalPages ?? 1} onChange={setPage} />
    </div>
  );
}
