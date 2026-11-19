/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        sage: {
          50: '#f3f6f2', 100: '#e4ebe1', 200: '#c9d7c4', 300: '#a6bd9e', 400: '#84a17a',
          500: '#66845d', 600: '#506a49', 700: '#41553c', 800: '#364533', 900: '#2d392b', 950: '#171f16',
        },
        clay: { 50: '#fbf5f1', 100: '#f5e6dc', 300: '#e3b598', 400: '#d79a74', 500: '#c97f55', 600: '#b0663f' },
        sand: { 50: '#faf9f6', 100: '#f4f2ec', 200: '#e8e4da', 300: '#d6d0c2' },
        ink: { 700: '#3a3d38', 800: '#262925', 900: '#181a17', 950: '#101210' },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['Fraunces', 'ui-serif', 'Georgia', 'serif'],
      },
      boxShadow: {
        soft: '0 1px 2px rgba(20,30,20,.04), 0 4px 16px rgba(20,30,20,.05)',
      },
    },
  },
  plugins: [],
};
