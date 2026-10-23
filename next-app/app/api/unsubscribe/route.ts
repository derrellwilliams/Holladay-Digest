import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const AUDIENCE_ID = process.env.RESEND_AUDIENCE_ID ?? 'f0e9aae2-f00b-4af6-b995-34ad472d3429';
const CONTACT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Unsubscribes the contact in ?id= (the token in each digest's unsubscribe link). Handles both the
// confirm button on /unsubscribe and mail apps' one-click List-Unsubscribe POST.
export async function POST(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id') ?? '';
  const oneClick = (await request.text()).includes('List-Unsubscribe=One-Click');
  if (!CONTACT_ID.test(id)) {
    return oneClick ? new NextResponse('Invalid link', { status: 400 }) : NextResponse.redirect(new URL('/unsubscribe?status=error', request.url), 303);
  }

  const { error } = await resend.contacts.update({ id, audienceId: AUDIENCE_ID, unsubscribed: true });
  if (error) console.error('Resend error:', error);

  if (oneClick) return new NextResponse(error ? 'Error' : 'Unsubscribed', { status: error ? 500 : 200 });
  return NextResponse.redirect(new URL(`/unsubscribe?status=${error ? 'error' : 'done'}`, request.url), 303);
}
