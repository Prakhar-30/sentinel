import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/providers/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        mono: ["var(--font-mono)", "IBM Plex Mono", "Courier New", "monospace"],
        sans: ["var(--font-sans)", "Space Grotesk", "system-ui", "sans-serif"],
      },
      colors: {
        void:    "#080808",
        panel:   "#0f0f0f",
        raised:  "#161616",
        border:  "#2a2a2a",
        neon: {
          green: "#39FF14",
          amber: "#FFB800",
          red:   "#FF2D2D",
          cyan:  "#00F5FF",
        },
      },
      animation: {
        flicker:   "flicker 8s infinite",
        blink:     "blink 1s step-end infinite",
        "pulse-dot": "pulse-dot 2s infinite",
        "slide-up":  "slideUp 0.3s ease",
        "fade-in":   "fadeIn 0.4s ease",
      },
      keyframes: {
        flicker: {
          "0%, 100%": { opacity: "1" },
          "92%":      { opacity: "1" },
          "93%":      { opacity: "0.4" },
          "94%":      { opacity: "1" },
          "96%":      { opacity: "0.6" },
          "97%":      { opacity: "1" },
        },
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%":       { opacity: "0" },
        },
        "pulse-dot": {
          "0%":   { boxShadow: "0 0 0 0 rgba(57,255,20,0.6)" },
          "70%":  { boxShadow: "0 0 0 6px rgba(57,255,20,0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(57,255,20,0)" },
        },
        slideUp: {
          "0%":   { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          "0%":   { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
      boxShadow: {
        neon:    "0 0 20px rgba(57,255,20,0.4), 0 0 40px rgba(57,255,20,0.2)",
        "neon-sm": "0 0 10px rgba(57,255,20,0.3)",
        amber:   "0 0 20px rgba(255,184,0,0.4)",
        red:     "0 0 20px rgba(255,45,45,0.4)",
      },
    },
  },
  plugins: [],
};

export default config;