/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        display: ["Manrope", "sans-serif"],
        body: ["Manrope", "sans-serif"],
        inter: ["Inter", "sans-serif"]
      },
      colors: {
        surface: "#eff2ff",
        ink: "#0b1326",
        brand: {
          50: "#e0e7ff",
          100: "#c0c1ff", // Primary
          200: "#a5b4fc",
          300: "#8083ff", // Primary Container
          400: "#6366f1", // Active Indigo
          500: "#494bd6", // Inverse Primary
          600: "#4f46e5",
          700: "#4338ca",
          800: "#1000a9", // On-Primary
          900: "#07006c"  // On-Primary Fixed
        },
        rose: {
          400: "#ffb2b7", // Secondary
          500: "#f43f5e",
          600: "#b50036"  // Secondary Container
        },
        chatdark: {
          base: "#0b1326", // Surface
          bright: "#31394d", // Surface Bright
          container: {
            lowest: "#060e20",
            low: "#131b2e",
            DEFAULT: "#171f33",
            high: "#222a3d",
            highest: "#2d3449"
          }
        }
      }
    }
  },
  plugins: []
};
