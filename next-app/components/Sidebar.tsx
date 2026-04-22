'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import { getCanonicalType } from '@/lib/meetingColors';

interface SidebarProps {
  types: string[];
  years: string[];
  months: string[];
  selectedType: string;
  selectedYear: string;
  selectedMonth: string;
  searchValue: string;
}

export default function Sidebar({ types, years, months, selectedType, selectedYear, selectedMonth, searchValue }: SidebarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const updateParam = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      router.push(`/?${params.toString()}`);
    },
    [router, searchParams]
  );

  const handleSearch = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set('search', value);
      } else {
        params.delete('search');
      }
      router.push(`/?${params.toString()}`);
    },
    [router, searchParams]
  );

  const toggleType = useCallback(
    (type: string) => {
      const current = searchParams.get('type');
      updateParam('type', current === type ? null : type);
    },
    [searchParams, updateParam]
  );

  const MONTH_NAMES: Record<string, string> = {
    Jan: 'January', Feb: 'February', Mar: 'March', Apr: 'April',
    May: 'May', Jun: 'June', Jul: 'July', Aug: 'August',
    Sep: 'September', Oct: 'October', Nov: 'November', Dec: 'December',
  };

  return (
    <aside className="w-full sm:w-56 shrink-0 flex flex-row items-center gap-3 sm:flex-col sm:items-stretch sm:sticky sm:top-8 sm:self-start">
      {/* Logo lockup — shrink-0 on mobile so it never stretches */}
      <div className="shrink-0 sm:shrink" style={{ backgroundColor: '#475841', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px' }}>
        <img src="/logo.png" alt="" style={{ height: '28px', width: '28px', objectFit: 'contain' }} />
        <span style={{ fontFamily: 'var(--font-serif)', fontSize: '28px', color: 'white', whiteSpace: 'nowrap', lineHeight: 1 }}>Holladay Digest</span>
      </div>

      {/* Search — fills remaining space on mobile, full-width on desktop */}
      <div className="relative flex-1 sm:flex-none">
        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          type="search"
          defaultValue={searchValue}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search"
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-granite focus:border-transparent bg-white"
        />
      </div>

      {/* Meeting Type — hidden on mobile */}
      <div className="hidden sm:block" style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '12px 14px' }}>
        <ul className="space-y-2">
          <li>
            <button
              onClick={() => updateParam('type', null)}
              className={`w-full text-left text-sm transition-colors ${
                !selectedType ? 'font-bold text-granite' : 'font-normal text-granite/60 hover:text-granite'
              }`}
            >
              All Meetings
            </button>
          </li>
          {types.map((type) => (
            <li key={type}>
              <button
                onClick={() => toggleType(type)}
                className={`w-full text-left text-sm transition-colors ${
                  selectedType === type ? 'font-bold text-granite' : 'font-normal text-granite/60 hover:text-granite'
                }`}
              >
                {getCanonicalType(type)}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Year — hidden on mobile */}
      <div className="hidden sm:block" style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '12px 14px' }}>
        <select
          value={selectedYear}
          onChange={(e) => updateParam('year', e.target.value || null)}
          className="w-full bg-transparent text-sm font-bold text-granite focus:outline-none cursor-pointer appearance-none"
          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23475841' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0px center' }}
        >
          <option value="">All Years</option>
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {/* Month — hidden on mobile */}
      <div className="hidden sm:block" style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '12px 14px' }}>
        <select
          value={selectedMonth}
          onChange={(e) => updateParam('month', e.target.value || null)}
          className="w-full bg-transparent text-sm font-bold text-granite focus:outline-none cursor-pointer appearance-none"
          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23475841' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0px center' }}
        >
          <option value="">All Months</option>
          {months.map((m) => (
            <option key={m} value={m}>{MONTH_NAMES[m] ?? m}</option>
          ))}
        </select>
      </div>
    </aside>
  );
}
