/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ipl: {
          navy:    '#0B0E1A',
          gold:    '#F4C430',
          green:   '#00C896',
          live:    '#E84040',
          surface: '#161B2E',
        }
      },
      fontFamily: {
        display: ['Oswald', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
      },
      boxShadow: {
        'neon': '0 0 10px rgba(244, 196, 48, 0.4), 0 0 20px rgba(244, 196, 48, 0.2)',
      }
    },
  },
  plugins: [],
}
