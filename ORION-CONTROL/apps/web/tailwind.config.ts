import type { Config } from 'tailwindcss';

/**
 * ORION CONTROL design tokens.
 * Near-black navy surfaces, electric purple primary, cyan secondary, and
 * restrained neon accents. Everything is expressed here so pages stay readable.
 */
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        void: {
          950: '#04060d',
          900: '#070a14',
          850: '#090e1b',
          800: '#0c1222',
          750: '#101829',
          700: '#151f36',
        },
        edge: {
          DEFAULT: '#1c2740',
          soft: '#141d31',
          bright: '#2a3a5c',
        },
        brand: {
          50: '#f5f0ff',
          100: '#ece1ff',
          200: '#d9c6ff',
          300: '#bf9dff',
          400: '#a474ff',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
          800: '#5b21b6',
          900: '#4c1d95',
        },
        cyber: {
          300: '#67e8f9',
          400: '#22d3ee',
          500: '#06b6d4',
          600: '#0891b2',
        },
        signal: {
          success: '#34d399',
          warning: '#fbbf24',
          danger: '#fb7185',
          info: '#60a5fa',
          muted: '#64748b',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'Liberation Mono', 'monospace'],
      },
      boxShadow: {
        'glow-brand': '0 0 24px -6px rgba(139, 92, 246, 0.55)',
        'glow-cyan': '0 0 24px -6px rgba(34, 211, 238, 0.45)',
        panel: '0 20px 45px -30px rgba(0, 0, 0, 0.9), inset 0 1px 0 0 rgba(255, 255, 255, 0.03)',
      },
      backgroundImage: {
        'grid-fade':
          'linear-gradient(to bottom, rgba(139,92,246,0.10), rgba(4,6,13,0) 60%), radial-gradient(circle at 20% 0%, rgba(139,92,246,0.16), transparent 45%)',
        'brand-sheen': 'linear-gradient(135deg, rgba(139,92,246,0.22), rgba(34,211,238,0.10))',
      },
      keyframes: {
        'pulse-ring': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.45', transform: 'scale(0.85)' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'pulse-ring': 'pulse-ring 2.4s ease-in-out infinite',
        'fade-up': 'fade-up 240ms ease-out both',
        shimmer: 'shimmer 1.8s infinite',
      },
    },
  },
  plugins: [],
};

export default config;
