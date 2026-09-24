import { Fragment } from 'react';
import { Meeting } from '@/lib/db';
import { getCanonicalType, getSubtype } from '@/lib/meetingColors';
import { formatLongDate } from '@/lib/utils';
import { SectionNav, SectionSelect } from './SectionNav';

// ── Parsing ────────────────────────────────────────────────────────────────────
// AI summaries follow the same six sections (plus "In Brief" on newer ones):
// Meeting Overview, Key Topics, Decisions, Votes, Action Items, Other Notable Items.

type SectionKey = 'brief' | 'overview' | 'topics' | 'decisions' | 'votes' | 'actions' | 'notes' | 'body';

interface Item {
  label?: string;
  body: string;
  children: Item[];
}

type Block =
  | { kind: 'list'; items: Item[] }
  | { kind: 'para'; text: string }
  | { kind: 'note'; text: string }
  | { kind: 'sub'; text: string }
  | { kind: 'table'; header: string[]; rows: string[][] };

interface Section {
  key: SectionKey;
  blocks: Block[];
}

const SECTIONS: [SectionKey, RegExp, string][] = [
  ['brief', /^in brief$/i, 'In Brief'],
  ['overview', /^(meeting )?overview$/i, 'Overview'],
  ['topics', /^key topics( discussed)?$/i, 'Topics'],
  ['decisions', /^decisions( made)?$/i, 'Decisions'],
  ['votes', /^votes?( taken)?$/i, 'Votes'],
  ['actions', /^action items$/i, 'Actions'],
  ['notes', /^(other )?notable items$/i, 'Notes'],
];
const TITLES = Object.fromEntries(SECTIONS.map(([key, , title]) => [key, title])) as Record<SectionKey, string>;

const BULLET = /^(\s*)(?:[-*•]|\d+\.)\s+(.*)$/;

function cleanTitle(text: string) {
  return text.replace(/\*\*/g, '').replace(/^\d+\.\s*/, '').replace(/:$/, '').trim();
}

function sectionKey(title: string): SectionKey | null {
  return SECTIONS.find(([, re]) => re.test(title))?.[0] ?? null;
}

function parseItem(text: string): Item {
  const m = text.match(/^\*\*(.+?)\*\*\s*[:—–-]?\s*(.*)$/);
  if (m && m[1].length < 120) return { label: m[1].replace(/:$/, '').trim(), body: m[2], children: [] };
  return { body: text, children: [] };
}

function cells(line: string) {
  return line.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
}

function parseSummary(text: string, startInBody = false): Section[] {
  const sections: Section[] = [];
  let current: Section | null = startInBody ? { key: 'body', blocks: [] } : null;
  if (current) sections.push(current);
  const push = (block: Block) => current?.blocks.push(block);
  const lines = text.split('\n');

  let i = 0;
  while (i < lines.length) {
    const t = lines[i].trim();
    if (!t || /^(-{3,}|\*{3,})$/.test(t)) { i++; continue; }

    // Headings: "## 2. Key Topics", "**Votes**", or a bare "3. Decisions Made"
    const heading = t.match(/^#{1,6}\s+(.*)$/) ?? t.match(/^\*\*([^*]+)\*\*:?$/) ?? (/^\d+\.\s+/.test(t) && sectionKey(cleanTitle(t)) ? [t, t] : null);
    if (heading) {
      const title = cleanTitle(heading[1]);
      const key = sectionKey(title);
      if (key) {
        current = { key, blocks: [] };
        sections.push(current);
      } else {
        push({ kind: 'sub', text: title });
      }
      i++;
      continue;
    }

    if (t.startsWith('|')) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        if (!/^\|[\s:|-]+\|$/.test(lines[i].trim())) rows.push(cells(lines[i]));
        i++;
      }
      const [first, ...rest] = rows;
      const hasHeader = first && first.every((c) => c && !c.startsWith('**'));
      push({ kind: 'table', header: hasHeader ? first : [], rows: hasHeader ? rest : rows });
      continue;
    }

    if (t.startsWith('>')) {
      push({ kind: 'note', text: t.replace(/^>\s*/, '') });
      i++;
      continue;
    }

    if (BULLET.test(lines[i])) {
      const items: Item[] = [];
      let m: RegExpMatchArray | null;
      while (i < lines.length && (m = lines[i].match(BULLET))) {
        const item = parseItem(m[2].trim());
        const parent = items[items.length - 1];
        if (m[1].length > 0 && parent) parent.children.push(item);
        else items.push(item);
        i++;
      }
      push({ kind: 'list', items });
      continue;
    }

    push({ kind: 'para', text: t });
    i++;
  }

  // Older summaries without recognizable section headings render as one body
  return sections.length || startInBody ? sections : parseSummary(text, true);
}

function flatText(blocks: Block[]): string {
  return blocks
    .map((b) => (b.kind === 'list' ? b.items.map((it) => [it.label, it.body].filter(Boolean).join(' ')).join(' ') : b.kind === 'table' ? '' : b.text))
    .join(' ')
    .replace(/\*+/g, '')
    .trim();
}

// "No votes were recorded…" style sections collapse to a single dim line
function isEmptySection(section: Section) {
  const simple = section.blocks.every((b) => b.kind === 'para' || b.kind === 'note' || (b.kind === 'list' && b.items.length <= 1 && !b.items[0]?.children.length));
  const text = flatText(section.blocks);
  return simple && text.length < 500 && /\b(no|none)\b[^.]*\b(recorded|taken|adopted|made|assigned|identified|noted|captured|occurred)\b|\bnot (recorded|captured|documented)\b|\bdoes not (record|include|capture|contain)\b/i.test(text);
}

// ── Inline markdown ───────────────────────────────────────────────────────────
function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith('**') && part.endsWith('**') ? (
          <strong key={i} className="font-medium text-paper">{part.slice(2, -2)}</strong>
        ) : part.startsWith('*') && part.endsWith('*') && part.length > 2 ? (
          <em key={i}>{part.slice(1, -1)}</em>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        )
      )}
    </>
  );
}

// ── Overview → caveats only ───────────────────────────────────────────────────
// Time, attendees, quorum etc. aren't shown; keep free-text caveats like date discrepancies
const LOGISTICS = /\b(quorum|attend\w*|present|absent|presiding|time|location|called to order)\b/i;

function OverviewNotes({ section }: { section: Section | undefined }) {
  // Only quoted caveats (e.g. date discrepancies) — never quorum, attendance, time or location
  const notes = (section?.blocks ?? []).flatMap((b) => (b.kind === 'note' && !LOGISTICS.test(b.text) ? [b.text] : []));
  if (!notes.length) return null;

  return (
    <div className="mt-4 max-w-3xl space-y-2">
      {notes.map((n, i) => (
        <p key={i} className="italic text-paper/45 text-[13px] leading-relaxed"><Inline text={n} /></p>
      ))}
    </div>
  );
}

// ── Blocks ────────────────────────────────────────────────────────────────────
const HOUSEKEEPING = /transcript|off-topic|informal|summary note|note on/i;

function Children({ items }: { items: Item[] }) {
  return (
    <ul className="mt-2 space-y-1.5 border-l border-lime/15 pl-4 text-[15px] text-paper/65">
      {items.map((child, i) => (
        <li key={i}>
          {child.label && <span className="font-medium text-paper/85">{child.label}: </span>}
          <Inline text={child.body} />
        </li>
      ))}
    </ul>
  );
}

function ItemView({ item, dimLabels }: { item: Item; dimLabels?: boolean }) {
  // Plain items get a small lime square with a hanging indent so wrapped lines read as one item;
  // labeled items don't need one — the bold label marks the start
  if (!item.label) {
    return (
      <li className="flex gap-3">
        <span aria-hidden="true" className="mt-[0.6em] h-1.5 w-1.5 shrink-0 bg-lime/70" />
        <div className="min-w-0">
          <p className="text-paper/85"><Inline text={item.body} /></p>
          {item.children.length > 0 && <Children items={item.children} />}
        </div>
      </li>
    );
  }

  const dim = dimLabels && HOUSEKEEPING.test(item.label);
  return (
    <li className={dim ? 'opacity-60 text-[14px]' : undefined}>
      <p className="font-display font-bold text-[17px] leading-snug text-paper"><Inline text={item.label} /></p>
      {item.body && <p className="mt-1 text-paper/75"><Inline text={item.body} /></p>}
      {item.children.length > 0 && <Children items={item.children} />}
    </li>
  );
}

const RESPONSIBLE = /responsib|owner|party|assigned|who/i;

function TableView({ block, section }: { block: Extract<Block, { kind: 'table' }>; section: SectionKey }) {
  const { header, rows } = block;

  // Two columns (Field | Details, Member | Vote, Motion | …) read best as label/value pairs
  if (section !== 'actions' && rows.every((r) => r.length === 2)) {
    return (
      <dl className="grid grid-cols-[7.5rem_1fr] md:grid-cols-[10rem_1fr] gap-x-5 gap-y-2">
        {rows.map((r, i) => (
          <Fragment key={i}>
            <dt className="font-mono text-[12px] uppercase tracking-wider text-lime/70 pt-0.5">{r[0].replace(/\*\*/g, '')}</dt>
            <dd className="text-paper/85"><Inline text={r[1]} /></dd>
          </Fragment>
        ))}
      </dl>
    );
  }

  // Wider tables (Action | Responsible | Notes) become a list: first column leads, the rest are tags
  const responsibleCol = header.findIndex((h) => RESPONSIBLE.test(h));
  return (
    <ul className="space-y-4">
      {rows.map((r, i) => (
        <li key={i}>
          <p className="text-paper"><Inline text={r[0]} /></p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            {r.slice(1).map((cell, j) => {
              const col = j + 1;
              if (!cell || cell === '—' || cell === '-') return null;
              return col === responsibleCol ? (
                <span key={j} className="font-mono text-[11px] uppercase tracking-wider text-lime/90 border border-lime/30 rounded px-2 py-0.5">
                  {cell.replace(/\*\*/g, '')}
                </span>
              ) : (
                <span key={j} className="text-[14px] text-paper/55">
                  {header[col] && <span className="font-mono text-[11px] uppercase tracking-wider text-lime/60 mr-1.5">{header[col]}</span>}
                  <Inline text={cell} />
                </span>
              );
            })}
          </div>
        </li>
      ))}
    </ul>
  );
}

function BlockView({ block, section }: { block: Block; section: SectionKey }) {
  switch (block.kind) {
    case 'list':
      return (
        <ul className="space-y-4">
          {block.items.map((item, i) => <ItemView key={i} item={item} dimLabels={section === 'notes'} />)}
        </ul>
      );
    case 'table':
      return <TableView block={block} section={section} />;
    case 'note':
      return <p className="text-[13px] italic text-paper/45"><Inline text={block.text} /></p>;
    case 'sub':
      return <h4 className="font-display font-bold text-lg text-paper pt-2"><Inline text={block.text} /></h4>;
    case 'para':
      // Fully italic lines are asides, e.g. "*(Individual votes not recorded)*"
      if (/^\*[^*].*\*$/.test(block.text)) return <p className="text-[13px] italic text-paper/45">{block.text.slice(1, -1)}</p>;
      return <p className="text-paper/85"><Inline text={block.text} /></p>;
  }
}

function SectionView({ section }: { section: Section }) {
  const label = section.key === 'body' ? null : (
    <h3 className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-lime">{TITLES[section.key]}</h3>
  );

  if (isEmptySection(section)) {
    return (
      <section id={section.key} className="scroll-mt-24 mt-10 pt-5 border-t border-lime/15 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        {label}
        <p className="text-[14px] text-paper/45">{flatText(section.blocks).split(/(?<=\.)\s/)[0]}</p>
      </section>
    );
  }

  return (
    <section id={section.key} className="scroll-mt-24 mt-10 pt-5 border-t border-lime/15">
      {label}
      <div className="mt-5 space-y-4">
        {section.blocks.map((block, i) => <BlockView key={i} block={block} section={section.key} />)}
      </div>
    </section>
  );
}

// "City Council" → "City Council Meeting"; leaves names that already say what they are
function meetingTitle(label: string, subtype: string) {
  const base = label.replace(/\s*-\s*audio only$/i, '').replace(/\bMtg\b/i, 'Meeting');
  // Subtypes already named in the type ("RDA Board", "2026 Legislative Meeting") aren't repeated
  const sub = subtype && !base.toLowerCase().includes(subtype.replace(/ meeting$/i, '').toLowerCase()) ? subtype : '';
  if (sub === 'Work Meeting' || sub === 'Legislative') return `${base} ${sub.replace(/ Meeting$/, '')} Meeting`;
  const title = /\b(meeting|ceremony|hearing|retreat|session)$/i.test(base) ? base : `${base} Meeting`;
  return sub ? `${title} · ${sub}` : title;
}

// ── Page ──────────────────────────────────────────────────────────────────────
const NAV: SectionKey[] = ['topics', 'decisions', 'votes', 'actions', 'notes'];

export default function MeetingSummary({ meeting }: { meeting: Meeting }) {
  const label = getCanonicalType(meeting.meeting_type);
  const subtype = getSubtype(meeting.meeting_type, true);

  const sections = parseSummary(meeting.summary);
  const overview = sections.find((s) => s.key === 'overview');
  const brief = sections.find((s) => s.key === 'brief');
  const body = sections.filter((s) => s.key !== 'overview' && s.key !== 'brief');
  const nav = body.filter((s) => NAV.includes(s.key) && !isEmptySection(s));

  const navItems = nav.map((s) => ({ key: s.key, title: TITLES[s.key] }));
  const showNav = navItems.length > 1;

  return (
    // Width = padding + (TOC + gap) + 880px text column, so the header's right edge lines up with the text
    <article className={`px-8 md:px-12 pb-24 md:-mt-2 text-[15px] md:text-[16px] leading-relaxed ${showNav ? 'max-w-[976px] xl:max-w-[1174px] xl:grid xl:grid-cols-[150px_minmax(0,1fr)] xl:gap-x-12' : 'max-w-[976px]'}`}>
      <header className="flex items-start justify-between gap-6 flex-wrap xl:col-span-2">
        <div>
          <p className="font-mono text-sm text-paper">{formatLongDate(meeting.meeting_date)}</p>
          <h2 className="font-display text-3xl md:text-[34px] leading-tight text-paper mt-1">
            {meetingTitle(label, subtype)}
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

      {showNav && <SectionNav sections={navItems} />}

      <div className="min-w-0 max-w-[880px] xl:col-start-2">
        <OverviewNotes section={overview} />

        {brief && (
          <p className="mt-8 text-lg md:text-xl leading-relaxed text-paper">
            <Inline text={flatText(brief.blocks)} />
          </p>
        )}

        {showNav && <SectionSelect sections={navItems} />}

        {body.map((section, i) => <SectionView key={i} section={section} />)}

        <p className="mt-12 pt-6 border-t border-lime/10 font-mono text-xs text-paper/40">
          Summarized {new Date(meeting.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>
    </article>
  );
}
