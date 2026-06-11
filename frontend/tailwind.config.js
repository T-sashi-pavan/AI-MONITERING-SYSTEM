/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // Support administrative dark mode toggle
  theme: {
    extend: {
      colors: {
        dark: {
          950: '#06070A',
          900: '#090A0E',
          850: '#12131A',
          800: '#161722',
          700: '#1F202E',
          600: '#37394D',
        },
        brand: {
          cyan: '#F59E0B', // Re-map cyan to brand-amber for global accents
          indigo: '#FBBF24', // Re-map indigo to brand-gold
          purple: '#FEF08A', // Re-map purple to brand-cream
          emerald: '#10B981',
          rose: '#F43F5E',
          gold: '#FBBF24',
          amber: '#F59E0B',
          cream: '#FEF08A',
        }
      },
      fontFamily: {
        sans: ['Outfit', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.5)',
        'glass-hover': '0 8px 32px 0 rgba(245, 158, 11, 0.12)',
      },
      backdropBlur: {
        'xs': '2px',
      }
    },
  },
  plugins: [],
}
