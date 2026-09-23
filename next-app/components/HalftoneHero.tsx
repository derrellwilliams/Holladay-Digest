'use client';

import dynamic from 'next/dynamic';
import { AnimatePresence } from 'motion/react';
import { useEffect, useState } from 'react';
import SearchOverlay from './SearchOverlay';
import NewsletterOverlay from './NewsletterOverlay';
import type { ButtonSpot } from '@/lib/utils';

const HalftoneDots = dynamic(() => import('@paper-design/shaders-react').then((m) => m.HalftoneDots), { ssr: false });

type OverlayState = { kind: 'search' | 'newsletter'; origin: DOMRect | null } | null;

const BUTTON = 'press absolute z-10 h-[42px] rounded-md bg-forest text-lime font-mono text-sm md:text-base font-bold uppercase tracking-wide shadow-[0_2px_0_rgba(0,0,0,0.25)] hover:bg-pine';

export default function HalftoneHero({ spots }: { spots: [ButtonSpot, ButtonSpot] }) {
  const [overlay, setOverlay] = useState<OverlayState>(null);
  // Keep the first positions so the buttons don't move when a meeting opens (page re-renders)
  const [[newsletterSpot, searchSpot]] = useState(spots);

  const openFrom = (kind: 'search' | 'newsletter') => (e: React.MouseEvent<HTMLButtonElement>) =>
    // Keyboard "clicks" (Enter/Space) report detail 0 — open instantly for those
    setOverlay({ kind, origin: e.detail === 0 ? null : e.currentTarget.getBoundingClientRect() });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && e.target.closest('input, textarea, [contenteditable]');
      if (((e.metaKey || e.ctrlKey) && e.key === 'k') || (e.key === '/' && !typing)) {
        e.preventDefault();
        setOverlay((current) => current ?? { kind: 'search', origin: null });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const close = () => setOverlay(null);

  return (
    <section className="hero relative w-full aspect-[4/3] md:aspect-auto md:h-full md:min-h-[300px] bg-mint overflow-hidden">
      <div className="intro-fade absolute inset-0">
        <HalftoneDots
          image="/holladay.jpg"
          colorBack="#aeff9e"
          colorFront="#2b2b2b"
          originalColors={false}
          type="gooey"
          grid="hex"
          inverted={false}
          size={0.17}
          radius={1.07}
          contrast={0.39}
          grainMixer={0.03}
          grainOverlay={0.08}
          grainSize={0.18}
          scale={1}
          fit="cover"
          style={{ width: '100%', height: '100%' }}
          aria-label="Halftone photo of downtown Holladay, Utah"
          role="img"
        />
      </div>

      <button
        onClick={openFrom('newsletter')}
        className={`${BUTTON} w-[min(222px,40%)]`}
        style={{ left: `${newsletterSpot.left}%`, top: `${newsletterSpot.top}%` }}
      >
        Newsletter
      </button>
      <button
        onClick={openFrom('search')}
        aria-keyshortcuts="Meta+K /"
        className={`${BUTTON} w-[min(204px,40%)]`}
        style={{ left: `${searchSpot.left}%`, top: `${searchSpot.top}%` }}
      >
        Search
      </button>

      <AnimatePresence>
        {overlay?.kind === 'search' && <SearchOverlay key="search" origin={overlay.origin} onClose={close} />}
        {overlay?.kind === 'newsletter' && <NewsletterOverlay key="newsletter" origin={overlay.origin} onClose={close} />}
      </AnimatePresence>
    </section>
  );
}
