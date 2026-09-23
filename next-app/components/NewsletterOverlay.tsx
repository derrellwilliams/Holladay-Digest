'use client';

import { AnimatePresence, motion, useAnimate, useReducedMotion } from 'motion/react';
import { useState } from 'react';
import Overlay, { riseItem } from './Overlay';

export default function NewsletterOverlay({ origin, onClose }: { origin: DOMRect | null; onClose: () => void }) {
  const reduce = useReducedMotion();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('Something went wrong. Please try again.');
  const [shakeScope, animate] = useAnimate<HTMLDivElement>();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');

    const res = await fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    if (res.ok) {
      setStatus('success');
    } else {
      const data = await res.json().catch(() => ({}));
      setErrorMessage(data.error || 'Something went wrong. Please try again.');
      setStatus('error');
      if (!reduce) animate(shakeScope.current, { x: [0, -6, 6, -6, 6, 0] }, { duration: 0.3, ease: 'easeOut' });
    }
  };

  return (
    <Overlay label="Newsletter signup" origin={origin} onClose={onClose}>
      <div className="px-5 md:px-10 pb-24">
        <motion.h2
          variants={riseItem}
          className="font-display font-bold uppercase text-lime text-[18vw] md:text-[11vw] leading-[0.85]"
        >
          Get the Digest
        </motion.h2>

        <motion.p variants={riseItem} className="font-mono text-base md:text-lg text-paper/80 mt-6 max-w-xl">
          Meeting notes delivered to your inbox the moment they&rsquo;re ready.
        </motion.p>

        <motion.div variants={riseItem} className="mt-10 max-w-2xl">
          <AnimatePresence mode="wait" initial={false}>
            {status === 'success' ? (
              <motion.div
                key="success"
                initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 8 }}
                animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0, transition: { type: 'spring', duration: 0.5, bounce: 0.2 } }}
              >
                <p className="font-display font-bold uppercase text-5xl md:text-7xl text-lime">You&rsquo;re in.</p>
                <p className="font-mono text-sm text-paper/70 mt-3">We&rsquo;ll email you when new minutes are posted.</p>
              </motion.div>
            ) : (
              <motion.form
                key="form"
                onSubmit={handleSubmit}
                noValidate
                exit={{ opacity: 0, transition: { duration: 0.12 } }}
              >
                <div ref={shakeScope} className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="email"
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    aria-label="Email address"
                    aria-invalid={status === 'error'}
                    className="flex-1 min-w-0 bg-transparent border-b-2 border-lime/30 focus:border-lime outline-none font-mono text-xl md:text-2xl text-lime placeholder:text-lime/30 py-3 transition-colors duration-200"
                  />
                  <button
                    type="submit"
                    disabled={status === 'loading'}
                    className="press shrink-0 px-10 py-4 rounded-md bg-lime text-forest font-mono text-sm font-bold uppercase tracking-wider disabled:opacity-60 transition-opacity"
                  >
                    {status === 'loading' ? 'Signing up…' : 'Sign up'}
                  </button>
                </div>
                {status === 'error' && (
                  <p role="alert" className="font-mono text-sm text-[#FF9E8F] mt-3">{errorMessage}</p>
                )}
              </motion.form>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </Overlay>
  );
}
