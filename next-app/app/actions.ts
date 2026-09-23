'use server';

import { getMeetings } from '@/lib/db';
import { getCanonicalType } from '@/lib/meetingColors';
import { formatDotDate } from '@/lib/utils';

export interface SearchResult {
  id: number;
  date: string;
  type: string;
  snippets: string[];
}

export async function searchMeetings(query: string): Promise<SearchResult[]> {
  const q = query.trim().slice(0, 100);
  if (q.length < 2) return [];

  return getMeetings(undefined, q).map((meeting) => ({
    id: meeting.id,
    date: formatDotDate(meeting.meeting_date),
    type: getCanonicalType(meeting.meeting_type),
    snippets: meeting.summary
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .split(/(?<=[.!?])\s+|\n/)
      .map(s => s.replace(/^[-*•#>\d.]+\s*/, '').trim())
      .filter(s => s.length > 20 && s.toLowerCase().includes(q.toLowerCase()))
      .slice(0, 3),
  }));
}
