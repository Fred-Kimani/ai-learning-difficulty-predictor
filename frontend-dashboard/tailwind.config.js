/** @type {import('tailwindcss').Config} */
export default {
    darkMode: 'class',
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
                display: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
                mono: ['"Fira Code"', 'ui-monospace', 'monospace'],
            },
            colors: {
                brand: {
                    DEFAULT: '#2D6A4F',
                    soft: '#40916C',
                    deep: '#1B4332',
                    wash: '#EFF7F2',
                    'wash-dark': '#0D2818',
                },
                accent: {
                    DEFAULT: '#D4A373',
                    soft: '#E6CBA8',
                    deep: '#B8864A',
                    wash: '#FDF6ED',
                },
                risk: {
                    high: '#C0392B',
                    'high-soft': '#FDF2F0',
                    'high-wash': '#1C110F',
                    mid: '#CC8B3C',
                    'mid-soft': '#FDF6ED',
                    'mid-wash': '#1A150A',
                    low: '#27AE8F',
                    'low-soft': '#EDF8F5',
                    'low-wash': '#0A1A16',
                },
                surface: {
                    DEFAULT: '#FAFAF8',
                    raised: '#F5F5F0',
                    sunken: '#F0EFEA',
                    dark: '#141413',
                    'dark-raised': '#1E1E1C',
                    'dark-sunken': '#0C0C0B',
                },
            },
            boxShadow: {
                'card': '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)',
                'card-hover': '0 4px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)',
                'card-dark': '0 1px 3px rgba(0,0,0,0.2)',
                'card-dark-hover': '0 4px 12px rgba(0,0,0,0.3)',
                'float': '0 8px 24px rgba(0,0,0,0.08)',
                'glow-brand': '0 0 20px rgba(45,106,79,0.15)',
                'glow-risk': 'none',
                'inner-soft': 'inset 0 1px 2px rgba(0,0,0,0.04)',
            },
            borderRadius: {
                'sm': '3px',
                'DEFAULT': '6px',
                'md': '8px',
                'lg': '10px',
                'xl': '12px',
                '2xl': '14px',
                '3xl': '16px',
                'full': '9999px',
            },
            keyframes: {
                'pulse-soft': {
                    '0%, 100%': { opacity: '1' },
                    '50%': { opacity: '0.6' },
                },
            },
            animation: {
                'pulse-soft': 'pulse-soft 2.5s ease-in-out infinite',
            },
        },
    },
    plugins: [],
}