import { expect, test } from '@playwright/test'

/*
 * Against a real Cap server: the challenge is solved in the browser, then redeemed by the server through /siteverify.
 * Export the CAP_ENDPOINT and CAP_SECRET_KEY of a site key first: tests/E2E/create-site-key.sh creates one.
 */

test('an invisible challenge is solved on submit, then accepted', async ({ page }) => {
    await page.goto('/')
    await page.fill('#invisible_name', 'Ann')
    await page.click('#invisible_send')

    await expect(page.locator('#result')).toHaveText('invisible accepted')
})

test('an invisible challenge is solved while the visitor fills the form', async ({ page }) => {
    await page.goto('/')
    await page.fill('#invisible_name', 'Ann')

    await expect(page.locator('#invisible_captcha')).toHaveValue(/^.+:.+:.+$/)
    await page.click('#invisible_send')
    await expect(page.locator('#result')).toHaveText('invisible accepted')
})

test('the checkbox widget is ticked, then accepted', async ({ page }) => {
    await page.goto('/')
    await page.fill('#checkbox_name', 'Bob')
    // Playwright reaches into the open shadow root of <cap-widget>
    await page.locator('#checkbox_captcha .captcha-trigger').click()

    // The widget posts its token in the hidden input it creates, under the name of the Symfony field
    await expect(page.locator('#checkbox_captcha input[name="checkbox[captcha]"]')).toHaveValue(/^.+:.+:.+$/)
    await page.click('#checkbox_send')
    await expect(page.locator('#result')).toHaveText('checkbox accepted')
})

test('an unticked checkbox widget is solved on submit in a novalidate form', async ({ page }) => {
    await page.goto('/')
    await page.fill('#checkbox_name', 'Bob')
    await page.click('#checkbox_send')

    await expect(page.locator('#result')).toHaveText('checkbox accepted')
})

test('a forged token is rejected by the Cap server', async ({ page }) => {
    await page.goto('/')
    await page.fill('#invisible_name', 'Eve')
    await page.locator('#invisible_captcha').evaluate((input: HTMLInputElement) => {
        input.value = 'forged:token:value'
    })
    await page.click('#invisible_send')

    await expect(page.locator('#result')).toHaveText('invisible rejected')
    await expect(page.getByText('The human verification failed, please try again.')).toBeVisible()
})

test('the widget and its solvers come from the application, not from a CDN', async ({ page, baseURL }) => {
    const origins = new Set<string>()
    const files: string[] = []
    page.on('request', (request) => {
        const url = new URL(request.url())
        origins.add(url.origin)
        files.push(url.pathname)
    })

    await page.goto('/')
    await page.fill('#checkbox_name', 'Bob')
    await page.locator('#checkbox_captcha .captcha-trigger').click()
    await expect(page.locator('#checkbox_captcha input[name="checkbox[captcha]"]')).toHaveValue(/^.+:.+:.+$/)

    expect(files).toContain('/bundles/silarhicap/widget/cap.min.js')
    expect(files.some((file) => file.startsWith('/bundles/silarhicap/widget/') && file.endsWith('.wasm'))).toBe(true)
    expect([...origins].sort()).toEqual(
        [new URL(String(baseURL)).origin, new URL(String(process.env.CAP_ENDPOINT)).origin].sort()
    )
})
