import { notFound, redirect } from 'next/navigation';

// Meetings now open as a panel on the home page; keep old links working
export default async function MeetingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  if (isNaN(id) || id <= 0) notFound();

  redirect(`/?m=${id}`);
}
