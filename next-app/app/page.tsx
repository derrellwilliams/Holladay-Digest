import { getMeetings, getMeeting } from '@/lib/db';
import { getCanonicalType } from '@/lib/meetingColors';
import { formatDotDate } from '@/lib/utils';
import Masthead from '@/components/Masthead';
import MeetingList from '@/components/MeetingList';
import HalftoneHero from '@/components/HalftoneHero';
import MeetingPanel from '@/components/MeetingPanel';
import MeetingSummary from '@/components/MeetingSummary';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const { m } = await searchParams;

  const meetings = getMeetings().map((meeting) => ({
    id: meeting.id,
    date: formatDotDate(meeting.meeting_date),
    type: getCanonicalType(meeting.meeting_type),
  }));

  const id = m ? parseInt(m, 10) : NaN;
  const selected = id > 0 ? getMeeting(id) : null;

  return (
    <>
      <div className="flex flex-col md:h-dvh md:overflow-hidden">
        <Masthead />
        <div className="flex flex-col-reverse md:flex-row flex-1 min-h-0 md:pr-4 md:pb-9">
          <div className="md:w-[324px] shrink-0 md:h-full">
            <MeetingList meetings={meetings} activeId={selected?.id ?? null} />
          </div>
          <div className="flex-1 min-w-0 px-4 md:px-0">
            <HalftoneHero />
          </div>
        </div>
      </div>

      <MeetingPanel meetingId={selected?.id ?? null}>
        {selected && <MeetingSummary meeting={selected} />}
      </MeetingPanel>
    </>
  );
}
