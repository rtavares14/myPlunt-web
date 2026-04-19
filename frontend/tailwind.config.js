/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  important: "#root",
  theme: {
    extend: {
      colors: {
        cream:          '#ebe1d3',
        'green-main':   '#14532d',
        'green-second': '#0f7033',
        'green-light':  '#2e7d52',
      },
    },
  },
  plugins: [],
};
