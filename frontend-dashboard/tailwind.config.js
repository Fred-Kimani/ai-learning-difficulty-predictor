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
                sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
                display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
                mono: ['"Fira Code"', 'ui-monospace', 'monospace'],
            },
            colors: {
                brand: {
                    DEFAULT: '#4f6df5',
                    soft: '#7b93f8',
                    deep: '#3a52c7',
                    wash: '#eef1fe',
                    'wash-dark': '#151a2e',
                },
                risk: {
                    high: '#d94f4f',
                    'high-soft': '#fdf0f0',
                    'high-wash': '#1a0f0f',
                    mid: '#c98a2e',
                    'mid-soft': '#fdf6ec',
                    'mid-wash': '#1a150a',
                    low: '#2d9a7a',
                    'low-soft': '#edf8f4',
                    'low-wash': '#0a1a15',
                },
                surface: {
                    DEFAULT: '#ffffff',
                    raised: '#f8f9fb',
                    sunken: '#f1f3f5',
                    dark: '#111318',
                    'dark-raised': '#181b22',
                    'dark-sunken': '#0d0f13',
                },
            },
            boxShadow: {
                'card': '0 1px 3px rgba(0,0,0,0.04), 0 8px 24px -4px rgba(0,0,0,0.05)',
                'card-hover': '0 2px 8px rgba(0,0,0,0.06), 0 20px 40px -8px rgba(0,0,0,0.08)',
                'card-dark': '0 1px 3px rgba(0,0,0,0.2), 0 8px 24px -4px rgba(0,0,0,0.3)',
                'card-dark-hover': '0 2px 8px rgba(0,0,0,0.3), 0 20px 40px -8px rgba(0,0,0,0.45)',
                'float': '0 24px 48px -12px rgba(0,0,0,0.12)',
                'glow-brand': '0 0 24px -4px rgba(79,109,245,0.25)',
                'glow-risk': '0 0 20px -4px rgba(217,79,79,0.3)',
                'inner-soft': 'inset 0 1px 2px rgba(0,0,0,0.04)',
            },
            keyframes: {
                'slide-up': {
                    '0%': { opacity: '0', transform: 'translateY(12px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                'scale-in': {
                    '0%': { opacity: '0', transform: 'scale(0.95)' },
                    '100%': { opacity: '1', transform: 'scale(1)' },
                },
                'pulse-soft': {
                    '0%, 100%': { opacity: '1' },
                    '50%': { opacity: '0.6' },
                },
            },
            animation: {
                'slide-up': 'slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
                'scale-in': 'scale-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
                'pulse-soft': 'pulse-soft 2.5s ease-in-out infinite',
            },
        },
    },
    plugins: [],
}