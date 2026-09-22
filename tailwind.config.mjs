// Tailwind only styles the ported draw app and admin islands; site pages use their own CSS.
export default {
  content: ['./src/islands/**/*.{js,jsx}'],
  theme: { extend: {} },
  plugins: [],
};
