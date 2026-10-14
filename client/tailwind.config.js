/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        paper: 'rgb(var(--paper) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        ink: 'rgb(var(--ink) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',
        sand: 'rgb(var(--sand) / <alpha-value>)',
        moss: {
          DEFAULT: 'rgb(var(--moss) / <alpha-value>)',
          dark: 'rgb(var(--moss-dark) / <alpha-value>)',
          soft: 'rgb(var(--moss-soft) / <alpha-value>)',
        },
        clay: {
          DEFAULT: 'rgb(var(--clay) / <alpha-value>)',
          soft: 'rgb(var(--clay-soft) / <alpha-value>)',
        },
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgb(25 25 23 / 0.04), 0 4px 16px rgb(25 25 23 / 0.06)',
        lift: '0 12px 32px -8px rgb(25 25 23 / 0.18)',
      },
      borderRadius: { '4xl': '2rem' },
    },
  },
  plugins: [],
};
