import { Meeting } from '@/lib/db';
import { getCanonicalType, getSubtype } from '@/lib/meetingColors';
import { formatLongDate } from '@/lib/utils';

function renderInline(text: string): string {
  return text.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1');
}

function renderTable(lines: string[]) {
  const rows = lines.filter(l => !l.match(/^\|[-| :]+\|$/));
  return (
    <div className="overflow-x-auto my-1">
      <table className="min-w-full text-sm border border-lime/20">
        <tbody>
          {rows.map((row, i) => {
            const filtered = row.split('|').slice(1, -1).map(c => c.trim());
            return (
              <tr key={i} className={i === 0 ? 'font-mono text-xs uppercase tracking-wider text-lime' : 'border-t border-lime/10'}>
                {filtered.map((cell, j) => (
                  <td key={j} className="px-4 py-2.5 leading-snug">{renderInline(cell)}</td>
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

const HEADING = 'font-display font-bold text-xl text-paper mt-10 mb-1';
const SUB_ITEM = 'pl-6 text-paper/70';

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
        <p key={i} className="italic text-paper/50 text-sm mt-6">
          {lines.map(l => l.replace(/^>\s*/, '')).join(' ')}
        </p>
      );
    }

    // Markdown heading: ## Title or ### Title
    if (/^#{1,6}\s/.test(lines[0])) {
      const title = lines[0].replace(/^#{1,6}\s+/, '').replace(/^\d+\.\s+/, '');
      return (
        <h3 key={i} className={HEADING}>
          {renderInline(title)}
        </h3>
      );
    }

    // Bold-only line used as a section heading (e.g. **Meeting Overview**)
    if (/^\*\*[^*]+\*\*:?$/.test(lines[0].trim())) {
      const title = lines[0].trim().replace(/^\*\*|\*\*:?$/g, '').replace(/^\d+\.\s+/, '');
      return (
        <h3 key={i} className={HEADING}>
          {title}
        </h3>
      );
    }

    // Numbered section heading like "1. Meeting Overview" (no sub-items)
    if (lines.length === 1 && /^\d+\.\s+[A-Z]/.test(lines[0])) {
      return (
        <h3 key={i} className={HEADING}>
          {renderInline(lines[0].replace(/^\d+\.\s+/, ''))}
        </h3>
      );
    }

    // Bullet list — top-level bullets as plain lines, indented lines as sub-items
    if (lines.every(l => /^[-*•]\s/.test(l.trim()) || /^\s+[-*•]\s/.test(l))) {
      return (
        <div key={i}>
          {lines.map((line, j) => {
            const isSub = /^\s+[-*•]\s/.test(line);
            return isSub ? (
              <p key={j} className={SUB_ITEM}>{renderInline(line.replace(/^\s+[-*•]\s+/, ''))}</p>
            ) : (
              <p key={j}>{renderInline(line.replace(/^[-*•]\s+/, ''))}</p>
            );
          })}
        </div>
      );
    }

    // Numbered list (multi-item)
    if (lines.length > 1 && lines.every(l => /^\d+\.\s/.test(l.trim()))) {
      return (
        <div key={i}>
          {lines.map((line, j) => (
            <p key={j}>{renderInline(line.replace(/^\d+\.\s+/, ''))}</p>
          ))}
        </div>
      );
    }

    // Mixed block: top-level bullet item + indented sub-bullets
    if (lines.length > 1 && lines.slice(1).some(l => /^\s+[-*•]\s/.test(l) || /^[-*•]\s/.test(l.trim()))) {
      return (
        <div key={i}>
          {lines.map((line, j) => {
            const isSub = /^\s+[-*•]\s/.test(line);
            const isTop = /^[-*•]\s/.test(line.trim());
            return isSub ? (
              <p key={j} className={SUB_ITEM}>{renderInline(line.replace(/^\s+[-*•]\s+/, ''))}</p>
            ) : isTop ? (
              <p key={j}>{renderInline(line.replace(/^[-*•]\s+/, ''))}</p>
            ) : (
              <p key={j} className="font-display font-bold text-paper mt-4">{renderInline(line)}</p>
            );
          })}
        </div>
      );
    }

    return (
      <p key={i} className="mt-4">
        {renderInline(lines.join(' '))}
      </p>
    );
  });
}

export default function MeetingSummary({ meeting }: { meeting: Meeting }) {
  const label = getCanonicalType(meeting.meeting_type);
  const subtype = getSubtype(meeting.meeting_type, true);

  return (
    <article className="px-8 md:px-12 lg:px-[120px] pb-24 md:-mt-2 max-w-[1120px]">
      <header className="flex items-start justify-between gap-6 flex-wrap">
        <div>
          <p className="font-mono text-sm text-paper">{formatLongDate(meeting.meeting_date)}</p>
          <h2 className="font-display text-3xl md:text-[34px] leading-tight text-paper mt-1">
            {label}{subtype && ` · ${subtype}`}
          </h2>
        </div>
        {meeting.pdf_url && (
          <a
            href={meeting.pdf_url}
            target="_blank"
            rel="noopener noreferrer"
            className="press inline-flex items-center justify-center px-12 py-3 rounded-lg border border-lime font-mono text-sm font-bold uppercase tracking-wider text-lime transition-colors duration-150 hover:bg-lime hover:text-forest"
          >
            View PDF
          </a>
        )}
      </header>

      <div className="mt-6 text-[15px] md:text-[16px] leading-[1.85] md:leading-[2.25] text-paper/90">
        {renderSummary(meeting.summary)}
      </div>

      <p className="mt-12 pt-6 border-t border-lime/10 font-mono text-xs text-paper/40">
        Summarized {new Date(meeting.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
      </p>
    </article>
  );
}
