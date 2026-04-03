import type { Config } from "tailwindcss";

const config: Config & { daisyui: { themes: string[] } } = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {}
  },
  plugins: [require("daisyui")],
  daisyui: {
    themes: ["light", "dark"]
  }
};

export default config;
