import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { install, loadWidget, solve } from '../src/core'
import { render, submitted } from './fakes'

// No fakes here: <cap-widget> is never defined, as when the widget script fails to load
beforeAll(install)

afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    document.body.innerHTML = ''
})

describe('a widget script that cannot be loaded', () => {
    it('is reported in the console', async () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => {})
        const element = document.createElement('cap-widget')
        element.dataset.silarhiCapScript = 'data:text/javascript,throw new Error("unreachable")'

        loadWidget(element)
        await vi.waitFor(() => expect(error).toHaveBeenCalledOnce())
        expect(error).toHaveBeenCalledWith('Cap: the widget script could not be loaded.', expect.any(Error))
    })

    it('fails both kinds of challenge after 10 seconds', async () => {
        vi.useFakeTimers()
        const form = render(`<form novalidate>
            <input type="hidden" name="contact[captcha]" data-silarhi-cap="invisible" data-cap-api-endpoint="https://cap.test/key/">
        </form>`)
        const widget = document.createElement('cap-widget')
        widget.dataset.silarhiCap = 'checkbox'

        let settled = false
        const results = Promise.all([solve(form), solve(widget)]).finally(() => {
            settled = true
        })
        await vi.advanceTimersByTimeAsync(9_999)
        expect(settled).toBe(false)

        await vi.advanceTimersByTimeAsync(1)
        expect(await results).toEqual([false, false])
        expect(new FormData(form).get('contact[captcha]')).toBe('')
    })

    it('submits the form all the same once it gives up, so that the server shows its error', async () => {
        vi.useFakeTimers()
        const form = render(`<form novalidate>
            <cap-widget data-silarhi-cap="checkbox" data-cap-hidden-field-name="contact[captcha]"></cap-widget>
        </form>`)
        const failed = vi.fn()
        form.addEventListener('cap:failed', failed)
        const done = submitted(form)

        form.requestSubmit()
        expect(form.getAttribute('aria-busy')).toBe('true')

        await vi.advanceTimersByTimeAsync(10_000)
        await done
        expect(failed).toHaveBeenCalledOnce()
        expect(form.hasAttribute('aria-busy')).toBe(false)
    })
})
