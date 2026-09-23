/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'sans-serif'],
        display: ['var(--font-display)', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      colors: {
        forest: '#16290F',
        pine: '#0F1A0D',
        lime: '#8FFF7A',
        mint: '#AEFF9E',
        soot: '#2B2B2B',
        paper: '#EEF2EA',
      },
    },
  },
  plugins: [],
};
