import type { Config } from "tailwindcss";
const c = (v: string) => `rgb(var(--${v}) / <alpha-value>)`;
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: c("bg"), surface: c("surface"), ink: c("ink"), mute: c("mute"),
        line: c("line"), brand: c("brand"), soft: c("soft"),
        mint: c("mint"), plum: c("plum"), amber: c("amber"),
      },
      fontFamily: { sans: ['"Vazirmatn Variable"', "Vazirmatn", "system-ui", "sans-serif"] },
      borderRadius: { hero: "32px", row: "20px" },
      boxShadow: {
        card: "0 1px 0 rgb(var(--line) / .6), 0 12px 32px -18px rgb(var(--brand) / .35)",
        pop: "0 20px 60px -20px rgb(var(--ink) / .45)",
      },
    },
  },
  plugins: [],
} satisfies Config;
