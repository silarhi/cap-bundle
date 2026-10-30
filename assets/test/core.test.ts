import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { configure, install, reset, solve } from '../src/core'
import { defineFakes, FakeCap, FakeWidget, render, resetFakes, submitted } from './fakes'

beforeAll(() => {
    defineFakes()
    install()
})

afterEach(resetFakes)

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

    it('leaves Turbo events to the Turbo adapter', async () => {
        const form = render(html)
        await solve(form)

        form.dispatchEvent(new CustomEvent('turbo:submit-end', { bubbles: true }))
        document.dispatchEvent(new CustomEvent('turbo:before-cache'))
        expect(new FormData(form).get('contact[cap]')).toBe('token-1')
    })

    it('clears the token when Cap expires it', async () => {
        const form = render(html)
        await solve(form)

        const widget = document.documentElement.querySelector(':scope > cap-widget') as FakeWidget
        widget.reset()
        expect(new FormData(form).get('contact[cap]')).toBe('')
    })

    it('does not solve again a challenge that has its token', async () => {
        const form = render(html)
        expect(await solve(form)).toBe(true)

        expect(await solve(form)).toBe(true)
        expect(FakeWidget.solves).toBe(1)
        expect(new FormData(form).get('contact[cap]')).toBe('token-1')
    })

    it('does not solve a challenge outside a form on focus', () => {
        render(`<input type="hidden" data-silarhi-cap="invisible" data-cap-api-endpoint="https://cap.test/key/">
            <button type="button">Not in a form</button>`)
        document.querySelector('button')?.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))

        expect(FakeCap.configs).toEqual([])
        expect(FakeWidget.solves).toBe(0)
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

    it('does not solve a widget the visitor solved while its script was loading', async () => {
        const form = render(html)
        const widget = form.querySelector('cap-widget') as FakeWidget
        widget.solve = vi.fn(() => Promise.resolve(undefined))

        const solved = solve(form)
        // Before customElements.whenDefined() settles
        widget.token = 'visitor-token'

        expect(await solved).toBe(true)
        expect(widget.solve).not.toHaveBeenCalled()
    })

    it('submits all the same when the challenge fails', async () => {
        FakeWidget.fail = true
        const form = render(html)
        const failed = vi.fn()
        form.addEventListener('cap:failed', failed)
        const done = submitted(form)

        form.requestSubmit()
        await done
        expect(failed).toHaveBeenCalledOnce()
    })

    it('resets the widgets of a form', async () => {
        const form = render(html)
        const widget = form.querySelector('cap-widget') as FakeWidget
        await widget.solve()

        reset(form)
        expect(widget.token).toBeNull()
    })
})

describe('several challenges on a page', () => {
    const html = `
        <form id="contact">
            <input type="hidden" name="contact[captcha]" data-silarhi-cap="invisible" data-cap-api-endpoint="https://cap.test/key/">
            <button type="submit">Send</button>
        </form>
        <form id="newsletter" novalidate>
            <cap-widget data-silarhi-cap="checkbox" data-cap-hidden-field-name="newsletter[captcha]"></cap-widget>
            <button type="submit">Subscribe</button>
        </form>`

    it('solves only the challenges of the submitted form', async () => {
        render(html)
        const contact = document.getElementById('contact') as HTMLFormElement
        const newsletter = document.getElementById('newsletter') as HTMLFormElement
        const done = submitted(newsletter)

        newsletter.requestSubmit()
        await done
        expect((newsletter.querySelector('cap-widget') as FakeWidget).token).toBe('token-1')
        expect(new FormData(contact).get('contact[captcha]')).toBe('')
        expect(FakeCap.configs).toEqual([])
    })

    it('gives each form its own token', async () => {
        render(html)
        const contact = document.getElementById('contact') as HTMLFormElement
        const newsletter = document.getElementById('newsletter') as HTMLFormElement

        expect(await solve(document.body)).toBe(true)
        const tokens = [
            new FormData(contact).get('contact[captcha]'),
            (newsletter.querySelector('cap-widget') as FakeWidget).token,
        ]
        expect(new Set(tokens).size).toBe(2)

        reset(newsletter)
        expect(new FormData(contact).get('contact[captcha]')).toBe(tokens[0])
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

describe('page lifecycle', () => {
    const html = `<form>
        <input type="hidden" name="contact[cap]" data-silarhi-cap="invisible" data-cap-api-endpoint="https://cap.test/key/">
    </form>`

    it('forgets the tokens of a page the back-forward cache restores', async () => {
        const form = render(html)
        await solve(form)

        window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: false }))
        expect(new FormData(form).get('contact[cap]')).toBe('token-1')
        window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }))
        expect(new FormData(form).get('contact[cap]')).toBe('')
    })

    it('does not submit a form that left the page while solving', async () => {
        const form = render(html)
        const solved = vi.fn()
        form.addEventListener('cap:solved', solved)
        const listener = vi.fn()
        form.addEventListener('submit', listener)

        form.requestSubmit()
        form.remove()
        await vi.waitFor(() => expect(solved).toHaveBeenCalledOnce())
        expect(listener).not.toHaveBeenCalled()
    })
})

describe('forms without Cap', () => {
    it('ignores a submit event that does not come from a form', () => {
        render('<div data-silarhi-cap="invisible"></div>')
        const element = document.querySelector('div') as HTMLDivElement
        const listener = vi.fn()
        element.addEventListener('submit', listener)
        const event = new Event('submit', { bubbles: true, cancelable: true })

        element.dispatchEvent(event)
        expect(listener).toHaveBeenCalledOnce()
        expect(event.defaultPrevented).toBe(false)
        expect(FakeCap.configs).toEqual([])
    })

    it('are left alone', () => {
        const form = render('<form><button type="submit">Send</button></form>')
        const listener = vi.fn((event: Event) => event.preventDefault())
        form.addEventListener('submit', listener)

        form.requestSubmit()
        expect(listener).toHaveBeenCalledOnce()
    })
})
