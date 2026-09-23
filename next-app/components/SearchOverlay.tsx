'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { searchMeetings, type SearchResult } from '@/app/actions';
import Overlay, { riseItem } from './Overlay';

function highlight(text: string, term: string) {
  if (!term) return text;
  const parts = text.split(new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === term.toLowerCase()
      ? <mark key={i} className="bg-lime text-forest rounded-sm px-0.5">{part}</mark>
      : part
  );
}

export default function SearchOverlay({ origin, onClose }: { origin: DOMRect | null; onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [term, setTerm] = useState('');
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(0);

  const handleSearch = (value: string) => {
    setQuery(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      const request = ++latest.current;
      const found = await searchMeetings(value);
      // Ignore responses that arrive after a newer query
      if (request !== latest.current) return;
      setResults(value.trim().length < 2 ? null : found);
      setTerm(value.trim());
    }, 300);
  };

  useEffect(() => {
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, []);

  const openMeeting = (id: number) => {
    onClose();
    router.push(`/?m=${id}`, { scroll: false });
  };

  return (
    <Overlay label="Search meetings" origin={origin} onClose={onClose}>
      <div className="px-5 md:px-10 pb-24">
        <motion.div variants={riseItem}>
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="SEARCH"
            aria-label="Search meetings"
            className="w-full bg-transparent border-b-2 border-lime/30 focus:border-lime outline-none font-display font-bold uppercase text-lime placeholder:text-lime/25 text-[15vw] md:text-[10vw] leading-[0.9] pb-2 transition-colors duration-200"
          />
        </motion.div>

        <motion.p variants={riseItem} className="font-mono text-sm text-lime/60 mt-5" aria-live="polite">
          {results === null
            ? 'Try “ADU”, “budget”, or “parking”. Press Esc to close.'
            : `${results.length} ${results.length === 1 ? 'meeting' : 'meetings'} mention “${term}”`}
        </motion.p>

        <ul className="mt-8 max-w-4xl">
          <AnimatePresence initial={false}>
            {results?.map((r) => (
              <motion.li
                key={`${term}-${r.id}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { duration: 0.12 } }}
                exit={{ opacity: 0, transition: { duration: 0 } }}
              >
                <button
                  onClick={() => openMeeting(r.id)}
                  className="group w-full text-left py-5 border-t border-lime/15"
                >
                  <p className="font-mono text-base text-lime group-hover:text-paper transition-colors duration-150">
                    {r.date} {r.type}
                  </p>
                  {r.snippets.length > 0 ? (
                    <ul className="mt-2 space-y-1.5">
                      {r.snippets.map((s, i) => (
                        <li key={i} className="text-sm leading-relaxed text-paper/80">{highlight(s, term)}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm italic text-paper/40">Match found in full summary</p>
                  )}
                </button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </div>
    </Overlay>
  );
}
