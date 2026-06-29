import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";

/** Explicit local imports — avoids picking up root Tailwind v4 postcss config */
export default {
  plugins: [tailwindcss, autoprefixer],
};