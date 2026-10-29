import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { installAdapters } from '../src/adapters'
import { install, solve } from '../src/core'
import { defineFakes, type FakeWidget, render, resetFakes } from './fakes'

const html = `<form>
    <input type="hidden" name="contact[captcha]" data-silarhi-cap="invisible" data-cap-api-endpoint="https://cap.test/key/">
    <cap-widget data-silarhi-cap="checkbox" data-cap-hidden-field-name="contact[other]"></cap-widget>
</form>`

beforeAll(() => {
    defineFakes()
    install()
    // As CapType renders it with `cap.adapters: [turbo]`
    const challenge = document.createElement('input')
    challenge.dataset.silarhiCapAdapters = 'turbo'
    installAdapters(challenge)
})

afterEach(resetFakes)

describe('Turbo adapter', () => {
    it('forgets the tokens of a form Turbo submitted', async () => {
        const form = render(html)
        await solve(form)
        expect(new FormData(form).get('contact[captcha]')).toBe('token-1')

        form.dispatchEvent(new CustomEvent('turbo:submit-end', { bubbles: true }))
        expect(new FormData(form).get('contact[captcha]')).toBe('')
        expect((form.querySelector('cap-widget') as FakeWidget).token).toBeNull()
    })

    it('keeps no token in the page Turbo caches', async () => {
        const form = render(html)
        await solve(form)

        document.dispatchEvent(new CustomEvent('turbo:before-cache'))
        expect(new FormData(form).get('contact[captcha]')).toBe('')
    })

    it('ignores adapters it does not know', () => {
        const challenge = document.createElement('input')
        challenge.dataset.silarhiCapAdapters = 'turbo htmx'

        expect(() => installAdapters(challenge)).not.toThrow()
    })
})
