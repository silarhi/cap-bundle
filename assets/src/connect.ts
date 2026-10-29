import { installAdapters } from './adapters'
import { configure, install, loadWidget } from './core'

/**
 * Everything a challenge needs once it is in the page: the submit handling, the adapters CapType lists, the widget
 * settings and the widget script. What the Stimulus controller and the bundle's script do, for any other way of
 * reacting to elements that show up (a listener library, Alpine, htmx...). Idempotent: call it for each challenge.
 */
export function connect(element: HTMLElement): void {
    install()
    installAdapters(element)
    // Before the widget renders: it reads the nonce of its <style> when it connects
    configure(element)
    loadWidget(element)
}
