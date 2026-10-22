import { getMeetings } from '@/lib/db';
import { getCanonicalType } from '@/lib/meetingColors';
import { formatDotDate } from '@/lib/utils';
import { OverlayProvider } from '@/components/Overlays';
import HalftoneHero from '@/components/HalftoneHero';
import MeetingBrowser from '@/components/MeetingBrowser';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const { m } = await searchParams;

  const meetings = getMeetings();
  const items = meetings.map((meeting) => ({
    id: meeting.id,
    date: formatDotDate(meeting.meeting_date, '/'),
    type: getCanonicalType(meeting.meeting_type),
  }));

  // ?m=<id> opens the feed at that meeting; otherwise it starts at the welcome text
  const requested = m ? parseInt(m, 10) : NaN;
  const initialId = items.some((x) => x.id === requested) ? requested : null;

  return (
    <OverlayProvider>
      <div className="flex flex-col md:flex-row">
        {/* Menu + image, pinned while the page scrolls the meeting feed; 60px margin top, left and bottom on desktop */}
        <div className="px-5 md:px-0 md:pl-[60px] md:pb-[60px] md:flex-1 md:min-w-0 md:sticky md:top-0 md:self-start md:h-dvh md:flex md:flex-col">
          <HalftoneHero />
        </div>
        <MeetingBrowser items={items} meetings={meetings} initialId={initialId} />
      </div>
    </OverlayProvider>
  );
}
