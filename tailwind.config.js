/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1C2321",
        paper: "#F7F5EF",
        surface: "#FFFFFF",
        line: "#E4E0D4",
        primary: {
          50: "#EAF2ED",
          100: "#CFE3D6",
          400: "#3C7A5A",
          600: "#1F4D3A",
          700: "#16382A",
        },
        amber: {
          100: "#F6E6C8",
          500: "#B8863A",
          600: "#93692A",
        },
        status: {
          recorded: "#6B7280",
          verified: "#2563A8",
          paid: "#1F4D3A",
          rejected: "#A3312A",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        sm: "4px",
        md: "6px",
        lg: "10px",
      },
    },
  },
  plugins: [],
};
