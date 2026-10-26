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
        // Exact Tokens requested: bg, panel, raised, line, fg, muted, accent, danger, warn, ok
        bg: '#0E0F11',
        panel: '#151618',
        raised: '#1C1E21',
        line: '#26292D',
        fg: '#E6E7E9',
        muted: '#8B9097',
        accent: {
          DEFAULT: '#4C90F0',
          hover: '#3A7FE0',
          subtle: 'rgba(76, 144, 240, 0.12)',
        },
        danger: {
          DEFAULT: '#E5484D',
          subtle: 'rgba(229, 72, 77, 0.12)',
        },
        warn: {
          DEFAULT: '#F5A524',
          subtle: 'rgba(245, 165, 36, 0.12)',
        },
        ok: {
          DEFAULT: '#3DB46D',
          subtle: 'rgba(61, 180, 109, 0.12)',
        },
        // Semantic aliases
        app: '#0E0F11',
        surface: '#1C1E21',
        divider: '#26292D',
        'border-subtle': '#26292D',
        txt: {
          primary: '#E6E7E9',
          muted: '#8B9097',
        },
        // Unified palette aliases for legacy components
        intel: {
          bg: '#0E0F11',
          panel: '#151618',
          'panel-dark': '#0E0F11',
          'panel-light': '#1C1E21',
          border: '#26292D',
          'border-active': '#4C90F0',
          cyan: '#4C90F0',
          'cyan-glow': '#4C90F0',
          amber: '#F5A524',
          emerald: '#3DB46D',
          ruby: '#E5484D',
          purple: '#8B9097',
          blue: '#4C90F0',
          text: '#E6E7E9',
          muted: '#8B9097',
          dim: '#8B9097',
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
