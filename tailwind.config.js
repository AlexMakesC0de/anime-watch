/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        dark: {
          50: '#f5f5f6',
          100: '#e6e6e7',
          200: '#cfd0d2',
          300: '#adaeb3',
          400: '#84858c',
          500: '#696a71',
          600: '#5a5a61',
          700: '#4c4d52',
          800: '#434347',
          900: '#1a1b1e',
          950: '#111214'
        },
        accent: {
          DEFAULT: '#6c5ce7',
          hover: '#7c6ff0',
          light: '#a29bfe',
          dark: '#5a4bd1'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif']
      }
    }
  },
  plugins: []
}
