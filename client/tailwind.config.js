/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        intel: {
          bg: '#090d16',
          panel: '#0f172a',
          'panel-dark': '#0b1120',
          'panel-light': '#1e293b',
          border: '#1e293b',
          'border-active': '#334155',
          cyan: '#06b6d4',
          'cyan-glow': '#22d3ee',
          amber: '#f59e0b',
          emerald: '#10b981',
          ruby: '#f43f5e',
          purple: '#a855f7',
          blue: '#3b82f6',
          text: '#e2e8f0',
          muted: '#94a3b8',
          dim: '#64748b',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Courier New', 'monospace'],
        sans: ['Inter', 'Segoe UI', 'Roboto', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
