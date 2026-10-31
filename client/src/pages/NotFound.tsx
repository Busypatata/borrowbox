import { useDocumentTitle } from '@/hooks/misc';
import { LinkButton } from '@/components/ui/Button';
import { AdaptiveLayout } from '@/components/layout/AppLayout';

export default function NotFound() {
  useDocumentTitle('Page not found');
  return (
    <AdaptiveLayout>
      <div className="mx-auto max-w-lg py-16 text-center">
        <p className="font-display text-7xl text-burgundy">404</p>
        <h1 className="mt-2 text-3xl">We couldn't find that page</h1>
        <p className="mt-2 text-charcoal-70">The link may be broken or the page may have moved.</p>
        <div className="mt-6 flex justify-center gap-3"><LinkButton to="/">Go home</LinkButton><LinkButton to="/browse" variant="outline">Browse items</LinkButton></div>
      </div>
    </AdaptiveLayout>
  );
}
