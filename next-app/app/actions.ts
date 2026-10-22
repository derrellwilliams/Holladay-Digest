'use server';

import { getMeetings } from '@/lib/db';
import { getCanonicalType, getSubtype } from '@/lib/meetingColors';
import { formatPlainDate } from '@/lib/utils';
import { meetingTitle } from '@/components/MeetingSummary';

export interface SearchResult {
  id: number;
  date: string;
  title: string;
  snippets: string[];
}

export async function searchMeetings(query: string): Promise<SearchResult[]> {
  const q = query.trim().slice(0, 100);
  if (q.length < 2) return [];

  return getMeetings(undefined, q).map((meeting) => ({
    id: meeting.id,
    date: formatPlainDate(meeting.meeting_date),
    title: meetingTitle(getCanonicalType(meeting.meeting_type), getSubtype(meeting.meeting_type, true)),
    snippets: meeting.summary
      .replace(/⚠\uFE0F?\s*/g, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .split(/(?<=[.!?])\s+|\n/)
      .map(s => s.trim().replace(/^[-*•#>\d.]+\s*/, '').trim())
      .filter(s => s.length > 20 && s.toLowerCase().includes(q.toLowerCase()))
      .slice(0, 3),
  }));
}
