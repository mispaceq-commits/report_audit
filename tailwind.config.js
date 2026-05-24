/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.html'],
  theme: {
    extend: {
      colors: {
        brand: {
          blue: '#1F3C88',
          'blue-dark': '#162C66',
          'blue-light': '#E8ECF8',
          orange: '#F58B24',
          ink: '#111111',
          muted: '#5A6075',
          line: '#E5E7EE',
          paper: '#FFFFFF',
          bg: '#F7F8FC',
        },
      },
      fontFamily: {
        display: ['Montserrat', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
      },
      letterSpacing: {
        tightish: '-0.015em',
        tighter2: '-0.02em',
      },
    },
  },
  plugins: [],
};
