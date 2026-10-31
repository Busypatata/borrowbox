import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowRight, Compass, HandHeart, ShieldCheck, Search, Undo2, Users, MessageSquareLock, Star } from 'lucide-react';
import { CATEGORIES } from '@borrowbox/shared';
import { itemsApi } from '@/api/items.api';
import { useAuth } from '@/hooks/useAuth';
import { useDocumentTitle } from '@/hooks/misc';
import { qk } from '@/lib/queryKeys';
import { CATEGORY_ICONS } from '@/lib/categoryIcons';
import { LinkButton } from '@/components/ui/Button';
import { EmptyState, ErrorState } from '@/components/ui/Feedback';
import { ItemGrid, ItemGridSkeleton } from '@/components/items/ItemCard';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { AppLayout } from '@/components/layout/AppLayout';
import { pluralize } from '@/lib/utils';

function Hero({ photos }: { photos: { url: string; alt: string }[] }) {
  return (
    <section className="container-page grid items-center gap-10 py-12 lg:grid-cols-2 lg:py-20">
      <div>
        <h1 className="text-4xl leading-[1.1] sm:text-5xl lg:text-6xl">Good things are<br />closer than you think.</h1>
        <p className="mt-5 max-w-lg text-lg text-charcoal-70">Borrow useful things from people in your community. Save money, reduce waste, and make the most of what already exists.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <LinkButton to="/browse" size="lg" icon={<Compass className="h-5 w-5" aria-hidden />}>Explore items</LinkButton>
          <LinkButton to="/items/new" size="lg" variant="outline">Share something you own</LinkButton>
        </div>
      </div>
      <div aria-hidden className="relative mx-auto h-72 w-full max-w-md sm:h-96">
        <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-br from-blush to-pale" />
        {photos.length > 0 ? (
          photos.slice(0, 3).map((p, i) => (
            <img key={p.url} src={p.url} alt="" loading="eager" className="absolute h-44 w-36 rounded-2xl border-4 border-white object-cover shadow-pop sm:h-56 sm:w-44"
              style={{ left: `${8 + i * 28}%`, top: `${i % 2 === 0 ? 8 : 30}%`, transform: `rotate(${(i - 1) * 6}deg)` }} />
          ))
        ) : (
          <svg viewBox="0 0 200 200" className="absolute inset-0 m-auto h-3/4 w-3/4"><path d="M100 30l60 30v70l-60 30-60-30V60l60-30z" fill="#FAF6F5" stroke="#773B49" strokeWidth="5" strokeLinejoin="round" /><path d="M40 60l60 30 60-30M100 90v70" fill="none" stroke="#773B49" strokeWidth="5" strokeLinejoin="round" /></svg>
        )}
      </div>
    </section>
  );
}

const steps = [
  { icon: Search, title: '1. Find', body: 'Search what you need nearby — from drills to board games.' },
  { icon: HandHeart, title: '2. Borrow', body: 'Pick your dates, send a request, and arrange pickup by message.' },
  { icon: Undo2, title: '3. Return', body: 'Give it back, confirm the return, and leave a review.' },
];
const trust = [
  { icon: ShieldCheck, title: 'Verified members', body: 'Every member confirms their email before they can borrow or lend.' },
  { icon: Star, title: 'Honest reviews', body: 'Ratings come only from completed loans — never made up.' },
  { icon: MessageSquareLock, title: 'Private by design', body: 'Pickup details are shared only after a request is approved.' },
];

function LandingBody() {
  const featured = useQuery({ queryKey: qk.items({ landing: true }), queryFn: () => itemsApi.list({ pageSize: 8, sort: 'newest' }) });
  const items = featured.data?.data ?? [];
  const total = featured.data?.meta.total ?? 0;
  const { user } = useAuth();

  return (
    <>
      <Hero photos={items.filter((i) => i.image).map((i) => ({ url: i.image!.url, alt: i.title }))} />

      <section className="container-page py-8" aria-labelledby="cats">
        <div className="mb-4 flex items-end justify-between"><h2 id="cats" className="text-2xl">Popular categories</h2><Link to="/browse" className="link inline-flex items-center gap-1 text-sm">View all <ArrowRight className="h-4 w-4" aria-hidden /></Link></div>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-9">
          {CATEGORIES.map((c) => {
            const Icon = CATEGORY_ICONS[c.slug]!;
            return (
              <li key={c.slug}>
                <Link to={`/browse?category=${c.slug}`} className="card flex h-full flex-col items-center gap-2.5 p-4 text-center text-sm font-medium transition-colors hover:bg-pale/60">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-blush/60 text-burgundy"><Icon className="h-5 w-5" aria-hidden /></span>
                  {c.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="container-page py-8" aria-labelledby="featured">
        <div className="mb-4 flex items-end justify-between"><h2 id="featured" className="text-2xl">Featured items</h2><Link to="/browse" className="link inline-flex items-center gap-1 text-sm">View all <ArrowRight className="h-4 w-4" aria-hidden /></Link></div>
        {featured.isLoading ? <ItemGridSkeleton count={4} /> : featured.isError ? <ErrorState error={featured.error} onRetry={() => void featured.refetch()} /> : items.length === 0 ? (
          <EmptyState title="No items shared yet" body="Be the first to share something with your community." action={<LinkButton to={user ? '/items/new' : '/signup'}>{user ? 'Create the first listing' : 'Sign up to list an item'}</LinkButton>} />
        ) : <ItemGrid items={items.slice(0, 4)} />}
      </section>

      <section id="how-it-works" className="container-page scroll-mt-24 py-12" aria-labelledby="how">
        <h2 id="how" className="mb-6 text-center text-3xl">How it works</h2>
        <ol className="grid gap-4 md:grid-cols-3">
          {steps.map((s) => (
            <li key={s.title} className="card flex gap-4 p-5">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-pale text-mist-700"><s.icon className="h-5 w-5" aria-hidden /></span>
              <div><h3 className="font-sans text-base font-semibold">{s.title}</h3><p className="mt-1 text-sm text-charcoal-70">{s.body}</p></div>
            </li>
          ))}
        </ol>
      </section>

      <section className="container-page py-8" aria-labelledby="trust">
        <div className="card grid gap-8 p-6 sm:p-10 lg:grid-cols-[1fr_2fr]">
          <div>
            <Users className="h-8 w-8 text-burgundy" aria-hidden />
            <h2 id="trust" className="mt-3 text-2xl">A community that values sharing</h2>
            {total > 0 && <p className="mt-2 text-sm text-charcoal-70"><strong className="text-charcoal">{pluralize(total, 'item')}</strong> available to borrow right now.</p>}
          </div>
          <ul className="grid gap-5 sm:grid-cols-3">
            {trust.map((t) => (
              <li key={t.title}><t.icon className="h-5 w-5 text-mist-700" aria-hidden /><h3 className="mt-2 font-sans text-sm font-semibold">{t.title}</h3><p className="mt-1 text-sm text-charcoal-70">{t.body}</p></li>
            ))}
          </ul>
        </div>
      </section>

      <section className="container-page py-10">
        <div className="flex flex-col items-center gap-4 rounded-3xl bg-gradient-to-br from-blush to-pale px-6 py-12 text-center">
          <h2 className="text-3xl">Join a community that values<br className="hidden sm:block" /> sharing, sustainability and connection.</h2>
          <LinkButton to={user ? '/dashboard' : '/signup'} variant="accent" size="lg">{user ? 'Go to your dashboard' : 'Get started'}</LinkButton>
        </div>
      </section>
    </>
  );
}

export default function Landing() {
  const { user } = useAuth();
  useDocumentTitle();
  // Signed-in visitors keep the sidebar shell; everyone else gets the public header.
  return user ? <AppLayout><LandingBody /></AppLayout> : <PublicLayout><LandingBody /></PublicLayout>;
}
