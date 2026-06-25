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
          deepPurple: '#7B2CBF',
          mediumPurple: '#9D4EDD',
          lightPurple: '#C77DFF',
          accentPurple: '#A855F7',
          darkAccent: '#5A189A',
          
          // Re-mapped names for backward compatibility with class usages
          cyan: '#7B2CBF',
          indigo: '#9D4EDD',
          purple: '#C77DFF',
          gold: '#A855F7',
          amber: '#5A189A',
          cream: '#F3E8FF',
          
          emerald: '#10B981',
          rose: '#F43F5E',
        }
      },
      fontFamily: {
        sans: ['Outfit', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.5)',
        'glass-hover': '0 8px 32px 0 rgba(157, 78, 221, 0.12)',
      },
      backdropBlur: {
        'xs': '2px',
      }
    },
  },
  plugins: [],
}
