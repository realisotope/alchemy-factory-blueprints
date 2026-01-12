export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        cinzel: ['Cinzel', 'serif'],
        lora: ['Lora', 'serif'],
      },
      screens: {
        "4k": "3840px",
      },
      fontSize: {
        'md': '1.1rem',
      },
    },
  },
  plugins: [],
};
