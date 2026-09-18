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
        'zombie-dark': '#141b17',
        'abyss': '#0a0f0c',
        'pleb-gold': '#ffd700',
        'pleb-blue': '#1e90ff',
        'pleb-purple': '#c084fc',
      },
      fontFamily: {
        // Fallback is a plain sans-serif, not the `cursive` generic family —
        // browsers map `cursive` to an ornate calligraphy face (Apple
        // Chancery on macOS/iOS), which flashes visibly before Creepster
        // loads (font-display: swap) and looks nothing like it.
        'horror': ['"Creepster"', 'sans-serif'],
        'main': ['"Geist"', 'sans-serif'],
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        lurch: {
          '0%, 100%': { transform: 'rotate(-4deg) translateY(0)' },
          '25%': { transform: 'rotate(0deg) translateY(-3px)' },
          '50%': { transform: 'rotate(4deg) translateY(0)' },
          '75%': { transform: 'rotate(0deg) translateY(-3px)' },
        },
        flicker: {
          '0%, 100%, 92%, 94%, 97%': { opacity: '1' },
          '93%': { opacity: '0.6' },
          '96%': { opacity: '0.7' },
        },
        wiggle: {
          '0%, 100%': { transform: 'rotate(0deg)' },
          '25%': { transform: 'rotate(-8deg)' },
          '75%': { transform: 'rotate(8deg)' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%': { transform: 'translateX(-6px)' },
          '40%': { transform: 'translateX(6px)' },
          '60%': { transform: 'translateX(-4px)' },
          '80%': { transform: 'translateX(4px)' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(14px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        float: 'float 3.5s ease-in-out infinite',
        lurch: 'lurch 2.4s ease-in-out infinite',
        flicker: 'flicker 6s linear infinite',
        wiggle: 'wiggle 0.4s ease-in-out',
        shake: 'shake 0.5s ease-in-out',
        'fade-up': 'fade-up 0.5s cubic-bezier(0.22, 1, 0.36, 1) both',
      },
    },
  },
  plugins: [],
}