/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'bg-dark': '#0B0F14',
        'bg-panel': '#11161D',
        'bg-card': '#1A2029',
        'border-dark': '#232B36',
        'cyan': '#22D3EE',
        'cyan-dark': '#06B6D4',
        'amber': '#F5B301',
        'success': '#3DD68C',
        'warning': '#FF8A00',
        'danger': '#FF4D4F',
        'text-primary': '#F1F5F9',
        'text-secondary': '#94A3B8',
        'text-muted': '#64748B',
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        display: ['"Orbitron"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        'glow-cyan': '0 0 20px rgba(34, 211, 238, 0.3)',
        'glow-red': '0 0 20px rgba(255, 77, 79, 0.4)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(34, 211, 238, 0.5)' },
          '100%': { boxShadow: '0 0 20px rgba(34, 211, 238, 0.8)' },
        },
      },
    },
  },
  plugins: [],
}
