import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        parchment: "#f6efde",
        ink: "#1f1a14",
        wine: "#7c2d3a",
        gold: "#c9a14a",
        olive: "#506548",
        sky: "#5b7a96",
      },
      fontFamily: {
        serif: ["ui-serif", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};
export default config;
