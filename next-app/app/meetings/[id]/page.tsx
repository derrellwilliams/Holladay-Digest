import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getMeeting } from '@/lib/db';
import { getTypeColor, getCanonicalType, getSubtype } from '@/lib/meetingColors';

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Unknown date';
  if (/^[A-Za-z]/.test(dateStr)) return dateStr;
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('*') && part.endsWith('*')) return <em key={i}>{part.slice(1, -1)}</em>;
    return part;
  });
}

function renderTable(lines: string[]) {
  const rows = lines.filter(l => !l.match(/^\|[-| :]+\|$/));
  return (
    <div className="overflow-x-auto my-1">
      <table className="min-w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
        <tbody>
          {rows.map((row, i) => {
            const filtered = row.split('|').slice(1, -1).map(c => c.trim());
            return (
              <tr key={i} className={i === 0 ? 'bg-gray-50 font-semibold' : 'border-t border-gray-100'}>
                {filtered.map((cell, j) => (
                  <td key={j} className="px-4 py-2 text-gray-700">{renderInline(cell)}</td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function renderSummary(text: string) {
  const blocks = text.split(/\n{2,}/);
  return blocks.map((block, i) => {
    const lines = block.split('\n').filter(Boolean);
    if (!lines.length) return null;

    // Horizontal rule
    if (lines.length === 1 && /^---+$/.test(lines[0].trim())) {
      return <hr key={i} className="border-gray-200 my-2" />;
    }

    // Markdown table
    if (lines.some(l => l.includes('|'))) {
      return <div key={i}>{renderTable(lines)}</div>;
    }

    // Blockquote
    if (lines.every(l => l.trim().startsWith('>'))) {
      return (
        <blockquote key={i} className="border-l-4 border-gray-300 pl-4 italic text-gray-500 text-sm">
          {lines.map((l, j) => <p key={j}>{renderInline(l.replace(/^>\s*/, ''))}</p>)}
        </blockquote>
      );
    }

    // Markdown heading: ## Title or ### Title
    if (/^#{1,6}\s/.test(lines[0])) {
      return (
        <h3 key={i} className="text-base font-semibold text-gray-900 mt-5 mb-1">
          {renderInline(lines[0].replace(/^#{1,6}\s+/, ''))}
        </h3>
      );
    }

    // Bold-only line used as a section heading (e.g. **Meeting Overview**)
    if (/^\*\*[^*]+\*\*:?$/.test(lines[0].trim())) {
      return (
        <h3 key={i} className="text-base font-semibold text-gray-900 mt-5 mb-1">
          {lines[0].trim().replace(/^\*\*|\*\*:?$/g, '')}
        </h3>
      );
    }

    // Numbered section heading like "1. Meeting Overview" (no sub-items)
    if (lines.length === 1 && /^\d+\.\s+[A-Z]/.test(lines[0])) {
      return (
        <h3 key={i} className="text-base font-semibold text-gray-900 mt-5 mb-1">
          {renderInline(lines[0].replace(/^\d+\.\s+/, ''))}
        </h3>
      );
    }

    // Bullet list
    if (lines.every(l => /^[-*•]\s/.test(l.trim()))) {
      return (
        <ul key={i} className="list-disc pl-5 space-y-1 text-gray-700">
          {lines.map((line, j) => (
            <li key={j}>{renderInline(line.replace(/^[-*•]\s+/, ''))}</li>
          ))}
        </ul>
      );
    }

    // Numbered list (multi-item)
    if (lines.length > 1 && lines.every(l => /^\d+\.\s/.test(l.trim()))) {
      return (
        <ol key={i} className="list-decimal pl-5 space-y-1 text-gray-700">
          {lines.map((line, j) => (
            <li key={j}>{renderInline(line.replace(/^\d+\.\s+/, ''))}</li>
          ))}
        </ol>
      );
    }

    // Mixed block with bullets — split into heading + list
    if (lines.length > 1 && lines.slice(1).some(l => /^[-*•]\s/.test(l.trim()))) {
      return (
        <div key={i}>
          <p className="text-gray-700 font-medium">{renderInline(lines[0])}</p>
          <ul className="list-disc pl-5 space-y-1 text-gray-700 mt-1">
            {lines.slice(1).map((line, j) => (
              <li key={j}>{renderInline(line.replace(/^[-*•]\s+/, ''))}</li>
            ))}
          </ul>
        </div>
      );
    }

    return (
      <p key={i} className="text-gray-700 leading-relaxed">
        {renderInline(lines.join(' '))}
      </p>
    );
  });
}

export default async function MeetingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  if (isNaN(id)) notFound();

  const meeting = getMeeting(id);
  if (!meeting) notFound();

  const label = getCanonicalType(meeting.meeting_type);
  const subtype = getSubtype(meeting.meeting_type);

  return (
    <div className="px-6 py-8 max-w-4xl mx-auto">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-700 font-medium mb-6"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to all meetings
      </Link>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${getTypeColor(meeting.meeting_type)}`}>
                {label}
              </span>
              {subtype && (
                <span className="inline-block px-2.5 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-600">
                  {subtype}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-gray-900">
              {formatDate(meeting.meeting_date)}
            </h1>
          </div>
          {meeting.pdf_url && (
            <a
              href={meeting.pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              View PDF
            </a>
          )}
        </div>

        <hr className="border-gray-200 mb-6" />

        <div className="space-y-3 text-sm sm:text-base">
          {renderSummary(meeting.summary)}
        </div>

        <div className="mt-8 pt-6 border-t border-gray-100 text-xs text-gray-400">
          Summarized: {new Date(meeting.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>
    </div>
  );
}
