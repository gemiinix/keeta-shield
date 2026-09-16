/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{ts,tsx,js,jsx}',
    './src/app/**/*.{ts,tsx,js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Identidade Keeta
        'keeta-yellow': '#FFD600',
        'keeta-teal': '#19B394',
        // Tons derivados para hover/estados
        'keeta-teal-dark': '#14826D',
        'keeta-yellow-dark': '#D9B400',
      },
      fontFamily: {
        sans: ['var(--font-poppins)', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'glow-teal': '0 0 24px rgba(25, 179, 148, 0.35)',
        'glow-yellow': '0 0 24px rgba(255, 214, 0, 0.25)',
      },
      keyframes: {
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in-up': 'fade-in-up 0.4s ease-out',
      },
    },
  },
  plugins: [],
};
