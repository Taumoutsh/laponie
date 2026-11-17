import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#37352F',
        muted: '#6F6E69',
        faint: '#9B9A97',
        line: '#E9E9E7',
        line2: '#F1F1EF',
        soft: '#F7F7F5',
        hover: '#EFEFED',
        pine: { DEFAULT: '#1F6B52', dark: '#185842', light: '#E8F1EC' },
        credit: { DEFAULT: '#2F6FB0', text: '#245A93', bg: '#EEF4FB' },
        debt: { DEFAULT: '#D9822B', text: '#8F4A0E', bg: '#FCEBD9' },
        danger: { DEFAULT: '#B42318', bg: '#FDECEA' },
        warn: { DEFAULT: '#C98A1B', text: '#7A5C12', bg: '#FBF3DB' },
        couple: { DEFAULT: '#9B2C55', bg: '#F9E4EC' },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
