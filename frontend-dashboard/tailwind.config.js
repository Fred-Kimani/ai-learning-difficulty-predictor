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
                sans: ['"Fira Sans"', 'sans-serif'],
                mono: ['"Fira Code"', 'monospace'],
            },
            colors: {
                primary: {
                    DEFAULT: '#1E40AF',
                    light: '#3B82F6',
                    dark: '#1E3A8A',
                },
                accent: {
                    DEFAULT: '#F59E0B',
                }
            }
        },
    },
    plugins: [],
}