/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      screens: {
        'xs': '375px',     // Compact Mobile Handsets
        'sm': '480px',     // Standard Mobile Screens
        'md': '768px',     // Tablets
        'lg': '1024px',    // Standard Laptops
        'xl': '1440px',    // Pro Desktop Displays
        '2xl': '1600px',   // Large Monitor Layouts
      },
    },
  },
  plugins: [],
}