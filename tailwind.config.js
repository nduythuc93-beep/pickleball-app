/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1D9E75',
          50: '#E6F7F0',
          100: '#C2EBDB',
          200: '#8FD9BC',
          300: '#5BC79D',
          400: '#3FB789',
          500: '#1D9E75',
          600: '#178060',
          700: '#11614A',
          800: '#0B4334',
          900: '#06241D',
        },
        skill: {
          a: '#1D9E75',
          'b-plus': '#3B82F6',
          'b-minus': '#F59E0B',
          c: '#6B7280',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      keyframes: {
        wiggle: {
          '0%, 100%': { transform: 'rotate(-4deg)' },
          '50%': { transform: 'rotate(4deg)' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      animation: {
        wiggle: 'wiggle 1s ease-in-out infinite',
        slideDown: 'slideDown 180ms ease-out',
        fadeIn: 'fadeIn 150ms ease-out',
      },
    },
  },
  plugins: [],
}
