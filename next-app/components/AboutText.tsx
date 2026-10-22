// What the site is — shown at the top of the meeting feed and in the About overlay
export default function AboutText({ className = '' }: { className?: string }) {
  return (
    <div className={`space-y-6 font-sans text-lg md:text-xl leading-relaxed text-paper/85 ${className}`}>
      <p>
        Plain-language summaries of every Holladay City Council and Planning Commission meeting: what was discussed,
        decided and voted on, without digging through pages of minutes.
      </p>
      <p>
        Each night the site checks the city&rsquo;s meeting portal for new minutes. When they&rsquo;re posted, AI
        summarizes them into key topics, decisions, votes and action items, with a link to the original PDF.
      </p>
      <p>
        Pick a date to read a meeting, keep scrolling to move through them, or search across every summary. Sign up for
        email to get new summaries as soon as they&rsquo;re ready.
      </p>
    </div>
  );
}
