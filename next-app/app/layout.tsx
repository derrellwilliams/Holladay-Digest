import type { Metadata } from 'next';
import { Roboto, Roboto_Condensed, Roboto_Mono } from 'next/font/google';
import './globals.css';

const roboto = Roboto({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-sans',
  display: 'swap',
});

const robotoCondensed = Roboto_Condensed({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-display',
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
      <body className={`${roboto.variable} ${robotoCondensed.variable} ${robotoMono.variable} font-sans bg-forest text-lime antialiased`}>
        <main id="page">{children}</main>
      </body>
    </html>
  );
}
