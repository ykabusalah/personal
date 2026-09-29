// Tailwind only styles the ported draw app and admin islands; site pages use their own CSS.
// The colors and fonts point at the site's shared settings (src/styles/tokens.css), so the admin
// pages follow the seasonal accent like everything else.
export default {
  content: ['./src/islands/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: 'var(--ink)',
        muted: 'var(--muted)',
        line: 'var(--line)',
        accent: 'var(--accent)',
        'accent-ink': 'var(--accent-ink)',
        'on-accent': 'var(--on-accent)',
        'accent-soft': 'color-mix(in srgb, var(--accent) 14%, #fff)',
      },
      fontFamily: {
        body: 'var(--font-body)',
        display: 'var(--font-display)',
        hand: 'var(--font-hand)',
      },
    },
  },
  plugins: [],
};
