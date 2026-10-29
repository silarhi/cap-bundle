import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { installAdapters } from '../src/adapters'
import { install } from '../src/core'
import { defineFakes, type FakeWidget, render, resetFakes, submitted } from './fakes'

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
