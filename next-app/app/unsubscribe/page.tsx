import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Unsubscribe · Holladay Digest', robots: { index: false } };

// Linked from every digest email. Unsubscribing takes a button press, so link scanners that open the URL don't unsubscribe anyone.
export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; status?: string }>;
}) {
  const { id, status } = await searchParams;

  return (
    <main className="min-h-dvh px-5 md:px-[60px] py-[60px] max-w-2xl font-sans text-lg md:text-xl leading-relaxed">
      <a href="/" className="font-mono text-[12px] font-medium text-moss hover:text-lime">Holladay Digest</a>
      {status === 'done' ? (
        <>
          <h1 className="mt-10 font-bold text-paper">You&rsquo;re unsubscribed.</h1>
          <p className="mt-6 text-paper/85">You won&rsquo;t get any more emails. Every summary is still on the site.</p>
        </>
      ) : status === 'error' || !id ? (
        <>
          <h1 className="mt-10 font-bold text-paper">That didn&rsquo;t work.</h1>
          <p className="mt-6 text-paper/85">The link may be incomplete. Try the unsubscribe link in your latest email again.</p>
        </>
      ) : (
        <>
          <h1 className="mt-10 font-bold text-paper">Unsubscribe from Holladay Digest?</h1>
          <p className="mt-6 text-paper/85">You&rsquo;ll stop getting meeting summaries by email.</p>
          <form method="post" action={`/api/unsubscribe?id=${encodeURIComponent(id)}`} className="mt-10">
            <button className="press px-4 py-2 rounded-md border border-lime font-mono text-xs font-bold uppercase tracking-wider text-lime hover:bg-lime hover:text-forest">
              Unsubscribe
            </button>
          </form>
        </>
      )}
    </main>
  );
}
