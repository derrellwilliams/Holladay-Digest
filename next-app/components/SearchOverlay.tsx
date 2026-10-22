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
      ? <mark key={i} className="bg-lime/20 text-paper rounded-sm px-0.5">{part}</mark>
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
            className="w-full bg-transparent border-b-2 border-lime/30 focus:border-lime outline-none font-sans font-black uppercase text-lime placeholder:text-lime/25 text-[11vw] md:text-[6.5vw] leading-[0.9] pb-2 transition-colors duration-200"
          />
        </motion.div>

        <motion.p variants={riseItem} className="font-mono text-sm text-lime/60 mt-5" aria-live="polite">
          {results === null
            ? 'Try “ADU”, “budget”, or “parking”.'
            : `${results.length} ${results.length === 1 ? 'meeting' : 'meetings'} mention “${term}”`}
        </motion.p>

        <ul className="mt-8 max-w-4xl">
          <AnimatePresence initial={false}>
            {results?.map((r, i) => (
              <motion.li
                key={`${term}-${r.id}`}
                initial={{ opacity: 0 }}
                // Short stagger on the first few results; the rest appear with the last of them
                animate={{ opacity: 1, transition: { duration: 0.12, delay: Math.min(i, 8) * 0.03 } }}
                exit={{ opacity: 0, transition: { duration: 0 } }}
              >
                <button
                  onClick={() => openMeeting(r.id)}
                  className="group w-full text-left py-8 border-t border-paper/10"
                >
                  {/* Same type as a meeting card: mono date, Zalando title, square-bulleted lines */}
                  <p className="font-mono text-[12px] text-paper/70">{r.date}</p>
                  <h2 className="mt-3 font-sans text-2xl leading-tight text-paper group-hover:text-lime transition-colors duration-150">
                    {r.title}
                  </h2>
                  {r.snippets.length > 0 ? (
                    <ul className="mt-5 space-y-3 text-[15px] md:text-[16px] leading-relaxed">
                      {r.snippets.map((s, i) => (
                        <li key={i} className="flex gap-3">
                          <span aria-hidden="true" className="mt-[0.6em] h-1.5 w-1.5 shrink-0 bg-paper/30" />
                          <span className="min-w-0 text-paper/85">{highlight(s, term)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-5 text-[13px] italic text-paper/45">Match found in full summary</p>
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
