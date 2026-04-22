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
}

export default function Sidebar({ types, years, months, selectedType, selectedYear, selectedMonth }: SidebarProps) {
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

  const toggleType = useCallback(
    (type: string) => {
      const current = searchParams.get('type');
      updateParam('type', current === type ? null : type);
    },
    [searchParams, updateParam]
  );

  return (
    <aside className="w-56 shrink-0 space-y-4">
      {/* Meeting Type */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Meeting Type</h2>
        {types.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No types yet</p>
        ) : (
          <ul className="space-y-1">
            <li>
              <button
                onClick={() => updateParam('type', null)}
                className={`w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  !selectedType
                    ? 'bg-brand-600 text-white font-medium'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                All Meetings
              </button>
            </li>
            {types.map((type) => (
              <li key={type}>
                <button
                  onClick={() => toggleType(type)}
                  className={`w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    selectedType === type
                      ? 'bg-brand-600 text-white font-medium'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {getCanonicalType(type)}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Year */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Year</h2>
        <select
          value={selectedYear}
          onChange={(e) => updateParam('year', e.target.value || null)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600 bg-white"
        >
          <option value="">All years</option>
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {/* Month */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Month</h2>
        <select
          value={selectedMonth}
          onChange={(e) => updateParam('month', e.target.value || null)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600 bg-white"
        >
          <option value="">All months</option>
          {months.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>
    </aside>
  );
}
