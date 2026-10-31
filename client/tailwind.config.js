/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Brand palette (supplied)
        burgundy: { DEFAULT: '#773B49', 700: '#62303C', 800: '#4E2630' },
        ivory: '#FAF6F5',
        blush: { DEFAULT: '#EAD7D9', 50: '#F6EDEE' },
        // Muted blue: #6F9BCB for tints/accents; 700 is a darker step so white text meets WCAG AA.
        mist: { DEFAULT: '#6F9BCB', 700: '#44729F' },
        pale: '#DCE5F6',
        charcoal: { DEFAULT: '#30282B', 70: '#5E5559' },
        danger: { DEFAULT: '#A4372F', soft: '#F8E3E0' },
        success: { DEFAULT: '#2F6B4F', soft: '#E1F0E7' },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Fraunces', 'Georgia', 'ui-serif', 'serif'],
      },
      borderRadius: { xl: '0.875rem', '2xl': '1.125rem' },
      boxShadow: {
        card: '0 1px 2px rgba(48,40,43,0.04), 0 4px 16px rgba(48,40,43,0.05)',
        pop: '0 12px 40px rgba(48,40,43,0.16)',
      },
    },
  },
  plugins: [],
};
