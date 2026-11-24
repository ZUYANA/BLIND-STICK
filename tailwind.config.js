/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        stick: {
          dark: '#0f172a',
          card: '#1e293b',
          accent: '#38bdf8',
          yellow: '#facc15',
          green: '#22c55e',
          red: '#ef4444'
        }
      }
    },
  },
  plugins: [],
}
