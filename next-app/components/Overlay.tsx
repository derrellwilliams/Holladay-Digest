'use client';

import { motion, useReducedMotion, type TargetAndTransition, type Variants } from 'motion/react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

const IN_OUT = [0.77, 0, 0.175, 1] as const;

// Fill order for staggered content inside an overlay
export const riseItem: Variants = {
  hidden: { opacity: 0, y: 16 },
  shown: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.23, 1, 0.32, 1] } },
};

interface OverlayProps {
  label: string;
  // Box of the button that opened the overlay; null when opened from the keyboard (no animation)
  origin: DOMRect | null;
  onClose: () => void;
  children: React.ReactNode;
}

function insetFrom(rect: DOMRect) {
  const right = window.innerWidth - rect.right;
  const bottom = window.innerHeight - rect.bottom;
  return `inset(${rect.top}px ${right}px ${bottom}px ${rect.left}px round 6px)`;
}

// Mount inside <AnimatePresence> so the exit animation runs
export default function Overlay({ label, origin, onClose, children }: OverlayProps) {
  const reduce = useReducedMotion();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const page = document.getElementById('page');
    const trigger = document.activeElement as HTMLElement | null;
    if (page) page.inert = true;
    document.body.style.overflow = 'hidden';

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);

    return () => {
      if (page) page.inert = false;
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
      trigger?.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!mounted) return null;

  const full = 'inset(0px 0px 0px 0px round 0px)';
  const animated = origin !== null && !reduce;

  const initial = reduce ? { opacity: 0 } : animated ? { clipPath: insetFrom(origin) } : false;
  const exit: TargetAndTransition = reduce
    ? { opacity: 0, transition: { duration: 0.15 } }
    : animated
      ? { clipPath: insetFrom(origin), transition: { duration: 0.3, ease: IN_OUT } }
      : { opacity: 0, transition: { duration: 0 } };

  return createPortal(
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      className="fixed inset-0 z-50 bg-forest text-lime overflow-y-auto overscroll-contain"
      initial={initial}
      animate={{ clipPath: full, opacity: 1, transition: { duration: reduce ? 0.15 : 0.5, ease: IN_OUT } }}
      exit={exit}
    >
      <motion.div
        className="min-h-full"
        initial={animated ? 'hidden' : false}
        animate="shown"
        variants={{ shown: { transition: { staggerChildren: 0.04, delayChildren: 0.22 } } }}
      >
        <div className="flex justify-end px-5 py-4 md:px-10 md:py-8">
          <button
            onClick={onClose}
            aria-label="Close"
            className="press text-lime/70 hover:text-lime transition-colors p-2 -mr-2"
          >
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
              <path d="M5 5l14 14M19 5L5 19" />
            </svg>
          </button>
        </div>
        {children}
      </motion.div>
    </motion.div>,
    document.body,
  );
}
