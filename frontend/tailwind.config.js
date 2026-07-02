/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Neutral dev-tool canvas (GitHub-adjacent, not a copy)
        canvas:  '#F6F8FA',
        paper:   '#FFFFFF',
        line:    '#D1D9E0',
        ink:     '#1F2328',
        mute:    '#636C76',
        faint:   '#8C959F',

        // Merge / ship green — primary actions only
        primary: {
          DEFAULT: '#2DA54A',
          light:   '#3FB950',
          dark:    '#1B7A37',
          soft:    '#EEF9F1',
        },
        accent:  '#0870D3',
        success: '#1A7F37',
        warning: '#BF8700',
        danger:  '#CF222E',

        base:    '#070B14',
        surface: '#0D1320',
        elevated:'#162032',
        subtle:  '#1E2D42',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'Menlo', 'monospace'],
      },
      boxShadow: {
        'soft':      '0 1px 2px rgba(31,35,40,0.06)',
        'card':      '0 1px 2px rgba(31,35,40,0.06), 0 8px 24px -8px rgba(31,35,40,0.12)',
        'lift':      '0 4px 12px rgba(31,35,40,0.08), 0 16px 40px -12px rgba(31,35,40,0.14)',
        'glow-primary': '0 0 0 3px rgba(45,165,74,0.18)',
        'glow-success': '0 0 0 3px rgba(26,127,55,0.14)',
      },
      backgroundImage: {
        'mesh': 'radial-gradient(ellipse 75% 55% at 50% -15%, rgba(45,165,74,0.05) 0%, transparent 58%)',
        'grid': 'linear-gradient(rgba(209,217,224,0.45) 1px,transparent 1px), linear-gradient(90deg,rgba(209,217,224,0.45) 1px,transparent 1px)',
      },
      animation: {
        'cursor-blink': 'cursor-blink 1s step-end infinite',
        'fade-up':      'fade-up 0.4s ease both',
        'shimmer':      'shimmer 1.4s ease-in-out infinite',
      },
      keyframes: {
        'cursor-blink': {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'shimmer': {
          '0%':   { backgroundPosition: '-400px 0' },
          '100%': { backgroundPosition: '400px 0' },
        },
      },
    },
  },
  plugins: [],
}
