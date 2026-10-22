'use client';

import { useEffect, useRef } from 'react';

export interface MeetingListItem {
  id: number;
  date: string;
  type: string;
}

export default function MeetingList({
  meetings,
  activeId,
  onSelect,
}: {
  meetings: MeetingListItem[];
  activeId: number | null;
  onSelect: (id: number) => void;
}) {
  const navRef = useRef<HTMLElement>(null);

  // Keep the active date in view as the feed scrolls (vertical list on desktop, horizontal strip on mobile)
  useEffect(() => {
    const nav = navRef.current;
    const link = nav?.querySelector<HTMLElement>('[aria-current]');
    if (!nav || !link) return;
    const n = nav.getBoundingClientRect();
    const l = link.getBoundingClientRect();
    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
    if (nav.scrollWidth > nav.clientWidth) {
      if (l.left < n.left || l.right > n.right) nav.scrollTo({ left: nav.scrollLeft + l.left - n.left - 16, behavior });
    } else if (l.top < n.top || l.bottom > n.bottom - 64) {
      nav.scrollTo({ top: nav.scrollTop + l.top - n.top - n.height / 3, behavior });
    }
  }, [activeId]);

  const open = (e: React.MouseEvent, id: number) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    onSelect(id);
  };

  if (meetings.length === 0) {
    return (
      <p className="font-mono text-sm text-lime/70 px-6 md:px-8 py-6">
        No meetings yet. Run the scraper to populate the database.
      </p>
    );
  }

  return (
    <nav ref={navRef} aria-label="Meetings" className="no-scrollbar md:list-fade h-full overflow-x-auto md:overflow-x-hidden md:overflow-y-auto overscroll-contain">
      <ul className="flex md:block gap-6 px-5 py-4 md:px-16 md:pt-[47px] md:pb-16">
        {meetings.map((m, i) => {
          const active = m.id === activeId;
          return (
            <li key={m.id} className={i < 20 ? 'intro-row shrink-0' : 'shrink-0'} style={{ '--i': i } as React.CSSProperties}>
              <a
                href={`/?m=${m.id}`}
                onClick={(e) => open(e, m.id)}
                aria-current={active ? 'location' : undefined}
                title={m.type}
                className={`list-link relative block md:py-[13px] font-mono text-[12px] tabular-nums ${active ? 'text-lime font-bold' : 'text-moss font-medium'}`}
              >
                {m.date}
                <span className="sr-only"> {m.type}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
