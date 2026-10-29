import { afterEach, beforeAll, expect, it } from 'vitest'
import { connect } from '../src'
import { defineFakes, render, resetFakes, submitted } from './fakes'

beforeAll(() => {
    defineFakes()
})

afterEach(resetFakes)

it('installs the submit handling and the adapters, and configures the widget, from a challenge', async () => {
    const form = render(`<form>
        <input type="hidden" name="contact[captcha]" data-silarhi-cap="invisible" data-cap-api-endpoint="https://cap.test/key/"
            data-silarhi-cap-adapters="turbo" data-silarhi-cap-nonce="n0nce" data-silarhi-cap-script="data:text/javascript,">
        <button type="submit">Send</button>
    </form>`)
    const challenge = form.querySelector<HTMLElement>('[data-silarhi-cap]') as HTMLElement
    // As a listener library connects each challenge it sees, more than once if the form is put back
    connect(challenge)
    connect(challenge)
    expect(window.CAP_CSS_NONCE).toBe('n0nce')

    const done = submitted(form)
    form.requestSubmit()
    await done
    expect(new FormData(form).get('contact[captcha]')).toBe('token-1')

    form.dispatchEvent(new CustomEvent('turbo:submit-end', { bubbles: true }))
    expect(new FormData(form).get('contact[captcha]')).toBe('')
})
