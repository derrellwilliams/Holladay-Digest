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
        serif: ['var(--font-serif)', 'serif'],
      },
      colors: {
        alabaster: '#E6E8E6',
        dust: '#CED0CE',
        ash: '#9FB8AD',
        granite: '#475841',
        gunmetal: '#3F403F',
        brand: {
          100: '#E6E8E6',
          200: '#CED0CE',
          400: '#9FB8AD',
          600: '#475841',
          700: '#3a4835',
          900: '#3F403F',
        },
      },
    },
  },
  safelist: [
    'bg-dust', 'bg-granite',
    'text-granite', 'text-gunmetal', 'text-white',
  ],
  plugins: [],
};
