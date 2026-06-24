/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#f7f5ef',
        ink: '#22313f',
        sage: '#7d9d8c',
        moss: '#536f55',
        coral: '#c86f5f',
        clay: '#a96545',
        sky: '#6d99b8',
        marigold: '#d5a83f',
      },
      boxShadow: {
        soft: '0 18px 50px rgba(34, 49, 63, 0.09)',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
