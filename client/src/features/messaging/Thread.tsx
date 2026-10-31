import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowLeft, Loader2, Send } from 'lucide-react';
import { LIMITS, type MessageDto } from '@borrowbox/shared';
import { conversationsApi } from '@/api/conversations.api';
import { ApiError } from '@/api/client';
import { useAuth } from '@/hooks/useAuth';
import { qk } from '@/lib/queryKeys';
import { cn, errorMessage, formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Misc';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';

interface Pending { clientId: string; body: string; failed: boolean; error?: string; createdAt: string }
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

export function Thread({ conversationId }: { conversationId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const conv = useQuery({ queryKey: qk.conversation(conversationId), queryFn: () => conversationsApi.get(conversationId), retry: (n, e) => !(e instanceof ApiError && e.status === 404) && n < 2 });
  const msgs = useInfiniteQuery({
    queryKey: qk.messages(conversationId),
    queryFn: ({ pageParam }) => conversationsApi.messages(conversationId, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => (last.meta.hasMore ? (last.meta.nextCursor ?? undefined) : undefined),
    refetchInterval: 5000, // reliable polling; the database is the source of truth
    enabled: conv.isSuccess,
  });
  const [pending, setPending] = useState<Pending[]>([]);
  const [text, setText] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const prevHeight = useRef<number | null>(null);

  const server: MessageDto[] = [...(msgs.data?.pages ?? [])].reverse().flatMap((p) => p.data);
  const lastId = server[server.length - 1]?.id;
  const lastFromOther = server[server.length - 1] && server[server.length - 1]!.senderId !== user?.id;

  const refreshLists = useCallback(() => {
    void qc.invalidateQueries({ queryKey: qk.conversations });
    void qc.invalidateQueries({ queryKey: qk.stats });
    void qc.invalidateQueries({ queryKey: qk.notifications });
  }, [qc]);

  // Mark as read whenever a message from the other person is on screen.
  const markedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!lastId || !lastFromOther || markedFor.current === lastId) return;
    markedFor.current = lastId;
    conversationsApi.markRead(conversationId).then(refreshLists).catch(() => { markedFor.current = null; });
  }, [lastId, lastFromOther, conversationId, refreshLists]);

  // Auto-scroll only when the reader is already at the bottom (or just sent something).
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    if (prevHeight.current !== null) { el.scrollTop = el.scrollHeight - prevHeight.current; prevHeight.current = null; return; }
    if (stick.current) el.scrollTop = el.scrollHeight;
  }, [lastId, pending.length, msgs.isSuccess]);

  const onScroll = () => {
    const el = listRef.current;
    if (el) stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  const send = useMutation({
    mutationFn: (p: Pending) => conversationsApi.send(conversationId, p.body, p.clientId),
    onSuccess: async (_m, p) => {
      await qc.invalidateQueries({ queryKey: qk.messages(conversationId) });
      setPending((list) => list.filter((x) => x.clientId !== p.clientId));
      refreshLists();
    },
    onError: (e, p) => setPending((list) => list.map((x) => (x.clientId === p.clientId ? { ...x, failed: true, error: errorMessage(e) } : x))),
  });

  const submit = () => {
    const body = text.trim();
    if (!body) return;
    const p: Pending = { clientId: uid(), body, failed: false, createdAt: new Date().toISOString() };
    stick.current = true;
    setPending((l) => [...l, p]);
    setText('');
    send.mutate(p);
  };
  const retry = (p: Pending) => { setPending((l) => l.map((x) => (x.clientId === p.clientId ? { ...x, failed: false, error: undefined } : x))); send.mutate(p); };

  if (conv.isLoading) return <div className="space-y-3 p-5"><Skeleton className="h-12" /><Skeleton className="h-64" /></div>;
  if (conv.error instanceof ApiError && conv.error.status === 404) return <div className="p-6"><EmptyState title="Conversation not found" body="It may not exist, or you aren't a participant." action={<Link className="link" to="/messages">Back to messages</Link>} /></div>;
  if (conv.isError || !conv.data) return <div className="p-6"><ErrorState error={conv.error} onRetry={() => void conv.refetch()} /></div>;

  const c = conv.data;
  let lastDay = '';
  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-3 border-b border-blush/70 px-4 py-3">
        <Link to="/messages" aria-label="Back to conversations" className="rounded-lg p-2 hover:bg-blush/50 md:hidden"><ArrowLeft className="h-5 w-5" aria-hidden /></Link>
        <Avatar name={c.other.name} src={c.other.profileImageUrl} size={40} />
        <div className="min-w-0"><Link to={`/users/${c.other.id}`} className="block truncate font-semibold hover:underline">{c.other.name}</Link>{c.item && <Link to={`/items/${c.item.id}`} className="block truncate text-xs text-charcoal-70 hover:underline">About: {c.item.title}</Link>}</div>
      </header>

      <div ref={listRef} onScroll={onScroll} className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-4" role="log" aria-live="polite" aria-label={`Conversation with ${c.other.name}`}>
        {msgs.hasNextPage && (
          <div className="text-center"><Button size="sm" variant="ghost" loading={msgs.isFetchingNextPage} onClick={() => { prevHeight.current = listRef.current?.scrollHeight ?? null; void msgs.fetchNextPage(); }}>Load earlier messages</Button></div>
        )}
        {msgs.isLoading && <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-charcoal-70" aria-label="Loading messages" /></div>}
        {msgs.isError && <ErrorState error={msgs.error} onRetry={() => void msgs.refetch()} />}
        {msgs.isSuccess && server.length === 0 && pending.length === 0 && <p className="py-10 text-center text-sm text-charcoal-70">No messages yet. Say hello to {c.other.name.split(' ')[0]}!</p>}
        {server.map((m) => {
          const mine = m.senderId === user?.id;
          const day = formatDate(m.createdAt);
          const showDay = day !== lastDay; lastDay = day;
          return (
            <div key={m.id}>
              {showDay && <p className="my-2 text-center text-xs text-charcoal-70">{day}</p>}
              <div className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                <div className={cn('max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-sm', mine ? 'rounded-br-md bg-mist-700 text-white' : 'rounded-bl-md bg-white shadow-card')}>
                  {m.body}
                  <span className={cn('mt-1 block text-[10px]', mine ? 'text-white/80' : 'text-charcoal-70')}>{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            </div>
          );
        })}
        {pending.map((p) => (
          <div key={p.clientId} className="flex justify-end">
            <div className={cn('max-w-[80%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md px-4 py-2.5 text-sm text-white', p.failed ? 'bg-danger' : 'bg-mist-700/70')}>
              {p.body}
              <span className="mt-1 flex items-center gap-2 text-[10px] text-white/90">
                {p.failed ? <>Not sent — {p.error} <button type="button" className="font-bold underline" onClick={() => retry(p)}>Retry</button> <button type="button" className="underline" onClick={() => { setText(p.body); setPending((l) => l.filter((x) => x.clientId !== p.clientId)); }}>Edit</button></> : 'Sending…'}
              </span>
            </div>
          </div>
        ))}
      </div>

      <form className="flex items-end gap-2 border-t border-blush/70 p-3" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <label htmlFor="msg" className="sr-only">Type a message</label>
        <textarea id="msg" aria-label="Message" rows={1} value={text} maxLength={LIMITS.MESSAGE_MAX} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }} placeholder="Type a message…" className="max-h-32 min-h-11 flex-1 resize-none rounded-xl border border-blush bg-white px-3.5 py-2.5 text-sm" />
        <Button type="submit" aria-label="Send message" disabled={!text.trim()} icon={<Send className="h-4 w-4" aria-hidden />} className="h-11 w-11 !px-0" />
      </form>
    </div>
  );
}
