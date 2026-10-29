import { Application } from '@hotwired/stimulus'
import { afterEach, beforeAll, expect, it, vi } from 'vitest'
import Controller from '../src/controller'
import { defineFakes, type FakeWidget, render, resetFakes, submitted } from './fakes'

// The fake widget stands in for the package the controller loads
vi.mock('cap-widget', () => ({}))

const html = `<form novalidate>
    <cap-widget data-controller="silarhi--cap-bundle--cap" data-silarhi-cap="checkbox"
        data-cap-hidden-field-name="contact[captcha]" data-silarhi-cap-nonce="n0nce" data-silarhi-cap-adapters="turbo"
        data-action="click->silarhi--cap-bundle--cap#solve dblclick->silarhi--cap-bundle--cap#reset"></cap-widget>
    <button type="submit">Send</button>
</form>`

let application: Application

beforeAll(() => {
    defineFakes()
    application = Application.start()
    application.register('silarhi--cap-bundle--cap', Controller)
})

afterEach(resetFakes)

async function connected(): Promise<{ form: HTMLFormElement; widget: FakeWidget }> {
    const form = render(html)
    const widget = form.querySelector('cap-widget') as FakeWidget
    await vi.waitFor(() =>
        expect(application.getControllerForElementAndIdentifier(widget, 'silarhi--cap-bundle--cap')).not.toBeNull()
    )

    return { form, widget }
}

it('configures the widget and installs the submit handling and the adapters', async () => {
    const { form, widget } = await connected()
    expect(window.CAP_CSS_NONCE).toBe('n0nce')

    const done = submitted(form)
    form.requestSubmit()
    await done
    expect(widget.token).toBe('token-1')

    form.dispatchEvent(new CustomEvent('turbo:submit-end', { bubbles: true }))
    expect(widget.token).toBeNull()
})

it('solves and resets on demand', async () => {
    const { widget } = await connected()

    widget.click()
    await vi.waitFor(() => expect(widget.token).toBe('token-1'))
    widget.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
    expect(widget.token).toBeNull()
})
