'use client';

import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';

interface NavSection {
  key: string;
  title: string;
}

// Tracks which section is under the top of the meeting sheet's scroll area
function useActiveSection(sections: NavSection[]) {
  const ref = useRef<HTMLElement>(null);
  const [active, setActive] = useState(sections[0]?.key);
  const keys = sections.map((s) => s.key).join();

  useEffect(() => {
    const root = ref.current?.closest<HTMLElement>('[data-panel-scroll]');
    if (!root) return;
    const onScroll = () => {
      const line = root.getBoundingClientRect().top + 140;
      let current = sections[0]?.key;
      for (const s of sections) {
        const el = document.getElementById(s.key);
        if (el && el.getBoundingClientRect().top <= line) current = s.key;
      }
      // Short last sections can never reach the line — treat the bottom as the last one
      if (root.scrollTop + root.clientHeight >= root.scrollHeight - 4) current = sections[sections.length - 1]?.key;
      setActive(current);
    };
    onScroll();
    root.addEventListener('scroll', onScroll, { passive: true });
    return () => root.removeEventListener('scroll', onScroll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys]);

  const go = (key: string) => {
    document.getElementById(key)?.scrollIntoView({ block: 'start' });
    setActive(key);
  };

  return { ref, active, go };
}

// Desktop: sticky vertical table of contents with a sliding active bar
export function SectionNav({ sections }: { sections: NavSection[] }) {
  const reduce = useReducedMotion();
  const { ref, active, go } = useActiveSection(sections);

  return (
    <nav ref={ref} aria-label="Sections" className="hidden xl:block sticky top-24 self-start mt-10">
      <ul className="border-l border-lime/15">
        {sections.map((s) => (
          <li key={s.key}>
            <button
              onClick={() => go(s.key)}
              aria-current={active === s.key ? 'location' : undefined}
              className={`relative block w-full text-left pl-4 py-2 font-mono text-xs font-bold uppercase tracking-[0.14em] transition-colors duration-150 ${
                active === s.key ? 'text-lime' : 'text-lime/45 hover:text-lime/80'
              }`}
            >
              {active === s.key && (
                <motion.span
                  layoutId="section-nav-indicator"
                  className="absolute -left-px inset-y-1 w-0.5 bg-lime"
                  transition={{ duration: reduce ? 0 : 0.2, ease: [0.23, 1, 0.32, 1] }}
                />
              )}
              {s.title}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

// Mobile/tablet: a select that sticks into the sheet's top bar, beside the close button
export function SectionSelect({ sections }: { sections: NavSection[] }) {
  const { ref, active, go } = useActiveSection(sections);

  return (
    <div ref={ref as React.RefObject<HTMLDivElement>} className="xl:hidden sticky top-5 z-20 mt-6 w-[calc(100%-4.5rem)] max-w-xs">
      <select
        value={active}
        onChange={(e) => go(e.target.value)}
        aria-label="Jump to section"
        className="w-full appearance-none rounded-lg border border-lime/30 bg-pine py-2.5 pl-4 pr-10 font-mono text-xs font-bold uppercase tracking-[0.14em] text-lime focus:outline-none focus:border-lime"
      >
        {sections.map((s) => (
          <option key={s.key} value={s.key}>{s.title}</option>
        ))}
      </select>
      <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-lime" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M6 9l6 6 6-6" />
      </svg>
    </div>
  );
}
