import Link from 'next/link';
import { Meeting } from '@/lib/db';
import { getCanonicalType } from '@/lib/meetingColors';

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Unknown date';
  if (/^[A-Za-z]/.test(dateStr)) return dateStr;
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' });
}

function getTopics(summary: string): string[] {
  // Extract top-level bullets from "Key Topics Discussed" section
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

  // Fallback: grab first 5 non-empty, non-header lines
  return summary
    .split('\n')
    .map(l => l.replace(/^[-*•#>\d.]+\s*/, '').replace(/\*\*(.*?)\*\*/g, '$1').replace(/\|/g, '').trim())
    .filter(l => l.length > 20 && !/^(meeting type|date|time|location|presiding|field|structured summary)/i.test(l))
    .slice(0, 5)
    .map(t => t.length > 100 ? t.slice(0, 97).trimEnd() + '…' : t);
}

export default function MeetingCard({ meeting }: { meeting: Meeting }) {
  const topics = getTopics(meeting.summary);
  const label = getCanonicalType(meeting.meeting_type);

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

        {/* Topics */}
        <div className="flex-1">
          <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase mb-2">Key Topics</p>
          <ul className="space-y-1.5">
            {topics.map((topic, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="mt-1.5 w-1 h-1 rounded-full bg-gray-400 shrink-0" />
                {topic.replace(/^[-–—]\s*/, '')}
              </li>
            ))}
          </ul>
        </div>
      </article>
    </Link>
  );
}
