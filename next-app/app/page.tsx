import { Suspense } from 'react';
import { getMeetings, getMeetingTypes, getMeetingYears, getMeetingMonths } from '@/lib/db';
import Sidebar from '@/components/Sidebar';
import MeetingCard from '@/components/MeetingCard';

interface SearchParams {
  type?: string;
  search?: string;
  year?: string;
  month?: string;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { type, search, year, month } = await searchParams;

  const [meetings, types, years, months] = await Promise.all([
    Promise.resolve(getMeetings(type, search, year, month)),
    Promise.resolve(getMeetingTypes()),
    Promise.resolve(getMeetingYears()),
    Promise.resolve(getMeetingMonths()),
  ]);

  return (
    <div className="min-h-screen flex gap-8 px-6 py-8 max-w-4xl mx-auto">
      <Suspense>
        <Sidebar
          types={types}
          years={years}
          months={months}
          selectedType={type ?? ''}
          selectedYear={year ?? ''}
          selectedMonth={month ?? ''}
          searchValue={search ?? ''}
        />
      </Suspense>

      <div className="flex-1 min-w-0">
        {meetings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No meetings found</h3>
            <p className="text-gray-500 max-w-sm">
              {type || search || year || month
                ? 'Try adjusting your filters or search query.'
                : 'Run the scraper to populate the database with meeting summaries.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5">
            {meetings.map((meeting) => (
              <MeetingCard key={meeting.id} meeting={meeting} search={search ?? ''} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
