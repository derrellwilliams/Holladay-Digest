import Link from 'next/link';
import { Meeting } from '@/lib/db';
import { getCanonicalType } from '@/lib/meetingColors';
import { formatDate } from '@/lib/utils';

function getTopics(summary: string): string[] {
  const match = summary.match(/key topics discussed[^\n]*\n([\s\S]*?)(?=\n\d+\.\s|\n#{1,6}\s|\n\*\*\d+\.)/i);
  if (match) {
    const topics = match[1]
      .split('\n')
      .filter(l => /^[-*•]\s/.test(l.trim()))
      .map(l => l.replace(/^[-*•]\s*/, '').replace(/\*\*(.*?)\*\*/g, '$1').trim())
      .filter(Boolean)
      .slice(0, 5)
      .map(t => t.length > 100 ? t.slice(0, 97).trimEnd() + '…' : t);
    if (topics.length > 0) return topics;
  }

  return summary
    .split('\n')
    .map(l => l.replace(/^[-*•#>\d.]+\s*/, '').replace(/\*\*(.*?)\*\*/g, '$1').replace(/\|/g, '').trim())
    .filter(l => l.length > 20 && !/^(meeting type|date|time|location|presiding|field|structured summary)/i.test(l))
    .slice(0, 5)
    .map(t => t.length > 100 ? t.slice(0, 97).trimEnd() + '…' : t);
}

function highlight(text: string, term: string) {
  if (!term) return text;
  const parts = text.split(new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === term.toLowerCase()
      ? <mark key={i} className="bg-yellow-200 text-gray-900 rounded-sm px-0.5">{part}</mark>
      : part
  );
}

export default function MeetingCard({ meeting, search = '' }: { meeting: Meeting; search?: string }) {
  const allTopics = getTopics(meeting.summary);
  const label = getCanonicalType(meeting.meeting_type);

  const searchSnippets = search
    ? meeting.summary
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .split(/(?<=[.!?])\s+|\n/)
        .map(s => s.replace(/^[-*•#>\d.]+\s*/, '').trim())
        .filter(s => s.length > 20 && s.toLowerCase().includes(search.toLowerCase()))
        .slice(0, 3)
    : [];

  const topics = search
    ? allTopics.filter(t => t.toLowerCase().includes(search.toLowerCase()))
    : allTopics;

  return (
    <Link href={`/meetings/${meeting.id}`} className="block group">
      <article className="meeting-card bg-white rounded-2xl p-6 h-full flex flex-col gap-4 transition-all duration-200 group-hover:-translate-y-0.5">
        {/* Date + badge row */}
        <div className="flex items-center justify-between gap-4">
          <span
            className="text-3xl text-gray-900"
            style={{ fontFamily: 'var(--font-serif)' }}
          >
            {formatDate(meeting.meeting_date)}
          </span>
          <span className="inline-block shrink-0 px-3 py-1 rounded-full text-sm font-medium text-gunmetal" style={{ backgroundColor: '#EFEFEF' }}>
            {label}
          </span>
        </div>

        {/* Topics / Search snippets */}
        <div className="flex-1">
          {search ? (
            <ul className="space-y-2">
              {searchSnippets.map((snippet, i) => (
                <li key={i} className="text-sm text-gray-700 leading-snug">
                  {highlight(snippet, search)}
                </li>
              ))}
              {searchSnippets.length === 0 && (
                <p className="text-sm text-gray-400 italic">Match found in full summary</p>
              )}
            </ul>
          ) : (
            <>
              <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase mb-2">Key Topics</p>
              <ul className="space-y-1.5">
                {topics.map((topic, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="mt-1.5 w-1 h-1 rounded-full bg-gray-400 shrink-0" />
                    {topic.replace(/^[-–—]\s*/, '')}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </article>
    </Link>
  );
}
