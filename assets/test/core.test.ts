import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { installAdapters } from '../src/adapters'
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

    it('waits for the solve the focus started when the visitor submits', async () => {
        const form = render(html)
        const done = submitted(form)

        form.querySelector('button')?.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
        form.requestSubmit()
        await done
        expect(new FormData(form).get('contact[cap]')).toBe('token-1')
        expect(FakeWidget.solves).toBe(1)
    })

    it('does not solve again on focus a challenge that has its token', async () => {
        const form = render(html)
        await solve(form)

        form.querySelector('button')?.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
        expect(FakeWidget.solves).toBe(1)
    })

    it('ignores a focus that does not come from an element', () => {
        render(html)
        document.dispatchEvent(new FocusEvent('focusin'))

        expect(FakeWidget.solves).toBe(0)
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

    it('solves again, with the same Cap, a challenge that failed', async () => {
        FakeWidget.fail = true
        const form = render(html)
        expect(await solve(form)).toBe(false)

        FakeWidget.fail = false
        expect(await solve(form)).toBe(true)
        expect(new FormData(form).get('contact[cap]')).toBe('token-2')
        expect(FakeCap.configs).toHaveLength(1)
    })

    it('keeps the hidden widgets of the challenges still on the page', async () => {
        const form = render(`<form>
            <input type="hidden" name="contact[cap]" data-silarhi-cap="invisible" data-cap-api-endpoint="https://cap.test/key/">
            <input type="hidden" name="contact[cap2]" data-silarhi-cap="invisible" data-cap-api-endpoint="https://cap.test/other/">
        </form>`)

        expect(await solve(form)).toBe(true)
        expect(document.documentElement.querySelectorAll(':scope > cap-widget')).toHaveLength(2)
        expect(new FormData(form).get('contact[cap]')).not.toBe(new FormData(form).get('contact[cap2]'))
    })

    it('gives Cap an empty endpoint when CapType rendered none', async () => {
        const form = render('<form><input type="hidden" name="contact[cap]" data-silarhi-cap="invisible"></form>')

        await solve(form)
        expect(FakeCap.configs).toEqual([{ apiEndpoint: '' }])
    })

    it('leaves Turbo events to the Turbo adapter', async () => {
        const form = render(html)
        // A challenge that lists no adapter
        installAdapters(form.querySelector('input') as HTMLInputElement)
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

    it('fails a widget whose solve() rejects', async () => {
        const form = render(html)
        const widget = form.querySelector('cap-widget') as FakeWidget
        widget.solve = vi.fn(() => Promise.reject(new Error('Worker crashed')))
        const failed = vi.fn()
        form.addEventListener('cap:failed', failed)
        const done = submitted(form)

        form.requestSubmit()
        await done
        expect(failed.mock.calls[0]?.[0].detail.error).toBeNull()
    })

    it('does not solve on focus, the widget does it on its own', () => {
        const form = render(html)
        form.querySelector('button')?.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))

        expect(FakeWidget.solves).toBe(0)
    })

    it('resets the widgets of a form', async () => {
        const form = render(html)
        const widget = form.querySelector('cap-widget') as FakeWidget
        await widget.solve()

        reset(form)
        expect(widget.token).toBeNull()
    })
})

describe('floating challenge', () => {
    const html = `<form novalidate>
        <div data-silarhi-cap-floating hidden>
            <cap-widget data-silarhi-cap="floating" data-cap-hidden-field-name="contact[cap]" data-silarhi-cap-position="bottom" data-silarhi-cap-offset="12"></cap-widget>
        </div>
        <button type="submit">Send</button>
    </form>`

    it('shows the widget next to the button while it solves, then hides it and submits', async () => {
        const form = render(html)
        const wrapper = form.querySelector('[data-silarhi-cap-floating]') as HTMLElement
        const button = form.querySelector('button') as HTMLButtonElement
        button.getBoundingClientRect = () => DOMRect.fromRect({ x: 100, y: 200, width: 80, height: 30 })
        const done = submitted(form)

        button.click()
        expect(wrapper.hidden).toBe(false)
        expect(wrapper.style.position).toBe('absolute')
        // 12px below the button: its bottom is at 230
        expect(wrapper.style.top).toBe('242px')

        const event = await done
        expect(event.submitter).toBe(button)
        expect(wrapper.hidden).toBe(true)
        expect((form.querySelector('cap-widget') as FakeWidget).token).toBe('token-1')
    })

    it('shows the widget 8px above the button by default', async () => {
        const form = render(`<form novalidate>
            <div data-silarhi-cap-floating hidden>
                <cap-widget data-silarhi-cap="floating" data-cap-hidden-field-name="contact[cap]"></cap-widget>
            </div>
            <button type="submit">Send</button>
        </form>`)
        const wrapper = form.querySelector('[data-silarhi-cap-floating]') as HTMLElement
        const button = form.querySelector('button') as HTMLButtonElement
        button.getBoundingClientRect = () => DOMRect.fromRect({ x: 100, y: 200, width: 80, height: 30 })
        const done = submitted(form)

        button.click()
        // jsdom lays nothing out: the wrapper is 0px high
        expect(wrapper.style.top).toBe('192px')
        expect(wrapper.style.left).toBe('140px')
        await done
    })

    describe('in a positioned container', () => {
        afterEach(() => {
            document.body.style.position = ''
        })

        /** jsdom has no layout: offsetParent is always null, getBoundingClientRect() always empty. */
        function place(form: HTMLFormElement, parent: Element, rect: DOMRect): void {
            const wrapper = form.querySelector('[data-silarhi-cap-floating]') as HTMLElement
            Object.defineProperty(wrapper, 'offsetParent', { get: () => parent })
            parent.getBoundingClientRect = () => rect
            ;(form.querySelector('button') as HTMLButtonElement).getBoundingClientRect = () =>
                DOMRect.fromRect({ x: 100, y: 200, width: 80, height: 30 })
        }

        it('places the widget in its offset parent', async () => {
            const form = render(`<div class="modal">${html}</div>`)
            place(form, form.parentElement as HTMLElement, DOMRect.fromRect({ x: 50, y: 100, width: 500, height: 500 }))
            const done = submitted(form)

            form.querySelector('button')?.click()
            const wrapper = form.querySelector('[data-silarhi-cap-floating]') as HTMLElement
            expect(wrapper.style.left).toBe('90px')
            expect(wrapper.style.top).toBe('142px')
            await done
        })

        it('places the widget in a positioned body', async () => {
            const form = render(html)
            document.body.style.position = 'relative'
            place(form, document.body, DOMRect.fromRect({ x: 0, y: -300, width: 1024, height: 2000 }))
            const done = submitted(form)

            form.querySelector('button')?.click()
            expect((form.querySelector('[data-silarhi-cap-floating]') as HTMLElement).style.top).toBe('542px')
            await done
        })

        it('places the widget in the document when the body is not positioned', async () => {
            const form = render(html)
            place(form, document.body, DOMRect.fromRect({ x: 0, y: -300, width: 1024, height: 2000 }))
            const done = submitted(form)

            form.querySelector('button')?.click()
            expect((form.querySelector('[data-silarhi-cap-floating]') as HTMLElement).style.top).toBe('242px')
            await done
        })
    })

    it('shows the widget where it is in a form without a submit button', async () => {
        const form = render(`<form novalidate>
            <div data-silarhi-cap-floating hidden>
                <cap-widget data-silarhi-cap="floating" data-cap-hidden-field-name="contact[cap]"></cap-widget>
            </div>
        </form>`)
        const wrapper = form.querySelector('[data-silarhi-cap-floating]') as HTMLElement
        const done = submitted(form)

        form.requestSubmit()
        expect(wrapper.hidden).toBe(false)
        expect(wrapper.style.position).toBe('')

        const event = await done
        expect(event.submitter).toBeNull()
        expect(wrapper.hidden).toBe(true)
    })

    it('solves and resets a widget rendered without its wrapper', async () => {
        const widget = document.createElement('cap-widget') as FakeWidget
        widget.dataset.silarhiCap = 'floating'
        document.body.append(widget)

        expect(await solve(widget)).toBe(true)
        expect(widget.token).toBe('token-1')

        reset(widget)
        expect(widget.token).toBeNull()
    })

    it('keeps a failed widget on the page, with its error', async () => {
        FakeWidget.fail = true
        const form = render(html)
        const done = submitted(form)

        form.requestSubmit()
        await done
        expect((form.querySelector('[data-silarhi-cap-floating]') as HTMLElement).hidden).toBe(false)
    })

    it('hides the widget again on reset', async () => {
        FakeWidget.fail = true
        const form = render(html)
        await solve(form)

        reset(form)
        expect((form.querySelector('[data-silarhi-cap-floating]') as HTMLElement).hidden).toBe(true)
    })
})

describe('events', () => {
    const html = `<form novalidate>
        <cap-widget data-silarhi-cap="checkbox" data-cap-hidden-field-name="contact[cap]"></cap-widget>
        <input type="hidden" name="contact[cap2]" data-silarhi-cap="invisible" data-cap-api-endpoint="https://cap.test/key/">
    </form>`

    it('names the challenges a form solves', async () => {
        const form = render(html)
        const fields = Array.from(form.querySelectorAll('[data-silarhi-cap]'))
        const solving = vi.fn()
        const solved = vi.fn()
        form.addEventListener('cap:solving', solving)
        form.addEventListener('cap:solved', solved)
        const done = submitted(form)

        form.requestSubmit()
        await done
        expect(solving.mock.calls[0]?.[0].detail).toEqual({ fields })
        expect(solved.mock.calls[0]?.[0].detail).toEqual({ fields })
    })

    it('gives the error of the challenge that failed', async () => {
        FakeWidget.fail = true
        const form = render(html)
        const failed = vi.fn()
        form.addEventListener('cap:failed', failed)
        const done = submitted(form)

        form.requestSubmit()
        await done
        expect(failed.mock.calls[0]?.[0].detail.error).toBe('failed')
    })

    it('reports the progress of each challenge on its form', async () => {
        const form = render(html)
        const progress = vi.fn((event: CustomEvent) => [event.detail.field.tagName, event.detail.progress])
        form.addEventListener('cap:progress', progress as unknown as EventListener)

        await solve(form)
        expect(progress.mock.results.map((result) => result.value)).toEqual([
            ['CAP-WIDGET', 0],
            ['INPUT', 0],
            ['CAP-WIDGET', 100],
            ['INPUT', 100],
        ])
    })

    it('gives no error when Cap words none', async () => {
        const form = render(html)
        const widget = form.querySelector('cap-widget') as FakeWidget
        widget.solve = vi.fn(async () => {
            widget.dispatchEvent(new CustomEvent('error', { detail: { message: 404 } }))
            return undefined
        })
        const failed = vi.fn()
        form.addEventListener('cap:failed', failed)

        const done = submitted(form)
        form.requestSubmit()
        await done
        expect(failed.mock.calls[0]?.[0].detail.error).toBeNull()
    })

    it.each([
        ['an Error', () => Promise.reject(new Error('Network down')), 'Network down'],
        ['something else than an Error', () => Promise.reject('Network down'), null],
        [
            'an Error after an error event',
            function (this: FakeCap) {
                this.widget.dispatchEvent(new CustomEvent('error', { detail: { message: 'Invalid site key' } }))
                return Promise.reject(new Error('Network down'))
            },
            'Invalid site key',
        ],
    ])('gives the error of an invisible challenge whose solve() rejects with %s', async (_, rejected, error) => {
        const spy = vi.spyOn(FakeCap.prototype, 'solve').mockImplementationOnce(rejected)
        const form = render(`<form>
            <input type="hidden" name="contact[cap]" data-silarhi-cap="invisible" data-cap-api-endpoint="https://cap.test/key/">
        </form>`)
        const failed = vi.fn()
        form.addEventListener('cap:failed', failed)
        const done = submitted(form)

        form.requestSubmit()
        await done
        spy.mockRestore()
        expect(failed.mock.calls[0]?.[0].detail.error).toBe(error)
        expect(new FormData(form).get('contact[cap]')).toBe('')
    })

    it('ignores the progress events without a progress', () => {
        const form = render(html)
        const progress = vi.fn()
        form.addEventListener('cap:progress', progress)
        const widget = form.querySelector('cap-widget') as FakeWidget

        widget.dispatchEvent(new CustomEvent('progress', { detail: null }))
        widget.dispatchEvent(new CustomEvent('progress', { detail: { progress: '50' } }))
        expect(progress).not.toHaveBeenCalled()
    })

    it('reports the progress of a challenge outside a form on the challenge', () => {
        render('<cap-widget data-silarhi-cap="checkbox"></cap-widget>')
        const widget = document.querySelector('cap-widget') as FakeWidget
        const progress = vi.fn((event: CustomEvent) => event.detail)
        widget.addEventListener('cap:progress', progress as unknown as EventListener)

        widget.dispatchEvent(new CustomEvent('progress', { detail: { progress: 50 } }))
        expect(progress.mock.results[0]?.value).toEqual({ field: widget, progress: 50 })
    })

    it('ignores the progress events of other elements', () => {
        const form = render(`<form><video></video></form>`)
        const progress = vi.fn()
        form.addEventListener('cap:progress', progress)

        form.querySelector('video')?.dispatchEvent(new CustomEvent('progress', { detail: { progress: 50 } }))
        expect(progress).not.toHaveBeenCalled()
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
