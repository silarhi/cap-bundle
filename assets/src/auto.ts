/**
 * The script CapType renders next to each challenge (public/cap.js, served from /bundles/silarhicap/cap.js): no build
 * step needed. A module runs once per page, however many forms render it and however many SPA visits follow.
 */
import { installAdapters } from './adapters'
import { configure, install, loadWidget, SELECTOR } from './core'

install()

// Every challenge carries the same application-wide settings: the first one is enough
const challenge = document.querySelector<HTMLElement>(SELECTOR)
if (challenge) {
    installAdapters(challenge)
    // Before the widget renders: it reads the nonce of its <style> when it connects
    configure(challenge)
    loadWidget(challenge)
}
