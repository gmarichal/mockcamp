/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // MockCamp design tokens
        base:     { DEFAULT: '#0F1117' },
        surface:  { DEFAULT: '#171C26' },
        elevated: { DEFAULT: '#1E2433' },
        hover:    { DEFAULT: '#252C3E' },
        border:   { DEFAULT: '#2A3244', strong: '#3A4560' },
        accent:   { DEFAULT: '#3ECFCF', dim: '#1A6060' },
        success:  { DEFAULT: '#3DD68C' },
        warning:  { DEFAULT: '#F5A623' },
        error:    { DEFAULT: '#F56565' },
        purple:   { DEFAULT: '#A78BFA' },
        txt: {
          primary:   '#DCE5F5',
          secondary: '#7A8BA8',
          muted:     '#4A5668',
        },
        method: {
          get:    '#3ECFCF',
          post:   '#3DD68C',
          put:    '#F5A623',
          delete: '#F56565',
          patch:  '#A78BFA',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['Fira Code', 'SF Mono', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
}
