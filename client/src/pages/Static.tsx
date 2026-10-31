import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useDocumentTitle } from '@/hooks/misc';
import { AdaptiveLayout } from '@/components/layout/AppLayout';
import { LinkButton } from '@/components/ui/Button';
import { InlineNotice } from '@/components/ui/Feedback';

const SUPPORT_EMAIL = import.meta.env.VITE_SUPPORT_EMAIL as string | undefined;

function Doc({ title, children, lead }: { title: string; lead?: string; children: ReactNode }) {
  useDocumentTitle(title);
  return (
    <AdaptiveLayout>
      <article className="mx-auto max-w-3xl">
        <h1 className="text-4xl">{title}</h1>
        {lead && <p className="mt-2 text-lg text-charcoal-70">{lead}</p>}
        <div className="mt-8 space-y-6 text-[15px] leading-relaxed [&_h2]:mb-2 [&_h2]:mt-8 [&_h2]:text-2xl [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1">{children}</div>
      </article>
    </AdaptiveLayout>
  );
}

export function About() {
  return (
    <Doc title="About BorrowBox" lead="Borrow more. Buy less.">
      <p>People often buy things they need only occasionally — a drill, a tent, a board game, a textbook for one semester. Meanwhile, the same things sit unused in the cupboards of people nearby.</p>
      <p>BorrowBox helps communities share what they already own. List something you're happy to lend, find what you need close to home, agree dates, arrange pickup by message, and build trust through honest reviews.</p>
      <h2>What BorrowBox is — and isn't</h2>
      <ul><li>It's free, community-first lending between neighbours, students and hobby groups.</li><li>There are no payments, deposits or delivery in this version. Members agree pickup and return directly.</li><li>We don't verify identity documents; we verify email addresses and rely on reviews and reporting.</li></ul>
      <LinkButton to="/browse">Explore items</LinkButton>
    </Doc>
  );
}

export function Help() {
  const faqs: [string, string][] = [
    ['How do I borrow something?', 'Open an item, choose your dates and send a request. The owner approves or declines, and you coordinate pickup in Messages. After the owner confirms handover and you return the item, you can both leave a review.'],
    ['Why do I need to verify my email?', "Verified emails keep the community trustworthy. You can browse without an account, but listing items and sending requests need a verified address."],
    ['Can I cancel a request?', 'Yes — pending requests can be cancelled from My Requests. Once a request is approved it can no longer be cancelled in the app; message the owner to agree any change.'],
    ['What happens if two people want the same dates?', 'An item can never be approved for overlapping dates. When an owner approves one request, overlapping pending requests are declined automatically.'],
    ['Is my address shared?', "No. Listings only show a community and an approximate distance. Pickup instructions are revealed only to the borrower of an approved request."],
    ['How do I report a problem?', "Use “Report listing” on an item or “Report” on a member's profile. Moderators review every report."],
    ['I forgot my password.', 'Use “Forgot password?” on the sign-in page. Reset links are single-use and expire after 30 minutes.'],
  ];
  return (
    <Doc title="Help centre" lead="Answers to common questions.">
      <div className="space-y-3 !mt-6">{faqs.map(([q, a]) => (<details key={q} className="card group p-4"><summary className="cursor-pointer text-base font-semibold">{q}</summary><p className="mt-2 text-charcoal-70">{a}</p></details>))}</div>
      <h2 id="contact">Contact</h2>
      {SUPPORT_EMAIL ? <p>Email us at <a className="link" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.</p> : <InlineNotice>A support contact hasn't been configured for this deployment yet. Set <code>VITE_SUPPORT_EMAIL</code> to show one here.</InlineNotice>}
    </Doc>
  );
}

const DRAFT = <InlineNotice tone="warn">This is a plain-language starter document for the MVP. Have it reviewed by a qualified lawyer and adapt it to your jurisdiction before launching publicly.</InlineNotice>;

export function Terms() {
  return (
    <Doc title="Terms of Service" lead="Last updated: 2026">
      {DRAFT}
      <h2>1. The service</h2><p>BorrowBox connects members who wish to lend items with members who wish to borrow them. BorrowBox is not a party to any loan and does not own, inspect or insure listed items.</p>
      <h2>2. Your account</h2><p>You must provide accurate information, keep your password secure and verify your email address. You are responsible for activity on your account.</p>
      <h2>3. Lending and borrowing</h2>
      <ul><li>Only list items you own or are entitled to lend, and describe them honestly.</li><li>Borrowers must return items in the agreed condition and on time.</li><li>Members agree pickup and return directly; you are responsible for your own safety when meeting.</li><li>Disputes about damage or loss are between the members involved.</li></ul>
      <h2>4. Prohibited content and conduct</h2><p>Illegal, dangerous, deceptive or abusive listings and behaviour are not allowed, including weapons, stolen goods, harassment and spam. We may hide listings or suspend accounts that break these rules.</p>
      <h2>5. Reviews</h2><p>Reviews must be honest and based on a completed loan. We may remove reviews that are abusive or unrelated.</p>
      <h2>6. Liability</h2><p>BorrowBox is provided “as is”. To the extent permitted by law, we are not liable for loss, damage or injury arising from loans arranged through the service.</p>
      <h2>7. Changes and termination</h2><p>You may delete your account at any time from Settings. We may update these terms; continued use means you accept the changes.</p>
      <p>Questions? See the <Link className="link" to="/help#contact">Help centre</Link>.</p>
    </Doc>
  );
}

export function Privacy() {
  return (
    <Doc title="Privacy Policy" lead="Last updated: 2026">
      {DRAFT}
      <h2>What we collect</h2>
      <ul><li><strong>Account data:</strong> name, email address and a password (stored only as a salted hash).</li><li><strong>Profile data you add:</strong> bio, photo, community and city, and optionally a saved location.</li><li><strong>Activity:</strong> listings, requests, messages, reviews and notifications.</li></ul>
      <h2>How we use location</h2><p>Coordinates are used only on our servers to calculate approximate distances. They are never shown to other members, and distances are rounded.</p>
      <h2>Who can see what</h2>
      <ul><li>Your email address is never shown publicly.</li><li>Pickup instructions are visible only to you and the other party of an approved request.</li><li>Messages are visible only to the two participants.</li></ul>
      <h2>Cookies</h2><p>We use one strictly necessary, HTTP-only session cookie to keep you signed in. We do not use advertising or analytics cookies.</p>
      <h2>Service providers</h2><p>We use an image-hosting provider for photos and an email provider for account emails.</p>
      <h2>Retention and deletion</h2><p>When you delete your account we remove your personal details and archive your listings. Completed-loan history and reviews are retained in anonymised form so the other members' records remain accurate.</p>
    </Doc>
  );
}
