// frontend/tailwind.config.ts
import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // غيّرها حسب الخط اللي مُعرّف في layout.tsx
        sans: ["var(--font-cairo)", "ui-sans-serif", "system-ui"],
      },
      boxShadow: { card: "0 4px 20px rgba(2,6,23,.06)" },
      borderRadius: { xl: "14px", "2xl": "20px" },
    },
  },
  darkMode: "class",
  plugins: [],
} satisfies Config;
