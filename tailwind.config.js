/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'zombie-green': '#5cdb5c',
        'zombie-dark': '#2c3531',
        'pleb-gold': '#ffd700',
        'pleb-blue': '#1e90ff',
        'pleb-purple': '#8e30eb',
        'zombie-rot-green': '#5BDB5C',
      },
      fontFamily: {
        'horror': ['"Creepster"', 'cursive'],
        'main': ['"Inter"', 'sans-serif'],
      }
    },
  },
  plugins: [],
}