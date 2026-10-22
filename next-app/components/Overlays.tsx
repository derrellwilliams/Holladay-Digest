'use client';

import { AnimatePresence } from 'motion/react';
import { createContext, useContext, useEffect, useState } from 'react';
import SearchOverlay from './SearchOverlay';
import NewsletterOverlay from './NewsletterOverlay';
import AboutOverlay from './AboutOverlay';

type Kind = 'search' | 'newsletter' | 'about';
type OverlayState = { kind: Kind; origin: DOMRect | null } | null;

const OpenContext = createContext<(kind: Kind) => (e: React.MouseEvent<HTMLElement>) => void>(() => () => {});

// The hero's title and its icon buttons open full-screen overlays, so the state lives here
export function OverlayProvider({ children }: { children: React.ReactNode }) {
  const [overlay, setOverlay] = useState<OverlayState>(null);

  const openFrom = (kind: Kind) => (e: React.MouseEvent<HTMLElement>) =>
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
    <OpenContext.Provider value={openFrom}>
      {children}
      <AnimatePresence>
        {overlay?.kind === 'search' && <SearchOverlay key="search" origin={overlay.origin} onClose={close} />}
        {overlay?.kind === 'newsletter' && <NewsletterOverlay key="newsletter" origin={overlay.origin} onClose={close} />}
        {overlay?.kind === 'about' && <AboutOverlay key="about" origin={overlay.origin} onClose={close} />}
      </AnimatePresence>
    </OpenContext.Provider>
  );
}

export const useOpenOverlay = () => useContext(OpenContext);
