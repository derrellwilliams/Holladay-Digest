'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

export interface MeetingListItem {
  id: number;
  date: string;
  type: string;
}

export default function MeetingList({ meetings, activeId }: { meetings: MeetingListItem[]; activeId: number | null }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<number | null>(null);

  // Light up the clicked row immediately while the server renders the panel
  const shownId = isPending ? pendingId : activeId;

  const open = (e: React.MouseEvent, id: number) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    if (id === activeId) return;
    setPendingId(id);
    startTransition(() => router.push(`/?m=${id}`, { scroll: false }));
  };

  if (meetings.length === 0) {
    return (
      <p className="font-mono text-sm text-lime/70 px-6 md:px-10 py-6">
        No meetings yet. Run the scraper to populate the database.
      </p>
    );
  }

  return (
    <nav aria-label="Meetings" className="list-fade h-full overflow-y-auto overscroll-contain pb-16">
      <ul className="pl-6 md:pl-10 pr-6 py-3 md:py-1">
        {meetings.map((m, i) => {
          const active = m.id === shownId;
          return (
            <li key={m.id} className={i < 15 ? 'intro-row' : undefined} style={{ '--i': i } as React.CSSProperties}>
              <Link
                href={`/?m=${m.id}`}
                scroll={false}
                onClick={(e) => open(e, m.id)}
                aria-current={active ? 'page' : undefined}
                className={`list-link block -mx-2 px-2 py-[0.72rem] rounded font-mono text-[15px] md:text-base truncate transition-colors duration-150 ${
                  active ? 'bg-lime text-forest' : 'text-lime'
                }`}
              >
                {m.date} {m.type}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
