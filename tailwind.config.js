/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#070b14",
        paper: "#f6f1e6",
        parch: "#ece4d1",
        cardpaper: "#fffdf7",
        inktext: "#221b10",
        clay: "#8a6d3b",
        panel: "#0d1424",
        panel2: "#111a2e",
        brand: "#f59e0b",
        branddeep: "#b45309",
        branddim: "#92400e",
        gold: "#f5c518",
      },
      fontFamily: {
        display: ["Space Grotesk", "Inter", "system-ui", "sans-serif"],
        body: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        glow: "0 0 24px rgba(245, 158, 11, 0.18)",
        card: "0 8px 32px rgba(0, 0, 0, 0.45)",
        paper: "0 2px 14px rgba(60, 45, 20, 0.10)",
      },
    },
  },
  plugins: [],
};
