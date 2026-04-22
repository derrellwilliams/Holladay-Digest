import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getMeeting } from '@/lib/db';
import { getCanonicalType, getSubtype } from '@/lib/meetingColors';
import { formatDate } from '@/lib/utils';

function renderInline(text: string): string {
  return text.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1');
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

function trimToKeyTopics(text: string): string {
  const match = text.search(/^##?\s*\d*\.?\s*key topics discussed/im);
  return match !== -1 ? text.slice(match) : text;
}

function renderSummary(text: string) {
  const blocks = trimToKeyTopics(text).split(/\n{2,}/);
  return blocks.map((block, i) => {
    const lines = block.split('\n').filter(Boolean);
    if (!lines.length) return null;

    // Skip horizontal rules
    if (lines.length === 1 && /^---+$/.test(lines[0].trim())) {
      return null;
    }

    // Markdown table
    if (lines.some(l => l.includes('|'))) {
      return <div key={i} className="mt-6">{renderTable(lines)}</div>;
    }

    // Blockquote — render as plain italic note, no border
    if (lines.every(l => l.trim().startsWith('>'))) {
      return (
        <p key={i} className="italic text-gray-400 text-sm mt-6">
          {lines.map(l => l.replace(/^>\s*/, '')).join(' ')}
        </p>
      );
    }

    // Markdown heading: ## Title or ### Title
    if (/^#{1,6}\s/.test(lines[0])) {
      const title = lines[0].replace(/^#{1,6}\s+/, '').replace(/^\d+\.\s+/, '');
      return (
        <h3 key={i} className="text-base font-semibold text-gray-900 mt-8">
          {renderInline(title)}
        </h3>
      );
    }

    // Bold-only line used as a section heading (e.g. **Meeting Overview**)
    if (/^\*\*[^*]+\*\*:?$/.test(lines[0].trim())) {
      const title = lines[0].trim().replace(/^\*\*|\*\*:?$/g, '').replace(/^\d+\.\s+/, '');
      return (
        <h3 key={i} className="text-base font-semibold text-gray-900 mt-8">
          {title}
        </h3>
      );
    }

    // Numbered section heading like "1. Meeting Overview" (no sub-items)
    if (lines.length === 1 && /^\d+\.\s+[A-Z]/.test(lines[0])) {
      return (
        <h3 key={i} className="text-base font-semibold text-gray-900 mt-8">
          {renderInline(lines[0].replace(/^\d+\.\s+/, ''))}
        </h3>
      );
    }

    // Bullet list — top-level bullets with dot, indented lines as sub-bullets
    if (lines.every(l => /^[-*•]\s/.test(l.trim()) || /^\s+[-*•]\s/.test(l))) {
      return (
        <div key={i} className="mt-4 space-y-2">
          {lines.map((line, j) => {
            const isSub = /^\s+[-*•]\s/.test(line);
            return isSub ? (
              <div key={j} className="flex items-start gap-2 pl-8">
                <span className="shrink-0 mt-2 w-1 h-1 rounded-full bg-gray-400" />
                <p className="text-gray-600">{renderInline(line.replace(/^\s+[-*•]\s+/, ''))}</p>
              </div>
            ) : (
              <div key={j} className="flex items-start gap-2">
                <span className="shrink-0 mt-2 w-1.5 h-1.5 rounded-full bg-gray-500" />
                <p className="text-gray-700">{renderInline(line.replace(/^[-*•]\s+/, ''))}</p>
              </div>
            );
          })}
        </div>
      );
    }

    // Numbered list (multi-item) — render as bulleted list
    if (lines.length > 1 && lines.every(l => /^\d+\.\s/.test(l.trim()))) {
      return (
        <div key={i} className="mt-4 space-y-2">
          {lines.map((line, j) => (
            <div key={j} className="flex items-start gap-2">
              <span className="shrink-0 mt-2 w-1.5 h-1.5 rounded-full bg-gray-500" />
              <p className="text-gray-700">{renderInline(line.replace(/^\d+\.\s+/, ''))}</p>
            </div>
          ))}
        </div>
      );
    }

    // Mixed block: top-level bullet item + indented sub-bullets
    if (lines.length > 1 && lines.slice(1).some(l => /^\s+[-*•]\s/.test(l) || /^[-*•]\s/.test(l.trim()))) {
      return (
        <div key={i} className="mt-4 space-y-2">
          {lines.map((line, j) => {
            const isSub = /^\s+[-*•]\s/.test(line);
            const isTop = /^[-*•]\s/.test(line.trim());
            return isSub ? (
              <div key={j} className="flex items-start gap-2 pl-8">
                <span className="shrink-0 mt-2 w-1 h-1 rounded-full bg-gray-400" />
                <p className="text-gray-600">{renderInline(line.replace(/^\s+[-*•]\s+/, ''))}</p>
              </div>
            ) : isTop ? (
              <div key={j} className="flex items-start gap-2">
                <span className="shrink-0 mt-2 w-1.5 h-1.5 rounded-full bg-gray-500" />
                <p className="text-gray-700">{renderInline(line.replace(/^[-*•]\s+/, ''))}</p>
              </div>
            ) : (
              <p key={j} className="text-gray-700 font-medium">{renderInline(line)}</p>
            );
          })}
        </div>
      );
    }

    return (
      <p key={i} className="text-gray-700 leading-relaxed mt-4">
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
  const subtype = getSubtype(meeting.meeting_type, true);

  return (
    <div className="px-6 py-8 max-w-4xl mx-auto">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-granite hover:text-brand-700 font-medium mb-6"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to all meetings
      </Link>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <span className="inline-block px-3 py-1 rounded-full text-sm font-medium text-gunmetal" style={{ backgroundColor: '#EFEFEF' }}>
                {label}
              </span>
              {subtype && (
                <span className="inline-block px-3 py-1 rounded-full text-sm font-medium text-gunmetal" style={{ backgroundColor: '#EFEFEF' }}>
                  {subtype}
                </span>
              )}
            </div>
            <h1 className="text-5xl text-gray-900" style={{ fontFamily: 'var(--font-serif)' }}>
              {formatDate(meeting.meeting_date, true)}
            </h1>
          </div>
          {meeting.pdf_url && (
            <a
              href={meeting.pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-granite text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              View PDF
            </a>
          )}
        </div>

        <div className="text-sm sm:text-base">
          {renderSummary(meeting.summary)}
        </div>

        <div className="mt-8 pt-6 border-t border-gray-100 text-xs text-gray-400">
          Summarized: {new Date(meeting.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>
    </div>
  );
}
