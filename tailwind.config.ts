import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "var(--border-default)",
        input: "var(--border-default)",
        ring: "var(--accent)",
        background: "var(--background)",
        foreground: "var(--text-primary)",
        primary: {
          DEFAULT: "var(--accent)",
          foreground: "#ffffff",
        },
        secondary: {
          DEFAULT: "var(--surface-sunken)",
          foreground: "var(--text-secondary)",
        },
        destructive: {
          DEFAULT: "var(--error)",
          foreground: "#ffffff",
        },
        muted: {
          DEFAULT: "var(--surface-sunken)",
          foreground: "var(--text-secondary)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "#ffffff",
        },
        popover: {
          DEFAULT: "var(--surface-overlay)",
          foreground: "var(--text-primary)",
        },
        card: {
          DEFAULT: "var(--surface-raised)",
          foreground: "var(--text-primary)",
        },
        success: "var(--success)",
        warning: "var(--warning)",
        error: "var(--error)",
      },
      borderRadius: {
        lg: "0.5rem",
        md: "0.375rem",
        sm: "0.25rem",
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Inter",
          "SF Pro Display",
          "Segoe UI",
          "Arial",
          "sans-serif",
        ],
        mono: ["SF Mono", "Fira Code", "Fira Mono", "Roboto Mono", "monospace"],
        serif: [
          "Instrument Serif",
          "Georgia",
          "Cambria",
          "Times New Roman",
          "serif",
        ],
      },
      spacing: {
        sidebar: "240px",
        topbar: "56px",
      },
      animation: {
        "fade-in-up": "fade-in-up 0.25s ease-out both",
        shimmer: "shimmer 1.5s infinite",
        "spin-slow": "spin 2s linear infinite",
      },
      keyframes: {
        "fade-in-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-400px 0" },
          "100%": { backgroundPosition: "400px 0" },
        },
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)",
        modal: "0 20px 60px rgba(0,0,0,0.15), 0 8px 25px rgba(0,0,0,0.1)",
        dropdown: "0 4px 16px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.06)",
      },
    },
  },
  plugins: [],
};

export default config;
