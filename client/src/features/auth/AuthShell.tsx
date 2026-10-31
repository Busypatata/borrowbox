import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '@/components/ui/Logo';
import { useDocumentTitle } from '@/hooks/misc';

export function AuthShell({ title, subtitle, children, footer, docTitle }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode; docTitle?: string }) {
  useDocumentTitle(docTitle ?? title);
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.05fr]">
      <div className="flex flex-col px-5 py-8 sm:px-10">
        <Logo />
        <main id="main" className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
          <h1 className="text-3xl">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-charcoal-70">{subtitle}</p>}
          <div className="mt-7">{children}</div>
          {footer && <div className="mt-6 text-center text-sm text-charcoal-70">{footer}</div>}
        </main>
        <p className="text-center text-xs text-charcoal-70"><Link className="hover:underline" to="/terms">Terms</Link> · <Link className="hover:underline" to="/privacy">Privacy</Link></p>
      </div>
      <aside aria-hidden className="relative hidden overflow-hidden bg-burgundy lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,#9A5666_0%,transparent_55%),radial-gradient(circle_at_80%_90%,#6F9BCB55_0%,transparent_50%)]" />
        <div className="relative flex h-full flex-col justify-end p-12 text-white">
          <p className="font-display text-4xl leading-tight">Good things are closer than you think.</p>
          <p className="mt-4 max-w-sm text-white/80">Borrow useful things from people in your community. Save money, reduce waste, and make the most of what already exists.</p>
        </div>
      </aside>
    </div>
  );
}
