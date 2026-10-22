import type { Metadata } from 'next';
import { Roboto_Mono } from 'next/font/google';
import localFont from 'next/font/local';
import './globals.css';

// Zalando Sans isn't in next/font/google's list yet — self-hosted latin files from Google Fonts
const zalandoSans = localFont({
  src: [
    { path: './fonts/ZalandoSans-Regular.woff2', weight: '400' },
    { path: './fonts/ZalandoSans-Medium.woff2', weight: '500' },
    { path: './fonts/ZalandoSans-Bold.woff2', weight: '700' },
    { path: './fonts/ZalandoSans-Black.woff2', weight: '900' },
  ],
  variable: '--font-sans',
  display: 'swap',
});

const robotoMono = Roboto_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Holladay Digest',
  description: 'Browse Holladay City meeting minutes and AI-generated summaries',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(!sessionStorage.getItem('intro')){document.documentElement.setAttribute('data-intro','');sessionStorage.setItem('intro','1')}}catch(e){}`,
          }}
        />
      </head>
      <body className={`${zalandoSans.variable} ${robotoMono.variable} font-sans bg-forest text-lime antialiased`}>
        <main id="page">{children}</main>
      </body>
    </html>
  );
}
