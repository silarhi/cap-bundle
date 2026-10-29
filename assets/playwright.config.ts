import { defineConfig, devices, type PlaywrightTestConfig } from '@playwright/test'

const port = Number(process.env.E2E_PORT ?? 8099)

const config: PlaywrightTestConfig = defineConfig({
    testDir: 'e2e',
    timeout: 60_000,
    retries: process.env.CI ? 1 : 0,
    reporter: process.env.CI ? [['github'], ['list']] : 'list',
    use: {
        baseURL: `http://127.0.0.1:${port}`,
        trace: 'retain-on-failure',
    },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
    webServer: {
        // The E2E kernel of the bundle, with the script of public/cap.js: build it first
        command: `php -S 127.0.0.1:${port} ../tests/E2E/router.php`,
        url: `http://127.0.0.1:${port}/bundles/silarhicap/cap.js`,
        reuseExistingServer: !process.env.CI,
        // php -S logs every connection on stderr
        stderr: 'ignore',
    },
})

export default config
