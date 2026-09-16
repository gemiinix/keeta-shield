/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{ts,tsx,js,jsx}',
    './src/app/**/*.{ts,tsx,js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Paleta "Operação Viva" — tema claro único
        ink: '#14201D', // texto / grafite
        'keeta-yellow': '#FFD600',
        'keeta-teal': '#19B394',
        'keeta-teal-dark': '#0F8A73',
        'keeta-yellow-dark': '#D9B400',
        surface: '#F4F7F6', // superfície suave
        line: '#E4EAE8', // bordas
        // Estados semânticos de prazo
        'danger-red': '#C03526',
        'danger-bg': '#FBEBE9',
        'warn-amber': '#9A5B00',
        'warn-bg': '#FFF4DB',
      },
      fontFamily: {
        sans: ['var(--font-manrope)', 'system-ui', 'sans-serif'],
        display: ['var(--font-sora)', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '6px',
      },
      keyframes: {
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in-up': 'fade-in-up 0.15s ease-out',
      },
    },
  },
  plugins: [],
};
