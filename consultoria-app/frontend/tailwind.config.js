/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'bg-deep': '#020617',
        'primary': '#020617',
        'accent': '#38bdf8',
        'accent-glow': 'rgba(56, 189, 248, 0.4)',
        'text-main': '#ffffff',
        'text-muted': '#94a3b8',
        'success': '#10b981',
        'warning': '#f59e0b',
      }
    },
  },
  plugins: [],
}
