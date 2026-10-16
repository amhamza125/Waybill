/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#070b14",
        panel: "#0d1424",
        panel2: "#111a2e",
        brand: "#f59e0b",
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
      },
    },
  },
  plugins: [],
};
