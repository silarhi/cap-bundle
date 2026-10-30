import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { installAdapters } from '../src/adapters'
import { installLive } from '../src/adapters/live'
import { install } from '../src/core'
import { defineFakes, FakeWidget, render, resetFakes, submitted } from './fakes'

/** A Live Component root whose set() resolves when the test says the request is over. */
function liveComponent(form: HTMLFormElement) {
    let finish: () => void = () => {}
    const calls: Array<[string, unknown, boolean | undefined]> = []
    const component = {
        set: vi.fn((model: string, value: unknown, reRender?: boolean) => {
            calls.push([model, value, reRender])
            return new Promise<void>((resolve) => {
                finish = resolve
            })
        }),
    }
    const root = form.closest('[data-controller~="live"]') as HTMLElement & { __component?: unknown }
    root.__component = component

    return { calls, finish: () => finish(), component }
}

const html = `<div data-controller="live">
    <form novalidate>
        <cap-widget data-silarhi-cap="checkbox" data-cap-hidden-field-name="contact[captcha]" data-live-ignore></cap-widget>
        <button type="submit">Send</button>
    </form>
</div>`

beforeAll(() => {
    defineFakes()
    install()
    const challenge = document.createElement('input')
    challenge.dataset.silarhiCapAdapters = 'live'
    installAdapters(challenge)
})

afterEach(resetFakes)

describe('Live Components adapter', () => {
    it('sends the token with the action of the submit, without a re-render', async () => {
        const form = render(html)
        const widget = form.querySelector('cap-widget') as FakeWidget
        await widget.solve()
        const live = liveComponent(form)
        const order: string[] = []
        live.component.set.mockImplementationOnce((model: string, value: unknown, reRender?: boolean) => {
            order.push('set')
            live.calls.push([model, value, reRender])
            return new Promise<void>(() => {})
        })
        form.addEventListener('submit', (event) => {
            order.push('action')
            event.preventDefault()
        })

        form.requestSubmit()
        expect(order).toEqual(['set', 'action'])
        expect(live.calls).toEqual([['contact[captcha]', 'token-1', false]])
    })

    it('forgets the token once the request that redeemed it is over', async () => {
        const form = render(html)
        const widget = form.querySelector('cap-widget') as FakeWidget
        await widget.solve()
        const live = liveComponent(form)
        form.addEventListener('submit', (event) => event.preventDefault())

        form.requestSubmit()
        expect(widget.token).toBe('token-1')

        live.finish()
        await vi.waitFor(() => expect(widget.token).toBeNull())
        expect(live.calls).toEqual([
            ['contact[captcha]', 'token-1', false],
            ['contact[captcha]', '', false],
        ])
    })

    it('waits for the core to solve the challenge', async () => {
        const form = render(html)
        const live = liveComponent(form)
        const done = submitted(form)

        form.requestSubmit()
        expect(live.calls).toEqual([])

        await done
        expect(live.calls).toEqual([['contact[captcha]', 'token-1', false]])
    })

    it('sends the token of an invisible challenge under the name of its input', async () => {
        const form = render(`<div data-controller="live">
            <form>
                <input type="hidden" name="contact[captcha]" data-silarhi-cap="invisible" data-cap-api-endpoint="https://cap.test/key/" data-live-ignore>
            </form>
        </div>`)
        const live = liveComponent(form)
        const done = submitted(form)

        form.requestSubmit()
        await done
        expect(live.calls).toEqual([['contact[captcha]', 'token-1', false]])
    })

    it('sends no empty token when a failed challenge is submitted all the same', async () => {
        FakeWidget.fail = true
        const form = render(html)
        const live = liveComponent(form)
        const done = submitted(form)

        form.requestSubmit()
        await done
        expect(live.calls).toEqual([])
    })

    it('skips a challenge without a model to set, and sends the others', async () => {
        const form = render(`<div data-controller="live">
            <form novalidate>
                <cap-widget data-silarhi-cap="checkbox"></cap-widget>
                <cap-widget data-silarhi-cap="checkbox" data-cap-hidden-field-name="contact[captcha]"></cap-widget>
            </form>
        </div>`)
        for (const widget of form.querySelectorAll<FakeWidget>('cap-widget')) {
            await widget.solve()
        }
        const live = liveComponent(form)
        form.addEventListener('submit', (event) => event.preventDefault())

        form.requestSubmit()
        expect(live.calls).toEqual([['contact[captcha]', 'token-2', false]])
    })

    it('sets the token once however many times it is installed', async () => {
        installLive()
        installLive()
        const form = render(html)
        await (form.querySelector('cap-widget') as FakeWidget).solve()
        const live = liveComponent(form)
        form.addEventListener('submit', (event) => event.preventDefault())

        form.requestSubmit()
        expect(live.calls).toEqual([['contact[captcha]', 'token-1', false]])
    })

    it('ignores a submit event that does not come from a form', () => {
        const root = render(html).closest('[data-controller~="live"]') as HTMLElement
        const live = liveComponent(root.querySelector('form') as HTMLFormElement)

        root.dispatchEvent(new Event('submit', { bubbles: true }))
        expect(live.component.set).not.toHaveBeenCalled()
    })

    it('leaves the forms outside a Live Component alone', async () => {
        const form = render(
            '<form novalidate><cap-widget data-silarhi-cap="checkbox" data-cap-hidden-field-name="f[c]"></cap-widget></form>'
        )
        await (form.querySelector('cap-widget') as FakeWidget).solve()
        const done = submitted(form)

        form.requestSubmit()
        await expect(done.then(() => true)).resolves.toBe(true)
    })
})
