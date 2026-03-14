import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/features/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Nia brand — deep earth + warm gold + emergency crimson
        nia: {
          50:  "#fdf8f0",
          100: "#f9ecd8",
          200: "#f2d5a8",
          300: "#e8b96e",
          400: "#dd9a3c",
          500: "#c47f22",
          600: "#9e621a",
          700: "#7a4a16",
          800: "#5e3912",
          900: "#3d2409",
        },
        earth: {
          50:  "#f7f4f0",
          100: "#ede6da",
          200: "#d9ccb5",
          300: "#c0a988",
          400: "#a78a60",
          500: "#8f6f46",
          600: "#6e5335",
          700: "#533f28",
          800: "#3b2d1d",
          900: "#1e1710",
        },
        emergency: {
          50:  "#fff1f0",
          100: "#ffe0de",
          500: "#e63946",
          600: "#c1121f",
          700: "#9b000d",
        },
        stealth: {
          bg:    "#f8fafb",
          card:  "#ffffff",
          text:  "#1a2332",
          muted: "#6b7280",
          accent:"#10b981",
        },
      },
      fontFamily: {
        heading: ["var(--font-heading)", "serif"],
        body:    ["var(--font-body)", "sans-serif"],
        mono:    ["var(--font-mono)", "monospace"],
      },
      backgroundImage: {
        "nia-gradient": "linear-gradient(135deg, #3d2409 0%, #7a4a16 40%, #c47f22 100%)",
        "earth-texture": "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23c47f22' fill-opacity='0.04'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
      },
      boxShadow: {
        "nia-card": "0 2px 20px rgba(61, 36, 9, 0.08), 0 0 0 1px rgba(196, 127, 34, 0.06)",
        "nia-card-hover": "0 8px 40px rgba(61, 36, 9, 0.15), 0 0 0 1px rgba(196, 127, 34, 0.12)",
        "emergency": "0 0 0 3px rgba(230, 57, 70, 0.3), 0 4px 24px rgba(230, 57, 70, 0.25)",
        "glow": "0 0 30px rgba(196, 127, 34, 0.3)",
      },
      animation: {
        "pulse-slow":    "pulse 3s ease-in-out infinite",
        "float":         "float 6s ease-in-out infinite",
        "recording":     "recording 1.5s ease-in-out infinite",
        "slide-up":      "slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
        "fade-in":       "fadeIn 0.3s ease-out",
        "scale-in":      "scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
        "shimmer":       "shimmer 1.5s infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%":      { transform: "translateY(-10px)" },
        },
        recording: {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%":      { opacity: "0.4", transform: "scale(0.92)" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(16px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          from: { opacity: "0" },
          to:   { opacity: "1" },
        },
        scaleIn: {
          from: { opacity: "0", transform: "scale(0.95)" },
          to:   { opacity: "1", transform: "scale(1)" },
        },
        shimmer: {
          "0%":   { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
