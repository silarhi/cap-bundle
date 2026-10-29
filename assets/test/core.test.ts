import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { configure, install, reset, solve } from '../src/core'

/** Stands in for Cap's <cap-widget>: solve() succeeds with "token-<n>" unless `fail` is set. */
class FakeWidget extends HTMLElement {
    static fail = false
    static solves = 0
    token: string | null = null

    async solve() {
        FakeWidget.solves++
        await Promise.resolve()
        if (FakeWidget.fail) {
            this.dispatchEvent(new CustomEvent('error', { detail: { message: 'failed' } }))
            return undefined
        }
        this.token = `token-${FakeWidget.solves}`
        this.dispatchEvent(new CustomEvent('solve', { detail: { token: this.token } }))
        return { success: true, token: this.token }
    }

    reset() {
        this.token = null
        this.dispatchEvent(new CustomEvent('reset'))
    }
}

/** Stands in for Cap's programmatic mode, backed by a FakeWidget like the real one. */
class FakeCap {
    static configs: Array<Record<string, string>> = []
    readonly widget: FakeWidget

    constructor(config: Record<string, string>) {
        FakeCap.configs.push(config)
        this.widget = document.createElement('cap-widget') as FakeWidget
        document.documentElement.appendChild(this.widget)
    }

    get token() {
        return this.widget.token
    }

    solve() {
        return this.widget.solve()
    }

    reset() {
        this.widget.reset()
    }

    addEventListener(type: string, listener: EventListener) {
        this.widget.addEventListener(type, listener)
    }
}

/** Resolves once the form reaches its own submit listeners, i.e. once Cap let it through. */
function submitted(form: HTMLFormElement): Promise<SubmitEvent> {
    return new Promise((resolve) => {
        form.addEventListener(
            'submit',
            (event) => {
                event.preventDefault()
                resolve(event)
            },
            { once: true }
        )
    })
}

function render(html: string): HTMLFormElement {
    document.body.innerHTML = html
    return document.querySelector('form') as HTMLFormElement
}

beforeAll(() => {
    customElements.define('cap-widget', FakeWidget)
    ;(window as unknown as { Cap: typeof FakeCap }).Cap = FakeCap
    install()
})

beforeEach(() => {
    FakeWidget.fail = false
    FakeWidget.solves = 0
    FakeCap.configs = []
})

afterEach(() => {
    document.body.innerHTML = ''
    for (const widget of document.documentElement.querySelectorAll(':scope > cap-widget')) {
        widget.remove()
    }
})

describe('invisible challenge', () => {
    const html = `<form>
        <input type="hidden" name="contact[cap]" data-silarhi-cap="invisible" data-cap-api-endpoint="https://cap.test/key/" data-cap-lang="fr">
        <button type="submit" name="send">Send</button>
    </form>`

    it('solves on submit, then submits the form with the token and the submitter', async () => {
        const form = render(html)
        const listener = vi.fn()
        form.addEventListener('submit', listener)
        const done = submitted(form)

        form.querySelector('button')?.click()
        expect(listener).not.toHaveBeenCalled()
        expect(form.getAttribute('aria-busy')).toBe('true')

        const event = await done
        expect(event.submitter).toBe(form.querySelector('button'))
        expect(new FormData(form).get('contact[cap]')).toBe('token-1')
        expect(form.hasAttribute('aria-busy')).toBe(false)
        expect(FakeCap.configs).toEqual([{ apiEndpoint: 'https://cap.test/key/', 'data-cap-lang': 'fr' }])
    })

    it('solves while the visitor fills the form', async () => {
        const form = render(html)
        form.querySelector('button')?.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))

        await vi.waitFor(() => expect(new FormData(form).get('contact[cap]')).toBe('token-1'))
        const done = submitted(form)
        form.requestSubmit()
        await done
        expect(FakeWidget.solves).toBe(1)
    })

    it('submits once however many times the visitor clicks while solving', async () => {
        const form = render(html)
        const listener = vi.fn((event: Event) => event.preventDefault())
        form.addEventListener('submit', listener)

        form.requestSubmit()
        form.requestSubmit()
        await vi.waitFor(() => expect(listener).toHaveBeenCalledTimes(1))
        expect(FakeWidget.solves).toBe(1)
    })

    it('submits all the same when the challenge fails, so that the server shows its error', async () => {
        FakeWidget.fail = true
        const form = render(html)
        const failed = vi.fn()
        form.addEventListener('cap:failed', failed)
        const done = submitted(form)

        form.requestSubmit()
        await done
        expect(failed).toHaveBeenCalledOnce()
        expect(new FormData(form).get('contact[cap]')).toBe('')
    })

    it('forgets the token Turbo submitted', async () => {
        const form = render(html)
        await solve(form)
        expect(new FormData(form).get('contact[cap]')).toBe('token-1')

        form.dispatchEvent(new CustomEvent('turbo:submit-end', { bubbles: true }))
        expect(new FormData(form).get('contact[cap]')).toBe('')
    })

    it('keeps no token in the page Turbo caches', async () => {
        const form = render(html)
        await solve(form)

        document.dispatchEvent(new CustomEvent('turbo:before-cache'))
        expect(new FormData(form).get('contact[cap]')).toBe('')
    })

    it('clears the token when Cap expires it', async () => {
        const form = render(html)
        await solve(form)

        const widget = document.documentElement.querySelector(':scope > cap-widget') as FakeWidget
        widget.reset()
        expect(new FormData(form).get('contact[cap]')).toBe('')
    })

    it('removes the hidden widget of a form that left the page', async () => {
        await solve(render(html))
        await solve(render(html))

        expect(document.documentElement.querySelectorAll(':scope > cap-widget')).toHaveLength(1)
    })
})

describe('checkbox challenge', () => {
    const html = `<form novalidate>
        <cap-widget data-silarhi-cap="checkbox" data-cap-hidden-field-name="contact[cap]"></cap-widget>
        <button type="submit">Send</button>
    </form>`

    it('lets a solved widget through', async () => {
        const form = render(html)
        const widget = form.querySelector('cap-widget') as FakeWidget
        await widget.solve()
        const listener = vi.fn((event: Event) => event.preventDefault())
        form.addEventListener('submit', listener)

        form.requestSubmit()
        expect(listener).toHaveBeenCalledOnce()
        expect(FakeWidget.solves).toBe(1)
    })

    it('solves a widget the visitor did not tick before submitting', async () => {
        const form = render(html)
        const done = submitted(form)

        form.requestSubmit()
        await done
        expect((form.querySelector('cap-widget') as FakeWidget).token).toBe('token-1')
    })

    it('waits for the solve the visitor started', async () => {
        const form = render(html)
        const widget = form.querySelector('cap-widget') as FakeWidget
        let finish: () => void = () => {}
        widget.solve = vi.fn(() => {
            // A solve already running: Cap returns at once and dispatches "solve" later
            finish = () => {
                widget.token = 'late-token'
                widget.dispatchEvent(new CustomEvent('solve'))
            }
            return Promise.resolve(undefined)
        })
        const listener = vi.fn((event: Event) => event.preventDefault())
        form.addEventListener('submit', listener)

        form.requestSubmit()
        await vi.waitFor(() => expect(widget.solve).toHaveBeenCalled())
        expect(listener).not.toHaveBeenCalled()

        finish()
        await vi.waitFor(() => expect(listener).toHaveBeenCalledOnce())
    })

    it('resets the widgets of a form', async () => {
        const form = render(html)
        const widget = form.querySelector('cap-widget') as FakeWidget
        await widget.solve()

        reset(form)
        expect(widget.token).toBeNull()
    })
})

describe('configure', () => {
    it('copies the first widget settings to the globals of the widget', () => {
        const element = document.createElement('cap-widget')
        element.dataset.silarhiCapWasmUrl = '/cap/cap_wasm_bg.wasm'
        element.dataset.silarhiCapNonce = 'abc'
        configure(element)

        const other = document.createElement('cap-widget')
        other.dataset.silarhiCapWasmUrl = '/other.wasm'
        configure(other)

        expect(window.CAP_CUSTOM_WASM_URL).toBe('/cap/cap_wasm_bg.wasm')
        expect(window.CAP_CSS_NONCE).toBe('abc')
        expect(window.CAP_SCRIPT_NONCE).toBe('abc')
        expect(window.CAP_CUSTOM_HASHWX_URL).toBeUndefined()
    })
})

describe('forms without Cap', () => {
    it('are left alone', () => {
        const form = render('<form><button type="submit">Send</button></form>')
        const listener = vi.fn((event: Event) => event.preventDefault())
        form.addEventListener('submit', listener)

        form.requestSubmit()
        expect(listener).toHaveBeenCalledOnce()
    })
})
