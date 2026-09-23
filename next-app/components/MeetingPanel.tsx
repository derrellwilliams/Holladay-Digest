'use client';

import { AnimatePresence, motion, useReducedMotion, type PanInfo } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

const DRAWER = [0.32, 0.72, 0, 1] as const;

export default function MeetingPanel({ meetingId, children }: { meetingId: number | null; children: React.ReactNode }) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isTouch, setIsTouch] = useState(false);

  const close = () => router.push('/', { scroll: false });

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    setIsTouch(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setIsTouch(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (meetingId === null) return;
    scrollRef.current?.scrollTo({ top: 0 });
    const onKey = (e: KeyboardEvent) => {
      // Let an open search/newsletter overlay handle its own Escape
      if (e.key === 'Escape' && !document.querySelector('[aria-modal="true"]')) close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingId]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const width = window.innerWidth;
    // 0.11px/ms ≈ 110px/s
    if (info.offset.x > width * 0.4 || (info.velocity.x > 110 && info.offset.x > 24)) close();
  };

  return (
    <AnimatePresence>
      {meetingId !== null && (
        <motion.aside
          id="meeting-panel"
          aria-label="Meeting notes"
          className="fixed inset-0 md:left-[385px] z-30 bg-pine text-paper shadow-[-24px_0_48px_rgba(0,0,0,0.25)]"
          initial={reduce ? { opacity: 0 } : { x: '100%' }}
          animate={reduce ? { opacity: 1 } : { x: 0, transition: { duration: 0.45, ease: DRAWER } }}
          exit={reduce ? { opacity: 0 } : { x: '100%', transition: { duration: 0.28, ease: DRAWER } }}
          transition={{ duration: 0.15 }}
          drag={isTouch && !reduce ? 'x' : false}
          dragDirectionLock
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={{ left: 0, right: 1 }}
          onDragEnd={onDragEnd}
        >
          <div ref={scrollRef} className="h-full overflow-y-auto overscroll-contain">
            <div className="sticky top-0 z-10 flex justify-end px-5 py-4 md:px-8 md:py-6 bg-pine md:bg-transparent pointer-events-none">
              <button
                onClick={close}
                className="press pointer-events-auto font-mono text-xs font-bold uppercase tracking-wider text-lime/70 hover:text-lime transition-colors px-3 py-2 -mr-3"
              >
                Close ✕
              </button>
            </div>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={meetingId}
                initial={{ opacity: 0, filter: 'blur(2px)' }}
                animate={{ opacity: 1, filter: 'blur(0px)', transition: { duration: 0.18, ease: 'easeOut' } }}
                exit={{ opacity: 0, filter: 'blur(2px)', transition: { duration: 0.09, ease: 'easeOut' } }}
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
