import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { defineFakes, render, resetFakes, submitted } from './fakes'

beforeAll(() => {
    defineFakes()
})

// Each test loads the script anew, as another page would
beforeEach(() => {
    vi.resetModules()
})

afterEach(resetFakes)

it('only installs the submit handling on a page without a challenge', async () => {
    await import('../src/auto')
    expect(window.CAP_CUSTOM_WASM_URL).toBeUndefined()

    // A challenge a SPA visit brings later
    const form = render(`<form>
        <input type="hidden" name="contact[captcha]" data-silarhi-cap="invisible" data-cap-api-endpoint="https://cap.test/key/">
        <button type="submit">Send</button>
    </form>`)
    const done = submitted(form)
    form.requestSubmit()
    await done
    expect(new FormData(form).get('contact[captcha]')).toBe('token-1')
})

it('installs the submit handling and the adapters, and configures the widget, from the first challenge', async () => {
    // As CapType renders it: the script of the bundle comes after the challenge
    const form = render(`<form>
        <input type="hidden" name="contact[captcha]" data-silarhi-cap="invisible" data-cap-api-endpoint="https://cap.test/key/"
            data-silarhi-cap-adapters="turbo" data-silarhi-cap-wasm-url="/cap.wasm"
            data-silarhi-cap-script="data:text/javascript,">
        <button type="submit">Send</button>
    </form>`)
    await import('../src/auto')
    expect(window.CAP_CUSTOM_WASM_URL).toBe('/cap.wasm')

    const done = submitted(form)
    form.requestSubmit()
    await done
    expect(new FormData(form).get('contact[captcha]')).toBe('token-1')

    form.dispatchEvent(new CustomEvent('turbo:submit-end', { bubbles: true }))
    expect(new FormData(form).get('contact[captcha]')).toBe('')
})
