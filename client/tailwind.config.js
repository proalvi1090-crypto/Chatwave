/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        display: ["Poppins", "sans-serif"],
        body: ["Manrope", "sans-serif"]
      },
      colors: {
        surface: "#f3f6fb",
        ink: "#101727",
        ocean: "#0d9488",
        peach: "#ff9f5a"
      }
    }
  },
  plugins: []
};
