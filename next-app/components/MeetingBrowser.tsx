'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Meeting } from '@/lib/db';
import MeetingList, { type MeetingListItem } from './MeetingList';
import MeetingSummary from './MeetingSummary';
import AboutText from './AboutText';

const JUMP_MS = 400;
// Space between meeting cards on desktop (md:mb-6)
const CARD_GAP = 24;
// Meetings this close to the viewport get rendered
const RENDER_AHEAD = 1500;
const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4);
// Rough height for a meeting that hasn't rendered yet, so the feed's length is about right
const estimateHeight = (m: Meeting) => 300 + m.summary.length * 0.33;

// Date nav + every meeting stacked in one feed. Scrolling past a meeting runs into the next one;
// the nav follows whatever is under the top of the feed, and clicking a date scrolls there quickly.
// Only the opening meeting is server-rendered; the rest render from their text as they come near.
export default function MeetingBrowser({
  items,
  meetings,
  initialId,
}: {
  items: MeetingListItem[];
  meetings: Meeting[];
  initialId: number | null;
}) {
  const feedRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const openId = initialId ?? items[0]?.id ?? null;
  // null while the welcome text is in view
  const [activeId, setActiveId] = useState(initialId);
  const activeRef = useRef(initialId);
  const [rendered, setRendered] = useState(() => new Set(openId === null ? [] : [openId]));
  // Scroll handlers are bound once, so they read the set through a ref
  const renderedRef = useRef(rendered);
  // While a date click is scrolling, skip tracking and rendering the meetings it flies past
  const jumping = useRef(false);
  // The meeting at the top of the feed before new meetings render, so it can be held in place
  const anchor = useRef<{ el: HTMLElement; top: number } | null>(null);

  // The page scrolls; the hero and dates are pinned beside the feed on desktop, where meetings land
  // one card-gap below the top. On mobile the dates are a strip pinned over the top of the feed, so content lands below it.
  const scroller = () => document.scrollingElement!;
  const pinnedTop = () => (window.matchMedia('(min-width: 768px)').matches ? CARD_GAP : stripRef.current!.offsetHeight);

  const offsetOf = (el: HTMLElement) => el.getBoundingClientRect().top + window.scrollY - pinnedTop();

  const select = (id: number | null) => {
    if (id === activeRef.current) return;
    activeRef.current = id;
    setActiveId(id);
    window.history.replaceState(null, '', id === null ? '/' : `/?m=${id}`);
  };

  const render = (ids: number[]) => {
    if (ids.every((id) => renderedRef.current.has(id))) return;
    const sc = scroller();
    const top = pinnedTop();
    const el = [...feedRef.current!.children].find((c) => c.getBoundingClientRect().bottom > top + 1) as HTMLElement | undefined;
    anchor.current = el ? { el, top: el.getBoundingClientRect().top } : null;
    renderedRef.current = new Set([...renderedRef.current, ...ids]);
    setRendered(renderedRef.current);
  };

  // Meetings rendering above the reader change height; shift the scroll so what they're reading stays put
  useLayoutEffect(() => {
    const a = anchor.current;
    anchor.current = null;
    if (!a) return;
    const delta = a.el.getBoundingClientRect().top - a.top;
    if (delta) scroller().scrollTop += delta;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rendered]);

  // Highlight the meeting under the top of the feed and render the ones coming into view
  const update = () => {
    if (jumping.current) return;
    const sc = scroller();
    const top = pinnedTop();
    const bottom = top + sc.clientHeight;
    let current: number | null = null;
    const near: number[] = [];
    for (const m of items) {
      const box = document.getElementById(`meeting-${m.id}`)?.getBoundingClientRect();
      if (!box) continue;
      if (box.top <= top + 120) current = m.id;
      if (box.bottom > top - RENDER_AHEAD && box.top < bottom + RENDER_AHEAD) near.push(m.id);
    }
    // The last meeting may be too short to ever reach the line
    if (sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 4) current = items[items.length - 1]?.id ?? null;
    select(current);
    render(near);
  };

  useEffect(() => {
    // Opened from a link to a specific meeting
    const el = initialId !== null && document.getElementById(`meeting-${initialId}`);
    if (el) scroller().scrollTop = offsetOf(el);
    update();

    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const jumpTo = (id: number) => {
    const el = document.getElementById(`meeting-${id}`);
    if (!el) return;
    select(id);
    render([id]);
    jumping.current = true;
    // Wait a frame so the target has rendered and has its real height
    requestAnimationFrame(() => {
      const sc = scroller();
      const start = sc.scrollTop;
      const t0 = performance.now();
      const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : JUMP_MS;
      const step = (now: number) => {
        const t = duration ? Math.min(1, (now - t0) / duration) : 1;
        // Re-measure every frame in case anything above changes height
        sc.scrollTop = start + (offsetOf(el) - start) * easeOutQuart(t);
        if (t < 1) return requestAnimationFrame(step);
        jumping.current = false;
        update();
        // Brief lime flash on the card's date so it's clear where the jump landed
        el.querySelector('.meeting-date')?.animate(
          [{ color: '#8FFF7A' }, { color: '#8FFF7A', offset: 0.3 }, {}],
          { duration: 900, easing: 'ease' },
        );
      };
      requestAnimationFrame(step);
    });
  };

  return (
    <>
      {/* Pinned to the top on mobile as a horizontal strip */}
      <div ref={stripRef} className="sticky top-0 z-30 bg-forest md:z-auto md:self-start md:h-dvh shrink-0">
        <MeetingList meetings={items} activeId={activeId} onSelect={jumpTo} />
      </div>
      <div
        ref={feedRef}
        role="region"
        aria-label="Meeting notes"
        className="flex-1 md:flex-none md:w-[42%] min-w-0 md:pr-12 text-paper [overflow-anchor:none]"
      >
        {/* Fills the column minus a peek of the first meeting; text sits at the top, level with the first date */}
        <section aria-label="About Holladay Digest" className="intro-copy px-5 md:px-0 py-12 md:pt-[52px] md:pb-0 md:min-h-[calc(100dvh-240px)]">
          <AboutText className="max-w-2xl" />
        </section>
        {meetings.map((m, i) => (
          <section
            key={m.id}
            id={`meeting-${m.id}`}
            className={`meeting ${i === 0 ? 'intro-card ' : ''}bg-pine mb-3 md:mb-6 pt-8 md:pt-11`}
            style={rendered.has(m.id) ? undefined : { height: estimateHeight(m) }}
          >
            {rendered.has(m.id) && <MeetingSummary meeting={m} />}
          </section>
        ))}
      </div>
    </>
  );
}
