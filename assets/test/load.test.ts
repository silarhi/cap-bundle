import { expect, it, vi } from 'vitest'
import { loadWidget } from '../src/core'

// No fakes here: <cap-widget> is not defined until the script under test defines it
const script = `data:text/javascript,${encodeURIComponent(
    "customElements.define('cap-widget', class extends HTMLElement {}); window.loads = (window.loads ?? 0) + 1"
)}`

function challenge(src?: string): HTMLElement {
    const element = document.createElement('cap-widget')
    if (src) {
        element.dataset.silarhiCapScript = src
    }

    return element
}

it('loads the widget script once, and not when cap-widget is defined already', async () => {
    const loads = () => (window as unknown as { loads?: number }).loads

    loadWidget(challenge())
    loadWidget(challenge(script))
    await customElements.whenDefined('cap-widget')
    expect(loads()).toBe(1)

    const error = vi.spyOn(console, 'error')
    loadWidget(challenge('data:text/javascript,throw new Error()'))
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(error).not.toHaveBeenCalled()
})
