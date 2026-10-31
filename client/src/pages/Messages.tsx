import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';
import { conversationsApi } from '@/api/conversations.api';
import { useDocumentTitle } from '@/hooks/misc';
import { qk } from '@/lib/queryKeys';
import { cn, timeAgo } from '@/lib/utils';
import { Avatar } from '@/components/ui/Misc';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import { LinkButton } from '@/components/ui/Button';
import { Thread } from '@/features/messaging/Thread';

export default function Messages() {
  useDocumentTitle('Messages');
  const { conversationId } = useParams();
  const list = useQuery({ queryKey: qk.conversations, queryFn: conversationsApi.list, refetchInterval: 15_000 });
  const rows = list.data?.data ?? [];

  return (
    <div className="card grid h-[calc(100vh-11rem)] min-h-[28rem] overflow-hidden md:grid-cols-[20rem_1fr]">
      <section aria-label="Conversations" className={cn('flex min-h-0 flex-col border-blush/70 md:border-r', conversationId && 'hidden md:flex')}>
        <h1 className="border-b border-blush/70 px-4 py-4 font-display text-xl">Conversations</h1>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {list.isLoading ? <div className="space-y-2 p-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16" />)}</div> : list.isError ? <div className="p-3"><ErrorState error={list.error} onRetry={() => void list.refetch()} /></div> : rows.length === 0 ? (
            <div className="p-4"><EmptyState icon={<MessageSquare className="h-6 w-6" aria-hidden />} title="No conversations yet" body="Message an owner from any item page to start one." action={<LinkButton to="/browse" size="sm">Browse items</LinkButton>} className="border-0 shadow-none" /></div>
          ) : (
            <ul>
              {rows.map((c) => (
                <li key={c.id}>
                  <Link to={`/messages/${c.id}`} aria-current={c.id === conversationId ? 'page' : undefined} className={cn('flex gap-3 border-b border-blush/40 px-4 py-3 hover:bg-blush/30', c.id === conversationId && 'bg-pale/60')}>
                    <Avatar name={c.other.name} src={c.other.profileImageUrl} size={44} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2"><span className={cn('truncate text-sm', c.unreadCount > 0 ? 'font-bold' : 'font-semibold')}>{c.other.name}</span><span className="shrink-0 text-xs text-charcoal-70">{timeAgo(c.lastMessage?.createdAt ?? c.updatedAt)}</span></span>
                      {c.item && <span className="block truncate text-xs text-mist-700">{c.item.title}</span>}
                      <span className="flex items-center justify-between gap-2"><span className={cn('truncate text-xs', c.unreadCount > 0 ? 'font-semibold text-charcoal' : 'text-charcoal-70')}>{c.lastMessage?.body ?? 'No messages yet'}</span>{c.unreadCount > 0 && <span aria-label={`${c.unreadCount} unread`} className="grid h-5 min-w-5 place-items-center rounded-full bg-mist-700 px-1.5 text-xs font-bold text-white">{c.unreadCount}</span>}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
      <section aria-label="Messages" className={cn('min-h-0', !conversationId && 'hidden md:block')}>
        {conversationId ? <Thread key={conversationId} conversationId={conversationId} /> : <div className="grid h-full place-items-center p-6 text-center text-charcoal-70"><div><MessageSquare className="mx-auto h-10 w-10" aria-hidden /><p className="mt-3 text-sm">Select a conversation to start chatting.</p></div></div>}
      </section>
    </div>
  );
}
