const TITLE = 'HOLLADAY DIGEST';

export default function Masthead() {
  return (
    <h1
      aria-label="Holladay Digest"
      className="font-display font-bold uppercase text-lime whitespace-nowrap text-center leading-[0.78] text-[12.7vw] tracking-[-0.005em] px-[2vw] pt-3 md:pt-[1.6vw] pb-[1.8vw] md:pb-[2.1vw] overflow-hidden"
    >
      {TITLE.split('').map((ch, i) => (
        <span key={i} aria-hidden="true" className="inline-block overflow-hidden align-top pb-[0.02em]">
          <span className="intro-letter inline-block" style={{ '--i': i } as React.CSSProperties}>
            {ch === ' ' ? ' ' : ch}
          </span>
        </span>
      ))}
    </h1>
  );
}
