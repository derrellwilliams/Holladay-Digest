'use client';

import dynamic from 'next/dynamic';
import { useOpenOverlay } from './Overlays';

const HalftoneDots = dynamic(() => import('@paper-design/shaders-react').then((m) => m.HalftoneDots), { ssr: false });

const LINES = ['Holladay', 'Digest'];

const MENU_LINK = 'press font-mono text-[12px] font-medium text-moss hover:text-lime';

export default function HalftoneHero() {
  const openFrom = useOpenOverlay();

  return (
    <>
    <nav aria-label="Site" className="shrink-0 h-14 md:h-[60px] flex items-center gap-10">
      <button onClick={openFrom('about')} aria-haspopup="dialog" className={MENU_LINK}>About</button>
      <button onClick={openFrom('search')} aria-haspopup="dialog" aria-keyshortcuts="Meta+K /" className={MENU_LINK}>Search</button>
      <button onClick={openFrom('newsletter')} aria-haspopup="dialog" className={MENU_LINK}>Newsletter</button>
    </nav>
    <section className="relative w-full aspect-[4/3] md:aspect-auto md:flex-1 md:min-h-0 bg-mint overflow-hidden [container-type:size] md:[container-type:inline-size]">
      <div className="intro-fade absolute inset-0">
        <HalftoneDots
          image="/holladay.jpg"
          colorBack="#aeff9e"
          colorFront="#2b2b2b"
          originalColors={false}
          type="gooey"
          grid="hex"
          inverted={false}
          size={0.13}
          radius={1.07}
          contrast={0.39}
          grainMixer={0.03}
          grainOverlay={0.08}
          grainSize={0.18}
          scale={1}
          fit="cover"
          style={{ width: '100%', height: '100%' }}
          aria-label="Halftone photo of downtown Holladay, Utah"
          role="img"
        />
      </div>

      {/* On mobile the heading covers the image to place the title in its upper third; only the title itself takes clicks */}
      <h1
        className="pointer-events-none absolute inset-0 flex flex-col justify-start pt-[14cqh] md:relative md:inset-auto md:block text-center font-sans font-black text-forest text-[12cqw] md:text-[min(104px,12.5cqw)] leading-[0.944] tracking-[-0.01em] md:pt-[9vh]"
      >
        <button
          onClick={openFrom('about')}
          aria-label="Holladay Digest"
          aria-haspopup="dialog"
          className="press pointer-events-auto self-center inline-block cursor-pointer"
        >
          {LINES.map((line, l) => (
            <span key={line} aria-hidden="true" className="block">
              {line.split('').map((ch, i) => (
                <span key={i} className="inline-block overflow-hidden align-top pb-[0.12em] -mb-[0.12em]">
                  <span className="intro-letter inline-block" style={{ '--i': l * 8 + i } as React.CSSProperties}>
                    {ch}
                  </span>
                </span>
              ))}
            </span>
          ))}
        </button>
      </h1>

    </section>
    </>
  );
}
