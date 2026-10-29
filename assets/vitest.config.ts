import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        environment: 'jsdom',
        globals: false,
        include: ['test/**/*.test.ts'],
        coverage: {
            include: ['src/**'],
            // clover.xml for the coverage report of the CI, text for the terminal
            reporter: ['text', 'clover'],
        },
    },
})
