/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        base:    '#070B14',
        surface: '#0D1320',
        elevated:'#162032',
        subtle:  '#1E2D42',
        primary: {
          DEFAULT: '#6366F1',
          light:   '#818CF8',
          dark:    '#4F46E5',
        },
        success: '#10B981',
        warning: '#F59E0B',
        danger:  '#EF4444',
        accent:  '#C084FC',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'Menlo', 'monospace'],
      },
      animation: {
        'pulse-ring':    'pulse-ring 2s cubic-bezier(0.4,0,0.6,1) infinite',
        'cursor-blink':  'cursor-blink 1s step-end infinite',
        'fade-up':       'fade-up 0.4s ease both',
        'glow-pulse':    'glow-pulse 3s ease-in-out infinite',
      },
      keyframes: {
        'pulse-ring': {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.4' },
        },
        'cursor-blink': {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'glow-pulse': {
          '0%, 100%': { opacity: '0.4' },
          '50%':      { opacity: '0.8' },
        },
      },
      boxShadow: {
        'glow-primary': '0 0 20px rgba(99,102,241,0.3)',
        'glow-success': '0 0 20px rgba(16,185,129,0.3)',
        'glow-sm':      '0 0 8px rgba(99,102,241,0.2)',
      },
    },
  },
  plugins: [],
}
