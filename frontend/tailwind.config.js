/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },
        accent: {
          DEFAULT: '#15803d',
          dark: '#166534',
          soft: '#dcfce7',
          glow: '#4ade80',
        },
        ink: {
          DEFAULT: '#0b110e',
          800: '#1a221d',
          700: '#27322b',
          600: '#3a463e',
        },
        canvas: '#e8ecef',
        tile: '#f5f6f7',
        night: '#030504',
        frame: '#e8e8e9',
        shell: '#1b1a1b',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 3px 0 rgb(15 23 42 / 0.06)',
        pill: '0 1px 2px rgb(15 23 42 / 0.06), 0 10px 28px -14px rgb(15 23 42 / 0.18)',
      },
    },
  },
  plugins: [],
};